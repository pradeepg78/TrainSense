# backend/app/__init__.py
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from config import Config

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()

def create_app(config_class=Config):
    """Application factory pattern"""
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize Flask extensions
    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app)
    
    # Add a simple health check route
    @app.route('/')
    def health_check():
        return {
            'status': 'healthy',
            'message': 'MTA Transit Companion API is running!',
            'version': '1.0.0'
        }
    
    return app