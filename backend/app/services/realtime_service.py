from datetime import datetime, timedelta
import time
import requests
import logging
from flask import current_app
from google.transit import gtfs_realtime_pb2
from app.models.transit import Route, Stop, Trip, StopRoute

logger = logging.getLogger(__name__)

class RealtimeDataService:
    """Service for handling MTA real-time data"""
    
    # MTA feed mappings
    FEED_MAPPINGS = {
        '123456': ['1', '2', '3', '4', '5', '6'],
        'ace': ['A', 'C', 'E'],
        'bdfm': ['B', 'D', 'F', 'M'],
        'g': ['G'],
        'jz': ['J', 'Z'],
        'nqrw': ['N', 'Q', 'R', 'W'],
        'l': ['L'],
        'si': ['SI'],
        '7': ['7']
    }
    
    def __init__(self):
        self.api_key = current_app.config.get('MTA_API_KEY')
        self.base_url = "https://api-endpoint.mta.info/feeds"
        
        if not self.api_key:
            logger.warning("MTA_API_KEY not configured")
    
    def get_arrivals_for_stop(self, stop_id, route_ids=None):
        """Get real-time arrivals for a specific stop"""
        try:
            arrivals = []
            
            # Get all feeds that might have data for this stop
            feeds_to_check = []
            for feed_id, routes in self.FEED_MAPPINGS.items():
                if not route_ids or any(route in routes for route in route_ids):
                    feeds_to_check.append(feed_id)
            
            # Get data from each relevant feed
            for feed_id in feeds_to_check:
                feed_data = self._get_feed_data(feed_id)
                if feed_data:
                    feed_arrivals = self._parse_arrivals_from_feed(feed_data, stop_id, route_ids)
                    arrivals.extend(feed_arrivals)
            
            # Sort by arrival time
            arrivals.sort(key=lambda x: x.get('arrival_time', 0))
            
            return arrivals[:20]  # Return top 20 arrivals
            
        except Exception as e:
            logger.error(f"Error getting arrivals for stop {stop_id}: {e}")
            return []
    
    def get_route_status(self, route_id):
        """Get service status for a specific route"""
        try:
            # Find which feed contains this route
            feed_id = None
            for feed, routes in self.FEED_MAPPINGS.items():
                if route_id in routes:
                    feed_id = feed
                    break
            
            if not feed_id:
                return {
                    'status': 'unknown',
                    'message': 'Route not found in feed mappings',
                    'color': '#999999'
                }
            
            # Get feed data
            feed_data = self._get_feed_data(feed_id)
            if not feed_data:
                return {
                    'status': 'unknown',
                    'message': 'Unable to fetch feed data',
                    'color': '#999999'
                }
            
            # Analyze feed for service status
            status = self._analyze_route_status(feed_data, route_id)
            return status
            
        except Exception as e:
            logger.error(f"Error getting status for route {route_id}: {e}")
            return {
                'status': 'unknown',
                'message': 'Error fetching status',
                'color': '#999999'
            }
    
    def _get_feed_data(self, feed_id):
        """Get GTFS real-time data from MTA API"""
        try:
            url = f"{self.base_url}/{feed_id}/gtfs-realtime"
            
            headers = {}
            if self.api_key:
                headers['x-api-key'] = self.api_key
            
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            # Parse protobuf data
            feed = gtfs_realtime_pb2.FeedMessage()
            feed.ParseFromString(response.content)
            
            return feed
            
        except Exception as e:
            logger.error(f"Error fetching feed {feed_id}: {e}")
            return None
    
    def _parse_arrivals_from_feed(self, feed, stop_id, route_ids=None):
        """Parse arrival times from GTFS real-time feed"""
        arrivals = []
        current_time = int(time.time())
        
        try:
            for entity in feed.entity:
                if entity.HasField('trip_update'):
                    trip_update = entity.trip_update
                    
                    # Get route ID from trip
                    route_id = None
                    if trip_update.trip.HasField('route_id'):
                        route_id = trip_update.trip.route_id
                    
                    # Filter by route if specified
                    if route_ids and route_id not in route_ids:
                        continue
                    
                    # Parse stop time updates
                    for stop_time_update in trip_update.stop_time_update:
                        if stop_time_update.stop_id == stop_id:
                            arrival_time = None
                            
                            if stop_time_update.HasField('arrival'):
                                arrival_time = stop_time_update.arrival.time
                            elif stop_time_update.HasField('arrival_time'):
                                arrival_time = stop_time_update.arrival_time
                            
                            if arrival_time:
                                # Calculate minutes until arrival
                                minutes_until = (arrival_time - current_time) // 60
                                
                                if 0 <= minutes_until <= 30:  # Only show arrivals within 30 minutes
                                    arrival = {
                                        'route': route_id,
                                        'minutes': minutes_until,
                                        'arrival_time': arrival_time,
                                        'direction': self._get_direction(trip_update.trip),
                                        'status': self._get_status(minutes_until),
                                        'trip_id': trip_update.trip.trip_id
                                    }
                                    arrivals.append(arrival)
            
            return arrivals
            
        except Exception as e:
            logger.error(f"Error parsing arrivals from feed: {e}")
            return []
    
    def _get_direction(self, trip):
        """Get direction from trip information"""
        try:
            if trip.HasField('trip_id'):
                trip_id = trip.trip_id.lower()
                if 'north' in trip_id or 'uptown' in trip_id:
                    return 'Northbound'
                elif 'south' in trip_id or 'downtown' in trip_id:
                    return 'Southbound'
                elif 'east' in trip_id:
                    return 'Eastbound'
                elif 'west' in trip_id:
                    return 'Westbound'
            
            # Default direction based on trip ID pattern
            return 'Northbound'  # Default fallback
            
        except Exception as e:
            logger.error(f"Error getting direction: {e}")
            return 'Unknown'
    
    def _get_status(self, minutes_until):
        """Get status based on arrival time"""
        if minutes_until <= 1:
            return 'Arriving'
        elif minutes_until <= 3:
            return 'Approaching'
        else:
            return 'On Time'
    
    def _analyze_route_status(self, feed, route_id):
        """Analyze feed data to determine route status"""
        try:
            # Count delays and issues
            total_trips = 0
            delayed_trips = 0
            
            for entity in feed.entity:
                if entity.HasField('trip_update'):
                    trip_update = entity.trip_update
                    
                    if trip_update.trip.HasField('route_id') and trip_update.trip.route_id == route_id:
                        total_trips += 1
                        
                        # Check for delays
                        for stop_time_update in trip_update.stop_time_update:
                            if stop_time_update.HasField('delay'):
                                if stop_time_update.delay > 300:  # 5 minutes or more
                                    delayed_trips += 1
                                    break
            
            # Determine status based on delay percentage
            if total_trips == 0:
                return {
                    'status': 'unknown',
                    'message': 'No trip data available',
                    'color': '#999999'
                }
            
            delay_percentage = (delayed_trips / total_trips) * 100
            
            if delay_percentage < 10:
                return {
                    'status': 'good_service',
                    'message': 'Good Service',
                    'color': '#00C851'
                }
            elif delay_percentage < 30:
                return {
                    'status': 'some_delays',
                    'message': 'Some Delays',
                    'color': '#ffbb33'
                }
            else:
                return {
                    'status': 'significant_delays',
                    'message': 'Significant Delays',
                    'color': '#ff4444'
                }
                
        except Exception as e:
            logger.error(f"Error analyzing route status: {e}")
            return {
                'status': 'unknown',
                'message': 'Unable to determine status',
                'color': '#999999'
            }
    
    def get_feed_health(self):
        """Check health of all MTA feeds"""
        results = {}
        
        for feed_id in self.FEED_MAPPINGS.keys():
            try:
                start_time = time.time()
                feed_data = self._get_feed_data(feed_id)
                response_time = time.time() - start_time
                
                if feed_data:
                    results[feed_id] = {
                        'status': 'healthy',
                        'response_time': round(response_time, 3),
                        'entities': len(feed_data.entity),
                        'timestamp': feed_data.header.timestamp if feed_data.header.HasField('timestamp') else None
                    }
                else:
                    results[feed_id] = {
                        'status': 'unhealthy',
                        'error': 'Failed to fetch feed data'
                    }
                    
            except Exception as e:
                results[feed_id] = {
                    'status': 'unhealthy',
                    'error': str(e)
                }
        
        return {
            'timestamp': datetime.now().isoformat(),
            'feeds': results
        } 