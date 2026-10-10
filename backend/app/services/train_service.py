"""
Live position of a single train, built from the MTA GTFS-realtime feed.

The feed tells us, per trip, the next stop (vehicle.stop_id + current_status)
and predicted times for every remaining stop. It does not give coordinates, so
we place the train between its previous and next stop, interpolating by time,
and snap that point onto the GTFS shape for the line.
"""

import csv
import json
import math
import os
import time
from functools import lru_cache

from app.services.realtime_service import RealtimeDataService

GTFS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'gtfs')

# GTFS-realtime VehicleStopStatus enum
INCOMING_AT, STOPPED_AT, IN_TRANSIT_TO = 0, 1, 2

# Used when we can't infer how long the current segment takes
DEFAULT_SEGMENT_SECONDS = 120


@lru_cache(maxsize=1)
def _load_stops():
    """stop_id -> {id, name, latitude, longitude, parent_station}"""
    stops = {}
    with open(os.path.join(GTFS_DIR, 'stops.txt'), encoding='utf-8') as f:
        for row in csv.DictReader(f):
            stops[row['stop_id']] = {
                'id': row['stop_id'],
                'name': row['stop_name'],
                'latitude': float(row['stop_lat']),
                'longitude': float(row['stop_lon']),
                'parent_station': row.get('parent_station') or row['stop_id'],
            }
    return stops


@lru_cache(maxsize=1)
def _load_shapes():
    """shape_id -> [(lat, lon), ...] in sequence order"""
    points = {}
    with open(os.path.join(GTFS_DIR, 'shapes.txt'), encoding='utf-8') as f:
        for row in csv.DictReader(f):
            points.setdefault(row['shape_id'], []).append(
                (int(row['shape_pt_sequence']), float(row['shape_pt_lat']), float(row['shape_pt_lon']))
            )
    return {sid: [(lat, lon) for _, lat, lon in sorted(pts)] for sid, pts in points.items()}


@lru_cache(maxsize=1)
def _load_route_stop_seq():
    """route_id -> {directional stop_id: sequence number}"""
    with open(os.path.join(GTFS_DIR, 'route_stop_seq.json'), encoding='utf-8') as f:
        return json.load(f)


def _pick_shape(route_id, direction, trip_id):
    """
    Choose the GTFS shape for this trip. Realtime trip ids look like
    "062750_1..S03X015"; static shape ids look like "1..S03R". Prefer the
    shape sharing the longest prefix with the trip's pattern, falling back to
    the longest shape for the route and direction.
    """
    shapes = _load_shapes()
    pattern = trip_id.split('_', 1)[-1]
    prefix = f"{route_id}..{direction}"
    candidates = [sid for sid in shapes if sid.startswith(prefix)]
    if not candidates:
        return None

    def score(sid):
        common = 0
        for a, b in zip(sid, pattern):
            if a != b:
                break
            common += 1
        return (common, len(shapes[sid]))

    return shapes[max(candidates, key=score)]


def _xy(lat, lon, ref_lat):
    """Equirectangular projection in metres; plenty accurate within NYC."""
    k = 111_320
    return lon * k * math.cos(math.radians(ref_lat)), lat * k


def _project_onto_shape(shape, lat, lon):
    """Return distance along the shape (metres) of the closest point to (lat, lon)."""
    ref = shape[0][0]
    px, py = _xy(lat, lon, ref)
    best_d2, best_along, along = float('inf'), 0.0, 0.0
    for (alat, alon), (blat, blon) in zip(shape, shape[1:]):
        ax, ay = _xy(alat, alon, ref)
        bx, by = _xy(blat, blon, ref)
        dx, dy = bx - ax, by - ay
        seg2 = dx * dx + dy * dy
        t = 0.0 if seg2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg2))
        cx, cy = ax + t * dx, ay + t * dy
        d2 = (px - cx) ** 2 + (py - cy) ** 2
        if d2 < best_d2:
            best_d2, best_along = d2, along + t * math.sqrt(seg2)
        along += math.sqrt(seg2)
    return best_along


def _point_at_distance(shape, target):
    """Return (lat, lon) at `target` metres along the shape."""
    ref = shape[0][0]
    along = 0.0
    for (alat, alon), (blat, blon) in zip(shape, shape[1:]):
        ax, ay = _xy(alat, alon, ref)
        bx, by = _xy(blat, blon, ref)
        seg = math.hypot(bx - ax, by - ay)
        if along + seg >= target and seg > 0:
            t = (target - along) / seg
            return alat + t * (blat - alat), alon + t * (blon - alon)
        along += seg
    return shape[-1]


def _shape_slice(shape, start, end):
    """Shape points between two distances along it (used to draw the trip's remaining path)."""
    ref = shape[0][0]
    out = [_point_at_distance(shape, start)]
    along = 0.0
    for (alat, alon), (blat, blon) in zip(shape, shape[1:]):
        ax, ay = _xy(alat, alon, ref)
        bx, by = _xy(blat, blon, ref)
        along += math.hypot(bx - ax, by - ay)
        if start < along < end:
            out.append((blat, blon))
    out.append(_point_at_distance(shape, end))
    return out


