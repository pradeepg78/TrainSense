# backend/scripts/ridership_condenser.py
import os
import requests
import zipfile
import csv
import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sys

def condense_ridership_data(data_source, output_db_path, chunk_size=100000, source_type='socrata_api'):
    """
    Condense 115M row ridership dataset into crowd prediction patterns
    
    Args:
        data_source: Dataset ID, URL, or file path
        output_db_path: Path for output SQLite database
        chunk_size: Number of rows to process at once
        source_type: 'csv', 'url', 'socrata_api', or 'download'
    """
    
    print("🚇 Starting ridership data condensation...")
    print(f"📊 Data source: {data_source}")
    print(f"📁 Output database: {output_db_path}")
    
    # Create output database
    conn = sqlite3.connect(output_db_path)
    
    # Initialize aggregation dataframes
    station_hourly_patterns = []
    station_daily_patterns = []
    peak_patterns = []
    
    # Get data iterator based on source type
    data_iterator = get_data_iterator(data_source, source_type, chunk_size)
    
    # Process data in chunks to avoid memory issues
    chunk_count = 0
    total_rows_processed = 0
    
    for chunk in data_iterator:
        chunk_count += 1
        total_rows_processed += len(chunk)
        print(f"📊 Processing chunk {chunk_count} ({len(chunk):,} rows) - Total: {total_rows_processed:,}")
        
        # Clean and prepare data
        chunk = prepare_chunk(chunk)
        
        if chunk is None or len(chunk) == 0:
            print("⚠️  Empty chunk, skipping...")
            continue
        
        # Aggregate this chunk
        hourly_agg = aggregate_hourly_patterns(chunk)
        daily_agg = aggregate_daily_patterns(chunk)
        peak_agg = aggregate_peak_patterns(chunk)
        
        station_hourly_patterns.append(hourly_agg)
        station_daily_patterns.append(daily_agg)
        peak_patterns.append(peak_agg)
        
        print(f"✅ Chunk {chunk_count} processed - Hourly: {len(hourly_agg)}, Daily: {len(daily_agg)}, Peak: {len(peak_agg)}")
    
    # Combine all chunks
    print("🔄 Combining aggregated data...")
    
    # Final hourly patterns (station + hour of week)
    if station_hourly_patterns:
        final_hourly = pd.concat(station_hourly_patterns, ignore_index=True)
        final_hourly = final_hourly.groupby(['station_complex_id', 'hour_of_week', 'day_type']).agg({
            'avg_ridership': 'mean',
            'peak_ridership': 'max',
            'min_ridership': 'min'
        }).reset_index()
    else:
        final_hourly = pd.DataFrame()
    
    # Final daily patterns (station + day type)
    if station_daily_patterns:
        final_daily = pd.concat(station_daily_patterns, ignore_index=True)
        final_daily = final_daily.groupby(['station_complex_id', 'day_type', 'borough']).agg({
            'total_ridership': 'mean',
            'peak_hour': lambda x: x.mode().iloc[0] if not x.empty else 6
        }).reset_index()
    else:
        final_daily = pd.DataFrame()
    
    # Final peak patterns
    if peak_patterns:
        final_peaks = pd.concat(peak_patterns, ignore_index=True)
        final_peaks = final_peaks.groupby(['station_complex_id', 'peak_period']).agg({
            'avg_ridership': 'mean',
            'ridership_std': 'mean'
        }).reset_index()
    else:
        final_peaks = pd.DataFrame()
    
    # Save to database
    print("💾 Saving to database...")
    if not final_hourly.empty:
        final_hourly.to_sql('hourly_patterns', conn, if_exists='replace', index=False)
    if not final_daily.empty:
        final_daily.to_sql('daily_patterns', conn, if_exists='replace', index=False)
    if not final_peaks.empty:
        final_peaks.to_sql('peak_patterns', conn, if_exists='replace', index=False)
    
    # Create indexes for fast lookups
    try:
        conn.execute('CREATE INDEX IF NOT EXISTS idx_hourly_station ON hourly_patterns(station_complex_id)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_daily_station ON daily_patterns(station_complex_id)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_peak_station ON peak_patterns(station_complex_id)')
    except Exception as e:
        print(f"⚠️  Warning: Could not create indexes: {e}")
    
    conn.close()
    
    print(f"""
🎉 Condensation Complete!
📊 Original rows processed: {total_rows_processed:,}
📊 Hourly patterns: {len(final_hourly):,} rows
📊 Daily patterns: {len(final_daily):,} rows  
📊 Peak patterns: {len(final_peaks):,} rows
💾 Saved to: {output_db_path}
    """)
    
    return {
        'success': True,
        'total_rows_processed': total_rows_processed,
        'hourly_patterns': len(final_hourly),
        'daily_patterns': len(final_daily),
        'peak_patterns': len(final_peaks),
        'output_path': output_db_path
    }

