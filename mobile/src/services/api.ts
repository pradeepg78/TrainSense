import React from 'react';
import { Alert } from 'react-native';

// API Configuration
const API_BASE_URL = 'http://127.0.0.1:5000/api';

// Types for API responses
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
  routes?: Route[];
  distance_km?: number;
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
}

export interface TripPlan {
  origin: Stop;
  destination: Stop;
  routes: Array<{
    route: Route;
    type: string;
  }>;
  estimated_time: string;
  transfers: number;
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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Check if backend is available
let backendAvailable = true;

// Generic API request function
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`Making API request to: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();
    console.log(`API response for ${endpoint}:`, { status: response.status, success: data.success });

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    backendAvailable = true; // Reset availability flag on successful request
    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    
    // Check if it's a connection error
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
};

// Utility function to show API errors
export function showApiError(error: string, title: string = 'API Error') {
  Alert.alert(title, error, [{ text: 'OK' }]);
}

// Hook for API state management
export function useApiState<T>() {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const execute = React.useCallback(async (apiCall: () => Promise<ApiResponse<T>>) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiCall();
      if (response.success && response.data) {
        setData(response.data);
      } else {
        setError(response.error || 'Unknown error occurred');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, execute };
}
