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
    
    def get_earliest_available_date(self):
        """
        Fetch the earliest available transit_timestamp from the API.
        Returns a datetime object for the earliest record.
        """
        params = {
            '$limit': 1,
            '$order': 'transit_timestamp ASC'
        }
        try:
            response = requests.get(self.mta_hourly_api, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            if data and 'transit_timestamp' in data[0]:
                return datetime.fromisoformat(data[0]['transit_timestamp'].replace('Z', ''))
            else:
                raise Exception("No data found in API response.")
        except Exception as e:
            print(f"  ❌ Failed to fetch earliest available date: {e}")
            # Fallback: use 1 year ago
            return datetime.now() - timedelta(days=365)

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

    def download_all_hourly_data_by_month(self, max_records=None, start_year=None, end_year=None):
        """
        Download all available MTA hourly ridership data, month by month.
        Now gets ALL data, not limited to 2000 records per month.
        Can be limited to specific years for chunked processing.
        """
        print("backend/app/services/mta_crowd_service.py: Downloading ALL MTA hourly ridership data (batch by month, no limits)...")

        # Get earliest and latest available dates
        full_start_date = self.get_earliest_available_date()
        full_end_date = self.get_latest_available_date()
        
        # Apply year limits if specified
        if start_year:
            start_date = datetime(start_year, 1, 1)
            if start_date < full_start_date:
                start_date = full_start_date
        else:
            start_date = full_start_date
            
        if end_year:
            end_date = datetime(end_year, 12, 31)
            if end_date > full_end_date:
                end_date = full_end_date
        else:
            end_date = full_end_date

        print(f"  Full data range: {full_start_date.strftime('%Y-%m-%d')} to {full_end_date.strftime('%Y-%m-%d')}")
        print(f"  Processing range: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")

        all_data = []
        current = datetime(start_date.year, start_date.month, 1)
        last = datetime(end_date.year, end_date.month, 1)
        month_count = 0
        while current <= last:
            # Calculate month start and end
            month_start = current
            if current.month == 12:
                month_end = datetime(current.year + 1, 1, 1) - timedelta(days=1)
            else:
                month_end = datetime(current.year, current.month + 1, 1) - timedelta(days=1)
            # Don't go past the true end_date
            if month_end > end_date:
                month_end = end_date
            start_str = month_start.strftime("%Y-%m-%dT00:00:00.000")
            end_str = month_end.strftime("%Y-%m-%dT23:59:59.999")
            
            # Remove the $limit parameter to get ALL data for this month
            params = {
                '$where': f"transit_timestamp >= '{start_str}' AND transit_timestamp <= '{end_str}'",
                '$order': 'transit_timestamp DESC'
            }
            
            print(f"  📅 Fetching {month_start.strftime('%Y-%m')} ({start_str} to {end_str})...")
            try:
                response = requests.get(self.mta_hourly_api, params=params, timeout=60)  # Increased timeout
                response.raise_for_status()
                data = response.json()
                print(f"    ✅ Downloaded {len(data)} records for {month_start.strftime('%Y-%m')}")
                all_data.extend(data)
            except Exception as e:
                print(f"    ❌ Failed to fetch data for {month_start.strftime('%Y-%m')}: {e}")
            # Move to next month
            if current.month == 12:
                current = datetime(current.year + 1, 1, 1)
            else:
                current = datetime(current.year, current.month + 1, 1)
            month_count += 1
        print(f"  📦 Total records downloaded: {len(all_data)} from {month_count} months.")
        return all_data
    
    def process_hourly_to_crowds(self, hourly_data):
        """
        Convert MTA hourly ridership data to crowd level estimates
        Much cleaner than the old turnstile approach!
        """
        print("🔄 Converting hourly ridership to crowd estimates...")
        
        if not hourly_data:
            return []
        
        # Calculate percentiles from the current batch of data first
        print("📊 Calculating crowd level percentiles from current data batch...")
        ridership_values = []
        for record in hourly_data:
            ridership = self._safe_int(record.get('ridership', 0))
            if ridership and ridership > 0:
                ridership_values.append(ridership)
        
        if ridership_values:
            p25 = np.percentile(ridership_values, 25)
            p50 = np.percentile(ridership_values, 50)
            p75 = np.percentile(ridership_values, 75)
            
            print(f"  📈 Ridership percentiles from current batch:")
            print(f"     25th percentile (Level 1-2 boundary): {p25:.1f}")
            print(f"     50th percentile (Level 2-3 boundary): {p50:.1f}")
            print(f"     75th percentile (Level 3-4 boundary): {p75:.1f}")
            print(f"     Total valid records: {len(ridership_values)}")
            
            # Store percentiles for use in crowd level calculation
            self._current_batch_percentiles = {'p25': p25, 'p50': p50, 'p75': p75}
        else:
            print("  ⚠️  No valid ridership data found in batch.")
            self._current_batch_percentiles = {'p25': 10, 'p50': 50, 'p75': 200}
        
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
                
                # Convert ridership to crowd level using current batch percentiles
                crowd_level = self._ridership_to_crowd_level_from_batch(ridership, timestamp.hour, timestamp.weekday())
                
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

    def _ridership_to_crowd_level_from_batch(self, ridership, hour, day_of_week):
        """
        Convert hourly ridership count to crowd level (1-4) using current batch percentiles.
        This ensures balanced distribution across all crowd levels.
        """
        # Use percentiles calculated from current batch
        p25 = self._current_batch_percentiles['p25']
        p50 = self._current_batch_percentiles['p50']
        p75 = self._current_batch_percentiles['p75']
        
        # Apply percentile-based classification
        if ridership <= p25:
            return 1  # Low (bottom 25%)
        elif ridership <= p50:
            return 2  # Medium (25-50%)
        elif ridership <= p75:
            return 3  # High (50-75%)
        else:
            return 4  # Very High (top 25%)

    def _safe_int(self, value):
        """Safely convert value to integer"""
        try:
            if isinstance(value, str):
                # Remove commas and convert
                value = value.replace(',', '')
            return int(float(value))
        except:
            return None

    def calculate_crowd_level_percentiles(self):
        """
        Calculate percentile thresholds for crowd levels based on historical data.
        This ensures balanced distribution across all crowd levels.
        Returns: dict with 25th, 50th, 75th percentile thresholds
        """
        print("📊 Calculating crowd level percentiles from historical data...")
        
        # Get all ridership values from existing data
        existing_data = db.session.query(CrowdDataPoint.raw_entries).filter(
            CrowdDataPoint.raw_entries > 0
        ).all()
        
        if not existing_data:
            print("  ⚠️  No historical data found. Using default thresholds.")
            return {
                'p25': 10,   # 25th percentile
                'p50': 50,   # 50th percentile (median)
                'p75': 200   # 75th percentile
            }
        
        # Extract ridership values
        ridership_values = [point.raw_entries for point in existing_data]
        
        # Calculate percentiles
        p25 = np.percentile(ridership_values, 25)
        p50 = np.percentile(ridership_values, 50)
        p75 = np.percentile(ridership_values, 75)
        
        print(f"  📈 Ridership percentiles:")
        print(f"     25th percentile (Level 1-2 boundary): {p25:.1f}")
        print(f"     50th percentile (Level 2-3 boundary): {p50:.1f}")
        print(f"     75th percentile (Level 3-4 boundary): {p75:.1f}")
        print(f"     Total data points: {len(ridership_values)}")
        
        return {
            'p25': p25,
            'p50': p50,
            'p75': p75
        }

    def _ridership_to_crowd_level_percentile(self, ridership, hour, day_of_week):
        """
        Convert hourly ridership count to crowd level (1-4) using percentile-based thresholds.
        This ensures balanced distribution across all crowd levels.
        """
        # Get percentile thresholds (calculate once and cache)
        if not hasattr(self, '_percentile_thresholds'):
            self._percentile_thresholds = self.calculate_crowd_level_percentiles()
        
        p25 = self._percentile_thresholds['p25']
        p50 = self._percentile_thresholds['p50']
        p75 = self._percentile_thresholds['p75']
        
        # Apply percentile-based classification
        if ridership <= p25:
            return 1  # Low (bottom 25%)
        elif ridership <= p50:
            return 2  # Medium (25-50%)
        elif ridership <= p75:
            return 3  # High (50-75%)
        else:
            return 4  # Very High (top 25%)

    def _ridership_to_crowd_level(self, ridership, hour, day_of_week):
        """
        Convert hourly ridership count to crowd level (1-4)
        Now uses percentile-based thresholds for balanced distribution
        """
        # Use the new percentile-based method
        return self._ridership_to_crowd_level_percentile(ridership, hour, day_of_week)
    
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
    
    def update_crowd_data(self, max_records=None):
        """
        Main method: Update crowd data using the NEW MTA hourly API
        Now optimized for large datasets with better performance
        """
        print("🚇 MTA crowd data update (using NEW hourly ridership API)...")

        # Download all hourly ridership data by month (no limits)
        hourly_data = self.download_all_hourly_data_by_month(max_records=max_records)

        if hourly_data:
            print(f"📊 Processing {len(hourly_data)} total records...")
            
            # Convert to crowd estimates
            crowd_points = self.process_hourly_to_crowds(hourly_data)

            # Save to database in batches for better performance
            saved_count = self.save_crowd_data_batch(crowd_points)

            print(f"✅ Update complete: {saved_count} new data points")
            print(f"📊 Data source: MTA Official Hourly Ridership API")
            return saved_count
        else:
            print("❌ No hourly ridership data downloaded")
            return 0

    def save_crowd_data_batch(self, crowd_points, batch_size=1000):
        """Save crowd data to database in batches for better performance"""
        print(f"💾 Saving {len(crowd_points)} crowd estimates in batches...")
        
        saved_count = 0
        total_batches = (len(crowd_points) + batch_size - 1) // batch_size
        
        for i in range(0, len(crowd_points), batch_size):
            batch = crowd_points[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            
            print(f"  📦 Processing batch {batch_num}/{total_batches} ({len(batch)} records)...")
            
            batch_saved = 0
            for point_data in batch:
                try:
                    # Check for duplicates
                    existing = CrowdDataPoint.query.filter_by(
                        station_id=point_data['station_id'],
                        timestamp=point_data['timestamp']
                    ).first()
                    
                    if not existing:
                        crowd_point = CrowdDataPoint(**point_data)
                        db.session.add(crowd_point)
                        batch_saved += 1
                    
                except Exception as e:
                    if batch_saved <= 5:  # Show first 5 errors only
                        print(f"    ⚠️  Error saving point: {e}")
                    continue
            
            try:
                db.session.commit()
                saved_count += batch_saved
                print(f"    ✅ Batch {batch_num} complete: {batch_saved} new records saved")
            except Exception as e:
                db.session.rollback()
                print(f"    ❌ Error committing batch {batch_num}: {e}")
                continue
        
        print(f"  ✅ Total saved: {saved_count} new crowd data points")
        return saved_count

    def update_crowd_data_chunk(self, start_year=None, end_year=None):
        """
        Update crowd data for a specific year range (chunked processing)
        """
        print(f"🚇 MTA crowd data update (chunked: {start_year}-{end_year})...")

        # Download hourly ridership data for the specified year range
        hourly_data = self.download_all_hourly_data_by_month(
            start_year=start_year, 
            end_year=end_year
        )

        if hourly_data:
            print(f"📊 Processing {len(hourly_data)} total records...")
            
            # Convert to crowd estimates
            crowd_points = self.process_hourly_to_crowds(hourly_data)

            # Save to database in batches for better performance
            saved_count = self.save_crowd_data_batch(crowd_points)

            print(f"✅ Chunk update complete: {saved_count} new data points")
            return saved_count
        else:
            print("❌ No hourly ridership data downloaded for this chunk")
            return 0

    def download_aggregated_data(self, aggregation='daily', days_back=30):
        """
        Download pre-aggregated data for much faster processing.
        This mimics how professional apps work - they use aggregated data.
        """
        print(f"backend/app/services/mta_crowd_service.py: Downloading {aggregation} aggregated data...")
        
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        
        # Use a different endpoint or aggregation method
        # For now, we'll use the hourly API but with larger time buckets
        params = {
            '$where': f"transit_timestamp >= '{start_date.strftime('%Y-%m-%d')}' AND transit_timestamp <= '{end_date.strftime('%Y-%m-%d')}'",
            '$select': 'station_complex_id,station_complex,route_id,transit_mode,borough,AVG(ridership) as avg_ridership,COUNT(*) as record_count',
            '$group': 'station_complex_id,station_complex,route_id,transit_mode,borough',
            '$order': 'avg_ridership DESC',
            '$limit': 1000  # Limit to top stations for speed
        }
        
        try:
            response = requests.get(self.mta_hourly_api, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            print(f"✅ Downloaded {len(data)} aggregated records")
            return data
        except Exception as e:
            print(f"❌ Failed to download aggregated data: {e}")
            return []

    def process_aggregated_to_crowds(self, aggregated_data):
        """
        Convert aggregated data to crowd estimates (much faster)
        """
        print("🔄 Converting aggregated data to crowd estimates...")
        
        crowd_points = []
        processed = 0
        errors = 0
        
        for record in aggregated_data:
            try:
                # Extract basic info
                station_id = record.get('station_complex_id', 'unknown')
                station_name = record.get('station_complex', 'Unknown Station')
                route_id = record.get('route_id', 'unknown')
                transit_mode = record.get('transit_mode', 'subway')
                borough = record.get('borough', 'Unknown')
                avg_ridership = float(record.get('avg_ridership', 0))
                record_count = int(record.get('record_count', 1))
                
                # Calculate crowd level based on average ridership
                if avg_ridership < 50:
                    crowd_level = 1  # Low
                elif avg_ridership < 150:
                    crowd_level = 2  # Medium
                elif avg_ridership < 300:
                    crowd_level = 3  # High
                else:
                    crowd_level = 4  # Very High
                
                # Create crowd data point
                crowd_point = CrowdDataPoint(
                    station_id=station_id,
                    station_name=station_name,
                    route_id=route_id,
                    transit_mode=transit_mode,
                    borough=borough,
                    crowd_level=crowd_level,
                    raw_entries=int(avg_ridership),
                    timestamp=datetime.now(),
                    data_source="MTA Aggregated API"
                )
                
                crowd_points.append(crowd_point)
                processed += 1
                
            except Exception as e:
                errors += 1
                continue
        
        print(f"✅ Converted {processed} aggregated records to crowd estimates")
        print(f"📊 Processed: {processed}, Errors: {errors}")
        return crowd_points

    def update_crowd_data_fast(self, days_back=30):
        """
        Fast update using aggregated data (like professional apps)
        """
        print("🚇 MTA crowd data update (FAST - using aggregated data)...")
        
        # Download aggregated data
        aggregated_data = self.download_aggregated_data(days_back=days_back)
        
        if aggregated_data:
            # Convert to crowd estimates
            crowd_points = self.process_aggregated_to_crowds(aggregated_data)
            
            # Save to database
            saved_count = self.save_crowd_data_batch(crowd_points)
            
            print(f"✅ Fast update complete: {saved_count} new data points")
            return saved_count
        else:
            print("❌ No aggregated data downloaded")
            return 0

    def generate_sample_data(self, num_stations=50, days_back=30):
        """
        Generate synthetic sample data for rapid testing (like professional apps do during development)
        """
        print(f"backend/app/services/mta_crowd_service.py: Generating {num_stations} sample stations...")
        
        import random
        from datetime import timedelta
        
        # Sample station data (real MTA stations)
        sample_stations = [
            ("G", "Flushing Av", "Brooklyn"),
            ("7", "Times Square-42 St", "Manhattan"),
            ("6", "Grand Central-42 St", "Manhattan"),
            ("L", "Bedford Av", "Brooklyn"),
            ("N", "Astoria-Ditmars Blvd", "Queens"),
            ("A", "125 St", "Manhattan"),
            ("F", "Delancey St", "Manhattan"),
            ("R", "Forest Hills-71 Av", "Queens"),
            ("1", "South Ferry", "Manhattan"),
            ("2", "Flatbush Av-Brooklyn College", "Brooklyn"),
            ("3", "Harlem-148 St", "Manhattan"),
            ("4", "Woodlawn", "Bronx"),
            ("5", "Dyre Av", "Bronx"),
            ("B", "Brighton Beach", "Brooklyn"),
            ("C", "168 St", "Manhattan"),
            ("D", "Norwood-205 St", "Bronx"),
            ("E", "Jamaica Center-Parsons/Archer", "Queens"),
            ("J", "Jamaica Center-Parsons/Archer", "Queens"),
            ("M", "Middle Village-Metropolitan Av", "Queens"),
            ("Q", "Coney Island-Stillwell Av", "Brooklyn"),
            ("W", "Astoria-Ditmars Blvd", "Queens"),
            ("Z", "Jamaica Center-Parsons/Archer", "Queens")
        ]
        
        crowd_points = []
        end_date = datetime.now()
        
        for i in range(num_stations):
            # Select random station
            route_id, station_name, borough = random.choice(sample_stations)
            station_id = f"{route_id}_{station_name.replace(' ', '_').replace('-', '_')}"
            
            # Generate multiple data points per station
            for day in range(days_back):
                for hour in range(24):
                    # Generate realistic ridership based on time of day
                    base_ridership = 50
                    
                    # Rush hour multipliers
                    if 7 <= hour <= 9:  # Morning rush
                        base_ridership *= random.uniform(2.0, 4.0)
                    elif 17 <= hour <= 19:  # Evening rush
                        base_ridership *= random.uniform(1.5, 3.0)
                    elif 22 <= hour or hour <= 5:  # Late night
                        base_ridership *= random.uniform(0.1, 0.5)
                    
                    # Weekend effect
                    day_of_week = (end_date - timedelta(days=day)).weekday()
                    if day_of_week >= 5:  # Weekend
                        base_ridership *= random.uniform(0.6, 0.9)
                    
                    # Add some randomness
                    ridership = int(base_ridership * random.uniform(0.8, 1.2))
                    
                    # Calculate crowd level
                    if ridership < 50:
                        crowd_level = 1
                    elif ridership < 150:
                        crowd_level = 2
                    elif ridership < 300:
                        crowd_level = 3
                    else:
                        crowd_level = 4
                    
                    # Create timestamp
                    timestamp = end_date - timedelta(days=day, hours=hour)
                    
                    crowd_point = CrowdDataPoint(
                        station_id=station_id,
                        station_name=station_name,
                        route_id=route_id,
                        transit_mode="subway",
                        borough=borough,
                        crowd_level=crowd_level,
                        raw_entries=ridership,
                        timestamp=timestamp,
                        data_source="Sample Data"
                    )
                    
                    crowd_points.append(crowd_point)
        
        print(f"✅ Generated {len(crowd_points)} sample data points")
        return crowd_points

    def update_crowd_data_sample(self, num_stations=50, days_back=30):
        """
        Fast update using sample data (for development/testing)
        """
        print("🚇 MTA crowd data update (SAMPLE - for rapid testing)...")
        
        # Generate sample data
        crowd_points = self.generate_sample_data(num_stations, days_back)
        
        if crowd_points:
            # Save to database
            saved_count = self.save_crowd_data_batch(crowd_points)
            
            print(f"✅ Sample update complete: {saved_count} new data points")
            return saved_count
        else:
            print("❌ No sample data generated")
            return 0