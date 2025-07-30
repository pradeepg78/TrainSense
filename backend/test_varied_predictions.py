#!/usr/bin/env python3
"""
Test Varied Crowd Predictions
"""

from app.services.crowd_prediction_service import CrowdPredictionService
from datetime import datetime, timedelta

def test_varied_predictions():
    """Test varied crowd predictions for different times"""
    print("🧪 Testing Varied Crowd Predictions")
    print("=" * 50)
    
    service = CrowdPredictionService()
    
    # Test different scenarios
    scenarios = [
        ("Times Square", "Monday 8:00 AM", 8, 0),   # Rush hour
        ("Grand Central", "Monday 6:00 PM", 18, 0),  # Evening rush
        ("34 St-Herald Sq", "Wednesday 2:00 PM", 14, 2),  # Midday
        ("14 St-Union Sq", "Friday 11:00 PM", 23, 4),  # Late night
        ("Atlantic Av", "Saturday 3:00 PM", 15, 5),  # Weekend
        ("Fulton St", "Sunday 10:00 PM", 22, 6),  # Weekend evening
    ]
    
    for station, description, hour, day_offset in scenarios:
        # Create a mock time for testing
        test_time = datetime.now().replace(hour=hour, minute=0, second=0, microsecond=0)
        test_time = test_time + timedelta(days=day_offset)
        
        print(f"\n🚇 {station} - {description}:")
        
        # Mock the prediction by calling the service
        prediction = service.predict_crowd_level(station, hours_ahead=1)
        
        if prediction:
            crowd_level = prediction['crowd_level'].upper()
            confidence = prediction['confidence']
            factors = prediction['factors'][:3]  # First 3 factors
            
            print(f"  Crowd Level: {crowd_level}")
            print(f"  Confidence: {confidence:.1%}")
            print(f"  Factors: {', '.join(factors)}")
            
            # Show estimated ridership if available
            if 'estimated_ridership' in prediction:
                print(f"  Est. Ridership: {prediction['estimated_ridership']}")
        else:
            print(f"  ❌ Failed to predict")
    
    print("\n✅ Varied prediction test complete!")

if __name__ == "__main__":
    test_varied_predictions() 