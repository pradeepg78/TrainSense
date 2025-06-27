from date import datetime
import time, requests
from flask import current_app
# from app.models.transit import Route, Stop, Trip

class RealtimeService:
    routes_to_feed = {
    '1': '123456',
    '2': '123456', 
    '3': '123456',
    '4': '123456',
    '5': '123456', 
    '6': '123456',
    
    'A': 'ace',
    'C': 'ace', 
    'E': 'ace',
    
    'B': 'bdfm',
    'D': 'bdfm',
    'F': 'bdfm',
    'M': 'bdfm',
    
    'G': 'g',
    
    'J': 'jz',
    'Z': 'jz',
    
    'N': 'nqrw',
    'Q': 'nqrw', 
    'R': 'nqrw',
    'W': 'nqrw',
    
    'L': 'l',
    
    '7': '7',
    
    'SI': 'si'
    }
    
    def _init__(self):
        # Initialize API Key
        self.api_key = current_app.config.get('MTA_API_KEY')
        self.feed_urls = current_app.config.get('MTA_REALTIME_FEEDS')
        
        if not self.api_key:
            raise ValueError("MTA_API_KEY is not set in the configuration.")
        if not self.feed_urls:
            raise ValueError("MTA_REALTIME_FEEDS is not set in the configuration.")
        
    def get_route_updates(route_id):
        
    def get_feed_for_route(route_id):
        """Get the feed URL for a given route ID."""
        feed_key = self.routes_to_feed.get(route_id.upper())
        if not feed_key:
            raise ValueError(f"No feed found for route {route_id}")
        
        feed_url = current_app.config['MTA_REALTIME_FEEDS'].get(feed_key)
        if not feed_url:
            raise ValueError(f"No URL found for feed key {feed_key}")
        
        return feed_url
    
    def make_api_request(url):
        