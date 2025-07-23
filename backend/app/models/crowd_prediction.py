"""
Database models for crowd prediction data
"""

from app import db
from datetime import datetime

class CrowdDataPoint(db.Model):
    """
    Stores crowd estimates derived from MTA hourly ridership data
    Each row = crowd level for one route at one station at one time
    """
    __tablename__ = 'crowd_data_points'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Links to existing MTA data
    station_id = db.Column(db.String(20), db.ForeignKey('stops.id'), nullable=False)
    route_id = db.Column(db.String(10), db.ForeignKey('routes.id'), nullable=False)
    
    # Time information
    timestamp = db.Column(db.DateTime, nullable=False)
    hour_of_day = db.Column(db.Integer, nullable=False)  # 0-23
    day_of_week = db.Column(db.Integer, nullable=False)  # 0-6
    
    # Crowd data derived from ridership counts
    crowd_level = db.Column(db.Integer, nullable=False)  # 1-4 scale
    raw_entries = db.Column(db.Integer)  # Original ridership count
    raw_exits = db.Column(db.Integer)    # Not available in hourly data
    net_traffic = db.Column(db.Integer)  # Same as ridership for hourly data
    
    # Data source tracking
    source = db.Column(db.String(50), default='mta_hourly_ridership')
    mta_station_name = db.Column(db.String(100))  # Original MTA station name
    
    def to_dict(self):
        """Convert to JSON for API responses"""
        return {
            'id': self.id,
            'station_id': self.station_id,
            'route_id': self.route_id,
            'crowd_level': self.crowd_level,
            'timestamp': self.timestamp.isoformat(),
            'net_traffic': self.net_traffic,
            'source': self.source
        }

class CrowdPrediction(db.Model):
    """Stores ML predictions for future crowd levels"""
    __tablename__ = 'crowd_predictions'
    
    id = db.Column(db.Integer, primary_key=True)
    station_id = db.Column(db.String(20), db.ForeignKey('stops.id'), nullable=False)
    route_id = db.Column(db.String(10), db.ForeignKey('routes.id'), nullable=False)
    
    prediction_time = db.Column(db.DateTime, nullable=False)  # When prediction was made
    target_time = db.Column(db.DateTime, nullable=False)      # Time being predicted
    predicted_crowd_level = db.Column(db.Integer, nullable=False)
    confidence_score = db.Column(db.Float, default=0.0)
    
    def to_dict(self):
        return {
            'station_id': self.station_id,
            'route_id': self.route_id,
            'target_time': self.target_time.isoformat(),
            'predicted_crowd_level': self.predicted_crowd_level,
            'confidence_score': self.confidence_score
        }