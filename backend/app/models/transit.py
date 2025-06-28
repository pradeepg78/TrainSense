# backend/app/models/transit.py
from app import db
from datetime import datetime

class Route(db.Model):
    """MTA Route model - represents subway lines"""
    __tablename__ = 'routes'
    
    id = db.Column(db.String(10), primary_key=True)  # e.g., "6", "N", "Q"
    short_name = db.Column(db.String(10), nullable=False)  # Display name
    long_name = db.Column(db.String(255), nullable=False)  # Full route name
    route_type = db.Column(db.Integer, nullable=False)  # 1=subway, 3=bus
    route_color = db.Column(db.String(6), default='000000')  # Hex color
    text_color = db.Column(db.String(6), default='FFFFFF')  # Text color
    
    # repr methods are basically a toString() method for when the objects are called
    def __repr__(self):
        return f'<Route {self.short_name}: {self.long_name}>'
    
    def to_dict(self):
        """Convert route to dictionary for JSON response"""
        return {
            'id': self.id,
            'short_name': self.short_name,
            'long_name': self.long_name,
            'route_type': self.route_type,
            'route_color': self.route_color,
            'text_color': self.text_color
        }

class Stop(db.Model):
    """MTA Stop model - represents subway stations"""
    __tablename__ = 'stops'
    
    id = db.Column(db.String(20), primary_key=True)  # MTA stop ID
    name = db.Column(db.String(255), nullable=False)  # Stop name
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    zone_id = db.Column(db.String(10))  # Fare zone
    location_type = db.Column(db.Integer, default=0)  # 0=stop, 1=station
    parent_station = db.Column(db.String(20))  # For stops part of larger station
    
    def __repr__(self):
        return f'<Stop {self.name} ({self.id})>'
    
    def to_dict(self):
        """Convert stop to dictionary for JSON response"""
        return {
            'id': self.id,
            'name': self.name,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'zone_id': self.zone_id,
            'location_type': self.location_type,
            'parent_station': self.parent_station
        }

class Trip(db.Model):
    """MTA Trip model - represents a specific trip on a route"""
    __tablename__ = 'trips'
    
    id = db.Column(db.String(50), primary_key=True)  # MTA trip ID
    route_id = db.Column(db.String(10), db.ForeignKey('routes.id'), nullable=False)
    service_id = db.Column(db.String(10), nullable=False)  # Service calendar
    trip_headsign = db.Column(db.String(255))  # Destination shown on train
    direction_id = db.Column(db.Integer)  # 0 or 1 for direction
    
    def __repr__(self):
        return f'<Trip {self.id} on Route {self.route_id}>'
    
    def to_dict(self):
        """Convert trip to dictionary for JSON response"""
        return {
            'id': self.id,
            'route_id': self.route_id,
            'service_id': self.service_id,
            'trip_headsign': self.trip_headsign,
            'direction_id': self.direction_id
        }