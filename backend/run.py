# backend/run.py
from app import create_app, db
from config import Config

# Import models so they're registered with SQLAlchemy
from app.models.transit import Route, Stop, Trip

# Create Flask app
app = create_app()

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

if __name__ == '__main__':
    # Validate configuration
    if Config.validate_config():
        print("✅ Configuration validated successfully")
    else:
        print("⚠️  Configuration issues detected")
    
    print(f"🚇 Starting MTA Subway Crowd Prediction API")
    print(f"🌐 Running on: http://localhost:5000")
    print(f"📊 Database: {app.config['SQLALCHEMY_DATABASE_URI']}")
    print(f"🔑 MTA API Key: {'✅ Configured' if app.config['MTA_API_KEY'] else '❌ Missing'}")
    
    # Create database tables
    with app.app_context():
        db.create_all()
        print("📋 Database tables created")
    
    # Run the Flask app
    app.run(
        debug=app.config['DEBUG'],
        host='0.0.0.0',
        port=5001
    )