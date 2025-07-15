#!/usr/bin/env python3
# test_api.py
"""
Simple test script to verify the API endpoints are working.
Run this after starting the backend server.
"""

import requests
import json

BASE_URL = "http://localhost:5001/api/v1"

def test_endpoint(endpoint, description):
    """Test an API endpoint and print results"""
    print(f"\n🔍 Testing {description}...")
    try:
        response = requests.get(f"{BASE_URL}{endpoint}", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success: {data.get('success', False)}")
            if 'data' in data:
                if isinstance(data['data'], list):
                    print(f"📊 Items returned: {len(data['data'])}")
                elif isinstance(data['data'], dict):
                    print(f"📊 Data keys: {list(data['data'].keys())}")
            return True
        else:
            print(f"❌ Failed: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    print("🚇 Testing TrainSense API Endpoints")
    print("=" * 50)
    
    # Test basic endpoints
    test_endpoint("/health", "Health Check")
    test_endpoint("/routes", "Get Routes")
    test_endpoint("/stops", "Get Stops")
    test_endpoint("/service-status", "Service Status")
    
    # Test map stations endpoint
    print(f"\n🔍 Testing Map Stations...")
    try:
        params = {
            'zoom': 'city',
            'north': 40.8,
            'south': 40.7,
            'east': -73.9,
            'west': -74.0
        }
        response = requests.get(f"{BASE_URL}/map/stations", params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success: {data.get('success', False)}")
            if 'data' in data and 'stations' in data['data']:
                print(f"📊 Stations returned: {len(data['data']['stations'])}")
                if data['data']['stations']:
                    print(f"📍 First station: {data['data']['stations'][0]['name']}")
        else:
            print(f"❌ Failed: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n🎉 API Testing Complete!")
    print("\nIf you see stations being returned, the map should work.")
    print("If not, check that the backend is running and the database has data.")

if __name__ == "__main__":
    main() 