#!/usr/bin/env python3
"""
Test Crowd Prediction System
"""

from app.services.crowd_prediction_service import CrowdPredictionService

def test_crowd_prediction():
    """Test the crowd prediction system"""
    print("🧪 Testing Crowd Prediction System")
    print("=" * 50)
    
    # Initialize service
    service = CrowdPredictionService()
    
    # Train model
    print("🤖 Training model...")
    success = service.train_model()
    
    if not success:
        print("❌ Model training failed")
        return
    
    # Test predictions
    print("\n📊 Testing predictions...")
    
    test_stations = [
        "Times Square-42 St",
        "Grand Central-42 St", 
        "34 St-Herald Sq",
        "14 St-Union Sq"
    ]
    
    for station in test_stations:
        prediction = service.predict_crowd_level(station, hours_ahead=2)
        
        if prediction:
            print(f"\n🚇 {station}:")
            print(f"  Crowd Level: {prediction['crowd_level'].upper()}")
            print(f"  Confidence: {prediction['confidence']:.1%}")
            print(f"  Method: {prediction['method']}")
            print(f"  Factors: {', '.join(prediction['factors'][:2])}")
        else:
            print(f"❌ Failed to predict for {station}")
    
    print("\n✅ Crowd prediction test complete!")

if __name__ == "__main__":
    test_crowd_prediction() 