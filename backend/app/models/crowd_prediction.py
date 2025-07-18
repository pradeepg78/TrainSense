from app import db
from datetime import datetime

class CrowdDataPoint(db.Model):
    """
    Database that represents crowd level pulled from the MTA's public turnstile data
    Each row represents one time period at one station with estimated crowd level
    """
    
    __tablename__ = 'crowd_data_points'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Link to existing MTA data
    station_id = db.Column(db.String(20), db.ForeignKey('stops.id'), nullable=False)
    route_id = db.Column(db.String(10), db.ForeignKey('routes.id'), nullable=False)
    
    # Timestamp info from the public MTA turnstile data
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    hour_of_day = db.Column(db.DateTime, nullable=False)
    day_of_week = db.Column(db.Integer, nullable=False)
    
    # Crowd estimate based on turnstile counts
    crowd_level = db.Column(db.Integer, nullable=False) # 1-4 scale
    raw_entries = db.Column(db.Integer) # Original MTA entry count
    raw_exits = db.Column(db.Integer) # Original MTA exit count
    net_traffic = db.Column(db.Integer)  # net entries - exits
    
    # Data source tracking
    source = db.Column(db.String(50), default='mta_turnstile')
    mta_station_name = db.Column(db.String(100))
    
    def to_dict(self):
        """Convert to JSON for API response"""
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
    
    # Link to existing MTA data
    station_id = db.Column(db.String(20), db.ForeignKey('stops.id'), nullable=False)
    route_id = db.Column(db.String(10), db.ForeignKey('routes.id'), nullable=False)
    
    # Prediction timestamp
    prediction_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    # Predicted crowd level
    predicted_crowd_level = db.Column(db.Integer, nullable=False)  # 1-4 scale
    
    def to_dict(self):
        """Convert to JSON for API response"""
        return {
            'id': self.id,
            'station_id': self.station_id,
            'route_id': self.route_id,
            'predicted_crowd_level': self.predicted_crowd_level,
            'prediction_time': self.prediction_time.isoformat()
        }
    