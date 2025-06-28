# backend/load_gtfs_data.py
"""
Script to download and load MTA GTFS static data
Run this to populate the database with subway routes and stops
"""

from app import create_app, db
from app.services.gtfs_service import GTFSService
import sys

def main():
    """Main function to load GTFS data"""
    print("🚇 MTA GTFS Data Loader")
    print("=" * 40)
    
    # Create Flask app context
    app = create_app()
    
    with app.app_context():
        # Create database tables if they don't exist
        print("📋 Creating database tables...")
        db.create_all()
        
        # Initialize GTFS service
        gtfs_service = GTFSService()
        
        # Check command line arguments
        force_download = '--force' in sys.argv
        
        if force_download:
            print("🔄 Force download enabled - will download fresh data")
        
        # Load GTFS data
        result = gtfs_service.load_all_gtfs_data(force_download=force_download)
        
        if result['success']:
            print("\n🎉 Success! Your database now contains:")
            
            # Show stats
            stats = gtfs_service.get_data_stats()
            print(f"  🚇 Routes: {stats['routes_count']}")
            print(f"  🚏 Stops: {stats['stops_count']}")
            
            if stats['last_download']:
                print(f"  📅 Data from: {stats['last_download'].strftime('%Y-%m-%d %H:%M')}")
            
            print(f"\n💾 Raw GTFS files stored in: {stats['data_directory']}")
            print("\n✅ Ready to start your Flask app!")
            
        else:
            print(f"\n❌ Failed to load GTFS data: {result.get('error', 'Unknown error')}")
            sys.exit(1)

if __name__ == '__main__':
    main()