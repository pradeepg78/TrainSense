"""
Comprehensive MTA Data Service for Crowd Prediction
Fetches and processes one week per month + holidays from 2021-2024
"""

import os
import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import time
import json
import logging
from sqlalchemy import create_engine, text
from app import create_app, db
from app.models.crowd_prediction import CrowdDataPoint
from app.models.transit import Route, Stop

logger = logging.getLogger(__name__)

class MTAComprehensiveService:
    """
    Comprehensive MTA data service that fetches one week per month + holidays
    from 2021-2024 and processes it for crowd prediction
    """
    
    def __init__(self):
        self.app = create_app()
        self.base_url = "https://data.ny.gov/resource/wujg-7c2s.json"
        self.session = requests.Session()
        
        # API limits and configuration
        self.max_records_per_request = 50000  # Socrata limit
        self.request_delay = 0.1  # Be nice to the API
        
        # Data processing configuration
        self.batch_size = 10000
        self.min_records_for_training = 100000
        
    def get_data_range(self):
        """Get the full date range of available data"""
        print("📊 Determining available data range...")
        
        # Get earliest date
        earliest_params = {
            '$limit': 1,
            '$order': 'transit_timestamp ASC'
        }
        
        # Get latest date
        latest_params = {
            '$limit': 1,
            '$order': 'transit_timestamp DESC'
        }
        
        try:
            earliest_response = self.session.get(self.base_url, params=earliest_params, timeout=30)
            latest_response = self.session.get(self.base_url, params=latest_params, timeout=30)
            
            earliest_data = earliest_response.json()
            latest_data = latest_response.json()
            
            if earliest_data and latest_data:
                earliest_date = datetime.fromisoformat(earliest_data[0]['transit_timestamp'].replace('Z', ''))
                latest_date = datetime.fromisoformat(latest_data[0]['transit_timestamp'].replace('Z', ''))
                
                print(f"📅 Data available from {earliest_date.strftime('%Y-%m-%d')} to {latest_date.strftime('%Y-%m-%d')}")
                print(f"📊 Total time span: {(latest_date - earliest_date).days} days")
                
                return earliest_date, latest_date
            else:
                raise Exception("No data found in API response")
                
        except Exception as e:
            print(f"❌ Error getting data range: {e}")
            # Fallback to known range
            return datetime(2020, 1, 1), datetime(2024, 12, 31)
    
    def fetch_data_chunk(self, start_date, end_date, offset=0):
        """Fetch a chunk of data for a specific date range"""
        start_str = start_date.strftime("%Y-%m-%dT00:00:00.000")
        end_str = end_date.strftime("%Y-%m-%dT23:59:59.999")
        
        params = {
            '$where': f"transit_timestamp >= '{start_str}' AND transit_timestamp <= '{end_str}'",
            '$order': 'transit_timestamp ASC',
            '$limit': self.max_records_per_request,
            '$offset': offset
        }
        
        try:
            response = self.session.get(self.base_url, params=params, timeout=60)
            response.raise_for_status()
            data = response.json()
            
            if isinstance(data, dict) and data.get('error'):
                print(f"❌ API Error: {data.get('message', 'Unknown error')}")
                return []
            
            return data
            
        except Exception as e:
            print(f"❌ Error fetching data chunk: {e}")
            return []
    
    def fetch_useful_data(self, start_year=2021, end_year=2024):
        """Fetch only useful data: one week per month + all holidays from 2021-2024"""
        print(f"🚇 Fetching useful MTA data from {start_year}-{end_year}")
        print("📊 Downloading one week per month + all holidays...")
        
        all_data = []
        chunk_count = 0
        
        # US Federal Holidays (comprehensive list for 2021-2024)
        federal_holidays = [
            # 2021
            datetime(2021, 1, 1),   # New Year's Day
            datetime(2021, 1, 18),  # MLK Day
            datetime(2021, 2, 15),  # Presidents' Day
            datetime(2021, 5, 31),  # Memorial Day
            datetime(2021, 7, 5),   # Independence Day (observed)
            datetime(2021, 9, 6),   # Labor Day
            datetime(2021, 10, 11), # Columbus Day
            datetime(2021, 11, 11), # Veterans Day
            datetime(2021, 11, 25), # Thanksgiving
            datetime(2021, 12, 24), # Christmas (observed)
            
            # 2022
            datetime(2022, 1, 17),  # MLK Day
            datetime(2022, 2, 21),  # Presidents' Day
            datetime(2022, 5, 30),  # Memorial Day
            datetime(2022, 7, 4),   # Independence Day
            datetime(2022, 9, 5),   # Labor Day
            datetime(2022, 10, 10), # Columbus Day
            datetime(2022, 11, 11), # Veterans Day
            datetime(2022, 11, 24), # Thanksgiving
            datetime(2022, 12, 26), # Christmas (observed)
            
            # 2023
            datetime(2023, 1, 2),   # New Year's Day (observed)
            datetime(2023, 1, 16),  # MLK Day
            datetime(2023, 2, 20),  # Presidents' Day
            datetime(2023, 5, 29),  # Memorial Day
            datetime(2023, 7, 4),   # Independence Day
            datetime(2023, 9, 4),   # Labor Day
            datetime(2023, 10, 9),  # Columbus Day
            datetime(2023, 11, 10), # Veterans Day (observed)
            datetime(2023, 11, 23), # Thanksgiving
            datetime(2023, 12, 25), # Christmas
            
            # 2024
            datetime(2024, 1, 1),   # New Year's Day
            datetime(2024, 1, 15),  # MLK Day
            datetime(2024, 2, 19),  # Presidents' Day
            datetime(2024, 5, 27),  # Memorial Day
            datetime(2024, 7, 4),   # Independence Day
            datetime(2024, 9, 2),   # Labor Day
            datetime(2024, 10, 14), # Columbus Day
            datetime(2024, 11, 11), # Veterans Day
            datetime(2024, 11, 28), # Thanksgiving
            datetime(2024, 12, 25), # Christmas
        ]
        
        # Convert to set for faster lookup
        holiday_set = set(holiday.date() for holiday in federal_holidays)
        
        # Use actual available data range, but focus on 2021-2024
        earliest_date, latest_date = self.get_data_range()
        start_date = max(earliest_date, datetime(2021, 1, 1))
        end_date = min(latest_date, datetime(2024, 12, 31))
        
        current_date = start_date
        
        while current_date <= end_date:
            # Process one month at a time
            if current_date.month == 12:
                next_month = datetime(current_date.year + 1, 1, 1)
            else:
                next_month = datetime(current_date.year, current_date.month + 1, 1)
            
            month_end = min(next_month - timedelta(days=1), end_date)
            
            print(f"📅 Processing {current_date.strftime('%Y-%m')} (one week + holidays)...")
            
            # Get one representative week (Monday-Saturday) for this month
            useful_dates = []
            
            # Find the first Monday of the month
            first_monday = current_date
            while first_monday.weekday() != 0:  # 0 = Monday
                first_monday += timedelta(days=1)
            
            # Add Monday-Saturday (6 days) for the representative week
            for i in range(6):
                week_day = first_monday + timedelta(days=i)
                if week_day <= month_end:
                    useful_dates.append(week_day)
            
            # Add all holidays for this year that fall in this month
            year_holidays = [h for h in federal_holidays if h.year == current_date.year and h.month == current_date.month]
            for holiday in year_holidays:
                if holiday >= current_date and holiday <= month_end:
                    useful_dates.append(holiday)
            
            # Remove duplicates
            useful_dates = list(set(useful_dates))
            useful_dates.sort()
            
            print(f"  📊 Found {len(useful_dates)} useful days in {current_date.strftime('%Y-%m')}")
            print(f"    📅 Week: {useful_dates[0].strftime('%Y-%m-%d')} to {useful_dates[5].strftime('%Y-%m-%d')}")
            if len(useful_dates) > 6:
                print(f"    🎉 Holidays: {[d.strftime('%Y-%m-%d') for d in useful_dates[6:]]}")
            
            # Fetch data for useful dates only
            month_data = []
            
            for useful_date in useful_dates:
                # Fetch data for this specific day
                day_start = useful_date.replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = useful_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                
                offset = 0
                day_records = 0
                while True:
                    chunk = self.fetch_data_chunk(day_start, day_end, offset)
                    
                    if not chunk:
                        break
                    
                    month_data.extend(chunk)
                    day_records += len(chunk)
                    offset += len(chunk)
                    
                    # If we got fewer records than the limit, we've reached the end
                    if len(chunk) < self.max_records_per_request:
                        break
                    
                    # Be nice to the API
                    time.sleep(self.request_delay)
                
                print(f"    ✅ {useful_date.strftime('%Y-%m-%d')}: {day_records} records")
            
            all_data.extend(month_data)
            chunk_count += 1
            
            print(f"📊 Month complete: {len(month_data)} records")
            print(f"📈 Total so far: {len(all_data)} records")
            
            # Move to next month
            if current_date.month == 12:
                current_date = datetime(current_date.year + 1, 1, 1)
            else:
                current_date = datetime(current_date.year, current_date.month + 1, 1)
        
        print(f"🎉 Download complete!")
        print(f"📊 Total records: {len(all_data):,}")
        print(f"📅 Processed {chunk_count} months")
        print(f"📊 Focused on one week per month + holidays from 2021-2024")
        
        return all_data
    
    def run_ultra_fast_update(self):
        """Run ultra-fast update with minimal data for immediate testing"""
        print("🚇 MTA Ultra-Fast Data Update")
        print("=" * 50)
        print("📊 Fetching 3 key months from 2023 (ULTRA FAST MODE)")
        print()
        
        # Step 1: Fetch ultra-fast data (just 3 months)
        raw_data = self.fetch_ultra_fast_data()
        
        if not raw_data:
            print("❌ No data fetched")
            return 0
        
        # Step 2: Process data
        processed_data = self.process_raw_data(raw_data)
        
        if not processed_data:
            print("❌ No data processed")
            return 0
        
        # Step 3: Save to database
        saved_count = self.save_to_database(processed_data)
        
        if saved_count == 0:
            print("❌ No data saved")
            return 0
        
        # Step 4: Train ML model
        model_success = self.train_ml_model(saved_count)
        
        print("\n🎉 Ultra-fast update complete!")
        print(f"📊 Total records processed: {len(raw_data):,}")
        print(f"💾 Records saved: {saved_count:,}")
        print(f"🤖 Model training: {'✅ Success' if model_success else '❌ Failed'}")
        
        return saved_count
    
    def fetch_ultra_fast_data(self):
        """Fetch minimal data for ultra-fast training - just 3 key months"""
        print(f"🚇 Fetching ultra-fast MTA data from 2023")
        print("📊 Downloading 3 key months only (ULTRA FAST MODE)")
        
        all_data = []
        
        # Just 3 key months: January, June, November (representing different seasons)
        key_months = [
            (2023, 1),   # January - winter patterns
            (2023, 6),   # June - summer patterns  
            (2023, 11),  # November - fall patterns
        ]
        
        for year, month in key_months:
            print(f"📅 Processing {year}-{month:02d} (ULTRA FAST MODE)...")
            
            # Get one week from this month
            start_date = datetime(year, month, 1)
            if month == 12:
                end_date = datetime(year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = datetime(year, month + 1, 1) - timedelta(days=1)
            
            # Find the first Monday of the month
            first_monday = start_date
            while first_monday.weekday() != 0:  # 0 = Monday
                first_monday += timedelta(days=1)
            
            # Add Monday-Saturday (6 days)
            useful_dates = []
            for i in range(6):
                week_day = first_monday + timedelta(days=i)
                if week_day <= end_date:
                    useful_dates.append(week_day)
            
            print(f"  📊 Found {len(useful_dates)} days in {year}-{month:02d}")
            print(f"    📅 Week: {useful_dates[0].strftime('%Y-%m-%d')} to {useful_dates[-1].strftime('%Y-%m-%d')}")
            
            # Fetch data for useful dates only
            month_data = []
            
            for useful_date in useful_dates:
                # Fetch data for this specific day
                day_start = useful_date.replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = useful_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                
                offset = 0
                day_records = 0
                while True:
                    chunk = self.fetch_data_chunk(day_start, day_end, offset)
                    
                    if not chunk:
                        break
                    
                    month_data.extend(chunk)
                    day_records += len(chunk)
                    offset += len(chunk)
                    
                    # If we got fewer records than the limit, we've reached the end
                    if len(chunk) < self.max_records_per_request:
                        break
                    
                    # Be nice to the API
                    time.sleep(self.request_delay)
                
                print(f"    ✅ {useful_date.strftime('%Y-%m-%d')}: {day_records} records")
            
            all_data.extend(month_data)
            print(f"📊 Month complete: {len(month_data)} records")
            print(f"📈 Total so far: {len(all_data)} records")
        
        print(f"🎉 Ultra-fast download complete!")
        print(f"📊 Total records: {len(all_data):,}")
        print(f"📅 Processed 3 key months")
        print(f"📊 Ultra-fast mode complete")
        
        return all_data
    
    def process_raw_data(self, raw_data):
        """Process and clean the raw MTA data"""
        print("🔧 Processing raw MTA data...")
        
        if not raw_data:
            print("❌ No raw data to process")
            return []
        
        # Convert to DataFrame for efficient processing
        df = pd.DataFrame(raw_data)
        
        print(f"📊 Raw data shape: {df.shape}")
        print(f"📋 Columns: {list(df.columns)}")
        
        # Clean and filter the data
        processed_data = []
        
        # Debug: Check first few rows
        print(f"🔍 Debug: First 3 rows:")
        for i in range(min(3, len(df))):
            row = df.iloc[i]
            print(f"  Row {i}: station='{row.get('station_complex', 'N/A')}', ridership='{row.get('ridership', 'N/A')}', borough='{row.get('borough', 'N/A')}'")
        
        for _, row in df.iterrows():
            try:
                # Extract key information
                timestamp_str = row.get('transit_timestamp', '')
                if not timestamp_str:
                    continue
                
                # Parse timestamp
                timestamp = datetime.fromisoformat(timestamp_str.replace('Z', ''))
                
                # Extract station and route info
                station_complex = row.get('station_complex', '')
                borough = row.get('borough', '')
                ridership_raw = row.get('ridership', 0)
                
                # Convert ridership to integer (handle float strings like "10.0")
                try:
                    if isinstance(ridership_raw, str):
                        ridership = int(float(ridership_raw))
                    else:
                        ridership = int(ridership_raw) if ridership_raw else 0
                except (ValueError, TypeError):
                    ridership = 0
                
                # Skip invalid entries
                if not station_complex or ridership <= 0:
                    continue
                
                # Use station complex as route_id since MTA data doesn't have route info
                route_id = station_complex.split('-')[0] if '-' in station_complex else 'N'
                
                # Calculate crowd level based on ridership
                crowd_level = self.calculate_crowd_level(ridership, timestamp)
                
                # Create processed record
                processed_record = {
                    'station_complex': station_complex,
                    'route_id': route_id,
                    'borough': borough,
                    'timestamp': timestamp,
                    'ridership': ridership,
                    'crowd_level': crowd_level,
                    'hour_of_day': timestamp.hour,
                    'day_of_week': timestamp.weekday(),
                    'month': timestamp.month,
                    'year': timestamp.year
                }
                
                processed_data.append(processed_record)
                
            except Exception as e:
                print(f"⚠️ Error processing row: {e}")
                continue
        
        print(f"✅ Processed {len(processed_data)} records")
        return processed_data
    
    def calculate_crowd_level(self, ridership, timestamp):
        """Calculate crowd level based on ridership and time"""
        # Base crowd level on ridership
        if ridership <= 50:
            return 1  # Low
        elif ridership <= 150:
            return 2  # Medium
        elif ridership <= 300:
            return 3  # High
        else:
            return 4  # Very High
    
    def save_to_database(self, processed_data):
        """Save processed data to database"""
        print("💾 Saving data to database...")
        
        with self.app.app_context():
            saved_count = 0
            
            for record in processed_data:
                try:
                    # Check if record already exists
                    existing = db.session.query(CrowdDataPoint).filter(
                        CrowdDataPoint.station_id == record['station_complex'],
                        CrowdDataPoint.route_id == record['route_id'],
                        CrowdDataPoint.timestamp == record['timestamp']
                    ).first()
                    
                    if existing:
                        continue
                    
                    # Create new crowd data point
                    crowd_point = CrowdDataPoint(
                        station_id=record['station_complex'],
                        route_id=record['route_id'],
                        station_name=record['station_complex'],
                        borough=record['borough'],
                        timestamp=record['timestamp'],
                        hour_of_day=record['hour_of_day'],
                        day_of_week=record['day_of_week'],
                        crowd_level=record['crowd_level'],
                        raw_entries=record['ridership'],
                        source='mta_comprehensive_api'
                    )
                    
                    db.session.add(crowd_point)
                    saved_count += 1
                    
                    # Commit in batches
                    if saved_count % self.batch_size == 0:
                        db.session.commit()
                        print(f"  ✅ Saved {saved_count} records...")
                
                except Exception as e:
                    db.session.rollback()
                    print(f"⚠️ Error saving record: {e}")
                    continue
            
            # Final commit
            db.session.commit()
            print(f"✅ Total saved: {saved_count} records")
            return saved_count
    
    def train_ml_model(self, data_count):
        """Train ML model with the comprehensive dataset"""
        print("🤖 Training ML model with comprehensive dataset...")
        
        if data_count < self.min_records_for_training:
            print(f"⚠️ Insufficient data for training ({data_count} < {self.min_records_for_training})")
            return False
        
        try:
            from app.services.crowd_prediction_service import CrowdPredictionService
            
            service = CrowdPredictionService()
            success = service.train_model()
            
            if success:
                print(f"✅ Model trained successfully with {data_count:,} records")
                return True
            else:
                print("❌ Model training failed")
                return False
                
        except Exception as e:
            print(f"❌ Error training model: {e}")
            return False
    
    def run_comprehensive_update(self, start_year=2021, end_year=2024):
        """Run the complete comprehensive data update"""
        print("🚇 MTA Useful Data Update")
        print("=" * 50)
        print(f"📊 Fetching {start_year}-{end_year} useful data (one week per month + holidays)")
        print()
        
        # Step 1: Fetch useful data only
        raw_data = self.fetch_useful_data(start_year, end_year)
        
        if not raw_data:
            print("❌ No data fetched")
            return 0
        
        # Step 2: Process data
        processed_data = self.process_raw_data(raw_data)
        
        if not processed_data:
            print("❌ No data processed")
            return 0
        
        # Step 3: Save to database
        saved_count = self.save_to_database(processed_data)
        
        if saved_count == 0:
            print("❌ No data saved")
            return 0
        
        # Step 4: Train ML model
        model_success = self.train_ml_model(saved_count)
        
        print("\n🎉 Comprehensive update complete!")
        print(f"📊 Total records processed: {len(raw_data):,}")
        print(f"💾 Records saved: {saved_count:,}")
        print(f"🤖 Model training: {'✅ Success' if model_success else '❌ Failed'}")
        
        return saved_count 
    
    def run_fast_update(self):
        """Run a fast data update with minimal data for quick ML training"""
        print("🚇 MTA Fast Data Update")
        print("=" * 50)
        print("📊 Fetching 2023 data only (one week per month + holidays)")
        print()
        
        # Step 1: Fetch fast data (just 2023)
        raw_data = self.fetch_fast_data()
        
        if not raw_data:
            print("❌ No data fetched")
            return 0
        
        # Step 2: Process data
        processed_data = self.process_raw_data(raw_data)
        
        if not processed_data:
            print("❌ No data processed")
            return 0
        
        # Step 3: Save to database
        saved_count = self.save_to_database(processed_data)
        
        if saved_count == 0:
            print("❌ No data saved")
            return 0
        
        # Step 4: Train ML model
        model_success = self.train_ml_model(saved_count)
        
        print("\n🎉 Fast update complete!")
        print(f"📊 Total records processed: {len(raw_data):,}")
        print(f"💾 Records saved: {saved_count:,}")
        print(f"🤖 Model training: {'✅ Success' if model_success else '❌ Failed'}")
        
        return saved_count
    
    def fetch_fast_data(self):
        """Fetch minimal data for fast training - just 2023 with key patterns"""
        print(f"🚇 Fetching fast MTA data from 2023")
        print("📊 Downloading one week per month + holidays (FAST MODE)")
        
        all_data = []
        chunk_count = 0
        
        # US Federal Holidays for 2023 only
        federal_holidays_2023 = [
            datetime(2023, 1, 2),   # New Year's Day (observed)
            datetime(2023, 1, 16),  # MLK Day
            datetime(2023, 2, 20),  # Presidents' Day
            datetime(2023, 5, 29),  # Memorial Day
            datetime(2023, 7, 4),   # Independence Day
            datetime(2023, 9, 4),   # Labor Day
            datetime(2023, 10, 9),  # Columbus Day
            datetime(2023, 11, 10), # Veterans Day (observed)
            datetime(2023, 11, 23), # Thanksgiving
            datetime(2023, 12, 25), # Christmas
        ]
        
        # Convert to set for faster lookup
        holiday_set = set(holiday.date() for holiday in federal_holidays_2023)
        
        # Focus on 2023 only
        start_date = datetime(2023, 1, 1)
        end_date = datetime(2023, 12, 31)
        
        current_date = start_date
        
        while current_date <= end_date:
            # Process one month at a time
            if current_date.month == 12:
                next_month = datetime(current_date.year + 1, 1, 1)
            else:
                next_month = datetime(current_date.year, current_date.month + 1, 1)
            
            month_end = min(next_month - timedelta(days=1), end_date)
            
            print(f"📅 Processing {current_date.strftime('%Y-%m')} (FAST MODE)...")
            
            # Get one representative week (Monday-Saturday) for this month
            useful_dates = []
            
            # Find the first Monday of the month
            first_monday = current_date
            while first_monday.weekday() != 0:  # 0 = Monday
                first_monday += timedelta(days=1)
            
            # Add Monday-Saturday (6 days) for the representative week
            for i in range(6):
                week_day = first_monday + timedelta(days=i)
                if week_day <= month_end:
                    useful_dates.append(week_day)
            
            # Add all holidays for this year that fall in this month
            year_holidays = [h for h in federal_holidays_2023 if h.year == current_date.year and h.month == current_date.month]
            for holiday in year_holidays:
                if holiday >= current_date and holiday <= month_end:
                    useful_dates.append(holiday)
            
            # Remove duplicates
            useful_dates = list(set(useful_dates))
            useful_dates.sort()
            
            print(f"  📊 Found {len(useful_dates)} useful days in {current_date.strftime('%Y-%m')}")
            print(f"    📅 Week: {useful_dates[0].strftime('%Y-%m-%d')} to {useful_dates[5].strftime('%Y-%m-%d')}")
            if len(useful_dates) > 6:
                print(f"    🎉 Holidays: {[d.strftime('%Y-%m-%d') for d in useful_dates[6:]]}")
            
            # Fetch data for useful dates only
            month_data = []
            
            for useful_date in useful_dates:
                # Fetch data for this specific day
                day_start = useful_date.replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = useful_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                
                offset = 0
                day_records = 0
                while True:
                    chunk = self.fetch_data_chunk(day_start, day_end, offset)
                    
                    if not chunk:
                        break
                    
                    month_data.extend(chunk)
                    day_records += len(chunk)
                    offset += len(chunk)
                    
                    # If we got fewer records than the limit, we've reached the end
                    if len(chunk) < self.max_records_per_request:
                        break
                    
                    # Be nice to the API
                    time.sleep(self.request_delay)
                
                print(f"    ✅ {useful_date.strftime('%Y-%m-%d')}: {day_records} records")
            
            all_data.extend(month_data)
            chunk_count += 1
            
            print(f"📊 Month complete: {len(month_data)} records")
            print(f"📈 Total so far: {len(all_data)} records")
            
            # Move to next month
            if current_date.month == 12:
                current_date = datetime(current_date.year + 1, 1, 1)
            else:
                current_date = datetime(current_date.year, current_date.month + 1, 1)
        
        print(f"🎉 Fast download complete!")
        print(f"📊 Total records: {len(all_data):,}")
        print(f"📅 Processed {chunk_count} months")
        print(f"📊 Focused on 2023 data only (FAST MODE)")
        
        return all_data 
    
    def run_ultra_fast_update(self):
        """Run ultra-fast update with minimal data for immediate testing"""
        print("🚇 MTA Ultra-Fast Data Update")
        print("=" * 50)
        print("📊 Fetching 3 key months from 2023 (ULTRA FAST MODE)")
        print()
        
        # Step 1: Fetch ultra-fast data (just 3 months)
        raw_data = self.fetch_ultra_fast_data()
        
        if not raw_data:
            print("❌ No data fetched")
            return 0
        
        # Step 2: Process data
        processed_data = self.process_raw_data(raw_data)
        
        if not processed_data:
            print("❌ No data processed")
            return 0
        
        # Step 3: Save to database
        saved_count = self.save_to_database(processed_data)
        
        if saved_count == 0:
            print("❌ No data saved")
            return 0
        
        # Step 4: Train ML model
        model_success = self.train_ml_model(saved_count)
        
        print("\n🎉 Ultra-fast update complete!")
        print(f"📊 Total records processed: {len(raw_data):,}")
        print(f"💾 Records saved: {saved_count:,}")
        print(f"🤖 Model training: {'✅ Success' if model_success else '❌ Failed'}")
        
        return saved_count
    
    def fetch_ultra_fast_data(self):
        """Fetch minimal data for ultra-fast training - just 3 key months"""
        print(f"🚇 Fetching ultra-fast MTA data from 2023")
        print("📊 Downloading 3 key months only (ULTRA FAST MODE)")
        
        all_data = []
        
        # Just 3 key months: January, June, November (representing different seasons)
        key_months = [
            (2023, 1),   # January - winter patterns
            (2023, 6),   # June - summer patterns  
            (2023, 11),  # November - fall patterns
        ]
        
        for year, month in key_months:
            print(f"📅 Processing {year}-{month:02d} (ULTRA FAST MODE)...")
            
            # Get one week from this month
            start_date = datetime(year, month, 1)
            if month == 12:
                end_date = datetime(year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = datetime(year, month + 1, 1) - timedelta(days=1)
            
            # Find the first Monday of the month
            first_monday = start_date
            while first_monday.weekday() != 0:  # 0 = Monday
                first_monday += timedelta(days=1)
            
            # Add Monday-Saturday (6 days)
            useful_dates = []
            for i in range(6):
                week_day = first_monday + timedelta(days=i)
                if week_day <= end_date:
                    useful_dates.append(week_day)
            
            print(f"  📊 Found {len(useful_dates)} days in {year}-{month:02d}")
            print(f"    📅 Week: {useful_dates[0].strftime('%Y-%m-%d')} to {useful_dates[-1].strftime('%Y-%m-%d')}")
            
            # Fetch data for useful dates only
            month_data = []
            
            for useful_date in useful_dates:
                # Fetch data for this specific day
                day_start = useful_date.replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = useful_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                
                offset = 0
                day_records = 0
                while True:
                    chunk = self.fetch_data_chunk(day_start, day_end, offset)
                    
                    if not chunk:
                        break
                    
                    month_data.extend(chunk)
                    day_records += len(chunk)
                    offset += len(chunk)
                    
                    # If we got fewer records than the limit, we've reached the end
                    if len(chunk) < self.max_records_per_request:
                        break
                    
                    # Be nice to the API
                    time.sleep(self.request_delay)
                
                print(f"    ✅ {useful_date.strftime('%Y-%m-%d')}: {day_records} records")
            
            all_data.extend(month_data)
            print(f"📊 Month complete: {len(month_data)} records")
            print(f"📈 Total so far: {len(all_data)} records")
        
        print(f"🎉 Ultra-fast download complete!")
        print(f"📊 Total records: {len(all_data):,}")
        print(f"📅 Processed 3 key months")
        print(f"📊 Ultra-fast mode complete")
        
        return all_data 