"""
Build app/data/crowd/riders_per_train.json: the typical number of riders on
board each train as it leaves each stop, by route, day type and hour.

Inputs
- MTA Subway Origin-Destination Ridership Estimate (data.ny.gov 28vm-gjqr):
  average trips between station complexes by hour, for one month.
- The static GTFS schedule (stop patterns, run times, trains per hour).
- mobile/src/assets/subway-stops.json for station complex -> GTFS stop ids.

Method
1. Route every origin/destination complex pair along the fastest path through
   the subway (a transfer costs TRANSFER_SECONDS).
2. Each leg of that path (board at A, ride to B) is shared by every route that
   runs from A to B, in proportion to how many trains each runs that hour.
3. Sum the riders on each route as it leaves each stop, then divide by that
   route's trains per hour there.

The OD data counts fare-paying entries only, so absolute loads are somewhat
low; levels are relative to approximate train capacity (see crowd_service).

Run from backend/:  python scripts/build_crowd_model.py [--year 2026 --month 8]
Downloads are cached in backend/data/od_cache/ (gitignored).
"""

import argparse
import csv
import heapq
import io
import json
import os
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

import requests

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GTFS_DIR = os.path.join(BACKEND_DIR, 'app', 'data', 'gtfs')
CACHE_DIR = os.path.join(BACKEND_DIR, 'data', 'od_cache')
OUTPUT_DIR = os.path.join(BACKEND_DIR, 'app', 'data', 'crowd')
STATIONS_FILE = os.path.join(os.path.dirname(BACKEND_DIR), 'mobile', 'src', 'assets', 'subway-stops.json')

OD_DATASET = 'https://data.ny.gov/resource/28vm-gjqr'
# One representative day per day type; Wednesday stands in for weekdays
DAY_TYPES = {'weekday': 'Wednesday', 'saturday': 'Saturday', 'sunday': 'Sunday'}
SERVICE_IDS = {'weekday': 'Weekday', 'saturday': 'Saturday', 'sunday': 'Sunday'}

TRANSFER_SECONDS = 600      # transfer penalty (walk + wait + reluctance)
DEFAULT_SEGMENT_SECONDS = 120
MIN_PATTERN_SHARE = 0.05    # ignore stop patterns run by <5% of a route's trips
PAGE_SIZE = 50000


# ---------------------------------------------------------------- download

# Summer and December ridership runs well below the rest of the year
ATYPICAL_MONTHS = {7, 8, 12}


def latest_month():
    """Most recent month in the dataset that represents typical ridership."""
    rows = requests.get(f'{OD_DATASET}.json', params={
        '$select': 'year,month', '$group': 'year,month', '$order': 'year DESC, month DESC',
    }, timeout=120).json()
    for row in rows:
        if int(row['month']) not in ATYPICAL_MONTHS:
            return int(row['year']), int(row['month'])
    return int(rows[0]['year']), int(rows[0]['month'])


def _download_hour(year, month, day, hour):
    path = os.path.join(CACHE_DIR, f'{year}-{month:02d}-{day}-{hour:02d}.csv')
    if os.path.exists(path):
        return path
    rows, offset = [], 0
    while True:
        response = requests.get(f'{OD_DATASET}.csv', params={
            '$select': 'origin_station_complex_id,destination_station_complex_id,estimated_average_ridership',
            '$where': f"year={year} and month={month} and day_of_week='{day}' and hour_of_day={hour}",
            '$order': ':id', '$limit': PAGE_SIZE, '$offset': offset,
        }, timeout=600)
        response.raise_for_status()
        page = list(csv.reader(io.StringIO(response.text)))[1:]
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    tmp = path + '.tmp'
    with open(tmp, 'w', newline='') as f:
        csv.writer(f).writerows(rows)
    os.replace(tmp, path)
    return path


def download(year, month):
    os.makedirs(CACHE_DIR, exist_ok=True)
    jobs = [(year, month, day, hour) for day in DAY_TYPES.values() for hour in range(24)]
    started = time.time()
    with ThreadPoolExecutor(max_workers=8) as pool:
        for i, _ in enumerate(pool.map(lambda job: _download_hour(*job), jobs), 1):
            if i % 12 == 0:
                print(f'  downloaded {i}/{len(jobs)} day-hours ({time.time() - started:.0f}s)')


