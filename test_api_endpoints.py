#!/usr/bin/env python3
"""
Simple test script to check API endpoints
"""
import requests
import json

BASE_URL = "http://localhost:5001/api/v1"

def test_endpoint(endpoint, method="GET", data=None):
    """Test a single endpoint"""
    url = f"{BASE_URL}{endpoint}"
    print(f"\nTesting {method} {endpoint}")
    print(f"URL: {url}")
    
    try:
        if method == "GET":
            response = requests.get(url, timeout=10)
        elif method == "POST":
            response = requests.post(url, json=data, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Success: {result.get('success')}")
            if 'data' in result:
                if isinstance(result['data'], list):
                    print(f"Data count: {len(result['data'])}")
                    if len(result['data']) > 0:
                        print(f"First item: {result['data'][0]}")
                else:
                    print(f"Data: {result['data']}")
        else:
            print(f"Error: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Backend server is not running")
    except requests.exceptions.Timeout:
        print("❌ Timeout: Request took too long")
    except Exception as e:
        print(f"❌ Error: {e}")

def main():
    print("Testing API Endpoints")
    print("=" * 50)
    
    # Test health endpoint
    test_endpoint("/health")
    
    # Test routes endpoint
    test_endpoint("/routes")
    
    # Test stops endpoint
    test_endpoint("/stops")
    
    # Test map stations endpoint
    test_endpoint("/map/stations")
    
    # Test service status endpoint
    test_endpoint("/service-status")
    
    # Test trip planning endpoint
    test_endpoint("/plan-trip", method="POST", data={
        "origin_id": "test_origin",
        "destination_id": "test_destination"
    })

if __name__ == "__main__":
    main() 