# backend/app/routes/transit_routes.py
from flask import Blueprint, jsonify, request, current_app
from app import db
from app.models.transit import Route, Stop, Trip, StopRoute
from app.services.gtfs_service import GTFSService
from app.services.realtime_service import RealtimeDataService
from datetime import datetime, timedelta
import json
import math
import logging
import csv
import os
from collections import defaultdict, deque

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

transit_bp = Blueprint('transit', __name__)

@transit_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'MTA Transit API'
    })

@transit_bp.route('/routes', methods=['GET'])
def get_routes():
    """Get all subway routes"""
    try:
        # Get only subway routes (route_type = 1)
        routes = Route.query.filter_by(route_type=1).all()
        return jsonify({
            'success': True,
            'data': [route.to_dict() for route in routes]
        })
    except Exception as e:
        logger.error(f"Error fetching routes: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch routes'
        }), 500

@transit_bp.route('/stops', methods=['GET'])
def get_stops():
    """Get all subway stops"""
    try:
        # Get only stops that are stations (location_type = 1) or have parent stations
        stops = Stop.query.filter(
            (Stop.location_type == 1) | (Stop.parent_station.isnot(None))
        ).all()
        
        # Group stops by parent station to avoid duplicates
        station_dict = {}
        for stop in stops:
            station_id = stop.parent_station or stop.id
            if station_id not in station_dict:
                station_dict[station_id] = stop
        
        # Convert to list and add route information
        stations = []
        for stop in station_dict.values():
            stop_data = stop.to_dict()
            # Get routes that serve this stop
            routes = stop.get_routes()
            
            # If no routes found for the main stop, check directional stops
            if not routes:
                # Look for directional stops (N/S suffixes)
                directional_stops = Stop.query.filter(
                    (Stop.id == stop.id + 'N') | (Stop.id == stop.id + 'S')
                ).all()
                
                for dir_stop in directional_stops:
                    dir_routes = dir_stop.get_routes()
                    for route in dir_routes:
                        # Check if route already added
                        if not any(r.id == route.id for r in routes):
                            routes.append(route)
            
            stop_data['routes'] = [route.to_dict() for route in routes]
            stations.append(stop_data)
        
        return jsonify({
            'success': True,
            'data': stations
        })
    except Exception as e:
        logger.error(f"Error fetching stops: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch stops'
        }), 500