def read_od(year, month, day):
    """Yield (origin_complex, destination_complex, hour, riders)."""
    for hour in range(24):
        with open(os.path.join(CACHE_DIR, f'{year}-{month:02d}-{day}-{hour:02d}.csv')) as f:
            for o, d, r in csv.reader(f):
                yield o, d, hour, float(r)


# ---------------------------------------------------------------- network

def load_network():
    with open(os.path.join(GTFS_DIR, 'trip_patterns.json')) as f:
        tp = json.load(f)
    segment_seconds = tp['segment_seconds']

    # Patterns worth routing over: route, direction, ordered directional stops
    patterns = []
    for route_id, by_dir in tp['patterns'].items():
        for direction, pats in by_dir.items():
            total = sum(p['trips'] for p in pats)
            for p in pats:
                if p['trips'] >= MIN_PATTERN_SHARE * total:
                    patterns.append((route_id, direction, p['stops']))

    with open(STATIONS_FILE) as f:
        features = json.load(f)['features']
    parent_to_complex = {
        feat['properties']['gtfs_stop_id']: feat['properties']['complex_id'] for feat in features
    }
    complex_stops = defaultdict(set)  # complex -> directional stop ids
    for _, _, stops in patterns:
        for s in stops:
            c = parent_to_complex.get(s[:-1])
            if c:
                complex_stops[c].add(s)
    return patterns, segment_seconds, parent_to_complex, complex_stops


def trains_per_hour():
    """(day_type, route, departing stop) -> [trains in each hour of the day]"""
    service_of = {}
    with open(os.path.join(GTFS_DIR, 'trips.txt')) as f:
        for row in csv.DictReader(f):
            for day_type, service_id in SERVICE_IDS.items():
                if row['service_id'] == service_id:
                    service_of[row['trip_id']] = (day_type, row['route_id'])
    by_trip = defaultdict(list)
    with open(os.path.join(GTFS_DIR, 'stop_times.txt')) as f:
        for row in csv.DictReader(f):
            if row['trip_id'] in service_of:
                by_trip[row['trip_id']].append((int(row['stop_sequence']), row['stop_id'], row['departure_time']))
    tph = defaultdict(lambda: [0] * 24)
    for trip_id, rows in by_trip.items():
        day_type, route_id = service_of[trip_id]
        rows.sort()
        for _, stop_id, dep in rows[:-1]:  # the last stop has no departure
            tph[(day_type, route_id, stop_id)][int(dep.split(':')[0]) % 24] += 1
    return tph


def shortest_paths(patterns, segment_seconds, complex_stops, parent_to_complex):
    """
    For every origin complex, the fastest path to every destination complex,
    as a list of legs (board_stop, alight_stop). State = (stop, route).
    """
    ride = defaultdict(list)            # (stop, route) -> [((next_stop, route), seconds)]
    departs = defaultdict(set)          # stop -> routes leaving it
    for route_id, _, stops in patterns:
        for a, b in zip(stops, stops[1:]):
            edge = ((b, route_id), segment_seconds.get(f'{a}>{b}', DEFAULT_SEGMENT_SECONDS))
            if edge not in ride[(a, route_id)]:
                ride[(a, route_id)].append(edge)
            departs[a].add(route_id)

    def stop_complex(stop):
        return parent_to_complex.get(stop[:-1])

    paths = {}
    for origin in complex_stops:
        dist, prev, heap = {}, {}, []
        for s in complex_stops[origin]:
            for r in departs[s]:
                dist[(s, r)] = 0
                heapq.heappush(heap, (0, s, r))
        best = {}  # destination complex -> arrival state
        while heap:
            d, s, r = heapq.heappop(heap)
            if d > dist.get((s, r), float('inf')):
                continue
            c = stop_complex(s)
            if c and c not in best:
                best[c] = (s, r)
            moves = list(ride[(s, r)])
            # Transfer to any other route/platform in the same complex
            if c:
                for s2 in complex_stops[c]:
                    for r2 in departs[s2]:
                        if (s2, r2) != (s, r) and r2 != r:
                            moves.append(((s2, r2), TRANSFER_SECONDS))
            for (s2, r2), w in moves:
                nd = d + w
                if nd < dist.get((s2, r2), float('inf')):
                    dist[(s2, r2)] = nd
                    prev[(s2, r2)] = (s, r)
                    heapq.heappush(heap, (nd, s2, r2))

        for dest, state in best.items():
            if dest == origin:
                continue
            # Walk back, splitting into legs wherever the route changes
            chain = [state]
            while chain[-1] in prev:
                chain.append(prev[chain[-1]])
            chain.reverse()
            legs, board = [], chain[0]
            for a, b in zip(chain, chain[1:]):
                if b[1] != a[1]:            # transfer: leg ended at a
                    if a[0] != board[0]:
                        legs.append((board[0], a[0]))
                    board = b
            if chain[-1][0] != board[0]:
                legs.append((board[0], chain[-1][0]))
            paths[(origin, dest)] = legs
    return paths


