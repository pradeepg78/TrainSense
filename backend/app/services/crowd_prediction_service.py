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
        
        print(f"✅ Collected {len(crowd_data)} training examples")
        
        # Show data distribution
        crowd_levels = [point.crowd_level for point in crowd_data]
        crowd_dist = {}
        for level in crowd_levels:
            crowd_dist[level] = crowd_dist.get(level, 0) + 1
        
        print("📊 Crowd level distribution:")
        for level in sorted(crowd_dist.keys()):
            count = crowd_dist[level]
            percentage = (count / len(crowd_data)) * 100
            level_name = {1: "Low", 2: "Medium", 3: "High", 4: "Very High"}.get(level, f"Level {level}")
            print(f"  Level {level} ({level_name}): {count} samples ({percentage:.1f}%)")
        
        return crowd_data
    
    def engineer_features(self, data_points):
        """
        Enhanced feature engineering for 70%+ accuracy
        """
        print("🔧 Engineering advanced ML features...")
        
        features = []
        labels = []
        
        for point in data_points:
            try:
                # Parse timestamp
                timestamp = point.timestamp
                hour_of_day = timestamp.hour
                day_of_week = timestamp.weekday()
                month = timestamp.month
                day_of_year = timestamp.timetuple().tm_yday
                
                # Basic time features
                is_weekend = 1 if day_of_week >= 5 else 0
                is_rush_hour = 1 if (7 <= hour_of_day <= 9) or (17 <= hour_of_day <= 19) else 0
                is_late_night = 1 if hour_of_day >= 22 or hour_of_day <= 5 else 0
                
                # Enhanced time features
                is_morning_rush = 1 if 7 <= hour_of_day <= 9 else 0
                is_evening_rush = 1 if 17 <= hour_of_day <= 19 else 0
                is_midday = 1 if 10 <= hour_of_day <= 16 else 0
                
                # Seasonal features
                is_summer = 1 if month in [6, 7, 8] else 0
                is_winter = 1 if month in [12, 1, 2] else 0
                is_spring = 1 if month in [3, 4, 5] else 0
                is_fall = 1 if month in [9, 10, 11] else 0
                
                # Day type features
                is_monday = 1 if day_of_week == 0 else 0
                is_friday = 1 if day_of_week == 4 else 0
                is_sunday = 1 if day_of_week == 6 else 0
                
                # Cyclical time features (better for ML)
                hour_sin = np.sin(2 * np.pi * hour_of_day / 24)
                hour_cos = np.cos(2 * np.pi * hour_of_day / 24)
                day_sin = np.sin(2 * np.pi * day_of_week / 7)
                day_cos = np.cos(2 * np.pi * day_of_week / 7)
                month_sin = np.sin(2 * np.pi * month / 12)
                month_cos = np.cos(2 * np.pi * month / 12)
                
                # Station-specific features
                station_id = point.station_id
                route_id = point.route_id
                
                # Get historical averages for this station/route/time
                historical_avg = self._get_historical_average(station_id, route_id, hour_of_day, day_of_week)
                historical_std = self._get_historical_std(station_id, route_id, hour_of_day, day_of_week)
                
                # Traffic level based on historical data
                if historical_std > 0:
                    traffic_level = (point.raw_entries - historical_avg) / historical_std
                else:
                    traffic_level = 0
                
                # Station popularity (normalized)
                station_popularity = self._get_station_popularity(station_id, route_id)
                
                # Route-specific features
                is_express_route = 1 if route_id in ['A', 'D', 'E', 'F', 'N', 'Q', 'R'] else 0
                is_local_route = 1 if route_id in ['1', '2', '3', '4', '5', '6', '7', 'G', 'L', 'M'] else 0
                
                # Borough features
                borough = getattr(point, 'borough', '').lower() if hasattr(point, 'borough') and point.borough else 'manhattan'
                is_manhattan = 1 if 'manhattan' in borough else 0
                is_brooklyn = 1 if 'brooklyn' in borough else 0
                is_queens = 1 if 'queens' in borough else 0
                is_bronx = 1 if 'bronx' in borough else 0
                
                # Interaction features (important for accuracy)
                rush_manhattan = is_rush_hour * is_manhattan
                weekend_brooklyn = is_weekend * is_brooklyn
                late_night_express = is_late_night * is_express_route
                
                # Weather-like features (proxy for seasonal patterns)
                is_holiday_season = 1 if month in [11, 12] else 0  # Thanksgiving/Christmas
                is_summer_break = 1 if month in [6, 7, 8] else 0
                
                # Create feature vector
                feature_vector = [
                    hour_of_day,
                    day_of_week,
                    month,
                    day_of_year,
                    is_weekend,
                    is_rush_hour,
                    is_late_night,
                    is_morning_rush,
                    is_evening_rush,
                    is_midday,
                    is_summer,
                    is_winter,
                    is_spring,
                    is_fall,
                    is_monday,
                    is_friday,
                    is_sunday,
                    hour_sin,
                    hour_cos,
                    day_sin,
                    day_cos,
                    month_sin,
                    month_cos,
                    historical_avg,
                    historical_std,
                    traffic_level,
                    station_popularity,
                    is_express_route,
                    is_local_route,
                    is_manhattan,
                    is_brooklyn,
                    is_queens,
                    is_bronx,
                    rush_manhattan,
                    weekend_brooklyn,
                    late_night_express,
                    is_holiday_season,
                    is_summer_break,
                    point.raw_entries  # Raw ridership as feature
                ]
                
                features.append(feature_vector)
                labels.append(point.crowd_level)
                
            except Exception as e:
                print(f"Error engineering features: {e}")
                continue
        
        print(f"✅ Engineered features for {len(features)} data points")
        return np.array(features), np.array(labels)

    def _get_historical_average(self, station_id, route_id, hour, day_of_week):
        """Get historical average ridership for this station/route/time"""
        try:
            from app.models.crowd_prediction import CrowdDataPoint
            from sqlalchemy import func
            
            # Query historical data for this station/route/time combination
            avg_result = db.session.query(func.avg(CrowdDataPoint.raw_entries)).filter(
                CrowdDataPoint.station_id == station_id,
                CrowdDataPoint.route_id == route_id,
                func.extract('hour', CrowdDataPoint.timestamp) == hour,
                func.extract('dow', CrowdDataPoint.timestamp) == day_of_week
            ).scalar()
            
            return float(avg_result) if avg_result else 100.0  # Default fallback
        except:
            return 100.0

    def _get_historical_std(self, station_id, route_id, hour, day_of_week):
        """Get historical standard deviation for this station/route/time"""
        try:
            from app.models.crowd_prediction import CrowdDataPoint
            from sqlalchemy import func
            
            std_result = db.session.query(func.stddev(CrowdDataPoint.raw_entries)).filter(
                CrowdDataPoint.station_id == station_id,
                CrowdDataPoint.route_id == route_id,
                func.extract('hour', CrowdDataPoint.timestamp) == hour,
                func.extract('dow', CrowdDataPoint.timestamp) == day_of_week
            ).scalar()
            
            return float(std_result) if std_result else 50.0  # Default fallback
        except:
            return 50.0

    def _get_station_popularity(self, station_id, route_id):
        """Get station popularity score (0-1)"""
        try:
            from app.models.crowd_prediction import CrowdDataPoint
            from sqlalchemy import func
            
            # Get average ridership for this station/route
            avg_result = db.session.query(func.avg(CrowdDataPoint.raw_entries)).filter(
                CrowdDataPoint.station_id == station_id,
                CrowdDataPoint.route_id == route_id
            ).scalar()
            
            # Normalize to 0-1 scale (assuming max ridership is ~1000)
            popularity = min(float(avg_result) / 1000.0, 1.0) if avg_result else 0.1
            return popularity
        except:
            return 0.1
    
    def train_model(self):
        """Train the crowd prediction model with enhanced features for 70%+ accuracy"""
        print("🤖 Training crowd prediction model...")
        try:
            # Collect training data
            print("📊 Collecting training data from database...")
            data_points = self.collect_training_data()
            if not data_points:
                print("❌ No training data available")
                return False
            print(f"✅ Collected {len(data_points)} training examples")
            # Show crowd level distribution
            crowd_levels = [point.crowd_level for point in data_points]
            crowd_dist = {}
            for level in crowd_levels:
                crowd_dist[level] = crowd_dist.get(level, 0) + 1
            print("📊 Crowd level distribution:")
            for level in sorted(crowd_dist.keys()):
                count = crowd_dist[level]
                percentage = (count / len(data_points)) * 100
                level_name = {1: "Low", 2: "Medium", 3: "High", 4: "Very High"}.get(level, f"Level {level}")
                print(f"  Level {level} ({level_name}): {count} samples ({percentage:.1f}%)")
            # Engineer enhanced features
            X, y = self.engineer_features(data_points)
            if len(X) == 0:
                print("❌ No features could be engineered")
                return False
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
            # Scale features
            self.scaler = StandardScaler()
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_test_scaled = self.scaler.transform(X_test)
            # Train model with more trees for better accuracy
            self.model = RandomForestRegressor(
                n_estimators=200,  # More trees for better accuracy
                max_depth=15,      # Prevent overfitting
                min_samples_split=10,
                min_samples_leaf=5,
                random_state=42
            )
            self.model.fit(X_train_scaled, y_train)
            # Evaluate
            y_pred = self.model.predict(X_test_scaled)
            y_pred_rounded = np.round(y_pred).astype(int)
            # Calculate accuracy
            accuracy = np.mean(y_pred_rounded == y_test)
            # Calculate per-class accuracy
            from sklearn.metrics import classification_report
            report = classification_report(y_test, y_pred_rounded, output_dict=True)
            print(f"✅ Model trained! Overall Accuracy: {accuracy:.3f}")
            print("📊 Per-class accuracy:")
            for level in sorted(crowd_dist.keys()):
                if str(level) in report:
                    precision = report[str(level)]['precision']
                    recall = report[str(level)]['recall']
                    f1 = report[str(level)]['f1-score']
                    print(f"  Level {level}: Precision={precision:.3f}, Recall={recall:.3f}, F1={f1:.3f}")
            # Save model and scaler
            joblib.dump(self.model, 'models/crowd_prediction_model.pkl')
            joblib.dump(self.scaler, 'models/crowd_prediction_scaler.pkl')
            # Store feature names for prediction
            self.feature_names = [
                'hour_of_day', 'day_of_week', 'month', 'day_of_year',
                'is_weekend', 'is_rush_hour', 'is_late_night', 'is_morning_rush',
                'is_evening_rush', 'is_midday', 'is_summer', 'is_winter',
                'is_spring', 'is_fall', 'is_monday', 'is_friday', 'is_sunday',
                'hour_sin', 'hour_cos', 'day_sin', 'day_cos', 'month_sin', 'month_cos',
                'historical_avg', 'historical_std', 'traffic_level', 'station_popularity',
                'is_express_route', 'is_local_route', 'is_manhattan', 'is_brooklyn',
                'is_queens', 'is_bronx', 'rush_manhattan', 'weekend_brooklyn',
                'late_night_express', 'is_holiday_season', 'is_summer_break', 'raw_entries'
            ]
            return True
        except Exception as e:
            print(f"❌ Model training failed: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def predict_crowd_level(self, station_id, route_id, target_datetime):
        """Predict crowd level using enhanced features for better accuracy"""
        # Try to use the enhanced model first
        try:
            from enhanced_crowd_model import EnhancedCrowdModel
            enhanced_model = EnhancedCrowdModel()
            
            # Load the enhanced model
            if enhanced_model.load_model():
                print("✅ Using enhanced crowd prediction model")
                
                # Make prediction using enhanced model
                result = enhanced_model.predict(route_id, station_id, 'N', target_datetime)
                
                if result:
                    # Convert crowd level to string
                    crowd_level_map = {1: 'low', 2: 'medium', 3: 'high', 4: 'very_high', 5: 'very_high'}
                    crowd_level = crowd_level_map.get(result['predicted_crowd_level'], 'medium')
                    
                    return {
                        'crowd_level': crowd_level,
                        'confidence': result['confidence'],
                        'predicted_level': result['predicted_crowd_level']
                    }
        except Exception as e:
            print(f"❌ Enhanced model error: {e}")
        
        # Fallback to default prediction
        print("⚠️ Using default prediction")
        return {
            'crowd_level': 'medium',
            'confidence': 0.6,
            'predicted_level': 3
        }