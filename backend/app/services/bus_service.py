"""
Live NYC bus data from MTA Bus Time.

Everything comes from Bus Time's APIs (no static bus GTFS needed):
  - OneBusAway "where" API: stops near a point, a route's stops and shape
  - SIRI StopMonitoring / VehicleMonitoring: arrivals, live position, and
    passenger counts on buses with automatic counters
  - GTFS-realtime vehiclePositions: every bus at once, for the map

Requires MTA_BUS_API_KEY in the app config.
"""
import logging
import math
import time
from datetime import datetime, timezone

import requests
from dateutil import parser as dateparser
from flask import current_app
from google.transit import gtfs_realtime_pb2

logger = logging.getLogger(__name__)

OBA_BASE = "https://bustime.mta.info/api/where"
SIRI_BASE = "https://bustime.mta.info/api/siri"
GTFSRT_VEHICLES = "https://gtfsrt.prod.obanyc.com/vehiclePositions"

# Bus Time refreshes positions roughly every 30s
LIVE_CACHE_SECONDS = 20
# Stops and route shapes rarely change
STATIC_CACHE_SECONDS = 6 * 60 * 60

# Largest area we'll look up stops for (degrees); the app only asks when zoomed in
MAX_SPAN_DEG = 0.04
MAX_VEHICLES = 400

_cache = {}  # key -> (expires_at, value)


class BusDataError(Exception):
    """Bus Time is unavailable or misconfigured; message is safe to show"""


def _cached(key, ttl, fetch):
    hit = _cache.get(key)
    now = time.time()
    if hit and hit[0] > now:
        return hit[1]
    value = fetch()
    _cache[key] = (now + ttl, value)
    # Keep the cache from growing without bound as people pan around
    if len(_cache) > 2000:
        for k in [k for k, (exp, _) in _cache.items() if exp <= now]:
            _cache.pop(k, None)
    return value


def _api_key():
    key = current_app.config.get("MTA_BUS_API_KEY")
    if not key:
        raise BusDataError("Bus data isn't set up (MTA_BUS_API_KEY missing)")
    return key


def _get(url, params=None, raw=False):
    params = dict(params or {}, key=_api_key())
    try:
        response = requests.get(url, params=params, timeout=10)
    except requests.RequestException as e:
        logger.warning(f"Bus Time request failed: {e}")
        raise BusDataError("Couldn't reach MTA Bus Time")
    if response.status_code != 200:
        logger.warning(f"Bus Time {url} returned HTTP {response.status_code}")
        raise BusDataError("MTA Bus Time returned an error")
    return response.content if raw else response.json()


# ---------- formatting helpers ----------

_KEEP_UPPER = {"GW", "SBS", "LIRR", "JFK", "LGA", "CUNY", "MTA", "US", "II", "III", "NYC", "PS", "HS"}


def pretty_name(name):
    """'W 42 ST/7 AV' -> 'W 42 St / 7 Av'"""
    if not name:
        return ""
    words = []
    for i, word in enumerate(name.replace("/", " / ").split()):
        if word.upper() in _KEEP_UPPER or word == "/":
            words.append(word.upper())
        elif i > 0 and word.lower() in _LOWER:
            words.append(word.lower())
        else:
            words.append(word.capitalize())
    return " ".join(words)


_LOWER = {"via", "and", "of", "to"}

_COMPASS = {
    "N": "Northbound", "S": "Southbound", "E": "Eastbound", "W": "Westbound",
    "NE": "Northeast-bound", "NW": "Northwest-bound",
    "SE": "Southeast-bound", "SW": "Southwest-bound",
}


def _strip_agency(ref):
    """'MTA NYCT_M42' -> 'M42', 'MTA_403240' -> '403240'"""
    return ref.split("_", 1)[1] if ref and "_" in ref else (ref or "")


def _first(value):
    """SIRI v1 gives strings, v2 gives lists; accept either"""
    if isinstance(value, list):
        return value[0] if value else None
    return value


def _minutes_until(iso_time, now):
    if not iso_time:
        return None
    try:
        when = dateparser.isoparse(iso_time)
    except (ValueError, TypeError):
        return None
    return max(0, int(round((when - now).total_seconds() / 60)))


