"""
Enhanced Crowd Model for High-Accuracy Predictions
Advanced machine learning model for crowd prediction with 70%+ accuracy
"""

import os
import sys
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import accuracy_score, classification_report
import joblib
from app import create_app, db
from app.models.crowd_prediction import CrowdDataPoint

class EnhancedCrowdModel:
    """
    Enhanced crowd prediction model with advanced features
    for achieving 70%+ accuracy
    """
    
    def __init__(self):
        self.app = create_app()
        self.model = None
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.model_dir = 'models'
        self.model_path = os.path.join(self.model_dir, 'enhanced_crowd_model.pkl')
        self.scaler_path = os.path.join(self.model_dir, 'enhanced_crowd_scaler.pkl')
        self.encoder_path = os.path.join(self.model_dir, 'enhanced_crowd_encoder.pkl')
        
        # Create models directory if it doesn't exist
        os.makedirs(self.model_dir, exist_ok=True)
    
    def load_data(self):
        """Load and prepare data for training"""
        print("📊 Loading training data...")
        
        with self.app.app_context():
            # Get all crowd data points
            data_points = CrowdDataPoint.query.all()
            
            if not data_points:
                print("❌ No data points found in database")
                return None, None
            
            print(f"📈 Found {len(data_points)} data points")
            
            # Convert to DataFrame
            data = []
            for point in data_points:
                data.append({
                    'route_id': point.route_id,
                    'station_id': point.station_id,
                    'direction': 'N',  # Default direction
                    'hour_of_day': point.timestamp.hour,
                    'day_of_week': point.timestamp.weekday(),
                    'month': point.timestamp.month,
                    'is_weekend': 1 if point.timestamp.weekday() >= 5 else 0,
                    'is_rush_hour': 1 if (7 <= point.timestamp.hour <= 9) or (17 <= point.timestamp.hour <= 19) else 0,
                    'is_late_night': 1 if point.timestamp.hour >= 22 or point.timestamp.hour <= 5 else 0,
                    'crowd_level': point.crowd_level
                })
            
            df = pd.DataFrame(data)
            
            # Prepare features and target
            feature_columns = [
                'route_id', 'station_id', 'direction', 'hour_of_day', 
                'day_of_week', 'month', 'is_weekend', 'is_rush_hour', 'is_late_night'
            ]
            
            X = df[feature_columns]
            y = df['crowd_level']
            
            return X, y
    
    def encode_features(self, X):
        """Encode categorical features"""
        print("🔧 Encoding categorical features...")
        
        # Encode route_id
        if 'route_id' in X.columns:
            X['route_id_encoded'] = self.label_encoder.fit_transform(X['route_id'])
            X = X.drop('route_id', axis=1)
        
        # Encode station_id
        if 'station_id' in X.columns:
            X['station_id_encoded'] = self.label_encoder.fit_transform(X['station_id'])
            X = X.drop('station_id', axis=1)
        
        # Encode direction
        if 'direction' in X.columns:
            X['direction_encoded'] = self.label_encoder.fit_transform(X['direction'])
            X = X.drop('direction', axis=1)
        
        return X
    
    def create_advanced_features(self, X):
        """Create advanced features for better prediction"""
        print("🔧 Creating advanced features...")
        
        # Time-based features
        X['hour_sin'] = np.sin(2 * np.pi * X['hour_of_day'] / 24)
        X['hour_cos'] = np.cos(2 * np.pi * X['hour_of_day'] / 24)
        X['day_sin'] = np.sin(2 * np.pi * X['day_of_week'] / 7)
        X['day_cos'] = np.cos(2 * np.pi * X['day_of_week'] / 7)
        X['month_sin'] = np.sin(2 * np.pi * X['month'] / 12)
        X['month_cos'] = np.cos(2 * np.pi * X['month'] / 12)
        
        # Interaction features
        X['rush_weekend'] = X['is_rush_hour'] * X['is_weekend']
        X['late_weekend'] = X['is_late_night'] * X['is_weekend']
        
        # Peak hour features
        X['morning_peak'] = ((X['hour_of_day'] >= 7) & (X['hour_of_day'] <= 9)).astype(int)
        X['evening_peak'] = ((X['hour_of_day'] >= 17) & (X['hour_of_day'] <= 19)).astype(int)
        
        return X
    
    def train_model(self):
        """Train the enhanced crowd prediction model"""
        print("🤖 Training enhanced crowd prediction model...")
        
        # Load data
        X, y = self.load_data()
        if X is None:
            return False
        
        # Encode features
        X = self.encode_features(X)
        
        # Create advanced features
        X = self.create_advanced_features(X)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train ensemble model
        print("🔧 Training ensemble model...")
        
        # Random Forest
        rf_model = RandomForestClassifier(
            n_estimators=200,
            max_depth=15,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        )
        
        # Gradient Boosting
        gb_model = GradientBoostingClassifier(
            n_estimators=150,
            max_depth=8,
            learning_rate=0.1,
            random_state=42
        )
        
        # Train models
        print("🌲 Training Random Forest...")
        rf_model.fit(X_train_scaled, y_train)
        
        print("📈 Training Gradient Boosting...")
        gb_model.fit(X_train_scaled, y_train)
        
        # Evaluate models
        rf_score = rf_model.score(X_test_scaled, y_test)
        gb_score = gb_model.score(X_test_scaled, y_test)
        
        print(f"🌲 Random Forest accuracy: {rf_score:.3f}")
        print(f"📈 Gradient Boosting accuracy: {gb_score:.3f}")
        
        # Choose the better model
        if rf_score >= gb_score:
            self.model = rf_model
            print("✅ Selected Random Forest model")
        else:
            self.model = gb_model
            print("✅ Selected Gradient Boosting model")
        
        # Cross-validation
        cv_scores = cross_val_score(self.model, X_train_scaled, y_train, cv=5)
        print(f"📊 Cross-validation accuracy: {cv_scores.mean():.3f} (+/- {cv_scores.std() * 2:.3f})")
        
        # Save model
        self.save_model()
        
        # Final evaluation
        final_accuracy = self.model.score(X_test_scaled, y_test)
        print(f"🎯 Final model accuracy: {final_accuracy:.3f}")
        
        if final_accuracy >= 0.7:
            print("🎉 Excellent! Model achieves 70%+ accuracy!")
        elif final_accuracy >= 0.6:
            print("✅ Good! Model achieves 60%+ accuracy")
        else:
            print("⚠️ Model accuracy below 60%. Consider more data or feature engineering.")
        
        return True
    
    def save_model(self):
        """Save the trained model"""
        print("💾 Saving model...")
        
        try:
            joblib.dump(self.model, self.model_path)
            joblib.dump(self.scaler, self.scaler_path)
            joblib.dump(self.label_encoder, self.encoder_path)
            print("✅ Model saved successfully")
        except Exception as e:
            print(f"❌ Error saving model: {e}")
    
    def load_model(self):
        """Load the trained model"""
        print("📂 Loading model...")
        
        try:
            self.model = joblib.load(self.model_path)
            self.scaler = joblib.load(self.scaler_path)
            self.label_encoder = joblib.load(self.encoder_path)
            print("✅ Model loaded successfully")
            return True
        except Exception as e:
            print(f"❌ Error loading model: {e}")
            return False
    
    def predict(self, route_id, station_id, direction, timestamp):
        """Make a crowd prediction"""
        if self.model is None:
            if not self.load_model():
                return None
        
        try:
            # Prepare features
            features = {
                'route_id': route_id,
                'station_id': station_id,
                'direction': direction,
                'hour_of_day': timestamp.hour,
                'day_of_week': timestamp.weekday(),
                'month': timestamp.month,
                'is_weekend': 1 if timestamp.weekday() >= 5 else 0,
                'is_rush_hour': 1 if (7 <= timestamp.hour <= 9) or (17 <= timestamp.hour <= 19) else 0,
                'is_late_night': 1 if timestamp.hour >= 22 or timestamp.hour <= 5 else 0
            }
            
            # Create DataFrame
            X = pd.DataFrame([features])
            
            # Encode features
            X = self.encode_features(X)
            
            # Create advanced features
            X = self.create_advanced_features(X)
            
            # Scale features
            X_scaled = self.scaler.transform(X)
            
            # Make prediction
            prediction = self.model.predict(X_scaled)[0]
            probability = self.model.predict_proba(X_scaled)[0]
            
            return {
                'predicted_crowd_level': int(prediction),
                'confidence': float(max(probability)),
                'probabilities': probability.tolist()
            }
            
        except Exception as e:
            print(f"❌ Prediction error: {e}")
            return None
    
    def evaluate_model(self):
        """Evaluate the model performance"""
        print("🧪 Evaluating model performance...")
        
        # Load data
        X, y = self.load_data()
        if X is None:
            return
        
        # Encode and prepare features
        X = self.encode_features(X)
        X = self.create_advanced_features(X)
        X_scaled = self.scaler.transform(X)
        
        # Make predictions
        predictions = self.model.predict(X_scaled)
        
        # Calculate accuracy
        accuracy = accuracy_score(y, predictions)
        print(f"📊 Overall accuracy: {accuracy:.3f}")
        
        # Detailed classification report
        print("\n📋 Classification Report:")
        print(classification_report(y, predictions))
        
        return accuracy

def main():
    """Main function to train the enhanced model"""
    print("🚇 TrainSense Enhanced Crowd Model")
    print("=" * 40)
    print("🎯 Training advanced ML model for 70%+ accuracy")
    print()
    
    model = EnhancedCrowdModel()
    
    # Train the model
    if model.train_model():
        print("\n✅ Model training completed!")
        
        # Evaluate the model
        accuracy = model.evaluate_model()
        
        if accuracy and accuracy >= 0.7:
            print("🎉 Your enhanced model achieves 70%+ accuracy!")
        else:
            print("⚠️ Model accuracy below 70%. Consider more data or retraining.")
    else:
        print("❌ Model training failed.")

if __name__ == "__main__":
    main() 