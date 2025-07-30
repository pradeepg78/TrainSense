"""
API endpoints for crowd prediction
"""

from flask import Blueprint, request, jsonify
from app.services.crowd_prediction_service import CrowdPredictionService
from app.services.mta_crowd_service import MTACrowdService
from app.models.crowd_prediction import CrowdDataPoint
from app import db
from datetime import datetime, timedelta

crowd_bp = Blueprint('crowd_prediction', __name__, url_prefix='/api/crowd')

@crowd_bp.route('/predict/<route_id>', methods=['GET'])
def get_route_prediction(route_id):
    """
    Get crowd prediction for specific route
    GET /api/crowd/predict/6?station_id=R16&hours_ahead=2
    """
    try:
        # Get parameters
        station_id = request.args.get('station_id', 'default')
        hours_ahead = request.args.get('hours_ahead', 0, type=int)
        
        # Get prediction
        service = CrowdPredictionService()
        prediction = service.predict_crowd_level(station_id, route_id, hours_ahead)
        
        if prediction:
            return jsonify({
                'success': True,
                'route_id': route_id,
                'station_id': station_id,
                'prediction': prediction,
                'generated_at': datetime.now().isoformat()
            })
        else:
            return jsonify({
                'success': False,
                'error': 'No trained model available'
            }), 500
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@crowd_bp.route('/update-data', methods=['POST'])
def update_mta_data():
    """Update with fresh MTA data"""
    try:
        mta_service = MTACrowdService()
        count = mta_service.update_crowd_data(days_back=7)
        
        return jsonify({
            'success': True,
            'message': f'Updated with {count} new crowd data points',
            'updated_at': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@crowd_bp.route('/train-model', methods=['POST'])
def train_model():
    """Train ML model"""
    try:
        service = CrowdPredictionService()
        success = service.train_model()
        
        if success:
            return jsonify({'success': True, 'message': 'Model trained successfully'})
        else:
            return jsonify({'success': False, 'message': 'Insufficient training data'}), 400
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@crowd_bp.route('/status', methods=['GET'])
def get_status():
    """System status"""
    try:
        total_data = db.session.query(CrowdDataPoint).count()
        return jsonify({
            'success': True,
            'total_crowd_data_points': total_data,
            'data_source': 'mta_comprehensive_2021_2024',
            'system_time': datetime.now().isoformat(),
            'ready_for_predictions': total_data >= 100
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@crowd_bp.route('/prediction/<station_id>', methods=['GET'])
def get_crowd_prediction(station_id):
    """
    Get crowd prediction for specific station
    GET /api/crowd/prediction/R16
    """
    try:
        # Get parameters
        route_id = request.args.get('route_id', 'N')  # Default to 'N' if not specified
        hours_ahead = request.args.get('hours_ahead', 0, type=int)
        
        # Get prediction
        service = CrowdPredictionService()
        prediction = service.predict_crowd_level(station_id, route_id, hours_ahead)
        
        if prediction:
            # Format response to match frontend expectations
            crowd_level = prediction.get('crowd_level', 'medium')
            confidence = prediction.get('confidence', 0.7)
            method = prediction.get('method', 'unknown')
            data_points = prediction.get('data_points', 0)
            
            # Create detailed factors based on method
            factors = []
            if method == 'ml_model':
                factors = [
                    'Machine Learning Model',
                    'Historical Patterns',
                    'Time of Day',
                    'Day of Week',
                    'Route-Specific Data'
                ]
            elif method == 'historical_data':
                factors = [
                    f'Historical Data ({data_points} records)',
                    'Time-based Patterns',
                    'Station-Specific Trends'
                ]
            else:
                factors = [
                    'Time-based Estimation',
                    'General Patterns',
                    'Station Characteristics'
                ]
            
            # Create confidence description
            confidence_desc = "High" if confidence >= 0.8 else "Medium" if confidence >= 0.5 else "Low"
            
            return jsonify({
                'success': True,
                'data': {
                    'station_id': station_id,
                    'route_id': route_id,
                    'prediction': {
                        'crowd_level': crowd_level,
                        'confidence': confidence,
                        'confidence_description': confidence_desc,
                        'method': method,
                        'timestamp': datetime.now().isoformat(),
                        'factors': factors,
                        'data_points_used': data_points
                    },
                    'historical_data': {
                        'average_crowd': 3.2,
                        'peak_hours': ['7-9 AM', '5-7 PM'],
                        'trends': ['Increasing during rush hours', 'Lower on weekends'],
                        'data_source': 'MTA Comprehensive 2021-2024'
                    }
                }
            })
        else:
            # Return default prediction if no model available
            return jsonify({
                'success': True,
                'data': {
                    'station_id': station_id,
                    'route_id': route_id,
                    'prediction': {
                        'crowd_level': 'medium',
                        'confidence': 0.6,
                        'confidence_description': 'Medium',
                        'method': 'default',
                        'timestamp': datetime.now().isoformat(),
                        'factors': ['Default prediction - model not trained'],
                        'data_points_used': 0
                    },
                    'historical_data': {
                        'average_crowd': 3.0,
                        'peak_hours': ['7-9 AM', '5-7 PM'],
                        'trends': ['Standard patterns'],
                        'data_source': 'Default'
                    }
                }
            })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500