def get_data_iterator(data_source, source_type, chunk_size):
    """Get data iterator based on source type"""
    
    if source_type == 'csv':
        # Local CSV file
        print(f"📁 Reading local CSV: {data_source}")
        return pd.read_csv(data_source, chunksize=chunk_size)
    
    elif source_type == 'url':
        # Direct URL to CSV
        print(f"🌐 Downloading from URL: {data_source}")
        return pd.read_csv(data_source, chunksize=chunk_size)
    
    elif source_type == 'socrata_api':
        # NYC Open Data API (recommended for large datasets)
        print(f"🏛️ Using Socrata API: {data_source}")
        return get_socrata_chunks(data_source, chunk_size)
    
    elif source_type == 'download':
        # Download first, then process
        print(f"⬇️ Downloading dataset: {data_source}")
        local_file = download_nyc_opendata(data_source)
        return pd.read_csv(local_file, chunksize=chunk_size)
    
    else:
        raise ValueError(f"Unknown source_type: {source_type}")

def get_socrata_chunks(dataset_id, chunk_size):
    """Stream data from NYC Open Data Socrata API in chunks"""
    try:
        from sodapy import Socrata
    except ImportError:
        print("❌ Please install sodapy: pip install sodapy")
        return None
    
    client = Socrata("data.ny.gov", None)  # No app token needed for public data
    
    offset = 0
    while True:
        print(f"📊 Fetching rows {offset:,} to {offset + chunk_size:,}")
        
        try:
            # Get chunk from API
            results = client.get(dataset_id, limit=chunk_size, offset=offset)
            
            if not results:
                print("✅ No more data to fetch")
                break
                
            # Convert to DataFrame
            chunk = pd.DataFrame.from_records(results)
            
            if chunk.empty:
                print("✅ Empty chunk received, stopping")
                break
            
            # Convert numeric columns
            numeric_cols = ['ridership', 'transfers', 'latitude', 'longitude']
            for col in numeric_cols:
                if col in chunk.columns:
                    chunk[col] = pd.to_numeric(chunk[col], errors='coerce')
            
            yield chunk
            offset += chunk_size
            
            if len(results) < chunk_size:
                print("✅ Received partial chunk, this was the last one")
                break
                
        except Exception as e:
            print(f"❌ Error fetching data at offset {offset}: {e}")
            break
    
    client.close()

def download_nyc_opendata(dataset_url_or_id):
    """Download large dataset from NYC Open Data"""
    
    # If it's just an ID, construct the CSV export URL
    if not dataset_url_or_id.startswith('http'):
        # Assume it's a dataset ID like 'wujg-7c2s'
        download_url = f"https://data.ny.gov/api/views/{dataset_url_or_id}/rows.csv?accessType=DOWNLOAD"
    else:
        download_url = dataset_url_or_id
    
    print(f"⬇️ Downloading from: {download_url}")
    
    # Stream download for large files
    local_filename = f"ridership_data_{dataset_url_or_id.replace('/', '_')}.csv"
    
    try:
        with requests.get(download_url, stream=True) as r:
            r.raise_for_status()
            total_size = int(r.headers.get('content-length', 0))
            
            if total_size > 0:
                print(f"📦 File size: {total_size / (1024**3):.1f} GB")
            
            with open(local_filename, 'wb') as f:
                downloaded = 0
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
                    downloaded += len(chunk)
                    
                    if total_size > 0:
                        percent = (downloaded / total_size) * 100
                        print(f"\r⬇️ Download progress: {percent:.1f}%", end='')
        
        print(f"\n✅ Downloaded to: {local_filename}")
        return local_filename
        
    except Exception as e:
        print(f"❌ Download failed: {e}")
        raise

