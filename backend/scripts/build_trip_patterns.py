"""
Build app/data/gtfs/trip_patterns.json from the static GTFS schedule.

For every route + direction it records each distinct stop pattern (local,
express, each branch) with its shape and how many trips use it, plus the
median scheduled run time between every pair of consecutive stops. The train
tracker matches a live trip to one of these patterns by its remaining stops,
which works even when the live schedule no longer lines up with this GTFS
file's trip ids.

Run from backend/:  python scripts/build_trip_patterns.py
"""

import csv
import json
import os
import re
from collections import Counter, defaultdict
from statistics import median

GTFS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'app', 'data', 'gtfs')
OUTPUT = os.path.join(GTFS_DIR, 'trip_patterns.json')

# e.g. "...-Weekday-00_066900_7..N97R" or "..._036000_GS.N01R"
TRIP_ID_RE = re.compile(r'(\d{6})_([A-Z0-9]+)\.+([NS])')


def to_seconds(hms):
    h, m, s = (int(x) for x in hms.split(':'))
    return h * 3600 + m * 60 + s


def main():
    trips = {}
    with open(os.path.join(GTFS_DIR, 'trips.txt'), encoding='utf-8') as f:
        for row in csv.DictReader(f):
            m = TRIP_ID_RE.search(row['trip_id'])
            if m:
                trips[row['trip_id']] = (row['route_id'], m.group(3), row['shape_id'])

    stop_times = defaultdict(list)
    with open(os.path.join(GTFS_DIR, 'stop_times.txt'), encoding='utf-8') as f:
        for row in csv.DictReader(f):
            if row['trip_id'] in trips:
                stop_times[row['trip_id']].append(
                    (int(row['stop_sequence']), row['stop_id'], to_seconds(row['arrival_time']))
                )

    pattern_counts = defaultdict(Counter)   # (route, dir) -> Counter[(stops, shape)]
    segment_times = defaultdict(list)       # "A>B" -> [seconds, ...]
    for trip_id, rows in stop_times.items():
        route_id, direction, shape_id = trips[trip_id]
        rows.sort()
        stops = tuple(stop_id for _, stop_id, _ in rows)
        pattern_counts[(route_id, direction)][(stops, shape_id)] += 1
        for (_, a, ta), (_, b, tb) in zip(rows, rows[1:]):
            if tb > ta:
                segment_times[f"{a}>{b}"].append(tb - ta)

    patterns = defaultdict(dict)
    for (route_id, direction), counts in pattern_counts.items():
        patterns[route_id][direction] = [
            {'stops': list(stops), 'shape_id': shape_id, 'trips': n}
            for (stops, shape_id), n in counts.most_common()
        ]

    output = {
        'patterns': patterns,
        'segment_seconds': {k: int(median(v)) for k, v in segment_times.items()},
    }
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(output, f, separators=(',', ':'))

    n_patterns = sum(len(p) for d in patterns.values() for p in d.values())
    print(f"Wrote {n_patterns} patterns and {len(output['segment_seconds'])} segments to {OUTPUT}")


if __name__ == '__main__':
    main()