# Bus Time's occupancy values -> the same levels the subway crowd bars use
_LOAD_LEVELS = {
    "manySeatsAvailable": ("low", "Plenty of seats"),
    "empty": ("low", "Plenty of seats"),
    "seatsAvailable": ("low", "Seats available"),
    "fewSeatsAvailable": ("medium", "A few seats left"),
    "standingAvailable": ("high", "Standing room only"),
    "standingRoomOnly": ("high", "Standing room only"),
    "crushedStandingRoomOnly": ("very_high", "Packed"),
    "full": ("very_high", "Full"),
    "notAcceptingPassengers": ("very_high", "Full"),
}

_GTFSRT_OCCUPANCY = {
    gtfs_realtime_pb2.VehiclePosition.EMPTY: "empty",
    gtfs_realtime_pb2.VehiclePosition.MANY_SEATS_AVAILABLE: "manySeatsAvailable",
    gtfs_realtime_pb2.VehiclePosition.FEW_SEATS_AVAILABLE: "fewSeatsAvailable",
    gtfs_realtime_pb2.VehiclePosition.STANDING_ROOM_ONLY: "standingRoomOnly",
    gtfs_realtime_pb2.VehiclePosition.CRUSHED_STANDING_ROOM_ONLY: "crushedStandingRoomOnly",
    gtfs_realtime_pb2.VehiclePosition.FULL: "full",
    gtfs_realtime_pb2.VehiclePosition.NOT_ACCEPTING_PASSENGERS: "notAcceptingPassengers",
}


def _crowd_from_capacities(extensions):
    """Live passenger count from the bus's automatic counter, when it has one"""
    caps = (extensions or {}).get("Capacities") or {}
    level = _LOAD_LEVELS.get(caps.get("EstimatedPassengerLoadFactor"))
    count = caps.get("EstimatedPassengerCount")
    capacity = caps.get("EstimatedPassengerCapacity")
    if not level and count is not None and capacity:
        ratio = count / capacity
        level = (("low", "Plenty of seats") if ratio < 0.4 else
                 ("medium", "A few seats left") if ratio < 0.65 else
                 ("high", "Standing room only") if ratio < 0.9 else
                 ("very_high", "Packed"))
    if not level:
        return None
    crowd = {"level": level[0], "label": level[1], "source": "live"}
    if count is not None:
        crowd["passengers"] = count
    if capacity:
        crowd["capacity"] = capacity
    return crowd


def _route_info(route):
    return {
        "id": route.get("id"),
        "short_name": route.get("shortName") or _strip_agency(route.get("id")),
        "long_name": route.get("longName") or "",
        "description": route.get("description") or "",
    }


# ---------- stops ----------

def stops_in_bounds(south, west, north, east):
    """Bus stops inside a map viewport"""
    lat_span = min(abs(north - south), MAX_SPAN_DEG)
    lon_span = min(abs(east - west), MAX_SPAN_DEG)
    lat = (north + south) / 2
    lon = (east + west) / 2
    # Snap to a grid so nearby pans share cache entries
    key = ("stops", round(lat, 3), round(lon, 3), round(lat_span, 3), round(lon_span, 3))

    def fetch():
        data = _get(f"{OBA_BASE}/stops-for-location.json", {
            "lat": lat, "lon": lon, "latSpan": lat_span, "lonSpan": lon_span, "maxCount": 250,
        })
        stops = []
        for stop in (data.get("data") or {}).get("stops", []):
            seen = set()
            routes = []
            for route in stop.get("routes", []):
                info = _route_info(route)
                if info["short_name"] not in seen:
                    seen.add(info["short_name"])
                    routes.append(info)
            stops.append({
                "id": stop.get("code") or _strip_agency(stop.get("id")),
                "name": pretty_name(stop.get("name")),
                "direction": _COMPASS.get(stop.get("direction") or "", ""),
                "latitude": stop.get("lat"),
                "longitude": stop.get("lon"),
                "routes": sorted(routes, key=lambda r: _route_sort_key(r["short_name"])),
            })
        return stops

    return _cached(key, STATIC_CACHE_SECONDS, fetch)


def _route_sort_key(name):
    """M7 before M42 before M101"""
    prefix = "".join(c for c in name if not c.isdigit())
    digits = "".join(c for c in name if c.isdigit())
    return (prefix, int(digits) if digits else 0, name)


