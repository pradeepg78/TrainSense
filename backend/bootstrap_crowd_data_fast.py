#!/usr/bin/env python3
"""
Fast bootstrap script for rapid testing and development
Uses sample data to get your system running in minutes
"""

from app import create_app, db
from app.services.mta_crowd_service import MTACrowdService
from app.services.crowd_prediction_service import CrowdPredictionService
import time

def main():
    """Fast bootstrap with sample data"""
    
    print("🚇 TrainSense FAST Bootstrap (Sample Data)")
    print("=" * 50)
    print("⚡ For rapid testing and development")
    print("📊 Uses realistic sample data (not real MTA data)")
    print()
    
    start_time = time.time()
    
    app = create_app()
    
    with app.app_context():
        # Create database tables
        print("📋 Creating database tables...")
        db.create_all()
        
        # Update with sample data (FAST)
        print("📥 Generating sample data...")
        mta_service = MTACrowdService()
        
        # Choose your speed:
        print("\nChoose processing speed:")
        print("1. Ultra-fast (100 stations, 7 days) - ~30 seconds")
        print("2. Fast (200 stations, 14 days) - ~1 minute") 
        print("3. Medium (500 stations, 30 days) - ~3 minutes")
        print("4. Realistic (1000 stations, 60 days) - ~5 minutes")
        
        choice = input("\nEnter choice (1-4) [default: 2]: ").strip() or "2"
        
        if choice == "1":
            num_stations, days = 100, 7
        elif choice == "2":
            num_stations, days = 200, 14
        elif choice == "3":
            num_stations, days = 500, 30
        elif choice == "4":
            num_stations, days = 1000, 60
        else:
            num_stations, days = 200, 14
        
        print(f"\n🚀 Generating {num_stations} stations × {days} days = ~{num_stations * days * 24:,} data points...")
        
        count = mta_service.update_crowd_data_sample(num_stations=num_stations, days_back=days)
        
        if count > 0:
            print(f"\n🤖 Training ML model with {count} data points...")
            ml_service = CrowdPredictionService()
            success = ml_service.train_model()
            
            if success:
                end_time = time.time()
                duration = end_time - start_time
                
                print("\n🎉 FAST Bootstrap complete!")
                print(f"⏱️  Total time: {duration:.1f} seconds ({duration/60:.1f} minutes)")
                print("✅ Your crowd prediction system is ready!")
                print("\nNext steps:")
                print("1. Start app: python3 run.py")
                print("2. Test: curl -X GET http://localhost:5001/api/crowd/predict/6")
                print("3. Check status: curl -X GET http://localhost:5001/api/crowd/status")
                print("\n💡 This uses sample data. For real data, run: python3 bootstrap_crowd_data.py")
            else:
                print("\n⚠️  Model training failed. Check data quality.")
        else:
            print("\n❌ No sample data generated.")

if __name__ == '__main__':
    main() 