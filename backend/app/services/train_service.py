"""
Live position of a single train, built from the MTA GTFS-realtime feed.

The feed tells us, per trip, the next stop (vehicle.stop_id + current_status)
and predicted times for every remaining stop. It does not give coordinates, so
we match the trip to a scheduled stop pattern (scripts/build_trip_patterns.py)
to learn its previous stop, shape and scheduled run time for the current
segment, place the train along that segment by how much of the run time is
left, and snap the point onto the GTFS shape.
"""

import csv
import json
import math
import os
import re
import time
from collections import Counter
from functools import lru_cache

from app.services.realtime_service import RealtimeDataService

GTFS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'gtfs')

# GTFS-realtime VehicleStopStatus enum
INCOMING_AT, STOPPED_AT, IN_TRANSIT_TO = 0, 1, 2

# Average running speed between stations, used when the schedule has no run
# time for a segment (e.g. a stop added after this GTFS file was published)
FALLBACK_SPEED_MPS = 9.0


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
def _load_trip_patterns():
    """Stop patterns per route/direction and scheduled segment run times."""
    with open(os.path.join(GTFS_DIR, 'trip_patterns.json'), encoding='utf-8') as f:
        return json.load(f)


def _pattern_code(trip_id):
    """ "070250_A..N54R" -> "A..N54R"; identifies the branch/pattern on many lines."""
    return trip_id.split('_', 1)[-1]


def _match_pattern(route_id, direction, remaining_stop_ids, trip_id=''):
    """
    Pick the scheduled stop pattern that best explains the trip's remaining
    stops: the most remaining stops found in order, then the most common
    pattern. Live service can differ from the GTFS file (skipped or added
    stops), so an exact match isn't required.
    """
    patterns = _load_trip_patterns()['patterns'].get(route_id, {}).get(direction, [])
    # Live trip ids often carry the static shape id (e.g. "A..N54R"); prefer
    # those patterns so merged branches resolve to the right one
    same_shape = [p for p in patterns if p['shape_id'] and p['shape_id'] == _pattern_code(trip_id)]
    patterns = same_shape or patterns
    best, best_score = None, None
    for pattern in patterns:
        index = {sid: i for i, sid in enumerate(pattern['stops'])}
        matched, last = 0, -1
        for sid in remaining_stop_ids:
            i = index.get(sid)
            if i is not None and i > last:
                matched, last = matched + 1, i
        score = (matched, pattern['trips'])
        if matched and (best_score is None or score > best_score):
            best, best_score = pattern, score
    return best


def _previous_stop_from_live(feed, route_id, trip_id, remaining_stop_ids):
    """
    Ask the trains behind this one: any other trip on the same route whose
    remaining stops run through ours lists the stop just before our next stop.
    This reflects today's actual service (skipped or added stops, reroutes),
    which a static schedule can miss. Returns the most common answer, or None.
    """
    head = remaining_stop_ids[:3]
    code = _pattern_code(trip_id)
    same_pattern, same_route = Counter(), Counter()
    for entity in feed.entity:
        if not entity.HasField('trip_update'):
            continue
        trip = entity.trip_update.trip
        if trip.route_id != route_id or trip.trip_id == trip_id:
            continue
        stops = [stu.stop_id for stu in entity.trip_update.stop_time_update]
        if head[0] in stops:
            i = stops.index(head[0])
            if i > 0 and stops[i:i + len(head)] == head:
                same_route[stops[i - 1]] += 1
                if _pattern_code(trip.trip_id) == code:
                    same_pattern[stops[i - 1]] += 1
    # Where branches merge (e.g. the A from Lefferts vs Far Rockaway), only
    # trains on the same branch know the right previous stop
    votes = same_pattern or same_route
    return votes.most_common(1)[0][0] if votes else None


def _previous_stop_id(pattern, remaining_stop_ids):
    """
    The stop the train most recently left: the pattern's stop just before the
    first remaining stop that appears in the pattern.
    """
    if not pattern:
        return None
    stops = pattern['stops']
    for sid in remaining_stop_ids:
        if sid in stops:
            i = stops.index(sid)
            return stops[i - 1] if i > 0 else None
    return None


def _pick_shape(route_id, direction, trip_id):
    """
    Choose the GTFS shape for this trip. Realtime trip ids look like
    "062750_1..S03X015"; static shape ids look like "1..S03R". Prefer the
    shape sharing the longest prefix with the trip's pattern, falling back to
    the longest shape for the route and direction.
    """
    shapes = _load_shapes()
    pattern = trip_id.split('_', 1)[-1]
    # Express variants (6X, 7X, FX) share the local route's shapes; shuttles
    # use a single dot ("GS.N01R")
    for rid in (route_id, route_id.rstrip('X')):
        prefix = re.compile(rf"{re.escape(rid)}\.+{direction}")
        candidates = [sid for sid in shapes if prefix.match(sid)]
        if candidates:
            break
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
    # Stale feed entry: no vehicle reporting and every prediction long past
    if not vehicle and all(t and t < now - 120 for _, t in updates):
        return None
    upcoming = [s for s in (_stop_summary(sid, t, now) for sid, t in updates) if s]
    if not upcoming:
        return None

    next_stop = upcoming[0]
    status = vehicle.current_status if vehicle else IN_TRANSIT_TO
    direction = next_stop['id'][-1] if next_stop['id'][-1] in 'NS' else 'N'
    remaining_ids = [s['id'] for s in upcoming]
    pattern = _match_pattern(route_id, direction, remaining_ids, trip_id)
    prev_id = (_previous_stop_from_live(feed, route_id, trip_id, remaining_ids)
               or _previous_stop_id(pattern, remaining_ids))
    prev_stop = _stop_summary(prev_id) if prev_id else None

    shape = None
    if pattern and pattern.get('shape_id'):
        shape = _load_shapes().get(pattern['shape_id'])
    if not shape:
        shape = _pick_shape(route_id, direction, trip_id)

    if shape and prev_stop:
        start = _project_onto_shape(shape, prev_stop['latitude'], prev_stop['longitude'])
        end = _project_onto_shape(shape, next_stop['latitude'], next_stop['longitude'])

    # How far the train is between prev and next stop (0 = at prev, 1 = at next):
    # the share of this segment's scheduled run time that has elapsed, given
    # MTA's predicted arrival at the next stop.
    if status == STOPPED_AT or not prev_stop:
        progress = 1.0
    else:
        seconds_left = max(0, (updates[0][1] or now) - now)
        segment = _load_trip_patterns()['segment_seconds'].get(f"{prev_id}>{next_stop['id']}")
        if not segment:
            if shape:
                meters = abs(end - start)
            else:
                meters = math.hypot(*(a - b for a, b in zip(
                    _xy(prev_stop['latitude'], prev_stop['longitude'], prev_stop['latitude']),
                    _xy(next_stop['latitude'], next_stop['longitude'], prev_stop['latitude']))))
            segment = max(45, meters / FALLBACK_SPEED_MPS)
        progress = max(0.0, min(1.0, 1 - seconds_left / segment))

    if shape and prev_stop:
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
