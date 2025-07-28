"""
Reset database tables to include new columns
"""

from app import create_app, db
from sqlalchemy import text

def reset_database():
    """Drop and recreate all tables"""
    
    print("🔄 Resetting database tables...")
    
    app = create_app()
    
    with app.app_context():
        try:
            # Drop all tables
            print("🗑️  Dropping existing tables...")
            db.drop_all()
            
            # Create all tables with new schema
            print("📋 Creating tables with new schema...")
            db.create_all()
            
            print("✅ Database reset complete!")
            print("📊 New tables created with all required columns")
            
        except Exception as e:
            print(f"❌ Database reset failed: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    reset_database() 