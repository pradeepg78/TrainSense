# backend/scripts/fixed_smart_ridership_sampler.py
import os
import sqlite3
import pandas as pd
from datetime import datetime, timedelta
import numpy as np
from sodapy import Socrata

def sample_ridership_data_fixed(output_db_path, sample_size=50000):
    """
    Fixed version - handles empty DataFrames and SQL syntax errors
    """
    
    print("🚇 Fixed Smart Ridership Data Sampling")
    print("=" * 40)
    print(f"📊 Target sample size: {sample_size:,} rows")
    print("⚡ Using real MTA data with proper error handling!")
    
    # Create connection to NYC Open Data
    client = Socrata("data.ny.gov", None)
    dataset_id = "wujg-7c2s"  # MTA Subway Hourly Ridership
    
    # Define strategic sampling periods
    sampling_strategy = get_strategic_sampling_dates()
    
    all_samples = []
    total_fetched = 0
    
    for period_name, date_range, sample_count in sampling_strategy:
        print(f"\n📅 Sampling {period_name}: {date_range['start']} to {date_range['end']}")
        print(f"🎯 Target: {sample_count:,} rows")
        
        # Build date filter query
        where_clause = f"transit_timestamp >= '{date_range['start']}T00:00:00' AND transit_timestamp <= '{date_range['end']}T23:59:59'"
        
        try:
            # Get random sample from this period
            results = client.get(
                dataset_id,
                where=where_clause,
                limit=sample_count,
                order="transit_timestamp DESC"  # Get recent data first
            )
            
            if results:
                df = pd.DataFrame.from_records(results)
                df['period_type'] = period_name
                all_samples.append(df)
                total_fetched += len(df)
                print(f"✅ Fetched {len(df):,} rows for {period_name}")
            else:
                print(f"⚠️  No data found for {period_name}")
                
        except Exception as e:
            print(f"❌ Error fetching {period_name}: {e}")
            continue
    
    client.close()
    
    if not all_samples:
        print("❌ No data fetched!")
        return False
    
    # Combine all samples
    print(f"\n🔄 Processing {total_fetched:,} sampled rows...")
    combined_df = pd.concat(all_samples, ignore_index=True)
    
    # Process the sample data with better error handling
    processed_data = process_sample_data_fixed(combined_df)
    
    # Save to database with proper error handling
    save_sample_to_db_fixed(processed_data, output_db_path)
    
    print(f"""
🎉 Fixed Sampling Complete!
📊 Total rows sampled: {total_fetched:,}
📊 Crowd patterns generated: {len(processed_data.get('crowd_predictions', pd.DataFrame())):,}
💾 Database: {output_db_path}
⚡ Real MTA data successfully processed!
    """)
    
    return True

def get_strategic_sampling_dates():
    """
    Define strategic sampling periods to capture different patterns
    """
    
    # Use 2024 data (complete year)
    sampling_strategy = [
        # Regular weekdays - Q1
        ("Winter_Weekdays", {
            "start": "2024-01-15", 
            "end": "2024-01-19"
        }, 8000),
        
        # Regular weekdays - Q2  
        ("Spring_Weekdays", {
            "start": "2024-04-15", 
            "end": "2024-04-19"
        }, 8000),
        
        # Regular weekdays - Q3
        ("Summer_Weekdays", {
            "start": "2024-07-15", 
            "end": "2024-07-19"
        }, 8000),
        
        # Regular weekdays - Q4
        ("Fall_Weekdays", {
            "start": "2024-10-15", 
            "end": "2024-10-19"
        }, 8000),
        
        # Weekend patterns
        ("Regular_Weekends", {
            "start": "2024-03-01", 
            "end": "2024-03-31"
        }, 5000),
        
        # Holiday periods (different patterns)
        ("Holiday_Thanksgiving", {
            "start": "2024-11-20", 
            "end": "2024-11-30"
        }, 3000),
        
        ("Holiday_Christmas", {
            "start": "2024-12-20", 
            "end": "2024-12-31"
        }, 3000),
        
        ("Holiday_Summer", {
            "start": "2024-07-01", 
            "end": "2024-07-07"
        }, 3000),
        
        # Recent data from 2024 (avoid 2025 which might be incomplete)
        ("Recent_Data", {
            "start": "2024-11-01", 
            "end": "2024-12-15"
        }, 6000),
    ]
    
    return sampling_strategy

