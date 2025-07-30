#!/usr/bin/env python3
"""
Test API Endpoints
"""

import requests
import json
from datetime import datetime

def test_api_endpoints():
    """Test the API endpoints"""
    print("🧪 Testing API Endpoints")
    print("=" * 50)
    
    base_url = "http://localhost:5001"
    
    # Test health check
    print("🔍 Testing health check...")
    try:
        response = requests.get(f"{base_url}/")
        print(f"✅ Health check: {response.status_code}")
        print(f"📄 Response: {response.json()}")
    except Exception as e:
        print(f"❌ Health check failed: {e}")
    
    # Test crowd prediction
    print("\n🔍 Testing crowd prediction...")
    try:
        response = requests.get(f"{base_url}/api/crowd/predict/6?station_id=R16&hours_ahead=2")
        print(f"✅ Crowd prediction: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"📊 Prediction data:")
            print(f"  Crowd Level: {data.get('prediction', {}).get('crowd_level', 'N/A')}")
            print(f"  Confidence: {data.get('prediction', {}).get('confidence', 'N/A')}")
            print(f"  Method: {data.get('prediction', {}).get('method', 'N/A')}")
        else:
            print(f"❌ Error: {response.text}")
    except Exception as e:
        print(f"❌ Crowd prediction failed: {e}")
    
    # Test station prediction
    print("\n🔍 Testing station prediction...")
    try:
        response = requests.get(f"{base_url}/api/crowd/prediction/R16")
        print(f"✅ Station prediction: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"📊 Station data:")
            print(f"  Station: {data.get('station_id', 'N/A')}")
            print(f"  Prediction: {data.get('prediction', {}).get('crowd_level', 'N/A')}")
        else:
            print(f"❌ Error: {response.text}")
    except Exception as e:
        print(f"❌ Station prediction failed: {e}")
    
    print("\n✅ API endpoint test complete!")

if __name__ == "__main__":
    test_api_endpoints() 