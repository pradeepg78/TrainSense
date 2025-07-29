"""
Load processed MTA turnstile data into the database
"""

import os
import pandas as pd
from datetime import datetime
from app import create_app, db
from app.models.crowd_prediction import CrowdDataPoint

def load_mta_data_to_db():
    """Load the processed MTA data into the database"""
    print("📊 Loading MTA data into database...")
    
    app = create_app()
    
    # Path to the processed data
    data_file = "data/mta_turnstile/mta_turnstile_cleaned.csv"
    
    if not os.path.exists(data_file):
        print(f"❌ Data file not found: {data_file}")
        print("Please run download_and_preprocess_mta_data.py first")
        return
    
    # Load the data
    df = pd.read_csv(data_file)
    print(f"📈 Loaded {len(df)} records from {data_file}")
    
    with app.app_context():
        count = 0
        for _, row in df.iterrows():
            try:
                # Parse the date
                date_obj = datetime.strptime(row['DATE'], '%m/%d/%Y')
                
                # Create timestamp with hour
                timestamp = date_obj.replace(hour=row['HOUR'])
                
                # Create crowd data point
                data_point = CrowdDataPoint(
                    station_id=row['STATION'],
                    route_id=row['LINENAME'],
                    station_name=f"Station {row['STATION']}",
                    borough="Manhattan",  # Default
                    transit_mode="subway",
                    timestamp=timestamp,
                    hour_of_day=row['HOUR'],
                    day_of_week=timestamp.weekday(),
                    crowd_level=row['CROWD_LEVEL'],
                    raw_entries=row['ENTRIES'],
                    raw_exits=row['EXITS'],
                    net_traffic=row['ENTRIES'] + row['EXITS'],
                    source="mta_turnstile",
                    data_source="mta_turnstile",
                    mta_station_name=row['STATION']
                )
                
                db.session.add(data_point)
                count += 1
                
                # Commit in batches
                if count % 1000 == 0:
                    db.session.commit()
                    print(f"✅ Loaded {count} records...")
                    
            except Exception as e:
                print(f"❌ Error loading record: {e}")
                continue
        
        # Final commit
        db.session.commit()
        print(f"✅ Successfully loaded {count} crowd data points to database")

def main():
    """Main function"""
    print("🚀 Loading MTA turnstile data to database...")
    load_mta_data_to_db()
    print("✅ Data loading completed!")

if __name__ == "__main__":
    main() 