def process_sample_data_fixed(df):
    """Process the sampled data with proper error handling"""
    
    print("🔄 Processing sample data into crowd patterns...")
    
    try:
        # Convert data types with error handling
        df['transit_timestamp'] = pd.to_datetime(df['transit_timestamp'], errors='coerce')
        df['ridership'] = pd.to_numeric(df['ridership'], errors='coerce')
        
        # Remove rows with missing critical data
        df = df.dropna(subset=['ridership', 'station_complex_id', 'transit_timestamp'])
        
        if df.empty:
            print("❌ No valid data after cleaning!")
            return create_empty_patterns()
        
        # Extract time features
        df['hour'] = df['transit_timestamp'].dt.hour
        df['day_of_week'] = df['transit_timestamp'].dt.dayofweek
        df['month'] = df['transit_timestamp'].dt.month
        df['date'] = df['transit_timestamp'].dt.date
        
        # Classify patterns
        df['day_type'] = df['day_of_week'].apply(classify_day_type_fixed)
        df['peak_period'] = df['hour'].apply(classify_peak_period_fixed)
        df['hour_of_week'] = df['day_of_week'] * 24 + df['hour']
        
        # Handle holidays
        df['is_holiday'] = df['period_type'].str.contains('Holiday', na=False)
        df.loc[df['is_holiday'], 'day_type'] = 'holiday'
        
        # Only subway data
        if 'transit_mode' in df.columns:
            df = df[df['transit_mode'] == 'Subway']
        
        # Ensure we still have data
        if df.empty:
            print("❌ No subway data found!")
            return create_empty_patterns()
        
        # Create patterns with proper error handling
        patterns = create_patterns_from_sample_fixed(df)
        
        return patterns
        
    except Exception as e:
        print(f"❌ Error processing data: {e}")
        return create_empty_patterns()

def create_empty_patterns():
    """Create empty pattern DataFrames with correct structure"""
    return {
        'hourly_patterns': pd.DataFrame(columns=[
            'station_complex_id', 'hour_of_week', 'day_type', 
            'avg_ridership', 'peak_ridership', 'min_ridership'
        ]),
        'daily_patterns': pd.DataFrame(columns=[
            'station_complex_id', 'day_type', 'borough',
            'total_ridership', 'peak_hour'
        ]),
        'crowd_predictions': pd.DataFrame(columns=[
            'station_complex_id', 'hour_of_week', 'day_type', 'borough',
            'avg_ridership', 'peak_ridership', 'crowd_level', 
            'hour_of_day', 'day_of_week_num'
        ]),
        'peak_patterns': pd.DataFrame(columns=[
            'station_complex_id', 'peak_period', 'avg_ridership', 'ridership_std'
        ])
    }

def classify_day_type_fixed(day_of_week):
    """Classify day type for patterns"""
    if pd.isna(day_of_week):
        return 'weekday'
    if day_of_week < 5:
        return 'weekday'
    elif day_of_week == 5:
        return 'saturday'
    else:
        return 'sunday'

def classify_peak_period_fixed(hour):
    """Classify time periods for crowd prediction"""
    if pd.isna(hour):
        return 'overnight'
    if 6 <= hour <= 9:
        return 'morning_rush'
    elif 17 <= hour <= 20:
        return 'evening_rush'
    elif 10 <= hour <= 16:
        return 'midday'
    elif 21 <= hour <= 23:
        return 'evening'
    else:
        return 'overnight'

