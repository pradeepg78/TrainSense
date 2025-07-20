# backend/app/services/ridership_service.py
import sqlite3
import os
from datetime import datetime, timedelta
from flask import current_app
import pandas as pd

class RidershipService:
    """Service for crowd prediction using condensed ridership data"""
    
    def __init__(self):
        self.data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data')
        self.ridership_db = os.path.join(self.data_dir, 'condensed_ridership.db')
        
        # Ensure directory exists
        os.makedirs(self.data_dir, exist_ok=True)
    
    def get_station_crowd_level(self, station_complex_id, target_datetime=None):
        """
        Get crowd level prediction for a specific station at a given time
        """
        if target_datetime is None:
            target_datetime = datetime.now()
        
        # Calculate hour of week (0-167)
        hour_of_week = target_datetime.weekday() * 24 + target_datetime.hour
        day_type = self._classify_day_type(target_datetime.weekday())
        
        try:
            conn = sqlite3.connect(self.ridership_db)
            conn.row_factory = sqlite3.Row
            
            # Get crowd prediction
            query = """
            SELECT 
                crowd_level,
                avg_ridership,
                peak_ridership,
                hour_of_day,
                day_of_week_num as day_of_week
            FROM crowd_predictions 
            WHERE station_complex_id = ? 
            AND hour_of_week = ?
            AND day_type = ?
"""
            
            result = conn.execute(query, (station_complex_id, hour_of_week, day_type)).fetchone()
            
            if result:
                return {
                    'success': True,
                    'station_id': station_complex_id,
                    'timestamp': target_datetime.isoformat(),
                    'crowd_level': result['crowd_level'],
                    'ridership_estimate': int(result['avg_ridership']),
                    'peak_ridership': int(result['peak_ridership']),
                    'confidence': self._calculate_confidence(result),
                    'hour_of_day': int(result['hour_of_day']),
                    'day_type': day_type
                }
            else:
                # Fallback to station average if no specific time data
                fallback = self._get_station_fallback(station_complex_id, day_type)
                return {
                    'success': True,
                    'station_id': station_complex_id,
                    'timestamp': target_datetime.isoformat(),
                    'crowd_level': fallback.get('crowd_level', 'Moderate'),
                    'ridership_estimate': fallback.get('avg_ridership', 1000),
                    'confidence': 'Low',
                    'note': 'Using station average - no specific time data available'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f'Database error: {str(e)}',
                'station_id': station_complex_id
            }
        finally:
            conn.close()
    
    def get_nearby_crowd_levels(self, latitude, longitude, radius_km=1.0, target_datetime=None):
        """Get crowd levels for stations near a given location"""
        if target_datetime is None:
            target_datetime = datetime.now()
        
        try:
            from app.models.transit import Stop
            from app import db
            
            # Simple distance calculation
            lat_range = radius_km / 111.0
            lon_range = radius_km / (111.0 * abs(latitude))
            
            nearby_stations = db.session.query(Stop).filter(
                Stop.latitude.between(latitude - lat_range, latitude + lat_range),
                Stop.longitude.between(longitude - lon_range, longitude + lon_range)
            ).all()
            
            crowd_levels = []
            for station in nearby_stations:
                crowd_data = self.get_station_crowd_level(station.id, target_datetime)
                if crowd_data['success']:
                    distance = self._calculate_distance(latitude, longitude, 
                                                     station.latitude, station.longitude)
                    
                    crowd_data['station_name'] = station.name
                    crowd_data['latitude'] = station.latitude
                    crowd_data['longitude'] = station.longitude
                    crowd_data['distance_km'] = round(distance, 2)
                    crowd_levels.append(crowd_data)
            
            crowd_levels.sort(key=lambda x: x['distance_km'])
            
            return {
                'success': True,
                'location': {'latitude': latitude, 'longitude': longitude},
                'radius_km': radius_km,
                'timestamp': target_datetime.isoformat(),
                'stations': crowd_levels,
                'total_stations': len(crowd_levels)
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Location lookup error: {str(e)}'
            }
    
    def check_data_status(self):
        """Check if ridership data is available"""
        try:
            if not os.path.exists(self.ridership_db):
                return {
                    'available': False,
                    'message': 'Ridership database not found. Run data condensation first.'
                }
            
            conn = sqlite3.connect(self.ridership_db)
            
            # Check table existence and row counts
            tables = ['crowd_predictions', 'hourly_patterns', 'daily_patterns', 'peak_patterns']
            table_info = {}
            
            for table in tables:
                try:
                    count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                    table_info[table] = count
                except:
                    table_info[table] = 0
            
            conn.close()
            
            # Get file modification time
            mod_time = datetime.fromtimestamp(os.path.getmtime(self.ridership_db))
            
            return {
                'available': True,
                'last_updated': mod_time.isoformat(),
                'table_counts': table_info,
                'database_path': self.ridership_db
            }
            
        except Exception as e:
            return {
                'available': False,
                'error': str(e)
            }
    
    def _classify_day_type(self, day_of_week):
        """Classify day type for pattern matching"""
        if day_of_week < 5:
            return 'weekday'
        elif day_of_week == 5:
            return 'saturday'
        else:
            return 'sunday'
    
    def _calculate_confidence(self, result):
        """Calculate confidence level based on data quality"""
        if result['avg_ridership'] > 100:
            return 'High'
        elif result['avg_ridership'] > 50:
            return 'Medium'
        else:
            return 'Low'
    
    def _get_station_fallback(self, station_complex_id, day_type):
        """Get fallback data when specific time not available"""
        try:
            conn = sqlite3.connect(self.ridership_db)
            conn.row_factory = sqlite3.Row
            
            query = """
            SELECT AVG(avg_ridership) as avg_ridership
            FROM crowd_predictions 
            WHERE station_complex_id = ? AND day_type = ?
            """
            
            result = conn.execute(query, (station_complex_id, day_type)).fetchone()
            
            if result and result['avg_ridership']:
                avg = int(result['avg_ridership'])
                if avg > 800:
                    crowd_level = 'Very Crowded'
                elif avg > 600:
                    crowd_level = 'Crowded'
                elif avg > 400:
                    crowd_level = 'Moderate'
                elif avg > 200:
                    crowd_level = 'Light'
                else:
                    crowd_level = 'Very Light'
                
                return {
                    'crowd_level': crowd_level,
                    'avg_ridership': avg
                }
            
            return {'crowd_level': 'Moderate', 'avg_ridership': 500}
            
        except:
            return {'crowd_level': 'Moderate', 'avg_ridership': 500}
        finally:
            conn.close()
    
    def _calculate_distance(self, lat1, lon1, lat2, lon2):
        """Calculate distance between two points using Haversine formula"""
        import math
        
        R = 6371  # Earth's radius in kilometers
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c