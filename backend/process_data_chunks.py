#!/usr/bin/env python3
"""
Script to process MTA data in chunks to manage memory and processing time
"""

from app import create_app, db
from app.services.mta_crowd_service import MTACrowdService
from app.services.crowd_prediction_service import CrowdPredictionService
from datetime import datetime
import time

def process_year_chunk(year):
    """Process data for a specific year"""
    print(f"\n🚇 Processing Year {year}")
    print("=" * 40)
    
    start_time = time.time()
    
    app = create_app()
    with app.app_context():
        # Create database tables if needed
        db.create_all()
        
        # Process data for this year
        mta_service = MTACrowdService()
        count = mta_service.update_crowd_data_chunk(start_year=year, end_year=year)
        
        end_time = time.time()
        duration = end_time - start_time
        
        print(f"\n✅ Year {year} complete!")
        print(f"📊 Records processed: {count}")
        print(f"⏱️  Time taken: {duration:.1f} seconds ({duration/60:.1f} minutes)")
        
        return count, duration

def process_all_years():
    """Process all available years in chunks"""
    print("🚇 TrainSense Chunked Data Processing")
    print("=" * 50)
    print("📊 Processing MTA data year by year for better performance")
    print()
    
    # Get the date range from the service
    app = create_app()
    with app.app_context():
        mta_service = MTACrowdService()
        earliest_date = mta_service.get_earliest_available_date()
        latest_date = mta_service.get_latest_available_date()
        
        start_year = earliest_date.year
        end_year = latest_date.year
        
        print(f"📅 Data available from {start_year} to {end_year}")
        print(f"📊 Will process {end_year - start_year + 1} years")
        print()
    
    total_records = 0
    total_time = 0
    
    for year in range(start_year, end_year + 1):
        try:
            records, duration = process_year_chunk(year)
            total_records += records
            total_time += duration
            
            # Train model after each year (optional)
            if records > 0:
                print(f"\n🤖 Training model with {total_records} total records...")
                ml_service = CrowdPredictionService()
                success = ml_service.train_model()
                if success:
                    print(f"✅ Model updated with {total_records} records")
                else:
                    print("⚠️  Model training failed")
            
        except Exception as e:
            print(f"❌ Error processing year {year}: {e}")
            continue
    
    print(f"\n🎉 All years processed!")
    print(f"📊 Total records: {total_records}")
    print(f"⏱️  Total time: {total_time/60:.1f} minutes ({total_time/3600:.1f} hours)")
    print(f"📈 Average time per year: {total_time/(end_year-start_year+1)/60:.1f} minutes")

def process_single_year(year):
    """Process just one specific year"""
    print(f"🚇 Processing Single Year: {year}")
    print("=" * 40)
    
    records, duration = process_year_chunk(year)
    
    print(f"\n🎉 Year {year} processing complete!")
    print(f"📊 Records: {records}")
    print(f"⏱️  Time: {duration/60:.1f} minutes")
    
    # Train model
    if records > 0:
        print(f"\n🤖 Training model...")
        app = create_app()
        with app.app_context():
            ml_service = CrowdPredictionService()
            success = ml_service.train_model()
            if success:
                print("✅ Model trained successfully!")
            else:
                print("⚠️  Model training failed")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # Process specific year
        year = int(sys.argv[1])
        process_single_year(year)
    else:
        # Process all years
        process_all_years() 