# ---------- arrivals at a stop ----------

def _journey_status(journey, call):
    distances = (call.get("Extensions") or {}).get("Distances") or {}
    text = distances.get("PresentableDistance") or call.get("ArrivalProximityText") or ""
    progress = journey.get("ProgressStatus")
    progress = _first(progress) if progress else ""
    if progress and "layover" in progress:
        text = "At the terminal, leaving soon"
    elif progress and "prevTrip" in progress:
        text = "Finishing its previous trip"
    return text, distances.get("StopsFromCall")


def stop_arrivals(stop_id):
    """Upcoming buses at one stop, soonest first"""

    def fetch():
        data = _get(f"{SIRI_BASE}/stop-monitoring.json", {
            "MonitoringRef": stop_id,
            "MaximumStopVisits": 30,
        })
        delivery = (data.get("Siri", {}).get("ServiceDelivery", {})
                    .get("StopMonitoringDelivery") or [{}])[0]
        now = datetime.now(timezone.utc)
        arrivals = []
        for visit in delivery.get("MonitoredStopVisit", []):
            journey = visit.get("MonitoredVehicleJourney", {})
            call = journey.get("MonitoredCall", {})
            when = call.get("ExpectedArrivalTime") or call.get("ExpectedDepartureTime")
            distance_text, stops_away = _journey_status(journey, call)
            arrivals.append({
                "route": _first(journey.get("PublishedLineName")) or _strip_agency(journey.get("LineRef")),
                "route_id": journey.get("LineRef"),
                "destination": pretty_name(_first(journey.get("DestinationName"))),
                "minutes": _minutes_until(when, now),
                "distance_text": distance_text,
                "stops_away": stops_away,
                "vehicle_id": journey.get("VehicleRef"),
                "crowd": _crowd_from_capacities(call.get("Extensions")),
            })
        # Buses with a time first, soonest first; then ones only known by distance
        arrivals.sort(key=lambda a: (a["minutes"] is None, a["minutes"] or 0,
                                     a["stops_away"] if a["stops_away"] is not None else 99))
        return arrivals

    return _cached(("arrivals", stop_id), LIVE_CACHE_SECONDS, fetch)


# ---------- route shape + stops ----------

def _decode_polyline(encoded):
    """Google encoded polyline -> [[lon, lat], ...]"""
    coords, index, lat, lon = [], 0, 0, 0
    while index < len(encoded):
        for which in (0, 1):
            shift, result = 0, 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            delta = ~(result >> 1) if result & 1 else result >> 1
            if which == 0:
                lat += delta
            else:
                lon += delta
        coords.append([lon / 1e5, lat / 1e5])
    return coords


def route_details(route_id):
    """A route's shape per direction and coordinates of its stops"""

    def fetch():
        data = _get(f"{OBA_BASE}/stops-for-route/{requests.utils.quote(route_id)}.json", {
            "includePolylines": "true", "version": 2,
        })
        body = data.get("data") or {}
        stops = {
            _strip_agency(s["id"]): {
                "name": pretty_name(s.get("name")),
                "latitude": s.get("lat"),
                "longitude": s.get("lon"),
            }
            for s in (body.get("references") or {}).get("stops", [])
        }
        shapes = {}
        for grouping in (body.get("entry") or {}).get("stopGroupings", []):
            for group in grouping.get("stopGroups", []):
                lines = [_decode_polyline(p["points"]) for p in group.get("polylines", []) if p.get("points")]
                shapes[str(group.get("id"))] = [line for line in lines if len(line) > 1]
        return {"stops": stops, "shapes": shapes}

    return _cached(("route", route_id), STATIC_CACHE_SECONDS, fetch)


# ---------- one bus ----------

