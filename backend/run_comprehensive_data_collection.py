#!/usr/bin/env python3
"""
Fast MTA Data Collection Script
Fetches targeted data from 2021-2024 for quick ML training
"""

import os
import sys
from datetime import datetime, timedelta
from app import create_app, db
from app.services.mta_comprehensive_service import MTAComprehensiveService

def main():
    """Run fast MTA data collection"""
    print("🚇 TrainSense Fast MTA Data Collection")
    print("=" * 60)
    print("📊 Fetching targeted data from 2021-2024 (FAST MODE)")
    print("🤖 Training ML model with focused data")
    print()
    
    # Initialize app
    app = create_app()
    
    with app.app_context():
        # Initialize comprehensive service
        service = MTAComprehensiveService()
        
        # Check data range first
        print("📊 Checking available data range...")
        earliest_date, latest_date = service.get_data_range()
        
        print(f"📅 Data available: {earliest_date.strftime('%Y-%m-%d')} to {latest_date.strftime('%Y-%m-%d')}")
        print(f"📊 Total days: {(latest_date - earliest_date).days}")
        print()
        
        # Run fast update - just 2023 data for speed
        print("🚀 Starting FAST data collection (2023 only)...")
        start_time = datetime.now()
        
        try:
            # Run the ultra-fast update for immediate testing
            saved_count = service.run_ultra_fast_update()
            
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            print("\n" + "=" * 60)
            print("🎉 FAST DATA COLLECTION COMPLETE!")
            print("=" * 60)
            print(f"📊 Records saved: {saved_count:,}")
            print(f"⏱️  Duration: {duration/60:.1f} minutes")
            print(f"📈 Average: {saved_count/duration:.0f} records/second")
            print()
            print("🤖 ML model has been trained with focused data!")
            print("🎯 Crowd predictions will now be based on 2023 patterns")
            
        except KeyboardInterrupt:
            print("\n⚠️  Data collection interrupted by user")
            print("💾 Partial data has been saved")
            
        except Exception as e:
            print(f"\n❌ Error during data collection: {e}")
            import traceback
            traceback.print_exc()

def run_year_chunk(year):
    """Run data collection for a specific year"""
    print(f"📅 Processing year {year}...")
    
    app = create_app()
    
    with app.app_context():
        service = MTAComprehensiveService()
        
        start_time = datetime.now()
        saved_count = service.run_comprehensive_update(start_year=year, end_year=year)
        end_time = datetime.now()
        
        duration = (end_time - start_time).total_seconds()
        
        print(f"✅ Year {year} complete: {saved_count:,} records in {duration/60:.1f} minutes")
        return saved_count, duration

def run_incremental_update():
    """Run incremental update for recent data only"""
    print("📊 Running incremental update (last 30 days)...")
    
    app = create_app()
    
    with app.app_context():
        service = MTAComprehensiveService()
        
        # Get latest date and go back 30 days
        earliest_date, latest_date = service.get_data_range()
        start_date = latest_date - timedelta(days=30)
        
        print(f"📅 Updating from {start_date.strftime('%Y-%m-%d')} to {latest_date.strftime('%Y-%m-%d')}")
        
        # Fetch recent data
        raw_data = service.fetch_all_data(
            start_year=start_date.year,
            end_year=latest_date.year
        )
        
        if raw_data:
            processed_data = service.process_raw_data(raw_data)
            saved_count = service.save_to_database(processed_data)
            
            print(f"✅ Incremental update complete: {saved_count:,} new records")
            return saved_count
        else:
            print("❌ No new data found")
            return 0

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Fast MTA Data Collection")
    parser.add_argument("--year", type=int, help="Process specific year only")
    parser.add_argument("--incremental", action="store_true", help="Run incremental update only")
    parser.add_argument("--fast", action="store_true", help="Run fast mode (default)")
    
    args = parser.parse_args()
    
    if args.year:
        print(f"📅 Processing year {args.year} only...")
        saved_count, duration = run_year_chunk(args.year)
        print(f"✅ Complete: {saved_count:,} records in {duration/60:.1f} minutes")
    elif args.incremental:
        saved_count = run_incremental_update()
        print(f"✅ Incremental update: {saved_count:,} records")
    else:
        main() 