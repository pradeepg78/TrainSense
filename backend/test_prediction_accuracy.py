#!/usr/bin/env python3
"""
Test script to evaluate crowd prediction accuracy
"""

from app import create_app, db
from app.services.crowd_prediction_service import CrowdPredictionService
from app.models.crowd_prediction import CrowdDataPoint
from datetime import datetime, timedelta
import random

def test_prediction_accuracy():
    """Test how well the model predicts on historical data"""
    print("🧪 Testing Crowd Prediction Accuracy")
    print("=" * 40)
    
    app = create_app()
    
    with app.app_context():
        # Get some historical data points
        historical_points = db.session.query(CrowdDataPoint).limit(100).all()
        
        if not historical_points:
            print("❌ No historical data found. Run bootstrap first!")
            return
        
        print(f"📊 Testing on {len(historical_points)} historical data points...")
        
        # Initialize prediction service
        prediction_service = CrowdPredictionService()
        
        correct_predictions = 0
        total_predictions = 0
        confusion_matrix = {1: {1: 0, 2: 0, 3: 0, 4: 0},
                           2: {1: 0, 2: 0, 3: 0, 4: 0},
                           3: {1: 0, 2: 0, 3: 0, 4: 0},
                           4: {1: 0, 2: 0, 3: 0, 4: 0}}
        
        for point in historical_points:
            # Predict crowd level for this station/route/time
            prediction = prediction_service.predict_crowd_level(
                station_id=point.station_id,
                route_id=point.route_id,
                target_datetime=point.timestamp
            )
            
            if prediction:
                predicted_level = prediction['predicted_crowd_level']
                actual_level = point.crowd_level
                confidence = prediction['confidence_score']
                
                # Update confusion matrix
                confusion_matrix[actual_level][predicted_level] += 1
                
                if predicted_level == actual_level:
                    correct_predictions += 1
                
                total_predictions += 1
                
                # Show some examples
                if total_predictions <= 10:
                    print(f"  Station: {point.station_id}, Route: {point.route_id}")
                    print(f"    Actual: {actual_level}, Predicted: {predicted_level}, Confidence: {confidence:.3f}")
                    print(f"    {'✅' if predicted_level == actual_level else '❌'}")
                    print()
        
        # Calculate accuracy
        accuracy = correct_predictions / total_predictions if total_predictions > 0 else 0
        print(f"📈 Overall Accuracy: {accuracy:.3f} ({correct_predictions}/{total_predictions})")
        
        # Show confusion matrix
        print("\n📊 Confusion Matrix (Actual vs Predicted):")
        print("     Predicted:")
        print("       1   2   3   4")
        for actual in [1, 2, 3, 4]:
            row = f"Act {actual}: "
            for predicted in [1, 2, 3, 4]:
                count = confusion_matrix[actual][predicted]
                row += f"{count:3d} "
            print(row)
        
        # Calculate per-class accuracy
        print("\n📊 Per-Class Accuracy:")
        for level in [1, 2, 3, 4]:
            total_actual = sum(confusion_matrix[level].values())
            correct = confusion_matrix[level][level]
            if total_actual > 0:
                class_accuracy = correct / total_actual
                print(f"  Level {level}: {class_accuracy:.3f} ({correct}/{total_actual})")

def test_different_times():
    """Test predictions for different times of day"""
    print("\n🕐 Testing Predictions for Different Times")
    print("=" * 40)
    
    app = create_app()
    
    with app.app_context():
        prediction_service = CrowdPredictionService()
        
        # Test different times for the same station/route
        test_times = [
            datetime.now().replace(hour=8, minute=0, second=0, microsecond=0),   # Rush hour
            datetime.now().replace(hour=14, minute=0, second=0, microsecond=0),  # Midday
            datetime.now().replace(hour=18, minute=0, second=0, microsecond=0),  # Evening rush
            datetime.now().replace(hour=23, minute=0, second=0, microsecond=0),  # Late night
        ]
        
        station_id = "default"  # You can change this to a real station ID
        route_id = "6"
        
        for test_time in test_times:
            prediction = prediction_service.predict_crowd_level(
                station_id=station_id,
                route_id=route_id,
                target_datetime=test_time
            )
            
            if prediction:
                print(f"  {test_time.strftime('%H:%M')}: Level {prediction['predicted_crowd_level']} "
                      f"(Confidence: {prediction['confidence_score']:.3f})")

if __name__ == "__main__":
    test_prediction_accuracy()
    test_different_times() 