# backend/app/__init__.py
from flask import Flask # Main Frame Webwork Class
from flask_cors import CORS # Allows mobile app to make requests to the API
from flask_sqlalchemy import SQLAlchemy # Database Object Relational Mapping
from flask_migrate import Migrate # Database Schema Versioning
from config import Config

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()

def create_app(config_class=Config):
    """Application factory pattern"""
    app = Flask(__name__) # Tells Flask where to find its resources
    
    # app.config: dictionary object from Flask
    # from_object(): loads all uppercase attributes from a given class or object into app.config
    # config_class: the class Config imported from config.py, set in the parameter
    # This function allows me to call current_app.config.get('KEY') anywhere in the app to get configuration values
    app.config.from_object(config_class) # Load configuration from Config class
    
    # Initialize Flask extensions
    
    # Connect SQL Alchemy to this specific Flask app
    db.init_app(app) 
    
    # Add schema versioning
    # Keeps track of changes to models (like adding columns or tables)
    migrate.init_app(app, db) 
    
    # Allow requests from other domains
    CORS(app)
    
    # Import and register blueprints (ADD THIS SECTION)
    from app.routes.crowd_routes import crowd_bp
    from app.routes.transit_routes import transit_bp
    app.register_blueprint(crowd_bp)
    app.register_blueprint(transit_bp, url_prefix='/api/v1')
    
    # Add a simple health check route
    @app.route('/')
    def health_check():
        return {
            'status': 'healthy',
            'message': 'MTA Transit Companion API is running!',
            'version': '1.0.0',
            'endpoints': [
                '/api/crowd/status',
                '/api/crowd/station/<station_id>',
                '/api/crowd/nearby'
            ]
        }
    
    return app