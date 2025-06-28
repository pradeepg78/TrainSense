import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { apiService, MapStation } from "../services/api";

const { width, height } = Dimensions.get("window");

const MapScreen = () => {
  const [region, setRegion] = useState<Region>({
    latitude: 40.7831,
    longitude: -73.9712,
    latitudeDelta: 0.05, // Start with city view
    longitudeDelta: 0.05,
  });

  const [zoomLevel, setZoomLevel] = useState("city"); // neighborhood, city, borough
  const [stations, setStations] = useState<MapStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<MapStation | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showStationModal, setShowStationModal] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const mapRef = useRef<MapView>(null);

  // Load stations for current map view
  const loadStations = async (newRegion?: Region, newZoomLevel?: string) => {
    const currentRegion = newRegion || region;
    const currentZoom = newZoomLevel || zoomLevel;

    setIsLoading(true);
    setApiError(null);

    try {
      console.log("Loading stations from API...");
      const response = await apiService.getMapStations();
      if (response.success && response.data) {
        console.log("Loaded stations:", response.data.length);
        setStations(response.data);
      } else {
        console.error("Failed to load stations:", response.error);
        setApiError(response.error || "Failed to load stations");
        setStations([]);
      }
    } catch (error) {
      console.error("Error loading stations:", error);
      setApiError("Network error loading stations");
      setStations([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load initial stations
  useEffect(() => {
    console.log("MapScreen mounted, loading stations...");
    loadStations();
  }, []);

  // Debug: Log stations when they change
  useEffect(() => {
    console.log("Stations updated:", stations.length, "stations");
    if (stations.length > 0) {
      console.log("First station:", stations[0]);
    }
  }, [stations]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStations();
    setRefreshing(false);
  };

  const handleMarkerPress = (station: MapStation) => {
    console.log("Marker pressed:", station.name);
    setSelectedStation(station);
    setShowStationModal(true);
  };

  const handleLocationPress = () => {
    // Center map on user's location
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: 40.7831,
        longitude: -73.9712,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const onRegionChangeComplete = (newRegion: Region) => {
    setRegion(newRegion);

    // Determine zoom level based on delta
    let newZoomLevel = "city";
    if (newRegion.latitudeDelta < 0.01) {
      newZoomLevel = "neighborhood";
    } else if (newRegion.latitudeDelta > 0.1) {
      newZoomLevel = "borough";
    }

    if (newZoomLevel !== zoomLevel) {
      setZoomLevel(newZoomLevel);
      console.log("Zoom level changed to:", newZoomLevel);
    }
  };

  const getMarkerSize = (station: MapStation, zoomLevel: string) => {
    const isHub = station.routes && station.routes.length >= 3;

    if (zoomLevel === "neighborhood") {
      return isHub ? 12 : 8;
    } else if (zoomLevel === "city") {
      return isHub ? 10 : 6;
    } else {
      return isHub ? 8 : 4;
    }
  };

  const getMarkerColor = (station: MapStation) => {
    if (!station.routes || station.routes.length === 0) {
      return "#999999"; // Gray for stations with no route info
    }

    // Use the color of the first route, or default to blue
    return station.routes[0]?.route_color || "#0066CC";
  };

  const StationModal = () => (
    <Modal
      visible={showStationModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowStationModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedStation?.name}</Text>
            <TouchableOpacity
              onPress={() => setShowStationModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {selectedStation?.routes && selectedStation.routes.length > 0 ? (
              <View>
                <Text style={styles.sectionTitle}>Routes</Text>
                <View style={styles.routesContainer}>
                  {selectedStation.routes.map((route, index) => (
                    <View
                      key={route.id}
                      style={[
                        styles.routeBadge,
                        { backgroundColor: `#${route.route_color}` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.routeText,
                          { color: `#${route.text_color}` },
                        ]}
                      >
                        {route.short_name}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text style={styles.noDataText}>
                No route information available
              </Text>
            )}

            <View style={styles.stationInfo}>
              <Text style={styles.infoText}>
                Station ID: {selectedStation?.id}
              </Text>
              <Text style={styles.infoText}>
                Coordinates: {selectedStation?.latitude.toFixed(4)},{" "}
                {selectedStation?.longitude.toFixed(4)}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {stations.map((station) => (
          <Marker
            key={station.id}
            coordinate={{
              latitude: station.latitude,
              longitude: station.longitude,
            }}
            onPress={() => handleMarkerPress(station)}
          >
            <View
              style={[
                styles.marker,
                {
                  width: getMarkerSize(station, zoomLevel),
                  height: getMarkerSize(station, zoomLevel),
                  backgroundColor: getMarkerColor(station),
                },
              ]}
            />
          </Marker>
        ))}
      </MapView>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleLocationPress}
        >
          <Ionicons name="locate" size={24} color="#0066CC" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <Ionicons
            name="refresh"
            size={24}
            color="#0066CC"
            style={refreshing ? styles.spinning : undefined}
          />
        </TouchableOpacity>
      </View>

      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Loading stations...</Text>
        </View>
      )}

      {/* API Error indicator */}
      {apiError && (
        <View style={styles.errorOverlay}>
          <Ionicons name="warning" size={24} color="#FF6B6B" />
          <Text style={styles.errorText}>API Error: {apiError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadStations()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Station count indicator */}
      <View style={styles.stationCount}>
        <Text style={styles.stationCountText}>{stations.length} stations</Text>
      </View>

      <StationModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  marker: {
    borderRadius: 50,
    borderWidth: 2,
    borderColor: "white",
  },
  controls: {
    position: "absolute",
    top: 50,
    right: 20,
    gap: 10,
  },
  controlButton: {
    backgroundColor: "white",
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 20,
    alignItems: "center",
  },
  loadingText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  errorOverlay: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: "#0066CC",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  stationCount: {
    position: "absolute",
    bottom: 30,
    left: 20,
    backgroundColor: "white",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  stationCountText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.7,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  modalBody: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
    color: "#333",
  },
  routesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  routeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    minWidth: 30,
    alignItems: "center",
  },
  routeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  stationInfo: {
    marginTop: 10,
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 5,
  },
  noDataText: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
    marginVertical: 20,
  },
  spinning: {
    transform: [{ rotate: "360deg" }],
  },
});

export default MapScreen;
