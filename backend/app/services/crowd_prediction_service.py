"""
Machine learning service for crowd prediction
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib
import os
from app import db
from app.models.crowd_prediction import CrowdDataPoint, CrowdPrediction

class CrowdPredictionService:
    """
    ML service for predicting crowd levels from historical MTA patterns
    """
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        
        # Model storage paths
        self.model_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'models')
        os.makedirs(self.model_dir, exist_ok=True)
        self.model_path = os.path.join(self.model_dir, 'crowd_prediction_model.pkl')
        self.scaler_path = os.path.join(self.model_dir, 'crowd_prediction_scaler.pkl')
        
        self.feature_names = []
    
    def collect_training_data(self):
        """Get all crowd data from database for ML training"""
        print("📊 Collecting training data from database...")
        
        crowd_data = db.session.query(CrowdDataPoint).all()
        
        if len(crowd_data) < 50:
            print(f"⚠️  Only {len(crowd_data)} data points found.")
            print("   Need at least 50 points for training.")
            print("   Run MTA data update first!")
            return None
        
        # Convert to list of dictionaries
        data = []
        for point in crowd_data:
            data.append({
                'hour_of_day': point.hour_of_day,
                'day_of_week': point.day_of_week,
                'crowd_level': point.crowd_level,
                'net_traffic': point.net_traffic or 0,
                'station_id': point.station_id,
                'route_id': point.route_id,
                'timestamp': point.timestamp
            })
        
        df = pd.DataFrame(data)
        print(f"✅ Collected {len(df)} training examples")
        
        # Show data distribution
        crowd_distribution = df['crowd_level'].value_counts().sort_index()
        print(f"📊 Crowd level distribution:")
        for level, count in crowd_distribution.items():
            level_name = {1: 'Low', 2: 'Medium', 3: 'High', 4: 'Very High'}[level]
            print(f"   Level {level} ({level_name}): {count} samples ({count/len(df)*100:.1f}%)")
        
        return df
    
    def engineer_features(self, df):
        """Create features for machine learning"""
        print("🔧 Engineering ML features...")
        
        # Time-based features
        df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)
        df['is_rush_hour'] = ((df['hour_of_day'].between(7, 9)) | 
                             (df['hour_of_day'].between(17, 19))).astype(int)
        df['is_morning'] = df['hour_of_day'].between(6, 11).astype(int)
        df['is_evening'] = df['hour_of_day'].between(17, 21).astype(int)
        df['is_late_night'] = ((df['hour_of_day'] >= 22) | (df['hour_of_day'] <= 5)).astype(int)
        
        # Traffic-based features
        df['traffic_level'] = pd.cut(
            df['net_traffic'], 
            bins=[0, 500, 1500, 3000, float('inf')], 
            labels=[1, 2, 3, 4]
        ).astype(int)
        
        # Station popularity
        station_counts = df['station_id'].value_counts()
        df['station_popularity'] = df['station_id'].map(station_counts)
        
        return df
    
    def train_model(self):
        """Train the crowd prediction model"""
        print("🤖 Training crowd prediction model...")
        
        df = self.collect_training_data()
        if df is None:
            return False
        
        df = self.engineer_features(df)
        
        # Define features
        self.feature_names = [
            'hour_of_day', 'day_of_week', 'is_weekend', 'is_rush_hour',
            'is_morning', 'is_evening', 'is_late_night', 
            'traffic_level', 'station_popularity'
        ]
        
        X = df[self.feature_names]
        y = df['crowd_level']
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train model
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate
        accuracy = self.model.score(X_test_scaled, y_test)
        print(f"✅ Model trained! Accuracy: {accuracy:.3f}")
        
        # Save model
        joblib.dump(self.model, self.model_path)
        joblib.dump(self.scaler, self.scaler_path)
        
        return True
    
    def predict_crowd_level(self, station_id, route_id, target_datetime):
        """Predict crowd level for specific station, route, and time"""
        # Load model if needed
        if not self.model:
            try:
                self.model = joblib.load(self.model_path)
                self.scaler = joblib.load(self.scaler_path)
            except:
                return None
        
        # Extract features
        hour = target_datetime.hour
        day = target_datetime.weekday()
        is_weekend = 1 if day >= 5 else 0
        is_rush_hour = 1 if hour in [7, 8, 9, 17, 18, 19] else 0
        is_morning = 1 if 6 <= hour <= 11 else 0
        is_evening = 1 if 17 <= hour <= 21 else 0
        is_late_night = 1 if hour >= 22 or hour <= 5 else 0
        
        # Default values (would be better with historical lookup)
        traffic_level = 2
        station_popularity = 50
        
        # Create feature array
        features = np.array([[
            hour, day, is_weekend, is_rush_hour,
            is_morning, is_evening, is_late_night,
            traffic_level, station_popularity
        ]])
        
        # Predict
        features_scaled = self.scaler.transform(features)
        prediction = self.model.predict(features_scaled)[0]
        crowd_level = max(1, min(4, round(prediction)))
        
        return {
            'predicted_crowd_level': crowd_level,
            'confidence_score': 0.8,
            'target_time': target_datetime.isoformat()
        }