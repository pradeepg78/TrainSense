# backend/app/routes/crowd_routes.py
from flask import Blueprint, request, jsonify, current_app
from datetime import datetime
from app.services.ridership_service import RidershipService
import traceback

crowd_bp = Blueprint('crowd', __name__, url_prefix='/api/crowd')

@crowd_bp.route('/station/<station_id>', methods=['GET'])
def get_station_crowd(station_id):
    """Get current crowd level for a specific station"""
    try:
        ridership_service = RidershipService()
        
        # Parse optional datetime parameter
        datetime_str = request.args.get('datetime')
        target_datetime = None
        
        if datetime_str:
            try:
                target_datetime = datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
            except ValueError:
                return jsonify({
                    'success': False,
                    'error': 'Invalid datetime format. Use ISO format (e.g., 2024-01-15T14:30:00)'
                }), 400
        
        result = ridership_service.get_station_crowd_level(station_id, target_datetime)
        
        return jsonify(result)
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}',
            'traceback': traceback.format_exc() if current_app.debug else None
        }), 500

@crowd_bp.route('/nearby', methods=['GET'])
def get_nearby_crowds():
    """Get crowd levels for stations near a location"""
    try:
        # Validate required parameters
        latitude = request.args.get('lat', type=float)
        longitude = request.args.get('lon', type=float)
        
        if latitude is None or longitude is None:
            return jsonify({
                'success': False,
                'error': 'Missing required parameters: lat and lon'
            }), 400
        
        # Validate coordinate ranges
        if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
            return jsonify({
                'success': False,
                'error': 'Invalid coordinates. Latitude must be -90 to 90, longitude -180 to 180'
            }), 400
        
        radius = request.args.get('radius', default=1.0, type=float)
        
        # Parse optional datetime parameter
        datetime_str = request.args.get('datetime')
        target_datetime = None
        
        if datetime_str:
            try:
                target_datetime = datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
            except ValueError:
                return jsonify({
                    'success': False,
                    'error': 'Invalid datetime format. Use ISO format (e.g., 2024-01-15T14:30:00)'
                }), 400
        
        ridership_service = RidershipService()
        result = ridership_service.get_nearby_crowd_levels(latitude, longitude, radius, target_datetime)
        
        return jsonify(result)
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}',
            'traceback': traceback.format_exc() if current_app.debug else None
        }), 500

@crowd_bp.route('/status', methods=['GET'])
def get_data_status():
    """Check ridership data availability and status"""
    try:
        ridership_service = RidershipService()
        result = ridership_service.check_data_status()
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}',
            'traceback': traceback.format_exc() if current_app.debug else None
        }), 500