@transit_bp.route('/stops/nearby', methods=['GET'])
def get_nearby_stops():
    """Get stops near a location"""
    try:
        lat = request.args.get('lat', type=float)
        lng = request.args.get('lng', type=float)
        radius = request.args.get('radius', 1.0, type=float)  # Default 1km radius
        
        if not lat or not lng:
            return jsonify({
                'success': False,
                'error': 'Latitude and longitude are required'
            }), 400
        
        # Simple distance calculation (in a real app, use proper geospatial queries)
        stops = Stop.query.filter_by(location_type=0).all()
        nearby_stops = []
        
        for stop in stops:
            # Calculate distance using Haversine formula (simplified)
            R = 6371  # Earth's radius in km
            
            lat1, lng1 = math.radians(lat), math.radians(lng)
            lat2, lng2 = math.radians(stop.latitude), math.radians(stop.longitude)
            
            dlat = lat2 - lat1
            dlng = lng2 - lng1
            
            a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2
            c = 2 * math.asin(math.sqrt(a))
            distance = R * c
            
            if distance <= radius:
                nearby_stops.append({
                    'id': stop.id,
                    'name': stop.name,
                    'latitude': stop.latitude,
                    'longitude': stop.longitude,
                    'distance_km': round(distance, 2)
                })
        
        # Sort by distance
        nearby_stops.sort(key=lambda x: x['distance_km'])
        
        return jsonify({
            'success': True,
            'data': nearby_stops[:20]  # Limit to 20 closest stops
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@transit_bp.route('/stops/<stop_id>/routes', methods=['GET'])
def get_stop_routes(stop_id):
    """Get routes that serve a specific stop"""
    try:
        stop = Stop.query.get(stop_id)
        if not stop:
            return jsonify({
                'success': False,
                'error': 'Stop not found'
            }), 404
        
        routes = stop.get_routes()
        return jsonify({
            'success': True,
            'data': [route.to_dict() for route in routes]
        })
    except Exception as e:
        logger.error(f"Error fetching stop routes: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch stop routes'
        }), 500

@transit_bp.route('/realtime/<stop_id>', methods=['GET'])
def get_realtime_updates(stop_id):
    """Get real-time arrival data for a specific stop or station (aggregates all child stops and transfer hub stops)"""
    try:
        # Get the stop
        stop = Stop.query.get(stop_id)
        if not stop:
            return jsonify({
                'success': False,
                'error': 'Stop not found'
            }), 404
        
        # --- 1. Build transfer groups from transfers.txt (same logic as /map/stations) ---
        gtfs_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'gtfs')
        transfers_file = os.path.join(gtfs_dir, 'transfers.txt')
        transfer_graph = defaultdict(set)
        if os.path.exists(transfers_file):
            with open(transfers_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    from_stop = row['from_stop_id']
                    to_stop = row['to_stop_id']
                    transfer_graph[from_stop].add(to_stop)
                    transfer_graph[to_stop].add(from_stop)
        
        # Find connected components (transfer hubs)
        stop_to_hub = {}
        hub_id_counter = 1
        visited = set()
        for s in transfer_graph:
            if s in visited:
                continue
            # BFS to find all connected stops
            queue = deque([s])
            group = set()
            while queue:
                current_stop = queue.popleft()
                if current_stop in visited:
                    continue
                visited.add(current_stop)
                group.add(current_stop)
                for neighbor in transfer_graph[current_stop]:
                    if neighbor not in visited:
                        queue.append(neighbor)
            # Assign a hub_id to all stops in this group
            hub_id = f"hub_{hub_id_counter}"
            for s in group:
                stop_to_hub[s] = hub_id
            hub_id_counter += 1
        
        # --- 2. Gather all relevant stop IDs ---
        stop_ids = [stop_id]
        
        # Check if this stop is part of a transfer hub
        hub_id = stop_to_hub.get(stop_id)
        if hub_id:
            # Add all other stops in the same hub
            for s, h in stop_to_hub.items():
                if h == hub_id and s != stop_id:
                    stop_ids.append(s)
        
        # If this is a parent station, add all child stops
        child_stops = Stop.query.filter(Stop.parent_station == stop_id).all()
        stop_ids += [child.id for child in child_stops]
        
        # Also add directional stops (N/S/E/W suffixes) if not already included
        for suffix in ['N', 'S', 'E', 'W']:
            dir_stop_id = stop_id + suffix
            if dir_stop_id not in stop_ids:
                dir_stop = Stop.query.get(dir_stop_id)
                if dir_stop:
                    stop_ids.append(dir_stop_id)
        
        # Remove duplicates
        stop_ids = list(set(stop_ids))
        
        # Get all unique routes that serve any of these stops
        route_ids = set()
        for sid in stop_ids:
            s = Stop.query.get(sid)
            if s:
                for route in s.get_routes():
                    route_ids.add(route.id)
        route_ids = list(route_ids)
        
        # Get real-time data for all these stop IDs
        realtime_service = RealtimeDataService()
        all_arrivals = []
        for sid in stop_ids:
            arrivals = realtime_service.get_arrivals_for_stop(sid, route_ids)
            for arr in arrivals:
                arr['stop_id'] = sid  # Tag which platform this arrival is for
            all_arrivals.extend(arrivals)
        
        # Sort by soonest arrival
        all_arrivals.sort(key=lambda x: x.get('arrival_time', 0))
        
        return jsonify({
            'success': True,
            'data': {
                'stop': stop.to_dict(),
                'arrivals': all_arrivals
            }
        })
    except Exception as e:
        logger.error(f"Error fetching real-time updates: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch real-time updates'
        }), 500

