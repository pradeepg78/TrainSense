#!/usr/bin/env python3
"""
Test script for comprehensive MTA data collection
"""

from app import create_app, db
from app.services.mta_comprehensive_service import MTAComprehensiveService
from app.models.crowd_prediction import CrowdDataPoint
from datetime import datetime

def test_comprehensive_service():
    """Test the comprehensive MTA service"""
    print("🧪 Testing Comprehensive MTA Data Service")
    print("=" * 50)
    
    app = create_app()
    
    with app.app_context():
        # Initialize service
        service = MTAComprehensiveService()
        
        # Test 1: Check data range
        print("📊 Test 1: Checking data range...")
        earliest_date, latest_date = service.get_data_range()
        print(f"✅ Data range: {earliest_date.strftime('%Y-%m-%d')} to {latest_date.strftime('%Y-%m-%d')}")
        
        # Test 2: Fetch small sample
        print("\n📊 Test 2: Fetching sample data...")
        sample_data = service.fetch_data_chunk(
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 2)
        )
        print(f"✅ Sample data: {len(sample_data)} records")
        
        if sample_data:
            print(f"📋 Sample columns: {list(sample_data[0].keys())}")
            print(f"📊 Sample record: {sample_data[0]}")
        
        # Test 3: Process sample data
        print("\n🔧 Test 3: Processing sample data...")
        processed_data = service.process_raw_data(sample_data)
        print(f"✅ Processed: {len(processed_data)} records")
        
        if processed_data:
            print(f"📊 Sample processed record: {processed_data[0]}")
        
        # Test 4: Check database
        print("\n💾 Test 4: Checking database...")
        total_records = db.session.query(CrowdDataPoint).count()
        print(f"✅ Database has {total_records} crowd data points")
        
        if total_records > 0:
            # Show some statistics
            from sqlalchemy import func
            stats = db.session.query(
                func.avg(CrowdDataPoint.crowd_level).label('avg_crowd'),
                func.count(CrowdDataPoint.id).label('total'),
                func.min(CrowdDataPoint.timestamp).label('earliest'),
                func.max(CrowdDataPoint.timestamp).label('latest')
            ).first()
            
            print(f"📊 Average crowd level: {stats.avg_crowd:.2f}")
            print(f"📊 Date range: {stats.earliest.strftime('%Y-%m-%d')} to {stats.latest.strftime('%Y-%m-%d')}")
        
        print("\n✅ All tests completed!")

def test_prediction_with_real_data():
    """Test crowd prediction with real data"""
    print("\n🎯 Testing crowd prediction with real data...")
    
    app = create_app()
    
    with app.app_context():
        from app.services.crowd_prediction_service import CrowdPredictionService
        
        service = CrowdPredictionService()
        
        # Test prediction for a specific station/time
        test_station = "TIMES SQ-42 ST"
        test_route = "1"
        test_time = datetime.now()
        
        print(f"🎯 Testing prediction for {test_station} at {test_time.strftime('%H:%M')}")
        
        prediction = service.predict_crowd_level(test_station, test_route, test_time)
        
        if prediction:
            print(f"✅ Prediction: {prediction['crowd_level']} (confidence: {prediction['confidence']:.2f})")
        else:
            print("❌ No prediction available")

if __name__ == "__main__":
    test_comprehensive_service()
    test_prediction_with_real_data() 