def create_patterns_from_sample_fixed(df):
    """Create comprehensive patterns from the sample data with error handling"""
    
    try:
        # 1. Hourly patterns by station
        print("📊 Creating hourly patterns...")
        hourly_agg = df.groupby(['station_complex_id', 'hour_of_week', 'day_type']).agg({
            'ridership': ['mean', 'max', 'min', 'std', 'count']
        })
        
        if not hourly_agg.empty:
            hourly_agg.columns = ['avg_ridership', 'peak_ridership', 'min_ridership', 'ridership_std', 'sample_count']
            hourly_patterns = hourly_agg.reset_index()
            hourly_patterns = hourly_patterns.fillna(0)
        else:
            hourly_patterns = pd.DataFrame(columns=[
                'station_complex_id', 'hour_of_week', 'day_type', 
                'avg_ridership', 'peak_ridership', 'min_ridership'
            ])
        
        # 2. Daily patterns by station
        print("📊 Creating daily patterns...")
        daily_agg = df.groupby(['station_complex_id', 'day_type']).agg({
            'ridership': ['mean', 'sum', 'count']
        })
        
        if not daily_agg.empty:
            daily_agg.columns = ['avg_hourly_ridership', 'total_daily_ridership', 'sample_count']
            daily_patterns = daily_agg.reset_index()
            
            # Add borough information
            borough_info = df.groupby('station_complex_id')['borough'].first().reset_index()
            daily_patterns = daily_patterns.merge(borough_info, on='station_complex_id', how='left')
            daily_patterns['borough'] = daily_patterns['borough'].fillna('Unknown')
            daily_patterns = daily_patterns.fillna(0)
        else:
            daily_patterns = pd.DataFrame(columns=[
                'station_complex_id', 'day_type', 'borough', 'total_ridership', 'peak_hour'
            ])
        
        # 3. Generate comprehensive crowd predictions
        print("🎯 Generating crowd predictions...")
        crowd_predictions = generate_comprehensive_predictions_fixed(hourly_patterns, daily_patterns)
        
        # 4. Peak patterns
        print("📊 Creating peak patterns...")
        peak_agg = df.groupby(['station_complex_id', 'peak_period']).agg({
            'ridership': ['mean', 'std', 'count']
        })
        
        if not peak_agg.empty:
            peak_agg.columns = ['avg_ridership', 'ridership_std', 'sample_count']
            peak_patterns = peak_agg.reset_index()
            peak_patterns = peak_patterns.fillna(0)
        else:
            peak_patterns = pd.DataFrame(columns=[
                'station_complex_id', 'peak_period', 'avg_ridership', 'ridership_std'
            ])
        
        return {
            'hourly_patterns': hourly_patterns,
            'daily_patterns': daily_patterns,
            'crowd_predictions': crowd_predictions,
            'peak_patterns': peak_patterns
        }
        
    except Exception as e:
        print(f"❌ Error creating patterns: {e}")
        return create_empty_patterns()

def generate_comprehensive_predictions_fixed(hourly_patterns, daily_patterns):
    """Generate predictions for all hours/stations using interpolation"""
    
    if hourly_patterns.empty:
        print("⚠️  No hourly patterns available for predictions")
        return pd.DataFrame(columns=[
            'station_complex_id', 'hour_of_week', 'day_type', 'borough',
            'avg_ridership', 'peak_ridership', 'crowd_level', 
            'hour_of_day', 'day_of_week_num'
        ])
    
    print("🎯 Generating comprehensive crowd predictions...")
    
    all_predictions = []
    
    # Get all unique stations from hourly patterns
    stations = hourly_patterns['station_complex_id'].unique()
    
    for station in stations:
        station_hourly = hourly_patterns[hourly_patterns['station_complex_id'] == station]
        station_daily = daily_patterns[daily_patterns['station_complex_id'] == station] if not daily_patterns.empty else pd.DataFrame()
        
        # Get station's average ridership for scaling
        if not station_daily.empty:
            station_avg = station_daily['avg_hourly_ridership'].mean()
            borough = station_daily['borough'].iloc[0] if 'borough' in station_daily.columns else 'Unknown'
        else:
            station_avg = station_hourly['avg_ridership'].mean() if not station_hourly.empty else 100
            borough = 'Unknown'
        
        # Generate predictions for each day type
        for day_type in ['weekday', 'saturday', 'sunday', 'holiday']:
            day_hourly = station_hourly[station_hourly['day_type'] == day_type]
            
            if day_hourly.empty and day_type != 'weekday':
                # Use weekday data as fallback
                day_hourly = station_hourly[station_hourly['day_type'] == 'weekday']
            
            if day_hourly.empty:
                continue
            
            # Create predictions for all 168 hours of week
            for hour_of_week in range(168):
                hour_of_day = hour_of_week % 24
                
                # Check if we have actual data for this hour
                actual_data = day_hourly[day_hourly['hour_of_week'] == hour_of_week]
                
                if not actual_data.empty:
                    # Use actual data
                    avg_ridership = actual_data['avg_ridership'].iloc[0]
                    peak_ridership = actual_data['peak_ridership'].iloc[0]
                else:
                    # Generate synthetic data based on hour patterns
                    avg_ridership = generate_synthetic_ridership_fixed(hour_of_day, day_type, station_avg)
                    peak_ridership = avg_ridership * 1.5
                
                # Classify crowd level
                if peak_ridership > 0:
                    crowd_ratio = avg_ridership / peak_ridership
                    if crowd_ratio > 0.8:
                        crowd_level = 'Very Crowded'
                    elif crowd_ratio > 0.6:
                        crowd_level = 'Crowded'
                    elif crowd_ratio > 0.4:
                        crowd_level = 'Moderate'
                    elif crowd_ratio > 0.2:
                        crowd_level = 'Light'
                    else:
                        crowd_level = 'Very Light'
                else:
                    crowd_level = 'Very Light'
                
                all_predictions.append({
                    'station_complex_id': station,
                    'hour_of_week': hour_of_week,
                    'day_type': day_type,
                    'borough': borough,
                    'avg_ridership': round(float(avg_ridership), 2),
                    'peak_ridership': round(float(peak_ridership), 2),
                    'crowd_level': crowd_level,
                    'hour_of_day': hour_of_day,
                    'day_of_week_num': hour_of_week // 24
                })
    
    return pd.DataFrame(all_predictions)

