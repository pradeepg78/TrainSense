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
    """Get real-time arrival data for a specific stop"""
    try:
        # Get the stop
        stop = Stop.query.get(stop_id)
        if not stop:
            return jsonify({
                'success': False,
                'error': 'Stop not found'
            }), 404
        
        # Get routes that serve this stop
        routes = stop.get_routes()
        route_ids = [route.id for route in routes]
        
        # Get real-time data for these routes
        realtime_service = RealtimeDataService()
        arrivals = realtime_service.get_arrivals_for_stop(stop_id, route_ids)
        
        return jsonify({
            'success': True,
            'data': {
                'stop': stop.to_dict(),
                'arrivals': arrivals
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
    """Get all stations for the map view"""
    try:
        # Get all stops that are stations or have parent stations
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
            stop_data['routes'] = [route.to_dict() for route in routes]
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
        
        # Get service status for each route
        realtime_service = RealtimeDataService()
        status_data = []
        
        for route in routes:
            status = realtime_service.get_route_status(route.id)
            route_data = route.to_dict()
            route_data['status'] = status
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