#!/usr/bin/env python3
"""
Test script to check if the real-time arrivals endpoint is working
"""
import requests
import json

def test_realtime_arrivals():
    """Test the real-time arrivals endpoint"""
    try:
        # First get some stations
        stations_url = "http://127.0.0.1:5001/api/map/stations"
        print(f"Getting stations from: {stations_url}")
        
        stations_response = requests.get(stations_url, timeout=10)
        if stations_response.status_code != 200:
            print(f"❌ Failed to get stations: {stations_response.status_code}")
            return
        
        stations_data = stations_response.json()
        if not stations_data.get('success') or not stations_data.get('data'):
            print("❌ No stations data available")
            return
        
        stations = stations_data['data']
        print(f"✅ Found {len(stations)} stations")
        
        # Test real-time arrivals for the first station
        if len(stations) > 0:
            test_station = stations[0]
            station_id = test_station['id']
            station_name = test_station['name']
            
            print(f"\nTesting real-time arrivals for: {station_name} (ID: {station_id})")
            
            arrivals_url = f"http://127.0.0.1:5001/api/realtime/{station_id}"
            print(f"Testing URL: {arrivals_url}")
            
            arrivals_response = requests.get(arrivals_url, timeout=10)
            print(f"Response status: {arrivals_response.status_code}")
            
            if arrivals_response.status_code == 200:
                try:
                    arrivals_data = arrivals_response.json()
                    print("✅ JSON parsed successfully!")
                    
                    if arrivals_data.get('success'):
                        arrivals = arrivals_data.get('data', {}).get('arrivals', [])
                        print(f"✅ Found {len(arrivals)} arrivals")
                        
                        if arrivals:
                            print("\nSample arrivals:")
                            for i, arrival in enumerate(arrivals[:3]):
                                print(f"  {i+1}. Route {arrival.get('route')} - {arrival.get('minutes')} min - {arrival.get('direction')} - {arrival.get('status')}")
                        else:
                            print("ℹ️  No arrivals currently scheduled")
                    else:
                        print(f"❌ API returned error: {arrivals_data.get('error', 'Unknown error')}")
                        
                except json.JSONDecodeError as e:
                    print(f"❌ JSON parse error: {e}")
                    print(f"Raw response: {arrivals_response.text[:500]}...")
            else:
                print(f"❌ HTTP error: {arrivals_response.status_code}")
                print(f"Response text: {arrivals_response.text[:500]}...")
        else:
            print("❌ No stations available for testing")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection error - backend is not running")
        print("Make sure to run: python run.py --port 5001")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    test_realtime_arrivals() 