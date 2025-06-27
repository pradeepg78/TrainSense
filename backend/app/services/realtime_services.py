from datetime import datetime
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
        '7': '7',
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
        'SI': 'si'
    }
    
    def __init__(self):
        # Initialize API Key
        self.api_key = current_app.config.get('MTA_API_KEY')
        self.feed_urls = current_app.config.get('MTA_REALTIME_FEEDS')
        
        if not self.api_key:
            raise ValueError("MTA_API_KEY is not set in the configuration.")
        if not self.feed_urls:
            raise ValueError("MTA_REALTIME_FEEDS is not set in the configuration.")
        
    def get_route_updates(self, route_id):
        if route_id not in self.routes_to_feed:
            raise ValueError(f"Route {route_id} cannot be found.")
        
        feed_key = self.routes_to_feed[route_id.upper()]
        feed_url = self.feed_urls[feed_key]
        
        response_data = self._make_api_request(feed_url)
        
        print(f"get_route_updates -> response_data: {response_data}")
        
        return response_data
        
    def _get_feed_for_route(self, route_id):
        """Get the feed URL for a given route ID"""
        feed_key = self.routes_to_feed.get(route_id.upper())
        if not feed_key:
            raise ValueError(f"No feed found for route {route_id}")
        
        feed_url = current_app.config['MTA_REALTIME_FEEDS'].get(feed_key)
        if not feed_url:
            raise ValueError(f"No URL found for feed key {feed_key}")
        
        print(f"_get_feed_for_route -> feed_url: {feed_url}")
        
        return feed_url
    
    def _make_api_request(self, url):
        api_key = self.api_key
        
        headers = {
            'x-api-key': api_key
        }
        
        response = requests.get(url, headers=headers)
        
        print(f"_make_api_request -> response: {response}, status_code: {response.status_code}")
        
        return response
        