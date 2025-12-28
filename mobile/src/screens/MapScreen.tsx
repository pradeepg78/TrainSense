import { Ionicons } from "@expo/vector-icons";
import Mapbox, { Camera, LocationPuck, MapView } from "@rnmapbox/maps";
import Constants from "expo-constants";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StationModal } from "../components/StationModal";
import { apiService, MapStation, Stop } from "../services/api";

const { width, height } = Dimensions.get("window");

// Initialize Mapbox with token from environment
const mapboxToken = Constants.expoConfig?.extra?.mapboxAccessToken;
if (mapboxToken) {
  Mapbox.setAccessToken(mapboxToken);
} else {
  console.warn("Mapbox access token not found. Add MAPBOX_ACCESS_TOKEN to your .env file");
}

// Manhattan center location (Times Square area)
const MANHATTAN_CENTER = {
  latitude: 40.758,
  longitude: -73.9855,
};

const MapScreen = () => {
  const [zoomLevel, setZoomLevel] = useState(12);
  const [stations, setStations] = useState<MapStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<Stop | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showStationModal, setShowStationModal] = useState(false);

  const cameraRef = useRef<Camera>(null);

  // Load stations
  useEffect(() => {
    loadStations();
  }, []);

  const loadStations = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getMapStations();
      if (response.success && response.data) {
        setStations(response.data);
      }
    } catch (error) {
      console.error("Error loading stations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationPress = () => {
    cameraRef.current?.setCamera({
      centerCoordinate: [MANHATTAN_CENTER.longitude, MANHATTAN_CENTER.latitude],
      zoomLevel: 13,
      animationDuration: 500,
    });
  };

  const handleZoomIn = () => {
    cameraRef.current?.setCamera({
      zoomLevel: zoomLevel + 1,
      animationDuration: 300,
    });
  };

  const handleZoomOut = () => {
    cameraRef.current?.setCamera({
      zoomLevel: zoomLevel - 1,
      animationDuration: 300,
    });
  };

  const handleCloseModal = () => {
    setShowStationModal(false);
    setSelectedStation(null);
  };

  const onRegionChange = (feature: any) => {
    if (feature?.properties?.zoomLevel) {
      setZoomLevel(feature.properties.zoomLevel);
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        // Use Mapbox Standard style which includes transit
        styleURL="mapbox://styles/mapbox/standard"
        onRegionDidChange={onRegionChange}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [MANHATTAN_CENTER.longitude, MANHATTAN_CENTER.latitude],
            zoomLevel: 12,
          }}
        />
        
        {/* Show user location */}
        <LocationPuck
          puckBearing="heading"
          puckBearingEnabled={true}
          visible={true}
        />
      </MapView>

      {/* Floating Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleLocationPress}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={22} color="#1a1a1a" />
        </TouchableOpacity>
        
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={[styles.controlButton, styles.zoomButton]}
            onPress={handleZoomIn}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="#1a1a1a" />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity
            style={[styles.controlButton, styles.zoomButton]}
            onPress={handleZoomOut}
            activeOpacity={0.8}
          >
            <Ionicons name="remove" size={22} color="#1a1a1a" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingPill}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </View>
      )}

      {/* Station Count Badge */}
      {!isLoading && stations.length > 0 && (
        <View style={styles.stationBadge}>
          <Text style={styles.stationBadgeText}>{stations.length} stations</Text>
        </View>
      )}

      <StationModal
        visible={showStationModal}
        onClose={handleCloseModal}
        station={selectedStation}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  map: {
    flex: 1,
  },

  // Controls
  controlsContainer: {
    position: "absolute",
    right: 16,
    top: Platform.OS === "ios" ? 60 : 40,
    gap: 12,
  },
  controlButton: {
    width: 48,
    height: 48,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  zoomControls: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden",
  },
  zoomButton: {
    borderRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  zoomDivider: {
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.08)",
    marginHorizontal: 8,
  },

  // Loading
  loadingContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  loadingPill: {
    backgroundColor: "rgba(26, 26, 26, 0.9)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.3,
  },

  // Station Badge
  stationBadge: {
    position: "absolute",
    bottom: 110,
    left: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  stationBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3a3a3a",
    letterSpacing: 0.2,
  },
});

export default MapScreen;