# Entry point for flask application
from app import create_app, db
from config import Config
# import ML model
from app.models.crowd_prediction import CrowdDataPoint, CrowdPrediction

# Import models so they're registered with SQLAlchemy
from app.models.transit import Route, Stop, Trip

# Create Flask app
app = create_app()

# Preload the configuration for flask shell    
@app.shell_context_processor
def make_shell_context():
    """Make database models available in Flask shell"""
    return {
        'db': db, 
        'Route': Route, 
        'Stop': Stop, 
        'Trip': Trip,
        'CrowdDataPoint': CrowdDataPoint,     
        'CrowdPrediction': CrowdPrediction,   
        'Config': Config
    }

# This line means "only run this if the file is executed directly"
if __name__ == '__main__':
    # Validate configuration, aka check if MTA_API_KEY is valid
    if Config.validate_config():
        print("✅ Configuration validated successfully")
    else:
        print("⚠️  Configuration issues detected")
    
    print(f"🚇 Starting MTA Subway Crowd Prediction API")
    print(f"🌐 Running on: http://localhost:5000")
    
    # app.config is a special dictionary like object in Flask that is used to store configuration variables
    # When create_app() is run, it loads config values into app.config
    print(f"📊 Database: {app.config['SQLALCHEMY_DATABASE_URI']}") 
    print(f"🔑 MTA API Key: {'✅ Configured' if app.config['MTA_API_KEY'] else '❌ Missing'}")
    
    # Create database tables
    with app.app_context(): # Creates flask application context
        db.create_all() # Create all database tables based on models
        #! MAKE SURE THE DB TABLES ARE ACTUALLY BEING CREATED
        print("📋 Database tables created")
    
    # Run the Flask app
    app.run(
        debug=app.config['DEBUG'],
        host='0.0.0.0',
        port=5001
    )