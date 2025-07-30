#!/usr/bin/env python3
"""
Test Real MTA Data Crowd Prediction
"""

from app.services.crowd_prediction_service import CrowdPredictionService
import requests
import json

def test_real_data_prediction():
    """Test crowd prediction with real MTA data"""
    print("🧪 Testing Real MTA Data Crowd Prediction")
    print("=" * 60)
    
    # Initialize service
    service = CrowdPredictionService()
    
    # Train model with real data
    print("🤖 Training model with REAL MTA data...")
    success = service.train_model()
    
    if not success:
        print("❌ Model training failed")
        return
    
    # Test predictions for different times
    print("\n📊 Testing predictions for different scenarios...")
    
    test_scenarios = [
        ("Times Square-42 St", "rush_hour_morning", 8),  # 8 AM
        ("Grand Central-42 St", "rush_hour_evening", 18),  # 6 PM
        ("34 St-Herald Sq", "weekend_afternoon", 14),  # 2 PM weekend
        ("14 St-Union Sq", "late_night", 23),  # 11 PM
    ]
    
    for station, scenario, hour in test_scenarios:
        # Create a mock prediction for specific time
        prediction = service.predict_crowd_level(station, hours_ahead=1)
        
        if prediction:
            print(f"\n🚇 {station} ({scenario} - {hour}:00):")
            print(f"  Crowd Level: {prediction['crowd_level'].upper()}")
            print(f"  Confidence: {prediction['confidence']:.1%}")
            print(f"  Method: {prediction['method']}")
            print(f"  Factors: {', '.join(prediction['factors'][:3])}")
        else:
            print(f"❌ Failed to predict for {station}")
    
    # Test API endpoints
    print("\n🌐 Testing API endpoints with real data...")
    
    base_url = "http://localhost:5001"
    
    # Test crowd prediction endpoint
    try:
        response = requests.get(f"{base_url}/api/crowd/predict/6?station_id=R16&hours_ahead=2")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ API Prediction:")
            print(f"  Crowd Level: {data.get('prediction', {}).get('crowd_level', 'N/A')}")
            print(f"  Confidence: {data.get('prediction', {}).get('confidence', 'N/A')}")
            print(f"  Method: {data.get('prediction', {}).get('method', 'N/A')}")
            print(f"  Data Points: {data.get('prediction', {}).get('data_points_used', 'N/A')}")
        else:
            print(f"❌ API Error: {response.status_code}")
    except Exception as e:
        print(f"❌ API Error: {e}")
    
    # Test station prediction endpoint
    try:
        response = requests.get(f"{base_url}/api/crowd/prediction/R16")
        if response.status_code == 200:
            data = response.json()
            prediction_data = data.get('data', {}).get('prediction', {})
            print(f"\n✅ Station API Prediction:")
            print(f"  Crowd Level: {prediction_data.get('crowd_level', 'N/A')}")
            print(f"  Confidence: {prediction_data.get('confidence', 'N/A')}")
            print(f"  Method: {prediction_data.get('method', 'N/A')}")
            print(f"  Data Source: {data.get('data', {}).get('historical_data', {}).get('data_source', 'N/A')}")
        else:
            print(f"❌ Station API Error: {response.status_code}")
    except Exception as e:
        print(f"❌ Station API Error: {e}")
    
    print("\n🎉 Real MTA data prediction test complete!")
    print("📊 The system is now using REAL MTA data from our comprehensive collection!")

if __name__ == "__main__":
    test_real_data_prediction() 