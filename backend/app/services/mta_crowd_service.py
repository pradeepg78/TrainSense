"""
Updated MTA service using the hourly ridership API
"""

import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from app import db
from app.models.crowd_prediction import CrowdDataPoint
from app.models.transit import Route, Stop

class MTACrowdService:
    """
    Uses the new MTA Hourly Ridership API instead of broken turnstile files
    This is the official replacement that actually works!
    """
    
    def __init__(self):
        self.mta_hourly_api = "https://data.ny.gov/resource/wujg-7c2s.json"
        
        # Max records per request
        self.api_limit = 2000  
        
        # Station mappings (hourly data uses different station names)
        self.station_name_mappings = {
            'Times Sq-42 St': ['TIMES SQ-42 ST', 'TIMES SQUARE'],
            'Union Sq-14 St': ['UNION SQ-14 ST', 'UNION SQUARE'],
            'Herald Sq-34 St': ['HERALD SQ-34 ST', '34 ST-HERALD SQ'],
            'Grand Central-42 St': ['GRAND CENTRAL-42 ST', 'GRAND CENTRAL'],
            'Fulton St': ['FULTON ST', 'FULTON STREET'],
            'Atlantic Av-Barclays Ctr': ['ATLANTIC AV-BARCLAYS', 'BARCLAYS CENTER'],
            '59 St-Columbus Circle': ['59 ST-COLUMBUS', 'COLUMBUS CIRCLE'],
            'Canal St': ['CANAL ST', 'CANAL STREET'],
            '125 St': ['125 ST', '125TH STREET'],
        }
    
    def get_latest_available_date(self):
        """
        Fetch the latest available transit_timestamp from the API.
        Returns a datetime object for the most recent record.
        """
        params = {
            '$limit': 1,
            '$order': 'transit_timestamp DESC'
        }
        try:
            response = requests.get(self.mta_hourly_api, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            if data and 'transit_timestamp' in data[0]:
                # Remove 'Z' if present and parse
                return datetime.fromisoformat(data[0]['transit_timestamp'].replace('Z', ''))
            else:
                raise Exception("No data found in API response.")
        except Exception as e:
            print(f"  ❌ Failed to fetch latest available date: {e}")
            # Fallback: use today
            return datetime.now()
    
    def download_recent_hourly_data(self, max_records=2000):
        """
        Download MTA hourly ridership data
        """
        print("backend/app/services/mta_crowd_service.py: Downloading MTA hourly ridership data (using latest available date)...")

        # Dynamically get the latest available date
        end_date = self.get_latest_available_date()
        start_date = end_date - timedelta(days=30)

        # Format dates for API (ISO format)
        start_str = start_date.strftime("%Y-%m-%dT00:00:00.000")
        end_str = end_date.strftime("%Y-%m-%dT23:59:59.999")

        try:
            # Build API query with correct SoQL syntax
            params = {
                '$limit': max_records,
                '$where': f"transit_timestamp >= '{start_str}' AND transit_timestamp <= '{end_str}'",
                '$order': 'transit_timestamp DESC'
            }

            print(f"API URL: {self.mta_hourly_api}")
            print(f"Date range: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")

            response = requests.get(self.mta_hourly_api, params=params, timeout=30)
            response.raise_for_status()

            data = response.json()

            # Check if we got an error response
            if isinstance(data, dict) and data.get('error'):
                print(f"  ❌ API Error: {data.get('message', 'Unknown error')}")
                return []

            print(f"  ✅ Downloaded {len(data)} hourly ridership records")

            # Show sample of what we got
            if data:
                sample = data[0]
                print(f"  📊 Sample keys: {list(sample.keys())}")
                if 'station_complex' in sample:
                    print(f"  🚇 Sample station: {sample.get('station_complex', 'N/A')}")
                if 'ridership' in sample:
                    print(f"  👥 Sample ridership: {sample.get('ridership', 'N/A')}")

            return data

        except requests.exceptions.RequestException as e:
            print(f"  ❌ API request failed: {e}")
            return []
        except Exception as e:
            print(f"  ❌ Error processing data: {e}")
            return []
    
    def process_hourly_to_crowds(self, hourly_data):
        """
        Convert MTA hourly ridership data to crowd level estimates
        Much cleaner than the old turnstile approach!
        """
        print("🔄 Converting hourly ridership to crowd estimates...")
        
        if not hourly_data:
            return []
        
        crowd_points = []
        processed_count = 0
        error_count = 0
        
        for record in hourly_data:
            try:
                # Extract ridership count
                ridership = self._safe_int(record.get('ridership', 0))
                if ridership is None or ridership <= 0:
                    continue
                
                # Extract station info
                station_complex = record.get('station_complex', '').strip()
                if not station_complex:
                    continue
                
                # Extract time info
                timestamp_str = record.get('transit_timestamp', '')
                if not timestamp_str:
                    continue
                
                try:
                    # Parse timestamp (format: 2025-07-22T08:00:00.000)
                    if 'T' in timestamp_str:
                        timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '').split('.')[0])
                    else:
                        # Fallback format
                        timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                except:
                    continue
                
                # Convert ridership to crowd level
                crowd_level = self._ridership_to_crowd_level(ridership, timestamp.hour, timestamp.weekday())
                
                # Find matching station in your database
                station_match = self._find_station_by_complex_name(station_complex)
                
                if station_match:
                    # Guess route (simplified - the hourly data doesn't include route info)
                    route_id = self._guess_route_from_complex_name(station_complex)
                    
                    crowd_point = {
                        'station_id': station_match.id,
                        'route_id': route_id,
                        'timestamp': timestamp,
                        'hour_of_day': timestamp.hour,
                        'day_of_week': timestamp.weekday(),
                        'crowd_level': crowd_level,
                        'raw_entries': ridership,  # Hourly ridership count
                        'raw_exits': 0,  # Not available in hourly data
                        'net_traffic': ridership,
                        'source': 'mta_hourly_ridership',
                        'mta_station_name': station_complex
                    }
                    
                    crowd_points.append(crowd_point)
                    processed_count += 1
                else:
                    error_count += 1
                
            except Exception as e:
                error_count += 1
                if error_count <= 5:  # Show first 5 errors only
                    print(f"  ⚠️  Error processing record: {e}")
                continue
        
        print(f"  ✅ Converted {len(crowd_points)} hourly records to crowd estimates")
        print(f"  📊 Processed: {processed_count}, Errors: {error_count}")
        return crowd_points
    
    def _safe_int(self, value):
        """Safely convert value to integer"""
        try:
            if isinstance(value, str):
                # Remove commas and convert
                value = value.replace(',', '')
            return int(float(value))
        except:
            return None
    
    def _ridership_to_crowd_level(self, ridership, hour, day_of_week):
        """
        Convert hourly ridership count to crowd level (1-4)
        This is more direct than the old turnstile approach
        """
        # Adjust thresholds based on time patterns
        is_weekend = day_of_week >= 5
        is_rush_hour = hour in [7, 8, 9, 17, 18, 19]
        
        if is_weekend:
            # Weekend thresholds (generally lower)
            if ridership < 500:
                return 1  # Low
            elif ridership < 1500:
                return 2  # Medium
            elif ridership < 3000:
                return 3  # High
            else:
                return 4  # Very High
        else:
            # Weekday thresholds
            if is_rush_hour:
                # Rush hour - higher baseline
                if ridership < 1000:
                    return 2  # Medium (rush hour minimum)
                elif ridership < 3000:
                    return 3  # High
                else:
                    return 4  # Very High
            else:
                # Off-peak weekday
                if ridership < 300:
                    return 1  # Low
                elif ridership < 1000:
                    return 2  # Medium
                elif ridership < 2500:
                    return 3  # High
                else:
                    return 4  # Very High
    
    def _find_station_by_complex_name(self, complex_name):
        """
        Find station in your database that matches the complex name
        The hourly data uses different naming than your GTFS data
        """
        if not complex_name:
            return None
        
        # Try exact match first
        exact_match = Stop.query.filter(
            Stop.name.ilike(f"%{complex_name}%")
        ).first()
        
        if exact_match:
            return exact_match
        
        # Try known mappings
        for standard_name, variants in self.station_name_mappings.items():
            if any(variant.upper() in complex_name.upper() or 
                   complex_name.upper() in variant.upper() for variant in variants):
                match = Stop.query.filter(
                    Stop.name.ilike(f"%{variants[0]}%")
                ).first()
                if match:
                    return match
        
        # Try individual words
        words = complex_name.upper().replace('-', ' ').split()
        for word in words:
            if len(word) > 3:  # Skip short words
                match = Stop.query.filter(
                    Stop.name.ilike(f"%{word}%")
                ).first()
                if match:
                    return match
        
        return None
    
    def _guess_route_from_complex_name(self, complex_name):
        """Guess primary route based on station complex name"""
        name_upper = complex_name.upper()
        
        # Route guessing based on well-known stations
        if 'TIMES' in name_upper or '42' in name_upper:
            return '7'  # Times Square
        elif 'UNION' in name_upper:
            return '6'  # Union Square
        elif 'HERALD' in name_upper or '34' in name_upper:
            return 'N'  # Herald Square
        elif 'GRAND CENTRAL' in name_upper:
            return '6'  # Grand Central
        elif 'FULTON' in name_upper:
            return '4'  # Fulton Street
        elif 'ATLANTIC' in name_upper or 'BARCLAYS' in name_upper:
            return 'D'  # Atlantic/Barclays
        elif '59' in name_upper and 'COLUMBUS' in name_upper:
            return 'A'  # Columbus Circle
        elif '125' in name_upper:
            return '6'  # 125th Street
        elif 'CANAL' in name_upper:
            return '6'  # Canal Street
        else:
            return '6'  # Default fallback
    
    def save_crowd_data(self, crowd_points):
        """Save crowd data to database"""
        print(f"💾 Saving {len(crowd_points)} crowd estimates...")
        
        saved_count = 0
        
        for point_data in crowd_points:
            try:
                # Check for duplicates
                existing = CrowdDataPoint.query.filter_by(
                    station_id=point_data['station_id'],
                    timestamp=point_data['timestamp']
                ).first()
                
                if not existing:
                    crowd_point = CrowdDataPoint(**point_data)
                    db.session.add(crowd_point)
                    saved_count += 1
                
            except Exception as e:
                print(f"  ⚠️  Error saving point: {e}")
                continue
        
        try:
            db.session.commit()
            print(f"  ✅ Saved {saved_count} new crowd data points")
            return saved_count
        except Exception as e:
            db.session.rollback()
            print(f"  ❌ Error committing: {e}")
            return 0
    
    def update_crowd_data(self, max_records=2000):
        """
        Main method: Update crowd data using the NEW MTA hourly API
        This actually works unlike the broken turnstile approach!
        """
        print("🚇 MTA crowd data update (using NEW hourly ridership API)...")
        
        # Download hourly ridership data
        hourly_data = self.download_recent_hourly_data(max_records=2000)
        
        if hourly_data:
            # Convert to crowd estimates
            crowd_points = self.process_hourly_to_crowds(hourly_data)
            
            # Save to database
            saved_count = self.save_crowd_data(crowd_points)
            
            print(f"✅ Update complete: {saved_count} new data points")
            print(f"📊 Data source: MTA Official Hourly Ridership API")
            return saved_count
        else:
            print("❌ No hourly ridership data downloaded")
            return 0