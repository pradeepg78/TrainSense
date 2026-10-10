// API Configuration
import { Platform } from 'react-native';

// On web, call the API on the same origin (`/api`) so the deployed Vercel build
// reaches its bundled serverless backend with no CORS. During local web preview
// (the static export served on :4173) there is no same-origin backend, so fall
// back to the local Flask dev server. Native always uses the local dev server.
const resolveBaseUrl = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const isLocalPreview = window.location.port === '4173';
    return isLocalPreview ? 'http://127.0.0.1:5001/api' : '/api';
  }
  return 'http://127.0.0.1:5001/api';
};

const API_BASE_URL = resolveBaseUrl();

// Types for API responses 
// they describe the shape of the data --> instructions to TypeScript saying "whenever you see a route, it must have these"
// export means that other files can import and use this interface. if backend returns a Route w/o short_name, returns an error
export interface Route {
  id: string;
  short_name: string;
  long_name: string;
  route_color: string;
  text_color: string;
}

export interface Stop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  routes?: Route[]; // an array of Route objects
  distance_km?: number;
  parent_station?: string;
}

export interface Arrival {
  route: string;
  minutes: number;
  direction: string;
  status: string;
  arrival_time?: number;
  trip_id?: string;
}

export interface MapStation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  routes?: Route[];
  hub_id?: string;
}

export interface TripLeg {
  route: Route;
  from_stop: Stop;
  to_stop: Stop;
}

export interface TripOption {
  legs: TripLeg[];
  transfers: number;
  estimated_minutes: number;
  estimated_time: string;
}

export interface TripPlan {
  origin: Stop;
  destination: Stop;
  options: TripOption[];
}

export interface ServiceStatus {
  id: string;
  short_name: string;
  long_name: string;
  route_color: string;
  text_color: string;
  status: {
    status: string;
    message: string;
    color: string;
  };
}

export interface RealtimeUpdate {
  stop: Stop;
  arrivals: Arrival[];
}

// <T> here is a placeholder Type --> covers every possible ApiResponse
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Check if backend is available, used as a flag
// if a request fails bc a server is down, this flips to false
// app can check apiService.isBackendAvilaible() to decide whether or not to show an error
let backendAvailable = true;

// Generic API request function
// every single API call goes through here
// async --> returns a Promise, does async work -> js pauses function while it waits for something
async function apiRequest<T>(
  endpoint: string, // path like /routes
  options: RequestInit = {} // optional http options, defaults to empty
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE_URL}${endpoint}`; // backtick combines two into one
    console.log(`Making API request to: ${url}`);
    
    // http request
    // will use spread operator here --> ...options.headers means take all the key value pairs from options.headers and drop it here
    /* 
    why do we need the spread operator? since the spread operator takes everything inside the object and drops it in 
    without it, planTrip() passes method: 'POST' nd body '...' inside options, theyd never make it into fetch 
    youd only send the headers, and fetch would default to GET with no body
    */
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json(); // the raw http response, .json will read the body strea and parse it from a JSON strin into a JS object 
    console.log(`API response for ${endpoint}:`, { status: response.status, success: data.success });

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    backendAvailable = true; // Reset availability flag on successful request
    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    
    // Check if it's a connection error
    // instanceof checks if error is actually an Error object
    if (error instanceof Error && error.message.includes('Network request failed')) {
      backendAvailable = false;
      return {
        success: false,
        error: 'Backend server is not running. Please start the backend server.',
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// API Service Functions
// a js object being exported, means other files oher files can import it
export const apiService = {
  // Check if backend is available
  isBackendAvailable(): boolean {
    return backendAvailable;
  },

  // Health check
  async checkHealth(): Promise<ApiResponse<any>> {
    return apiRequest('/health');
  },

  // Routes
  async getRoutes(): Promise<ApiResponse<Route[]>> {
    return apiRequest<Route[]>('/routes');
  },

  // Stops
  async getStops(): Promise<ApiResponse<Stop[]>> {
    return apiRequest<Stop[]>('/stops');
  },

  async getStopRoutes(stopId: string): Promise<ApiResponse<Route[]>> {
    return apiRequest<Route[]>(`/stops/${stopId}/routes`);
  },

  // Real-time arrivals
  async getRealtimeUpdates(stopId: string): Promise<ApiResponse<RealtimeUpdate>> {
    return apiRequest<RealtimeUpdate>(`/realtime/${stopId}`);
  },

  // Trip Planning
  async planTrip(originId: string, destinationId: string): Promise<ApiResponse<TripPlan>> {
    return apiRequest<TripPlan>('/plan-trip', {
      method: 'POST',
      body: JSON.stringify({ 
        origin_id: originId, 
        destination_id: destinationId 
      }),
    });
  },

  // Map Stations
  async getMapStations(): Promise<ApiResponse<MapStation[]>> {
    return apiRequest<MapStation[]>('/map/stations');
  },

  // Service status
  async getServiceStatus(): Promise<ApiResponse<ServiceStatus[]>> {
    return apiRequest<ServiceStatus[]>('/service-status');
  },

  // Real-time health
  async getRealtimeHealth(): Promise<ApiResponse<any>> {
    return apiRequest('/realtime/health');
  },

  // Route Stations
  async getRouteStations(routeId: string): Promise<ApiResponse<Stop[]>> {
    return apiRequest<Stop[]>(`/route-stations/${routeId}`);
  },

  // Route Shape
  async getRouteShape(routeId: string): Promise<ApiResponse<any>> {
    return apiRequest<any>(`/route-shape/${routeId}`);
  },
};