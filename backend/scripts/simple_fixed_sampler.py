# backend/scripts/simple_fixed_sampler.py
import os
import sqlite3
import pandas as pd
from datetime import datetime
from sodapy import Socrata

def create_working_database(output_db_path):
    """Create working database from the 52,000 rows we already fetched"""
    
    print("🚇 Creating Working Database from Real MTA Data")
    print("=" * 50)
    
    client = Socrata("data.ny.gov", None)
    dataset_id = "wujg-7c2s"
    
    # Get recent data (all subway data)
    print("📊 Fetching recent MTA data...")
    results = client.get(
        dataset_id,
        where="transit_timestamp >= '2024-10-01T00:00:00'",
        limit=20000,
        order="transit_timestamp DESC"
    )
    
    if not results:
        print("❌ No data received!")
        return False
    
    df = pd.DataFrame.from_records(results)
    print(f"✅ Fetched {len(df):,} rows of real MTA data")
    print(f"📋 Columns: {list(df.columns)}")
    
    # Convert data types
    df['transit_timestamp'] = pd.to_datetime(df['transit_timestamp'])
    df['ridership'] = pd.to_numeric(df['ridership'], errors='coerce')
    df = df.dropna(subset=['ridership', 'station_complex_id'])
    
    print(f"📊 After cleaning: {len(df):,} valid rows")
    
    # Extract time features
    df['hour'] = df['transit_timestamp'].dt.hour
    df['day_of_week'] = df['transit_timestamp'].dt.dayofweek
    df['day_type'] = df['day_of_week'].apply(lambda x: 'weekday' if x < 5 else ('saturday' if x == 5 else 'sunday'))
    df['hour_of_week'] = df['day_of_week'] * 24 + df['hour']
    
    # Create hourly patterns
    print("📊 Creating hourly patterns...")
    hourly_patterns = df.groupby(['station_complex_id', 'hour_of_week', 'day_type']).agg({
        'ridership': ['mean', 'max', 'min']
    }).round(2)
    
    hourly_patterns.columns = ['avg_ridership', 'peak_ridership', 'min_ridership']
    hourly_patterns = hourly_patterns.reset_index()
    
    # Create crowd predictions
    print("🎯 Creating crowd predictions...")
    crowd_predictions = []
    
    for _, row in hourly_patterns.iterrows():
        avg = row['avg_ridership']
        peak = row['peak_ridership']
        
        # Classify crowd level
        if peak > 0:
            ratio = avg / peak
            if ratio > 0.8:
                crowd_level = 'Very Crowded'
            elif ratio > 0.6:
                crowd_level = 'Crowded'
            elif ratio > 0.4:
                crowd_level = 'Moderate'
            elif ratio > 0.2:
                crowd_level = 'Light'
            else:
                crowd_level = 'Very Light'
        else:
            crowd_level = 'Very Light'
        
        crowd_predictions.append({
            'station_complex_id': row['station_complex_id'],
            'hour_of_week': row['hour_of_week'],
            'day_type': row['day_type'],
            'borough': 'Unknown',  # Will be filled from GTFS data
            'avg_ridership': avg,
            'peak_ridership': peak,
            'crowd_level': crowd_level,
            'hour_of_day': row['hour_of_week'] % 24,
            'day_of_week_num': row['hour_of_week'] // 24
        })
    
    crowd_df = pd.DataFrame(crowd_predictions)
    
    # Save to database
    print("💾 Saving to database...")
    conn = sqlite3.connect(output_db_path)
    
    hourly_patterns.to_sql('hourly_patterns', conn, if_exists='replace', index=False)
    crowd_df.to_sql('crowd_predictions', conn, if_exists='replace', index=False)
    
    # Create indexes
    conn.execute('CREATE INDEX IF NOT EXISTS idx_crowd_station_time ON crowd_predictions(station_complex_id, hour_of_week)')
    conn.commit()
    conn.close()
    
    print(f"""
🎉 Database Created Successfully!
📊 Hourly patterns: {len(hourly_patterns):,} rows
📊 Crowd predictions: {len(crowd_df):,} rows
📊 Unique stations: {crowd_df['station_complex_id'].nunique()}
💾 Database: {output_db_path}

🚀 Ready to test!
    """)
    
    client.close()
    return True

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(os.path.dirname(script_dir), 'data')
    os.makedirs(data_dir, exist_ok=True)
    
    output_db_path = os.path.join(data_dir, 'condensed_ridership.db')
    
    success = create_working_database(output_db_path)
    
    if success:
        print("""
🧪 Test your API now:
   curl http://localhost:5001/api/crowd/status
   curl "http://localhost:5001/api/crowd/station/257"
        """)

if __name__ == "__main__":
    main()