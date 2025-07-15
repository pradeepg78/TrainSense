#!/usr/bin/env python3
# backend/load_initial_data.py
"""
Script to load initial GTFS data into the database for testing the API.
This should be run after the backend is set up to populate the database with real MTA data.
"""

import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from app.services.gtfs_service import GTFSService
from config import Config

def load_initial_data():
    """Load initial GTFS data into the database"""
    print("🚇 Loading initial GTFS data...")
    
    # Create Flask app context
    app = create_app()
    
    with app.app_context():
        try:
            # Create database tables
            db.create_all()
            print("✅ Database tables created")
            
            # Initialize GTFS service
            gtfs_service = GTFSService()
            
            # Download and load GTFS data
            print("📥 Downloading GTFS data...")
            zip_path = gtfs_service.download_gtfs_data(force_download=True)
            
            print("📦 Extracting GTFS data...")
            txt_files = gtfs_service.extract_gtfs_data(zip_path)
            
            print("🚇 Loading routes to database...")
            routes_loaded, routes_updated = gtfs_service.load_routes_to_db()
            
            print("🚏 Loading stops to database...")
            stops_loaded, stops_updated = gtfs_service.load_stops_to_db()
            
            print("✅ Data loading completed!")
            print(f"📊 Summary:")
            print(f"   - Routes: {routes_loaded} new, {routes_updated} updated")
            print(f"   - Stops: {stops_loaded} new, {stops_updated} updated")
            print(f"   - Files processed: {len(txt_files)}")
            
            # Get data stats
            stats = gtfs_service.get_data_stats()
            print(f"📈 Data stats: {stats}")
            
        except Exception as e:
            print(f"❌ Error loading data: {e}")
            return False
    
    return True

if __name__ == "__main__":
    print("🚇 MTA Transit App - Initial Data Loader")
    print("=" * 50)
    
    # Validate configuration
    if not Config.validate_config():
        print("❌ Configuration validation failed")
        print("Please set MTA_API_KEY in your environment variables")
        sys.exit(1)
    
    # Load data
    success = load_initial_data()
    
    if success:
        print("\n🎉 Initial data loading completed successfully!")
        print("You can now start the backend server and test the API.")
    else:
        print("\n❌ Data loading failed. Please check the error messages above.")
        sys.exit(1) 