# ---------------------------------------------------------------- assignment

def build(year, month):
    patterns, segment_seconds, parent_to_complex, complex_stops = load_network()
    print(f'{len(patterns)} stop patterns, {len(complex_stops)} station complexes')
    tph = trains_per_hour()

    started = time.time()
    paths = shortest_paths(patterns, segment_seconds, complex_stops, parent_to_complex)
    print(f'Routed {len(paths)} station pairs ({time.time() - started:.0f}s)')

    # Which patterns run from A to B, and where: leg -> [(pattern index, i_a, i_b)]
    stop_index = [{s: i for i, s in enumerate(stops)} for _, _, stops in patterns]
    leg_options = {}

    def options(a, b):
        if (a, b) not in leg_options:
            opts = []
            for p, idx in enumerate(stop_index):
                ia, ib = idx.get(a), idx.get(b)
                if ia is not None and ib is not None and ia < ib:
                    opts.append((p, ia, ib))
            leg_options[(a, b)] = opts
        return leg_options[(a, b)]

    result = {}
    for day_type, day in DAY_TYPES.items():
        started = time.time()
        # 1. Riders per leg per hour
        leg_flow = defaultdict(float)
        for o, d, hour, riders in read_od(year, month, day):
            for leg in paths.get((o, d), ()):
                leg_flow[(leg, hour)] += riders

        # 2. Split each leg across the patterns serving it (by route frequency),
        #    accumulating with a difference array per pattern and hour
        diffs = defaultdict(lambda: defaultdict(float))  # (pattern, hour) -> {index: delta}
        for ((a, b), hour), riders in leg_flow.items():
            opts = options(a, b)
            if not opts:
                continue
            weights = [tph[(day_type, patterns[p][0], a)][hour] for p, _, _ in opts]
            # Patterns of one route share its trains; don't count them twice
            per_route = defaultdict(int)
            for (p, _, _), w in zip(opts, weights):
                per_route[patterns[p][0]] += 1
            weights = [w / per_route[patterns[p][0]] for (p, _, _), w in zip(opts, weights)]
            total = sum(weights) or 0
            if total == 0:
                weights, total = [1.0] * len(opts), float(len(opts))
            for (p, ia, ib), w in zip(opts, weights):
                share = riders * w / total
                diffs[(p, hour)][ia] += share
                diffs[(p, hour)][ib] -= share

        # 3. Riders leaving each stop -> riders per train
        load = defaultdict(lambda: [0.0] * 24)  # (route, stop) -> riders/hour leaving stop
        for (p, hour), delta in diffs.items():
            route_id, _, stops = patterns[p]
            running = 0.0
            for i, stop in enumerate(stops[:-1]):
                running += delta.get(i, 0.0)
                load[(route_id, stop)][hour] += running

        per_train = defaultdict(dict)
        for (route_id, stop), riders in load.items():
            trains = tph[(day_type, route_id, stop)]
            values = [round(r / t) if t else None for r, t in zip(riders, trains)]
            if any(v for v in values):
                per_train[route_id][stop] = values
        result[day_type] = per_train
        print(f'{day_type}: {len(leg_flow)} leg-hours, {sum(len(v) for v in per_train.values())} '
              f'route-stops ({time.time() - started:.0f}s)')

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output = {
        'source': f'MTA Subway Origin-Destination Ridership Estimate, {year}-{month:02d}',
        'riders_per_train': result,
    }
    path = os.path.join(OUTPUT_DIR, 'riders_per_train.json')
    with open(path, 'w') as f:
        json.dump(output, f, separators=(',', ':'))
    print(f'Wrote {path} ({os.path.getsize(path) // 1024} KB)')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--year', type=int)
    parser.add_argument('--month', type=int)
    parser.add_argument('--download-only', action='store_true')
    args = parser.parse_args()
    year, month = (args.year, args.month) if args.year and args.month else latest_month()
    print(f'Using OD data for {year}-{month:02d}')
    download(year, month)
    if not args.download_only:
        build(year, month)


if __name__ == '__main__':
    main()
