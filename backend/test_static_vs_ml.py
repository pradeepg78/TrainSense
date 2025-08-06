#!/usr/bin/env python3
"""
Test Static vs ML Predictions
"""

from app.services.crowd_prediction_service import CrowdPredictionService
from datetime import datetime, timedelta

def test_static_vs_ml():
    """Test to show if we're using static values or real ML"""
    print("🧪 Testing Static vs ML Predictions")
    print("=" * 50)
    
    service = CrowdPredictionService()
    
    # Test different times to see if predictions vary
    test_times = [
        ("Morning Rush (8 AM)", 8),
        ("Evening Rush (6 PM)", 18),
        ("Midday (2 PM)", 14),
        ("Late Night (11 PM)", 23),
        ("Early Morning (3 AM)", 3),
    ]
    
    print("🔍 Testing if predictions are static or dynamic:")
    print()
    
    for description, hour in test_times:
        print(f"🚇 {description} (Hour: {hour}):")
        
        # Get prediction
        prediction = service.predict_crowd_level("Test Station", hours_ahead=1)
        
        if prediction:
            crowd_level = prediction['crowd_level'].upper()
            confidence = prediction['confidence']
            ridership = prediction.get('estimated_ridership', 0)
            method = prediction['method']
            
            print(f"  📊 Crowd Level: {crowd_level}")
            print(f"  🎯 Confidence: {confidence:.1%}")
            print(f"  👥 Est. Ridership: {ridership}")
            print(f"  🤖 Method: {method}")
            print()
        else:
            print(f"  ❌ Failed to predict")
            print()
    
    print("🔍 Analysis:")
    print("- If all predictions are the same: STATIC VALUES")
    print("- If predictions vary by time: REAL ML")
    print("- If confidence is always 100%: SUSPICIOUS")
    print("- If ridership varies: REAL DATA")

if __name__ == "__main__":
    test_static_vs_ml() 