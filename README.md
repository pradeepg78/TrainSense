# TrainSense - NYC Transit App

A real-time NYC transit app that connects to the MTA API to provide accurate subway information, including routes, stations, arrival times, and service status.

## Features

- **Real-time Arrivals**: Live arrival times from MTA GTFS real-time feeds
- **Interactive Map**: View all subway stations with their actual routes
- **Route Information**: Accurate route data with colors and names
- **Service Status**: Real-time service status for all subway lines
- **Trip Planning**: Plan trips between stations
- **Station Details**: View which routes serve each station

## Prerequisites

- Python 3.8+
- Node.js 16+
- MTA API Key (get one from [MTA Developer Portal](https://api.mta.info/))

## Setup Instructions

### 1. Backend Setup

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and add your MTA_API_KEY

# Set up database and import MTA data
python setup_database.py

# Start the backend server
python run.py
```

The backend will be available at `http://localhost:5001`

### 2. Frontend Setup

```bash
cd mobile

# Install dependencies
npm install

# Start the development server
npm start
```

### 3. Database Setup

The app uses SQLite for the database. The setup script will:

1. Create all necessary tables
2. Download GTFS data from MTA APIs
3. Import routes, stops, and stop-route relationships
4. Set up real-time data connections

## API Endpoints

### Routes

- `GET /api/v1/routes` - Get all subway routes
- `GET /api/v1/stops` - Get all subway stops with route information
- `GET /api/v1/stops/{stop_id}/routes` - Get routes for a specific stop

### Real-time Data

- `GET /api/v1/realtime/{stop_id}` - Get real-time arrivals for a stop
- `GET /api/v1/service-status` - Get service status for all routes
- `GET /api/v1/realtime/health` - Check health of real-time feeds

### Map & Planning

- `GET /api/v1/map/stations` - Get all stations for map display
- `POST /api/v1/plan-trip` - Plan a trip between two stops

## Data Sources

The app uses real data from:

- **MTA GTFS Static Data**: Routes, stops, and schedules
- **MTA GTFS Real-time Feeds**: Live arrival times and service updates
- **MTA API**: Service status and alerts

## Architecture

### Backend (Flask)

- `app/models/transit.py` - Database models for routes, stops, trips
- `app/routes/transit_routes.py` - API endpoints
- `app/services/realtime_service.py` - Real-time data processing
- `import_gtfs_data.py` - Data import from MTA APIs

### Frontend (React Native)

- `src/screens/` - Main app screens
- `src/services/api.ts` - API client
- `src/components/` - Reusable components

## Database Schema

- **routes**: Subway routes with colors and names
- **stops**: Subway stations with coordinates
- **stop_routes**: Many-to-many relationship between stops and routes
- **trips**: Individual train trips

## Real-time Data

The app connects to MTA's GTFS real-time feeds:

- **123456**: 1, 2, 3, 4, 5, 6 trains
- **ace**: A, C, E trains
- **bdfm**: B, D, F, M trains
- **g**: G train
- **jz**: J, Z trains
- **nqrw**: N, Q, R, W trains
- **l**: L train
- **si**: Staten Island Railway
- **7**: 7 train

## Troubleshooting

### No stations showing on map

1. Check that the backend is running
2. Verify MTA API key is set correctly
3. Check database has been populated with data
4. Look at backend logs for API errors

### No arrival times

1. Check MTA real-time feed health
2. Verify API key has real-time access
3. Check network connectivity to MTA APIs

### Database issues

1. Delete the database file and re-run setup
2. Check MTA API key permissions
3. Verify GTFS data is being downloaded correctly

## Development

### Adding new features

1. Update database models if needed
2. Add API endpoints in `transit_routes.py`
3. Update frontend API service
4. Add UI components

### Testing

```bash
# Backend tests
cd backend
python -m pytest

# Frontend tests
cd mobile
npm test
```

## License

This project is for educational purposes. Please respect MTA's API terms of service.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues related to:

- MTA API access: Contact MTA Developer Support
- App functionality: Check the troubleshooting section above
- Setup issues: Verify all prerequisites are installed
