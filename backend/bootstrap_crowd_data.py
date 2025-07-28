"""
Bootstrap script to set up crowd prediction system
"""

from app import create_app, db
from app.services.mta_crowd_service import MTACrowdService
from app.services.crowd_prediction_service import CrowdPredictionService

def main():
    """Bootstrap crowd prediction with MTA hourly data"""
    
    print("🚇 TrainSense Crowd Prediction Bootstrap")
    print("=" * 45)
    print("📊 Using NEW MTA Hourly Ridership API")
    print()
    
    app = create_app()
    
    with app.app_context():
        # Reset database to ensure new columns are available
        print("🔄 Resetting database to include new columns...")
        try:
            db.drop_all()
            db.create_all()
            print("✅ Database reset complete")
        except Exception as e:
            print(f"⚠️  Database reset warning: {e}")
            print("  Continuing with bootstrap...")
        
        # Update with MTA data
        print("📥 Downloading MTA hourly ridership data...")
        mta_service = MTACrowdService()
        
        # Try to get real data first, fallback to sample data if needed
        count = mta_service.update_crowd_data(max_records=2000)
        
        if count == 0:
            print("⚠️  No real MTA data available, using sample data...")
            count = mta_service.update_crowd_data_sample(num_stations=50, days_back=30)
        
        if count > 0:
            print(f"\n🤖 Training ML model with {count} data points...")
            ml_service = CrowdPredictionService()
            success = ml_service.train_model()
            
            if success:
                print("\n🎉 Bootstrap complete!")
                print("✅ Your crowd prediction system is ready!")
                print("\nNext steps:")
                print("1. Start app: python3 run.py")
                print("2. Test: curl -X GET http://localhost:5001/api/crowd/predict/6")
                print("3. Check status: curl -X GET http://localhost:5001/api/crowd/status")
            else:
                print("\n⚠️  Model training failed. Check data quality.")
                print("Try running with more data or check the logs above.")
        else:
            print("\n❌ No data downloaded.")
            print("\nTroubleshooting:")
            print("1. Check your internet connection")
            print("2. Verify the MTA API is accessible")
            print("3. Try running the bootstrap again")

if __name__ == '__main__':
    main()