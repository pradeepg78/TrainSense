#!/usr/bin/env python3
"""
Test script to check if the map stations endpoint is working
"""
import requests
import json

def test_map_stations():
    """Test the map stations endpoint"""
    try:
        url = "http://127.0.0.1:5001/api/map/stations"
        print(f"Testing URL: {url}")
        
        response = requests.get(url, timeout=10)
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print("✅ JSON parsed successfully!")
                print(f"Response structure: {json.dumps(data, indent=2)[:500]}...")
                
                if 'success' in data and data['success']:
                    stations = data.get('data', [])
                    print(f"✅ Found {len(stations)} stations")
                else:
                    print(f"❌ API returned error: {data.get('error', 'Unknown error')}")
                    
            except json.JSONDecodeError as e:
                print(f"❌ JSON parse error: {e}")
                print(f"Raw response: {response.text[:500]}...")
        else:
            print(f"❌ HTTP error: {response.status_code}")
            print(f"Response text: {response.text[:500]}...")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection error - backend is not running")
        print("Make sure to run: python run.py --port 5001")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    test_map_stations() 