@transit_bp.route('/plan-trip', methods=['POST'])
def plan_trip():
    """Plan a trip between two stops"""
    try:
        data = request.get_json()
        origin_id = data.get('origin_id')
        destination_id = data.get('destination_id')
        
        if not origin_id or not destination_id:
            return jsonify({
                'success': False,
                'error': 'Origin and destination IDs are required'
            }), 400
        
        # Get the stops
        origin = Stop.query.get(origin_id)
        destination = Stop.query.get(destination_id)
        
        if not origin or not destination:
            return jsonify({
                'success': False,
                'error': 'Origin or destination stop not found'
            }), 404
        
        # For now, return a simple trip plan
        # In a real implementation, this would use a routing algorithm
        trip_plan = {
            'origin': origin.to_dict(),
            'destination': destination.to_dict(),
            'routes': [],
            'estimated_time': '15-20 minutes',
            'transfers': 0
        }
        
        # Find common routes between origin and destination
        origin_routes = set(route.id for route in origin.get_routes())
        dest_routes = set(route.id for route in destination.get_routes())
        common_routes = origin_routes.intersection(dest_routes)
        
        if common_routes:
            # Direct route available
            route = Route.query.get(list(common_routes)[0])
            trip_plan['routes'].append({
                'route': route.to_dict(),
                'type': 'direct'
            })
        else:
            # Need to find transfer options
            # This is a simplified version - real implementation would be more complex
            trip_plan['transfers'] = 1
            trip_plan['estimated_time'] = '25-35 minutes'
        
        return jsonify({
            'success': True,
            'data': trip_plan
        })
    except Exception as e:
        logger.error(f"Error planning trip: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to plan trip'
        }), 500

@transit_bp.route('/map/stations', methods=['GET'])
def get_map_stations():
    """Get all stations for the map view, with transfer hub grouping"""
    try:
        # --- 1. Build transfer groups from transfers.txt ---
        gtfs_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'gtfs')
        transfers_file = os.path.join(gtfs_dir, 'transfers.txt')
        transfer_graph = defaultdict(set)
        if os.path.exists(transfers_file):
            with open(transfers_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    from_stop = row['from_stop_id']
                    to_stop = row['to_stop_id']
                    transfer_graph[from_stop].add(to_stop)
                    transfer_graph[to_stop].add(from_stop)
        
        # Find connected components (transfer hubs)
        stop_to_hub = {}
        hub_id_counter = 1
        visited = set()
        for stop in transfer_graph:
            if stop in visited:
                continue
            # BFS to find all connected stops
            queue = deque([stop])
            group = set()
            while queue:
                s = queue.popleft()
                if s in visited:
                    continue
                visited.add(s)
                group.add(s)
                for neighbor in transfer_graph[s]:
                    if neighbor not in visited:
                        queue.append(neighbor)
            # Assign a hub_id to all stops in this group
            hub_id = f"hub_{hub_id_counter}"
            for s in group:
                stop_to_hub[s] = hub_id
            hub_id_counter += 1
        # Stops not in any transfer group get their own hub_id
        # (single stations)
        # --- 2. Get all stops that are stations or have parent stations ---
        stops = Stop.query.filter(
            (Stop.location_type == 1) | (Stop.parent_station.isnot(None))
        ).all()
        
        # Group by parent station to avoid duplicates
        station_dict = {}
        for stop in stops:
            station_id = stop.parent_station or stop.id
            if station_id not in station_dict:
                station_dict[station_id] = stop
        
        # Convert to list and add route information
        stations = []
        for stop in station_dict.values():
            stop_data = stop.to_dict()
            # Get routes that serve this stop
            routes = stop.get_routes()
            
            # If no routes found for the main stop, check directional stops
            if not routes:
                # Look for directional stops (N/S suffixes)
                directional_stops = Stop.query.filter(
                    (Stop.id == stop.id + 'N') | (Stop.id == stop.id + 'S')
                ).all()
                
                for dir_stop in directional_stops:
                    dir_routes = dir_stop.get_routes()
                    for route in dir_routes:
                        # Check if route already added
                        if not any(r.id == route.id for r in routes):
                            routes.append(route)
            stop_data['routes'] = [route.to_dict() for route in routes]
            # Assign hub_id: use stop.id or parent_station, then map to hub_id
            sid = stop.id
            hub_id = stop_to_hub.get(sid)
            if not hub_id:
                # Try parent_station
                parent = stop.parent_station
                if parent:
                    hub_id = stop_to_hub.get(parent)
            if not hub_id:
                # Not in any group, assign unique
                hub_id = f"hub_{sid}"
            stop_data['hub_id'] = hub_id
            stations.append(stop_data)
        
        return jsonify({
            'success': True,
            'data': stations
        })
    except Exception as e:
        logger.error(f"Error fetching map stations: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch map stations'
        }), 500

@transit_bp.route('/realtime/health', methods=['GET'])
def get_realtime_health():
    """Get health status of all real-time feeds"""
    try:
        realtime_service = RealtimeDataService()
        result = realtime_service.get_feed_health()
        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@transit_bp.route('/service-status', methods=['GET'])
