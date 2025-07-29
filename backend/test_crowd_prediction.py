"""
Test script for crowd prediction service
"""

import os
import sys
from datetime import datetime
from app import create_app, db
from app.services.crowd_prediction_service import CrowdPredictionService

def test_crowd_prediction():
    """Test the crowd prediction service"""
    print("🧪 Testing crowd prediction service...")
    
    app = create_app()
    
    with app.app_context():
        # Check if we have data
        from app.models.crowd_prediction import CrowdDataPoint
        total_data = db.session.query(CrowdDataPoint).count()
        print(f"📊 Total data points in database: {total_data}")
        
        # Test the service
        service = CrowdPredictionService()
        
        # Test prediction
        target_time = datetime.now()
        prediction = service.predict_crowd_level('R16', 'N', target_time)
        
        print(f"🎯 Prediction result: {prediction}")
        
        # Check if model files exist
        model_dir = os.path.join(os.path.dirname(__file__), 'models')
        enhanced_model_path = os.path.join(model_dir, 'enhanced_crowd_model.pkl')
        enhanced_scaler_path = os.path.join(model_dir, 'enhanced_crowd_scaler.pkl')
        
        print(f"📁 Model directory: {model_dir}")
        print(f"🔍 Enhanced model exists: {os.path.exists(enhanced_model_path)}")
        print(f"🔍 Enhanced scaler exists: {os.path.exists(enhanced_scaler_path)}")
        
        if os.path.exists(enhanced_model_path):
            print(f"📏 Enhanced model size: {os.path.getsize(enhanced_model_path)} bytes")
        if os.path.exists(enhanced_scaler_path):
            print(f"📏 Enhanced scaler size: {os.path.getsize(enhanced_scaler_path)} bytes")

if __name__ == "__main__":
    test_crowd_prediction() 