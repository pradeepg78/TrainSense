"""
API endpoints for crowd prediction
"""

from flask import Blueprint, request, jsonify
from app.services.crowd_prediction_service import CrowdPredictionService
from app.services.mta_crowd_service import MTACrowdService
from app.models.crowd_prediction import CrowdDataPoint, db
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
        
        # Calculate target time
        target_time = datetime.now() + timedelta(hours=hours_ahead)
        
        # Get prediction
        service = CrowdPredictionService()
        prediction = service.predict_crowd_level(station_id, route_id, target_time)
        
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
            'data_source': 'mta_hourly_ridership',
            'system_time': datetime.now().isoformat(),
            'ready_for_predictions': total_data >= 50
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500