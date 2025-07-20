# backend/scripts/debug_mta_data.py
import pandas as pd
from sodapy import Socrata

def debug_mta_data():
    """Check what columns the MTA data actually has"""
    
    print("🔍 Debugging MTA Data Structure")
    print("=" * 40)
    
    client = Socrata("data.ny.gov", None)
    dataset_id = "wujg-7c2s"
    
    # Get a small sample to check structure
    print("📊 Fetching sample data...")
    results = client.get(dataset_id, limit=100)
    
    if results:
        df = pd.DataFrame.from_records(results)
        
        print(f"✅ Fetched {len(df)} rows")
        print(f"📋 Columns: {list(df.columns)}")
        print("\n🔍 Sample data:")
        print(df.head(2))
        
        print(f"\n📊 Data types:")
        print(df.dtypes)
        
        # Check if transit_mode exists
        if 'transit_mode' in df.columns:
            print(f"\n🚇 Transit modes: {df['transit_mode'].unique()}")
        else:
            print("\n⚠️  No 'transit_mode' column found!")
            print("💡 This means ALL data is subway data!")
            
    else:
        print("❌ No data received")
    
    client.close()

if __name__ == "__main__":
    debug_mta_data()