def bus_location(vehicle_id):
    """Live position, crowding, and next stops of one bus; None if it's not running"""
    data = _cached(("vehicle", vehicle_id), LIVE_CACHE_SECONDS, lambda: _get(
        f"{SIRI_BASE}/vehicle-monitoring.json", {
            "VehicleRef": vehicle_id,
            "VehicleMonitoringDetailLevel": "calls",
            "MaximumNumberOfCallsOnwards": 15,
        }))
    activity = (data.get("Siri", {}).get("ServiceDelivery", {})
                .get("VehicleMonitoringDelivery") or [{}])[0].get("VehicleActivity", [])
    if not activity:
        return None
    journey = activity[0].get("MonitoredVehicleJourney", {})
    location = journey.get("VehicleLocation") or {}
    if location.get("Latitude") is None:
        return None

    line_ref = journey.get("LineRef")
    try:
        route = route_details(line_ref) if line_ref else {"stops": {}, "shapes": {}}
    except BusDataError:
        route = {"stops": {}, "shapes": {}}

    now = datetime.now(timezone.utc)
    upcoming = []
    for call in (journey.get("OnwardCalls") or {}).get("OnwardCall", []):
        stop_id = _strip_agency(call.get("StopPointRef"))
        coords = route["stops"].get(stop_id, {})
        distances = (call.get("Extensions") or {}).get("Distances") or {}
        upcoming.append({
            "id": stop_id,
            "name": pretty_name(_first(call.get("StopPointName"))) or coords.get("name", ""),
            "latitude": coords.get("latitude"),
            "longitude": coords.get("longitude"),
            "minutes": _minutes_until(call.get("ExpectedArrivalTime"), now),
            "distance_text": distances.get("PresentableDistance") or "",
            "stops_away": distances.get("StopsFromCall"),
        })

    monitored = journey.get("MonitoredCall") or {}
    shape = route["shapes"].get(str(journey.get("DirectionRef")), [])
    return {
        "vehicle_id": vehicle_id,
        "route": _first(journey.get("PublishedLineName")) or _strip_agency(line_ref),
        "route_id": line_ref,
        "destination": pretty_name(_first(journey.get("DestinationName"))),
        "position": {"latitude": location["Latitude"], "longitude": location["Longitude"]},
        "bearing": journey.get("Bearing"),
        "crowd": _crowd_from_capacities(monitored.get("Extensions")),
        "upcoming_stops": upcoming,
        "path": shape,  # list of [lon, lat] lines for this direction
        "updated_at": int(time.time()),
    }


# ---------- every bus, for the map ----------

def _all_vehicles():
    def fetch():
        feed = gtfs_realtime_pb2.FeedMessage()
        feed.ParseFromString(_get(GTFSRT_VEHICLES, raw=True))
        vehicles = []
        for entity in feed.entity:
            if not entity.HasField("vehicle"):
                continue
            v = entity.vehicle
            if not v.HasField("position"):
                continue
            occupancy = _GTFSRT_OCCUPANCY.get(v.occupancy_status) if v.HasField("occupancy_status") else None
            vehicles.append({
                "id": v.vehicle.id or entity.id,
                "route": v.trip.route_id,
                "latitude": v.position.latitude,
                "longitude": v.position.longitude,
                "bearing": v.position.bearing if v.position.HasField("bearing") else None,
                "crowd_level": _LOAD_LEVELS[occupancy][0] if occupancy else None,
            })
        return vehicles

    return _cached(("vehicles",), LIVE_CACHE_SECONDS, fetch)


def vehicles_in_bounds(south, west, north, east):
    inside = [
        v for v in _all_vehicles()
        if south <= v["latitude"] <= north and west <= v["longitude"] <= east
    ]
    if len(inside) > MAX_VEHICLES:
        lat, lon = (north + south) / 2, (east + west) / 2
        inside.sort(key=lambda v: math.hypot(v["latitude"] - lat, v["longitude"] - lon))
        inside = inside[:MAX_VEHICLES]
    return inside


def route_shape(route_id):
    """Every line segment of a route (both directions), for drawing it on the map"""
    details = route_details(route_id)
    seen = set()
    lines = []
    for direction_lines in details["shapes"].values():
        for line in direction_lines:
            key = (tuple(line[0]), tuple(line[-1]), len(line))
            if key not in seen:
                seen.add(key)
                # 5 decimals (~1m) is plenty and keeps the payload small
                lines.append([[round(lon, 5), round(lat, 5)] for lon, lat in line])
    return {"id": route_id, "short_name": _strip_agency(route_id), "lines": lines}


def vehicles_on_routes(route_ids):
    """Every live bus on the given routes (ids like "MTA NYCT_M42" or "M42")"""
    wanted = {_strip_agency(r) for r in route_ids if r}
    return [v for v in _all_vehicles() if v["route"] in wanted]
