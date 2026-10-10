# backend/run.py
# Entry point for flask application

#open app/ and open __init__.py and grab the create_app function and db SQLAlchemy db
from app import create_app, db
#g to config.py and grab Config class --> this class holds all the settings: db path, API key, etc. 
from config import Config

# Import models so they're registered with 
# go to app/models/transit.py and grab the 3 db model classes
from app.models.transit import Route, Stop, Trip

# Create Flask app
# this function builds the entire flask app, connects db, enables CORS, registers all API routes, returns app object
app = create_app()

# Preload the configuration for flask shell
# when someone runs flask shell, automatially make thse variables availible
# flask shell is a dev tool, opens a Python terminal with app loaded so you can type commands directly w/o writing a script
@app.shell_context_processor
def make_shell_context():
    """Make database models available in Flask shell"""
    return {
        'db': db, 
        'Route': Route, 
        'Stop': Stop, 
        'Trip': Trip,
        'Config': Config
    }

# This line means "only run this if the file is executed directly"
if __name__ == '__main__':
    # validate_config is just a method in the Config class that checks whetger required settings like api key are present
    if Config.validate_config():
        print("Configuration validated successfully")
    else:
        print("Configuration issues detected")
    
    print(f"Starting MTA Subway Crowd Prediction API")
    print(f"Running on: http://localhost:5000")
    
    # app.config is a special dictionary like object in Flask that is used to store configuration variables
    # When create_app() is run, it loads config values into app.config
    print(f"Database: {app.config['SQLALCHEMY_DATABASE_URI']}") 
    print(f"MTA API Key: {'Configured' if app.config['MTA_API_KEY'] else 'Missing'}")
    
    # Create database tables
    with app.app_context(): # Creates flask application context
        db.create_all() # Create all database tables based on models
        #! MAKE SURE THE DB TABLES ARE ACTUALLY BEING CREATED
        print("Database tables created")
    
    # Run the Flask app
    app.run(
        debug=app.config['DEBUG'],
        host='0.0.0.0',
        port=5001
    )