def prepare_chunk(chunk):
    """Clean and prepare data chunk"""
    if chunk is None or chunk.empty:
        return None
    
    try:
        # Convert timestamp
        chunk['transit_timestamp'] = pd.to_datetime(chunk['transit_timestamp'])
        
        # Extract time features
        chunk['hour'] = chunk['transit_timestamp'].dt.hour
        chunk['day_of_week'] = chunk['transit_timestamp'].dt.dayofweek
        chunk['month'] = chunk['transit_timestamp'].dt.month
        chunk['date'] = chunk['transit_timestamp'].dt.date
        
        # Create time classifications
        chunk['day_type'] = chunk['day_of_week'].apply(classify_day_type)
        chunk['peak_period'] = chunk['hour'].apply(classify_peak_period)
        chunk['hour_of_week'] = chunk['day_of_week'] * 24 + chunk['hour']
        
        # Only subway data for crowd prediction
        if 'transit_mode' in chunk.columns:
            chunk = chunk[chunk['transit_mode'] == 'Subway']
        
        # Remove rows with missing critical data
        chunk = chunk.dropna(subset=['station_complex_id', 'ridership'])
        
        # Convert ridership to numeric if it's not already
        chunk['ridership'] = pd.to_numeric(chunk['ridership'], errors='coerce')
        chunk = chunk.dropna(subset=['ridership'])
        
        return chunk
        
    except Exception as e:
        print(f"❌ Error preparing chunk: {e}")
        return None

def classify_day_type(day_of_week):
    """Classify day type for patterns"""
    if day_of_week < 5:  # Monday = 0, Friday = 4
        return 'weekday'
    elif day_of_week == 5:
        return 'saturday'
    else:
        return 'sunday'

def classify_peak_period(hour):
    """Classify time periods for crowd prediction"""
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

def aggregate_hourly_patterns(chunk):
    """Aggregate ridership by station and hour of week"""
    try:
        grouped = chunk.groupby(['station_complex_id', 'hour_of_week', 'day_type']).agg({
            'ridership': ['mean', 'max', 'min', 'std']
        }).round(2)
        
        # Flatten column names
        grouped.columns = ['avg_ridership', 'peak_ridership', 'min_ridership', 'ridership_std']
        grouped = grouped.reset_index()
        
        # Fill NaN values
        grouped = grouped.fillna(0)
        
        return grouped
        
    except Exception as e:
        print(f"❌ Error in hourly aggregation: {e}")
        return pd.DataFrame()

def aggregate_daily_patterns(chunk):
    """Aggregate daily ridership patterns by station"""
    try:
        # First group by station and date
        daily = chunk.groupby(['station_complex_id', 'date', 'day_type', 'borough']).agg({
            'ridership': 'sum'
        }).reset_index()
        daily.columns = ['station_complex_id', 'date', 'day_type', 'borough', 'total_ridership']
        
        # Find peak hour for each station-day
        peak_hours = chunk.groupby(['station_complex_id', 'date']).apply(
            lambda x: x.loc[x['ridership'].idxmax(), 'hour'] if not x.empty else 8
        ).reset_index()
        peak_hours.columns = ['station_complex_id', 'date', 'peak_hour']
        
        # Merge peak hours with daily data
        daily = daily.merge(peak_hours, on=['station_complex_id', 'date'], how='left')
        daily['peak_hour'] = daily['peak_hour'].fillna(8)
        
        return daily
        
    except Exception as e:
        print(f"❌ Error in daily aggregation: {e}")
        return pd.DataFrame()