def get_service_status():
    """Get current service status for all routes"""
    try:
        # Get all subway routes
        routes = Route.query.filter_by(route_type=1).all()
        
        # For demonstration, return mock service status with realistic issues
        status_data = []
        
        # Mock service issues for demonstration
        mock_issues = {
            '4': {'status': 'some_delays', 'message': 'Some Delays', 'color': '#ffbb33'},
            '5': {'status': 'significant_delays', 'message': 'Significant Delays', 'color': '#ff4444'},
            '6': {'status': 'stops_skipped', 'message': 'Stops Skipped', 'color': '#ff4444'},
            '7': {'status': 'rerouted', 'message': 'Rerouted', 'color': '#ff8800'},
            'A': {'status': 'some_delays', 'message': 'Some Delays', 'color': '#ffbb33'},
            'C': {'status': 'good_service', 'message': 'Good Service', 'color': '#00C851'},
            'E': {'status': 'good_service', 'message': 'Good Service', 'color': '#00C851'},
            'F': {'status': 'station_notice', 'message': 'Station Notice', 'color': '#ff8800'},
            'M': {'status': 'good_service', 'message': 'Good Service', 'color': '#00C851'},
            'N': {'status': 'some_delays', 'message': 'Some Delays', 'color': '#ffbb33'},
            'Q': {'status': 'good_service', 'message': 'Good Service', 'color': '#00C851'},
            'R': {'status': 'good_service', 'message': 'Good Service', 'color': '#00C851'},
            'W': {'status': 'good_service', 'message': 'Good Service', 'color': '#00C851'},
            'L': {'status': 'good_service', 'message': 'Good Service', 'color': '#00C851'},
            'G': {'status': 'good_service', 'message': 'Good Service', 'color': '#00C851'},
            'J': {'status': 'good_service', 'message': 'Good Service', 'color': '#00C851'},
            'Z': {'status': 'good_service', 'message': 'Good Service', 'color': '#00C851'},
            '1': {'status': 'good_service', 'message': 'Good Service', 'color': '#00C851'},
            '2': {'status': 'good_service', 'message': 'Good Service', 'color': '#00C851'},
            '3': {'status': 'good_service', 'message': 'Good Service', 'color': '#00C851'},
            '6X': {'status': 'good_service', 'message': 'Good Service', 'color': '#00C851'},
            '7X': {'status': 'good_service', 'message': 'Good Service', 'color': '#00C851'},
            'FX': {'status': 'good_service', 'message': 'Good Service', 'color': '#00C851'},
        }
        
        for route in routes:
            route_data = route.to_dict()
            
            # Use mock status if available, otherwise use unknown
            if route.short_name in mock_issues:
                route_data['status'] = mock_issues[route.short_name]
            else:
                route_data['status'] = {
                    'status': 'unknown',
                    'message': 'Unable to determine status',
                    'color': '#999999'
                }
            
            status_data.append(route_data)
        
        return jsonify({
            'success': True,
            'data': status_data
        })
    except Exception as e:
        logger.error(f"Error fetching service status: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch service status'
        }), 500