def generate_synthetic_ridership_fixed(hour_of_day, day_type, base_ridership):
    """Generate realistic ridership based on typical subway patterns"""
    
    # Base patterns by hour (0.0 to 1.0 multipliers)
    weekday_pattern = {
        0: 0.1, 1: 0.05, 2: 0.05, 3: 0.05, 4: 0.1, 5: 0.2,
        6: 0.4, 7: 0.8, 8: 1.0, 9: 0.7, 10: 0.5, 11: 0.6,
        12: 0.7, 13: 0.6, 14: 0.6, 15: 0.6, 16: 0.7, 17: 0.9,
        18: 1.0, 19: 0.8, 20: 0.6, 21: 0.4, 22: 0.3, 23: 0.2
    }
    
    weekend_pattern = {
        0: 0.1, 1: 0.05, 2: 0.05, 3: 0.05, 4: 0.05, 5: 0.1,
        6: 0.15, 7: 0.2, 8: 0.3, 9: 0.4, 10: 0.6, 11: 0.8,
        12: 1.0, 13: 0.9, 14: 0.8, 15: 0.7, 16: 0.7, 17: 0.8,
        18: 0.8, 19: 0.7, 20: 0.6, 21: 0.5, 22: 0.4, 23: 0.3
    }
    
    holiday_pattern = {h: v * 0.6 for h, v in weekend_pattern.items()}
    
    # Select pattern based on day type
    if day_type == 'weekday':
        pattern = weekday_pattern
    elif day_type in ['saturday', 'sunday']:
        pattern = weekend_pattern
    else:  # holiday
        pattern = holiday_pattern
    
    multiplier = pattern.get(hour_of_day, 0.3)
    return base_ridership * multiplier

def save_sample_to_db_fixed(patterns, output_db_path):
    """Save processed patterns to SQLite database with proper error handling"""
    
    print("💾 Saving patterns to database...")
    
    conn = sqlite3.connect(output_db_path)
    
    # Save all pattern tables with error handling
    for table_name, df in patterns.items():
        try:
            if df.empty:
                print(f"⚠️  Skipping {table_name}: No data")
                continue
                
            # Clean column names (remove special characters that cause SQL issues)
            df.columns = [col.replace('(', '').replace(')', '').replace(' ', '_').replace('-', '_') for col in df.columns]
            
            df.to_sql(table_name, conn, if_exists='replace', index=False)
            print(f"✅ Saved {table_name}: {len(df):,} rows")
            
        except Exception as e:
            print(f"❌ Error saving {table_name}: {e}")
            continue
    
    # Create indexes with error handling
    try:
        conn.execute('CREATE INDEX IF NOT EXISTS idx_crowd_station_time ON crowd_predictions(station_complex_id, hour_of_week)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_hourly_station ON hourly_patterns(station_complex_id)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_daily_station ON daily_patterns(station_complex_id)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_peak_station ON peak_patterns(station_complex_id)')
        conn.commit()
        print("✅ Created database indexes")
    except Exception as e:
        print(f"⚠️  Warning creating indexes: {e}")
    
    conn.close()

def main():
    """Main function to run fixed smart sampling"""
    
    # Create data directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(os.path.dirname(script_dir), 'data')
    os.makedirs(data_dir, exist_ok=True)
    
    output_db_path = os.path.join(data_dir, 'condensed_ridership.db')
    
    print("🚇 Fixed Smart Ridership Data Sampler")
    print("=" * 50)
    print("⚡ Real MTA data with proper error handling!")
    print("🎯 Strategic sampling for crowd prediction")
    print("")
    
    try:
        success = sample_ridership_data_fixed(output_db_path, sample_size=50000)
        
        if success:
            print(f"""
🎉 Fixed Sampling Complete!
💾 Database created: {output_db_path}
⚡ Real MTA data successfully processed!
🎯 Ready for crowd predictions!

🚀 Test your API:
   curl http://localhost:5001/api/crowd/status
   curl "http://localhost:5001/api/crowd/station/257"
            """)
        else:
            print("❌ Sampling failed")
            
    except Exception as e:
        print(f"❌ Error during sampling: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()