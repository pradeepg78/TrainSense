#!/usr/bin/env python3
"""
Script to populate stop-route relationships from GTFS data
"""
import os
import csv
import sys
import logging

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from app.models.transit import Route, Stop, Trip, StopRoute

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def populate_stop_routes():
    """Populate stop-route relationships from GTFS data"""
    try:
        app = create_app()
        with app.app_context():
            logger.info("Starting stop-route relationship population...")
            
            # Get the GTFS data directory
            data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
            gtfs_dir = os.path.join(data_dir, 'gtfs')
            
            if not os.path.exists(gtfs_dir):
                logger.error("GTFS data directory not found. Please run setup_database.py first.")
                return False
            
            # Check if we have the required files
            trips_file = os.path.join(gtfs_dir, 'trips.txt')
            stop_times_file = os.path.join(gtfs_dir, 'stop_times.txt')
            
            if not os.path.exists(trips_file) or not os.path.exists(stop_times_file):
                logger.error("Required GTFS files not found. Please run setup_database.py first.")
                return False
            
            # Clear existing stop-route relationships
            logger.info("Clearing existing stop-route relationships...")
            StopRoute.query.delete()
            db.session.commit()
            
            # Create trip to route mapping
            logger.info("Creating trip to route mapping...")
            trip_route_map = {}
            
            with open(trips_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    trip_id = row.get('trip_id', '').strip()
                    route_id = row.get('route_id', '').strip()
                    if trip_id and route_id:
                        trip_route_map[trip_id] = route_id
            
            logger.info(f"Created mapping for {len(trip_route_map)} trips")
            
            # Create stop-route relationships from stop times
            logger.info("Creating stop-route relationships...")
            stop_route_pairs = set()
            
            with open(stop_times_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    trip_id = row.get('trip_id', '').strip()
                    stop_id = row.get('stop_id', '').strip()
                    
                    if trip_id in trip_route_map and stop_id:
                        route_id = trip_route_map[trip_id]
                        stop_route_pairs.add((stop_id, route_id))
            
            logger.info(f"Found {len(stop_route_pairs)} unique stop-route pairs")
            
            # Create StopRoute records
            logger.info("Creating StopRoute records...")
            count = 0
            
            for stop_id, route_id in stop_route_pairs:
                # Check if both stop and route exist
                stop = Stop.query.get(stop_id)
                route = Route.query.get(route_id)
                
                if stop and route:
                    # Check if relationship already exists
                    existing = StopRoute.query.filter_by(
                        stop_id=stop_id, 
                        route_id=route_id
                    ).first()
                    
                    if not existing:
                        stop_route = StopRoute(
                            stop_id=stop_id,
                            route_id=route_id
                        )
                        db.session.add(stop_route)
                        count += 1
                        
                        if count % 1000 == 0:
                            logger.info(f"Created {count} relationships...")
            
            db.session.commit()
            logger.info(f"Successfully created {count} stop-route relationships")
            
            # Verify some relationships
            logger.info("Verifying relationships...")
            total_stops = Stop.query.count()
            stops_with_routes = db.session.query(Stop).join(StopRoute).distinct().count()
            total_relationships = StopRoute.query.count()
            
            logger.info(f"Total stops: {total_stops}")
            logger.info(f"Stops with routes: {stops_with_routes}")
            logger.info(f"Total relationships: {total_relationships}")
            
            # Test a specific station (Flushing-Main St)
            flushing_stop = Stop.query.filter(Stop.name.like('%Flushing%')).first()
            if flushing_stop:
                routes = flushing_stop.get_routes()
                logger.info(f"Flushing-Main St serves routes: {[r.id for r in routes]}")
            
            return True
            
    except Exception as e:
        logger.error(f"Error populating stop-route relationships: {e}")
        return False

def main():
    """Main function"""
    logger.info("Starting stop-route population process...")
    
    if populate_stop_routes():
        logger.info("Stop-route population completed successfully!")
    else:
        logger.error("Stop-route population failed!")
        sys.exit(1)

if __name__ == "__main__":
    main() 