@transit_bp.route('/data/load', methods=['POST'])
def load_gtfs_data():
    """Load GTFS data into the database"""
    try:
        force_download = request.args.get('force', 'false').lower() == 'true'
        gtfs_service = GTFSService()
        
        # Download and extract GTFS data
        zip_path = gtfs_service.download_gtfs_data(force_download=force_download)
        txt_files = gtfs_service.extract_gtfs_data(zip_path)
        
        # Load data into database
        routes_loaded, routes_updated = gtfs_service.load_routes_to_db()
        stops_loaded, stops_updated = gtfs_service.load_stops_to_db()
        
        return jsonify({
            'success': True,
            'data': {
                'routes_loaded': routes_loaded,
                'routes_updated': routes_updated,
                'stops_loaded': stops_loaded,
                'stops_updated': stops_updated,
                'files_processed': txt_files
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@transit_bp.route('/data/stats', methods=['GET'])
def get_data_stats():
    """Get statistics about loaded data"""
    try:
        gtfs_service = GTFSService()
        stats = gtfs_service.get_data_stats()
        
        # Add database counts
        route_count = Route.query.count()
        stop_count = Stop.query.count()
        trip_count = Trip.query.count()
        
        stats.update({
            'database': {
                'routes': route_count,
                'stops': stop_count,
                'trips': trip_count
            }
        })
        
        return jsonify({
            'success': True,
            'data': stats
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@transit_bp.route('/route-shape/<route_id>', methods=['GET'])
def get_route_shape(route_id):
    """Return the ordered shape points for a route (using shapes.txt)"""
    # Find a representative shape_id for this route from trips.txt
    gtfs_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'gtfs')
    trips_file = os.path.join(gtfs_dir, 'trips.txt')
    shapes_file = os.path.join(gtfs_dir, 'shapes.txt')
    shape_id = None
    try:
        with open(trips_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['route_id'] == route_id and row.get('shape_id'):
                    shape_id = row['shape_id']
                    break
    except Exception as e:
        return jsonify({'success': False, 'error': f'Error reading trips.txt: {e}'})

    if not shape_id:
        return jsonify({'success': False, 'error': 'No shape_id found for this route'})

    # Get all shape points for this shape_id, ordered by shape_pt_sequence
    shape_points = []
    try:
        with open(shapes_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['shape_id'] == shape_id:
                    shape_points.append({
                        'lat': float(row['shape_pt_lat']),
                        'lon': float(row['shape_pt_lon']),
                        'seq': int(row['shape_pt_sequence'])
                    })
        shape_points.sort(key=lambda x: x['seq'])
    except Exception as e:
        return jsonify({'success': False, 'error': f'Error reading shapes.txt: {e}'})

    return jsonify({'success': True, 'data': [{'latitude': pt['lat'], 'longitude': pt['lon']} for pt in shape_points]})

@transit_bp.route('/route-stations/<route_id>', methods=['GET'])
def get_route_stations(route_id):
    """
    Return the ordered list of consecutive stations for a route using stop_times.txt and trips.txt.
    Combines stops from all trip patterns for the route to show the complete route.
    """
    gtfs_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'gtfs')
    trips_file = os.path.join(gtfs_dir, 'trips.txt')
    stop_times_file = os.path.join(gtfs_dir, 'stop_times.txt')
    stops_file = os.path.join(gtfs_dir, 'stops.txt')

    # 1. Find ALL trip_ids for this route
    trip_ids = []
    try:
        with open(trips_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['route_id'] == route_id:
                    trip_ids.append(row['trip_id'])
    except Exception as e:
        return jsonify({'success': False, 'error': f'Error reading trips.txt: {e}'})

    if not trip_ids:
        return jsonify({'success': False, 'error': 'No trip_ids found for this route'})

    # 2. Get all stop sequences for all trips
    all_stop_sequences = []
    try:
        with open(stop_times_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['trip_id'] in trip_ids:
                    all_stop_sequences.append((int(row['stop_sequence']), row['stop_id'], row['trip_id']))
    except Exception as e:
        return jsonify({'success': False, 'error': f'Error reading stop_times.txt: {e}'})

    # 3. Get full stop information for each stop_id
    stop_info = {}
    try:
        with open(stops_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                stop_info[row['stop_id']] = {
                    'id': row['stop_id'],
                    'name': row['stop_name'],
                    'latitude': float(row['stop_lat']),
                    'longitude': float(row['stop_lon']),
                    'parent_station': row.get('parent_station') or row['stop_id']
                }
    except Exception as e:
        return jsonify({'success': False, 'error': f'Error reading stops.txt: {e}'})

    # 4. Group stops by trip and find the longest/most complete trip pattern
    trip_stops = {}
    for seq, stop_id, trip_id in all_stop_sequences:
        if trip_id not in trip_stops:
            trip_stops[trip_id] = []
        trip_stops[trip_id].append((seq, stop_id))
    
    # Sort each trip's stops by sequence
    for trip_id in trip_stops:
        trip_stops[trip_id].sort()
        trip_stops[trip_id] = [sid for _, sid in trip_stops[trip_id]]

    # 5. Find the trip with the most stops (most complete route)
    longest_trip = max(trip_stops.keys(), key=lambda t: len(trip_stops[t]))
    stop_ids = trip_stops[longest_trip]

    # 6. Only include unique parent stations in order (to avoid platform duplicates)
    seen = set()
    ordered_stops = []
    
    for stop_id in stop_ids:
        info = stop_info.get(stop_id)
        if not info:
            continue
        parent = info['parent_station']
        if parent not in seen:
            ordered_stops.append(info)
            seen.add(parent)

    return jsonify({'success': True, 'data': ordered_stops})

@transit_bp.route('/trunk-shapes', methods=['GET'])
def get_trunk_shapes():
    """
    Return trunk segments for known shared routes using representative shapes.
    """
    gtfs_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'gtfs')
    trips_file = os.path.join(gtfs_dir, 'trips.txt')
    shapes_file = os.path.join(gtfs_dir, 'shapes.txt')
    routes_file = os.path.join(gtfs_dir, 'routes.txt')

    # Define known trunk routes that share tracks
    trunk_definitions = {
        'queens_blvd': ['E', 'F', 'M', 'R'],
        'sixth_ave': ['B', 'D', 'F', 'M'],
        'eighth_ave': ['A', 'C', 'E'],
        'broadway': ['N', 'Q', 'R', 'W'],
        'lexington': ['4', '5', '6'],
        'seventh_ave': ['1', '2', '3'],
        'canarsie': ['L'],
        'flushing': ['7'],
        'franklin': ['S'],
        'rockaway': ['A'],
        'staten_island': ['SI'],
        'shuttle': ['S'],
        'g': ['G'],
        'j_z': ['J', 'Z'],
        'nassau': ['J', 'Z'],
        'crosstown': ['G'],
        'queens_blvd_express': ['E', 'F'],
        'queens_blvd_local': ['M', 'R'],
        'sixth_ave_express': ['B', 'D'],
        'sixth_ave_local': ['F', 'M'],
        'eighth_ave_express': ['A'],
        'eighth_ave_local': ['C', 'E'],
        'broadway_express': ['N', 'Q'],
        'broadway_local': ['R', 'W'],
        'lexington_express': ['4', '5'],
        'lexington_local': ['6'],
        'seventh_ave_express': ['2', '3'],
        'seventh_ave_local': ['1']
    }

    # 1. Map route_id -> color
    route_to_color = {}
    try:
        with open(routes_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('route_id') and row.get('route_color'):
                    route_to_color[row['route_id']] = row['route_color']
    except Exception as e:
        return jsonify({'success': False, 'error': f'Error reading routes.txt: {e}'})

    # 2. Map route_id -> all shape_ids (not just the first one)
    route_to_shapes = defaultdict(list)
    try:
        with open(trips_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('route_id') and row.get('shape_id'):
                    route_id = row['route_id']
                    shape_id = row['shape_id']
                    if shape_id not in route_to_shapes[route_id]:
                        route_to_shapes[route_id].append(shape_id)
    except Exception as e:
        return jsonify({'success': False, 'error': f'Error reading trips.txt: {e}'})

    # 3. Map shape_id -> polyline
    shape_to_polyline = defaultdict(list)
    try:
        with open(shapes_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('shape_id') and row.get('shape_pt_lat') and row.get('shape_pt_lon'):
                    shape_to_polyline[row['shape_id']].append({
                        'lat': float(row['shape_pt_lat']),
                        'lon': float(row['shape_pt_lon']),
                        'seq': int(row['shape_pt_sequence'])
                    })
        # Sort each polyline by sequence
        for shape_id in shape_to_polyline:
            shape_to_polyline[shape_id].sort(key=lambda x: x['seq'])
    except Exception as e:
        return jsonify({'success': False, 'error': f'Error reading shapes.txt: {e}'})

    # 4. For each trunk, return segments for each route using all their shapes
    trunk_segments = []
    for trunk_name, routes in trunk_definitions.items():
        # Get all shapes for all routes in this trunk
        all_shapes = set()
        for route_id in routes:
            if route_id in route_to_shapes:
                all_shapes.update(route_to_shapes[route_id])
        
        # For each shape, create segments for all routes that use it
        for shape_id in all_shapes:
            if shape_id in shape_to_polyline:
                polyline = [
                    {'latitude': pt['lat'], 'longitude': pt['lon']} for pt in shape_to_polyline[shape_id]
                ]
                # Create a segment for each route in this trunk that uses this shape
                for route_id in routes:
                    if route_id in route_to_color and shape_id in route_to_shapes[route_id]:
                        color = route_to_color[route_id]
                        trunk_segments.append({
                            'route': route_id,
                            'color': f'#{color}',
                            'polyline': polyline
                        })
    
    return jsonify({'success': True, 'data': trunk_segments}) 