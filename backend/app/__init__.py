# backend/app/__init__.py

# all libaries installed via pip3
from flask import Flask # Main Frame Webwork Class
from flask_cors import CORS # Allows mobile app to make requests to the API
from flask_sqlalchemy import SQLAlchemy # Database Object Relational Mapping
from flask_migrate import Migrate # Tracks changes to your db structure over time
from config import Config

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()

#builds and returns the flask app 
def create_app(config_class=Config):
    """Application factory pattern"""
    app = Flask(__name__) # Tells Flask where to find its resources, __name__ is the name of the current module
    
    # app.config: dictionary object from Flask
    # from_object(): loads all uppercase attributes from a given class or object into app.config
    # config_class: the class Config imported from config.py, set in the parameter
    # This function allows me to call current_app.config.get('KEY') anywhere in the app to get configuration values
    app.config.from_object(config_class) # Load configuration from Config class
    
    # Initialize Flask extensions
    
    # Connect SQL Alchemy to this specific Flask app
    # fills in db, before it was empty
    db.init_app(app) 
    
    # Keeps track of changes to models (like adding columns or tables)
    migrate.init_app(app, db) 
    
    # Allow requests from other domains
    CORS(app)
    
    # Register API routes
    from app.routes import init_app as init_routes
    init_routes(app)
    
    # Add a simple health check route
    # when a GET comes in for / , run this below
    @app.route('/')
    def health_check():
        return {
            'status': 'healthy',
            'message': 'MTA Transit Companion API is running!',
            'version': '1.0.0'
        }
    
    return app

#run.py calls create_app()
#    ↓
#create_app() runs top to bottom:
#    1. app = Flask(...)        → creates the app
#    2. app.config.from_object  → loads settings
#    3. db.init_app(app)        → connects database
#    4. migrate.init_app(app)   → connects migration tracker
#    5. CORS(app)               → allows mobile app to talk to it
#    6. init_routes(app)        → registers all API endpoints
#    7. @app.route('/')         → adds health check
#    8. return app              → hands finished app back to run.py
#    ↓
#run.py calls app.run(port=5001)
#   ↓
#Server is live, listening for requests