def _previous_stop_id(route_id, next_stop_id):
    """The stop before `next_stop_id` on this route, in the same direction."""
    seq = _load_route_stop_seq().get(route_id, {})
    if next_stop_id not in seq:
        return None
    direction = next_stop_id[-1]
    earlier = [(n, sid) for sid, n in seq.items() if sid.endswith(direction) and n < seq[next_stop_id]]
    return max(earlier)[1] if earlier else None


def _stop_time(stu):
    if stu.HasField('arrival') and stu.arrival.time:
        return stu.arrival.time
    if stu.HasField('departure') and stu.departure.time:
        return stu.departure.time
    return None


def _stop_summary(stop_id, arrival_time=None, now=None):
    stop = _load_stops().get(stop_id)
    if not stop:
        return None
    out = dict(stop)
    if arrival_time:
        out['arrival_time'] = arrival_time
        out['minutes'] = max(0, (arrival_time - now) // 60)
    return out


def get_train(trip_id, route_id):
    """
    Locate one train. Returns None if the trip isn't in the live feed
    (e.g. it already finished its run).
    """
    service = RealtimeDataService()
    feed_id = next((fid for fid, routes in service.FEED_MAPPINGS.items() if route_id in routes), None)
    if not feed_id:
        return None
    feed = service._get_feed_data(feed_id)
    if not feed:
        return None

    trip_update, vehicle = None, None
    for entity in feed.entity:
        if entity.HasField('trip_update') and entity.trip_update.trip.trip_id == trip_id:
            trip_update = entity.trip_update
        elif entity.HasField('vehicle') and entity.vehicle.trip.trip_id == trip_id:
            vehicle = entity.vehicle
    if not trip_update or not trip_update.stop_time_update:
        return None

    now = int(time.time())
    updates = [(stu.stop_id, _stop_time(stu)) for stu in trip_update.stop_time_update]
    upcoming = [s for s in (_stop_summary(sid, t, now) for sid, t in updates) if s]
    if not upcoming:
        return None

    next_stop = upcoming[0]
    status = vehicle.current_status if vehicle else IN_TRANSIT_TO
    direction = next_stop['id'][-1] if next_stop['id'][-1] in 'NS' else 'N'
    prev_id = _previous_stop_id(route_id, next_stop['id'])
    prev_stop = _stop_summary(prev_id) if prev_id else None

    # How far the train is between prev and next stop (0 = at prev, 1 = at next).
    # The feed has no departure time for the previous stop, so estimate the
    # segment's duration from the next segment's predicted travel time.
    if status == STOPPED_AT or not prev_stop:
        progress = 1.0
    else:
        seconds_left = max(0, (updates[0][1] or now) - now)
        if len(updates) > 1 and updates[0][1] and updates[1][1]:
            segment = max(30, updates[1][1] - updates[0][1])
        else:
            segment = DEFAULT_SEGMENT_SECONDS
        progress = max(0.0, min(1.0, 1 - seconds_left / segment))

    shape = _pick_shape(route_id, direction, trip_id)
    if shape and prev_stop:
        start = _project_onto_shape(shape, prev_stop['latitude'], prev_stop['longitude'])
        end = _project_onto_shape(shape, next_stop['latitude'], next_stop['longitude'])
        lat, lon = _point_at_distance(shape, start + (end - start) * progress)
    elif prev_stop:
        lat = prev_stop['latitude'] + (next_stop['latitude'] - prev_stop['latitude']) * progress
        lon = prev_stop['longitude'] + (next_stop['longitude'] - prev_stop['longitude']) * progress
    else:
        lat, lon = next_stop['latitude'], next_stop['longitude']

    # Path the train still has to travel, for highlighting on the map
    if shape:
        here = _project_onto_shape(shape, lat, lon)
        last = upcoming[-1]
        terminus = _project_onto_shape(shape, last['latitude'], last['longitude'])
        path = _shape_slice(shape, here, terminus) if terminus > here else [(lat, lon)]
    else:
        path = [(lat, lon)] + [(s['latitude'], s['longitude']) for s in upcoming]

    return {
        'trip_id': trip_id,
        'route_id': route_id,
        'direction': service._get_direction_from_stop_id(next_stop['id'], trip_update.trip),
        'destination': upcoming[-1]['name'],
        'status': 'stopped_at' if status == STOPPED_AT else 'in_transit',
        'position': {'latitude': lat, 'longitude': lon},
        'previous_stop': prev_stop,
        'next_stop': next_stop,
        'upcoming_stops': upcoming,
        'path': [{'latitude': p[0], 'longitude': p[1]} for p in path],
        'updated_at': vehicle.timestamp if vehicle and vehicle.timestamp else now,
    }
