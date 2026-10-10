"""
Per-train crowding estimates.

Baseline: typical riders on board each route as it leaves each stop, by day
type and hour (app/data/crowd/riders_per_train.json, built by
scripts/build_crowd_model.py from MTA origin-destination ridership).

Live adjustment: a train running after a long gap picks up everyone who has
been waiting, and the one bunched right behind it runs emptier. We scale the
baseline by this train's gap to the train ahead relative to the typical gap
between trains on that route right now.
"""

import json
import os
import time
from datetime import datetime
from functools import lru_cache
from statistics import median

import pytz

CROWD_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'crowd', 'riders_per_train.json')
NYC = pytz.timezone('America/New_York')

# Approximate MTA guideline capacity per train (seated + standing), by route.
# A Division cars are ~51 ft (~110 riders each); most B Division trains are
# ~600 ft long (~1,400 riders).
TRAIN_CAPACITY = {
    **{r: 1100 for r in ['1', '2', '3', '4', '5', '6', '6X']},
    '7': 1210, '7X': 1210,
    'GS': 660, 'FS': 350, 'H': 580,
    'G': 700,
    **{r: 1160 for r in ['J', 'Z', 'L', 'M']},
}
DEFAULT_CAPACITY = 1400

# Share of capacity -> level. Seats run out at roughly a third of capacity.
LEVELS = [
    (0.35, 'low', 'Seats available'),
    (0.70, 'medium', 'Standing room'),
    (1.00, 'high', 'Crowded'),
    (float('inf'), 'very_high', 'Very crowded'),
]

MIN_GAP_FACTOR, MAX_GAP_FACTOR = 0.5, 2.0
STALE_SECONDS = 120

# The OD data only counts paid entries; the MTA has estimated roughly 10-15%
# of subway riders don't pay, so scale up to approximate everyone on board
FARE_EVASION_ADJUSTMENT = 1.12


@lru_cache(maxsize=1)
def _load():
    if not os.path.exists(CROWD_FILE):
        return {}
    with open(CROWD_FILE, encoding='utf-8') as f:
        return json.load(f)['riders_per_train']


def _day_type(when):
    return {5: 'saturday', 6: 'sunday'}.get(when.weekday(), 'weekday')


def baseline_riders(route_id, stop_id, timestamp):
    """Typical riders on a `route_id` train leaving `stop_id` at `timestamp` (unix)."""
    when = datetime.fromtimestamp(timestamp, NYC)
    table = _load().get(_day_type(when), {})
    by_stop = table.get(route_id) or table.get(route_id.rstrip('X'), {})
    hours = by_stop.get(stop_id)
    if not hours:
        return None
    value = hours[when.hour]
    if value is None:
        # No scheduled trains that hour in the data; use the nearest hour that has one
        for offset in (1, -1, 2, -2):
            value = hours[(when.hour + offset) % 24]
            if value is not None:
                break
    return value * FARE_EVASION_ADJUSTMENT if value is not None else None


def gap_factor(feed, trip_id, route_id, our_stops):
    """
    How much fuller/emptier than usual this train should be, from its spacing.
    `our_stops` is [(stop_id, predicted_time), ...] for this train. Compares
    our gap behind the train ahead with the median gap between consecutive
    trains of this route at the same stop. Returns 1.0 when unknown.
    """
    if feed is None:
        return 1.0
    # Stale entries (predictions long past, e.g. trips that ended) linger in
    # the feed; counting them as "the train ahead" makes gaps look huge
    cutoff = time.time() - STALE_SECONDS
    with_vehicle = {e.vehicle.trip.trip_id for e in feed.entity if e.HasField('vehicle')}
    others = []
    for entity in feed.entity:
        if not entity.HasField('trip_update'):
            continue
        tu = entity.trip_update
        if tu.trip.route_id != route_id or tu.trip.trip_id == trip_id:
            continue
        # No vehicle reporting and its predictions already slipping into the
        # past: a dead entry, not a real train ahead of us
        first = tu.stop_time_update[0] if tu.stop_time_update else None
        first_time = first and (first.arrival.time or first.departure.time)
        if tu.trip.trip_id not in with_vehicle and first_time and first_time < cutoff:
            continue
        others.append({
            stu.stop_id: t for stu in tu.stop_time_update
            if (t := stu.arrival.time or stu.departure.time) and t >= cutoff
        })

    # The train ahead has already passed our next stop, so use the first of our
    # stops that some train ahead still has to reach
    for stop_id, our_time in our_stops:
        if not our_time:
            continue
        times = sorted(t for o in others if (t := o.get(stop_id)))
        ahead = [t for t in times if t < our_time]
        if not ahead:
            continue
        series = sorted(times + [our_time])
        gaps = [b - a for a, b in zip(series, series[1:]) if b > a]
        typical = median(gaps) if len(gaps) >= 2 else None
        if not typical:
            return 1.0
        factor = (our_time - ahead[-1]) / typical
        return max(MIN_GAP_FACTOR, min(MAX_GAP_FACTOR, factor))
    return 1.0


def describe(route_id, riders):
    """Turn a rider count into the API's crowd payload."""
    if riders is None:
        return None
    capacity = TRAIN_CAPACITY.get(route_id, DEFAULT_CAPACITY)
    load = riders / capacity
    level, label = next((lvl, lab) for limit, lvl, lab in LEVELS if load < limit)
    return {
        'level': level,
        'label': label,
        'estimated_riders': int(round(riders)),
        'capacity': capacity,
        'load_factor': round(load, 2),
    }


def estimate(route_id, stop_id, timestamp, factor=1.0):
    """Crowding of a train leaving `stop_id`, or None if we have no data."""
    riders = baseline_riders(route_id, stop_id, timestamp)
    if riders is None:
        return None
    return describe(route_id, riders * factor)
