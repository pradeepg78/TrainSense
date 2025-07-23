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
        # Create database tables
        print("📋 Creating database tables...")
        db.create_all()
        
        # Update with MTA data
        print("📥 Downloading MTA hourly ridership data...")
        mta_service = MTACrowdService()
        count = mta_service.update_crowd_data(max_records=2000)
        
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
        else:
            print("\n❌ No NEW MTA data downloaded.")

if __name__ == '__main__':
    main()