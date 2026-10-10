"""
Refresh the static MTA subway GTFS schedule and everything derived from it.

1. Downloads the current schedule (Config.MTA_GTFS_STATIC_URL).
2. Replaces the GTFS files in both data dirs: backend/data/gtfs (importer) and
   backend/app/data/gtfs (read by the API).
3. Reloads routes and stops into the database and rebuilds stop -> route links.
4. Regenerates the precomputed files the API uses when stop_times.txt isn't
   deployed: trip_patterns.json, route_stop_seq.json, route_stations.json.

The MTA republishes the schedule a few times a year; check calendar.txt's
end_date to see when it lapses. Run from backend/:  python scripts/refresh_gtfs.py
"""

import io
import json
import logging
import os
import sys
import zipfile

import requests

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, os.path.join(BACKEND_DIR, 'scripts'))

from config import Config  # noqa: E402

GTFS_DIRS = [
    os.path.join(BACKEND_DIR, 'data', 'gtfs'),
    os.path.join(BACKEND_DIR, 'app', 'data', 'gtfs'),
]
REQUIRED_FILES = ['routes.txt', 'stops.txt', 'trips.txt', 'stop_times.txt', 'shapes.txt', 'transfers.txt', 'calendar.txt']

logging.basicConfig(level=logging.WARNING)
log = print


def download():
    log(f"Downloading {Config.MTA_GTFS_STATIC_URL} ...")
    response = requests.get(Config.MTA_GTFS_STATIC_URL, timeout=120)
    response.raise_for_status()
    data = response.content
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        missing = [name for name in REQUIRED_FILES if name not in zf.namelist()]
        if missing:
            raise RuntimeError(f"Downloaded GTFS is missing {missing}")
    return data


def write_files(data):
    for gtfs_dir in GTFS_DIRS:
        os.makedirs(gtfs_dir, exist_ok=True)
        with open(os.path.join(gtfs_dir, 'google_transit.zip'), 'wb') as f:
            f.write(data)
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            for name in zf.namelist():
                if name.endswith('.txt'):
                    with open(os.path.join(gtfs_dir, name), 'wb') as f:
                        f.write(zf.read(name))
        log(f"Wrote GTFS files to {gtfs_dir}")


def reload_database(data):
    from import_gtfs_data import GTFSImporter
    from app import db
    from app.models.transit import StopRoute

    importer = GTFSImporter()  # pushes an app context
    parse = lambda name: importer.parse_gtfs_file(io.BytesIO(data), name)  # noqa: E731
    trips, stop_times = parse('trips.txt'), parse('stop_times.txt')

    importer.import_routes(parse('routes.txt'))
    importer.import_stops(parse('stops.txt'))
    # Rebuild links from scratch so stops a route no longer serves drop off
    StopRoute.query.delete()
    db.session.commit()
    count = importer.import_stop_routes(trips, stop_times)
    log(f"Reloaded routes and stops; {count} stop-route links")


def rebuild_precomputed():
    from app import create_app
    from app.routes import transit_routes
    import build_trip_patterns

    build_trip_patterns.main()

    app = create_app()
    api_gtfs_dir = GTFS_DIRS[1]
    with app.app_context():
        route_stop_seq = transit_routes._build_stop_count_lookup()
        with open(os.path.join(api_gtfs_dir, 'route_stop_seq.json'), 'w', encoding='utf-8') as f:
            json.dump(route_stop_seq, f, separators=(',', ':'))
        log(f"Wrote route_stop_seq.json ({len(route_stop_seq)} routes)")

        client = app.test_client()
        route_stations = {}
        for route_id in sorted(route_stop_seq):
            body = client.get(f'/api/route-stations/{route_id}').get_json()
            if body and body.get('success'):
                route_stations[route_id] = body['data']
        with open(os.path.join(api_gtfs_dir, 'route_stations.json'), 'w', encoding='utf-8') as f:
            json.dump(route_stations, f, separators=(',', ':'))
        log(f"Wrote route_stations.json ({len(route_stations)} routes)")


def main():
    data = download()
    write_files(data)
    reload_database(data)
    rebuild_precomputed()
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        calendar = zf.read('calendar.txt').decode().splitlines()
    end_dates = sorted({line.split(',')[-1] for line in calendar[1:] if line})
    log(f"Done. Schedule valid through {end_dates[-1] if end_dates else 'unknown'}")


if __name__ == '__main__':
    main()
