#!/usr/bin/env python3
"""
Simple ML Prediction Test
"""

import numpy as np
import joblib
from datetime import datetime

def test_ml_predictions():
    """Test if ML predictions are varied and realistic"""
    print("🧪 Testing ML Predictions Only")
    print("=" * 40)
    
    try:
        # Load the trained model directly
        model = joblib.load('models/crowd_prediction_model.pkl')
        scaler = joblib.load('models/crowd_prediction_scaler.pkl')
        
        print("✅ Model loaded successfully")
        
        # Test different feature combinations
        test_features = [
            (8, 0, 1, 100),   # Morning rush, Monday, January, high ridership
            (18, 0, 1, 120),  # Evening rush, Monday, January, very high ridership
            (14, 2, 6, 80),   # Midday, Wednesday, June, medium ridership
            (23, 4, 12, 30),  # Late night, Friday, December, low ridership
            (3, 6, 7, 20),    # Early morning, Sunday, July, very low ridership
        ]
        
        crowd_levels = {1: 'low', 2: 'medium', 3: 'high', 4: 'very_high'}
        
        print("\n🔍 Testing ML predictions with different inputs:")
        print()
        
        for i, (hour, day, month, ridership) in enumerate(test_features, 1):
            # Create feature array
            features = np.array([[hour, day, month, ridership]])
            
            # Scale features
            scaled_features = scaler.transform(features)
            
            # Make prediction
            prediction = model.predict(scaled_features)[0]
            confidence = np.max(model.predict_proba(scaled_features)[0])
            
            crowd_level = crowd_levels.get(prediction, 'medium')
            
            print(f"Test {i}: Hour={hour}, Day={day}, Month={month}, Ridership={ridership}")
            print(f"  📊 ML Prediction: {crowd_level.upper()}")
            print(f"  🎯 Confidence: {confidence:.1%}")
            print()
        
        print("🔍 Analysis:")
        print("- If predictions vary: REAL ML")
        print("- If all same: STATIC VALUES")
        print("- If confidence varies: REAL ML")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_ml_predictions() 