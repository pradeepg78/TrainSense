"""
Enhanced Pipeline for Crowd Prediction
Complete pipeline for data collection, model training, and system setup
"""

import os
import sys
import time
from datetime import datetime, timedelta
from app import create_app, db
from app.models.crowd_prediction import CrowdDataPoint
from app.services.crowd_prediction_service import CrowdPredictionService
from enhanced_data_collection import EnhancedDataCollector

def setup_database():
    """Set up database tables"""
    print("🗄️ Setting up database...")
    
    app = create_app()
    with app.app_context():
        db.create_all()
        print("✅ Database tables created")

def collect_data():
    """Collect data using enhanced data collector"""
    print("📊 Collecting data with enhanced collector...")
    
    collector = EnhancedDataCollector()
    collector.run_collection(hours=24)
    print("✅ Data collection completed")

def train_model():
    """Train the enhanced crowd prediction model"""
    print("🤖 Training enhanced crowd prediction model...")
    
    from enhanced_crowd_model import EnhancedCrowdModel
    
    model = EnhancedCrowdModel()
    model.train_model()
    print("✅ Model training completed")

def setup_prediction_service():
    """Set up the crowd prediction service"""
    print("🔧 Setting up prediction service...")
    
    service = CrowdPredictionService()
    service.initialize()
    print("✅ Prediction service ready")

def run_complete_pipeline():
    """Run the complete enhanced pipeline"""
    print("🚀 Starting enhanced crowd prediction pipeline...")
    
    start_time = time.time()
    
    try:
        # Step 1: Setup database
        setup_database()
        
        # Step 2: Collect data
        collect_data()
        
        # Step 3: Train model
        train_model()
        
        # Step 4: Setup prediction service
        setup_prediction_service()
        
        end_time = time.time()
        duration = end_time - start_time
        
        print(f"✅ Enhanced pipeline completed in {duration:.2f} seconds!")
        print("🎯 Your crowd prediction system is now ready!")
        
    except Exception as e:
        print(f"❌ Pipeline failed: {e}")
        raise

def main():
    """Main function to run the enhanced pipeline"""
    print("🎯 Enhanced Crowd Prediction Pipeline")
    print("=" * 50)
    
    run_complete_pipeline()

if __name__ == "__main__":
    main() 