def aggregate_peak_patterns(chunk):
    """Aggregate peak period patterns for crowd prediction"""
    try:
        grouped = chunk.groupby(['station_complex_id', 'peak_period']).agg({
            'ridership': ['mean', 'std', 'count']
        }).round(2)
        
        # Flatten column names
        grouped.columns = ['avg_ridership', 'ridership_std', 'sample_count']
        grouped = grouped.reset_index()
        
        # Fill NaN values
        grouped = grouped.fillna(0)
        
        return grouped
        
    except Exception as e:
        print(f"❌ Error in peak aggregation: {e}")
        return pd.DataFrame()

def create_crowd_prediction_table(db_path):
    """Create a final table optimized for crowd predictions"""
    try:
        conn = sqlite3.connect(db_path)
        
        # Create crowd level lookup table
        query = """
        CREATE TABLE IF NOT EXISTS crowd_predictions AS
        SELECT 
            h.station_complex_id,
            h.hour_of_week,
            h.day_type,
            COALESCE(d.borough, 'Unknown') as borough,
            h.avg_ridership,
            h.peak_ridership,
            CASE 
                WHEN h.avg_ridership > h.peak_ridership * 0.8 THEN 'Very Crowded'
                WHEN h.avg_ridership > h.peak_ridership * 0.6 THEN 'Crowded'
                WHEN h.avg_ridership > h.peak_ridership * 0.4 THEN 'Moderate'
                WHEN h.avg_ridership > h.peak_ridership * 0.2 THEN 'Light'
                ELSE 'Very Light'
            END as crowd_level,
            (h.hour_of_week % 24) as hour_of_day,
            (h.hour_of_week / 24) as day_of_week
        FROM hourly_patterns h
        LEFT JOIN (
            SELECT station_complex_id, day_type, borough
            FROM daily_patterns
            GROUP BY station_complex_id, day_type
        ) d ON h.station_complex_id = d.station_complex_id 
             AND h.day_type = d.day_type
        """
        
        conn.execute(query)
        conn.execute('CREATE INDEX IF NOT EXISTS idx_crowd_station_time ON crowd_predictions(station_complex_id, hour_of_week)')
        conn.commit()
        conn.close()
        
        print("✅ Created crowd_predictions table for fast lookups")
        
    except Exception as e:
        print(f"❌ Error creating crowd prediction table: {e}")

def main():
    """Main function to run ridership data processing"""
    print("🚇 MTA Ridership Data Condenser")
    print("=" * 50)
    
    # Create data directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(os.path.dirname(script_dir), 'data')
    os.makedirs(data_dir, exist_ok=True)
    
    output_db_path = os.path.join(data_dir, 'condensed_ridership.db')
    
    # Check command line arguments
    if len(sys.argv) > 1:
        data_source = sys.argv[1]
        print(f"📊 Using data source from command line: {data_source}")
    else:
        # Default to NYC Open Data API
        data_source = "wujg-7c2s"  # MTA Subway Hourly Ridership dataset ID
        print(f"📊 Using default NYC Open Data dataset: {data_source}")
    
    try:
        # Process the ridership data
        result = condense_ridership_data(
            data_source=data_source,
            output_db_path=output_db_path,
            source_type="socrata_api",
            chunk_size=10000  # Smaller chunks for API
        )
        
        if result['success']:
            print("\n🎉 Data processing successful!")
            
            # Create optimized prediction table
            create_crowd_prediction_table(output_db_path)
            
            print(f"""
📊 Summary:
  📈 Total rows processed: {result['total_rows_processed']:,}
  📋 Hourly patterns: {result['hourly_patterns']:,}
  📅 Daily patterns: {result['daily_patterns']:,}
  ⏰ Peak patterns: {result['peak_patterns']:,}
  💾 Database: {result['output_path']}

✅ Ready for crowd predictions!
🚀 Start your Flask app: python backend/run.py
🧪 Test the API: curl http://localhost:5001/api/crowd/status
            """)
        else:
            print("❌ Data processing failed")
            
    except Exception as e:
        print(f"❌ Error during processing: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()