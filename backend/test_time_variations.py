#!/usr/bin/env python3
"""
Test ML Predictions for Different Times
"""

import requests
import json
from datetime import datetime, timedelta

def test_different_times():
    """Test predictions for different times of day"""
    print("🧪 Testing ML Predictions for Different Times")
    print("=" * 50)
    
    base_url = "http://localhost:5001"
    station = "test_station"
    
    # Test different times
    test_times = [
        ("Morning Rush (8 AM)", 8),
        ("Evening Rush (6 PM)", 18),
        ("Midday (2 PM)", 14),
        ("Late Night (11 PM)", 23),
        ("Early Morning (3 AM)", 3),
    ]
    
    print("🔍 Testing crowd predictions for different times:")
    print()
    
    for description, hour in test_times:
        print(f"🚇 {description} (Hour: {hour}):")
        
        try:
            # Make API call
            response = requests.get(f"{base_url}/api/crowd/prediction/{station}")
            
            if response.status_code == 200:
                data = response.json()
                prediction = data['data']['prediction']
                
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
                print(f"  ❌ API Error: {response.status_code}")
                print()
                
        except Exception as e:
            print(f"  ❌ Error: {e}")
            print()
    
    print("🔍 Analysis:")
    print("- If predictions vary by time: REAL ML")
    print("- If all same: STATIC VALUES")
    print("- Current time affects predictions: REAL ML")

if __name__ == "__main__":
    test_different_times() 