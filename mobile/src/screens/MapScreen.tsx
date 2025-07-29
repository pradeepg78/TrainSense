import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, Region } from "react-native-maps";
import { StationModal } from "../components/StationModal";
import { apiService, MapStation, Route, Stop } from "../services/api";
import { getMtaColor } from "../utils/mtaColors";

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
  const [selectedStation, setSelectedStation] = useState<Stop | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showStationModal, setShowStationModal] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [crowdPredictions, setCrowdPredictions] = useState<{[stationId: string]: any}>({});

  const mapRef = useRef<MapView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [routeStationLines, setRouteStationLines] = useState<{
    [routeId: string]: { latitude: number; longitude: number }[];
  }>({});

  const [routes, setRoutes] = useState<Route[]>([]);

  const OFFSET = 0.00008; // Adjust as needed for visual separation

  // Hardcoded shared shape groups for major trunk lines (expand as needed)
  const SHARED_SHAPE_GROUPS: { [shape: string]: string[] } = {
    queens_blvd: ["E", "F", "M", "R"],
    sixth_ave: ["B", "D", "F", "M"],
    eighth_ave: ["A", "C", "E"],
    broadway: ["N", "Q", "R", "W"],
    lexington: ["4", "5", "6"],
    seventh_ave: ["1", "2", "3"],
  };

  // Map routeId to group key (no duplicate keys)
  const ROUTE_TO_GROUP: { [route: string]: string } = {
    E: "queens_blvd",
    F: "queens_blvd",
    M: "queens_blvd",
    R: "queens_blvd",
    B: "sixth_ave",
    D: "sixth_ave",
    A: "eighth_ave",
    C: "eighth_ave",
    N: "broadway",
    Q: "broadway",
    W: "broadway",
    "4": "lexington",
    "5": "lexington",
    "6": "lexington",
    "1": "seventh_ave",
    "2": "seventh_ave",
    "3": "seventh_ave",
  };

  // Offset a polyline perpendicular to its path
  function offsetPolyline(
    coords: { latitude: number; longitude: number }[],
    offsetIndex: number,
    total: number,
    offsetAmount = 0.00008
  ) {
    if (total <= 1) return coords; // No offset needed for single line

    const center = (total - 1) / 2;
    const actualOffset = (offsetIndex - center) * offsetAmount;

    return coords.map((point, i) => {
      // Calculate direction vector between adjacent points
      let dx = 0,
        dy = 0;

      if (i === 0 && coords.length > 1) {
        // First point: use direction to next point
        dx = coords[i + 1].longitude - point.longitude;
        dy = coords[i + 1].latitude - point.latitude;
      } else if (i === coords.length - 1 && coords.length > 1) {
        // Last point: use direction from previous point
        dx = point.longitude - coords[i - 1].longitude;
        dy = point.latitude - coords[i - 1].latitude;
      } else if (coords.length > 1) {
        // Middle point: use average direction
        dx = (coords[i + 1].longitude - coords[i - 1].longitude) / 2;
        dy = (coords[i + 1].latitude - coords[i - 1].latitude) / 2;
      }

      // Normalize and apply perpendicular offset
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length > 0) {
        const normalizedDx = dx / length;
        const normalizedDy = dy / length;
        // Perpendicular vector (rotate 90 degrees)
        const perpDx = -normalizedDy;
        const perpDy = normalizedDx;

        return {
          latitude: point.latitude + perpDy * actualOffset,
          longitude: point.longitude + perpDx * actualOffset,
        };
      }

      return point;
    });
  }

  // Helper: Offset coordinates for visual separation
  function offsetCoords(
    coords: { latitude: number; longitude: number }[],
    offsetIndex: number
  ) {
    return coords.map((coord) => ({
      latitude: coord.latitude + offsetIndex * OFFSET,
      longitude: coord.longitude + offsetIndex * OFFSET,
    }));
  }

  const loadStations = async (newRegion?: Region, newZoomLevel?: string) => {
    if (isLoading) return;

    setIsLoading(true);
    setApiError(null);

    try {
      // Load stations for current map view
      const response = await apiService.getMapStations();
      if (response.success && response.data) {
        setStations(response.data);
        
        // Fetch crowd predictions for stations
        const predictions: {[stationId: string]: any} = {};
        for (const station of response.data) {
          try {
            const crowdResponse = await apiService.getCrowdPrediction(station.id);
            if (crowdResponse.success && crowdResponse.data) {
              predictions[station.id] = crowdResponse.data;
            }
          } catch (error) {
            console.error(`Error fetching crowd prediction for ${station.id}:`, error);
          }
        }
        setCrowdPredictions(predictions);
      } else {
        setApiError("Failed to load stations");
      }

      // Load route shapes
      async function fetchRouteShapes() {
        try {
          const uniqueRoutes = new Set(
            stations.flatMap((station) => (station.routes || []).map((r) => r.id))
          );
          const lines: any = {};
          for (const routeId of uniqueRoutes) {
            const res = await apiService.getRouteShape(routeId);
            if (res.success && res.data) {
              lines[routeId] = res.data;
            }
          }
          setRouteStationLines(lines);
        } catch (error) {
          console.error("Error fetching route shapes:", error);
        }
      }

      // Load routes
      async function fetchRoutes() {
        try {
          const routesResponse = await apiService.getRoutes();
          if (routesResponse.success && routesResponse.data) {
            setRoutes(routesResponse.data);
          }
        } catch (error) {
          console.error("Error fetching routes:", error);
        }
      }

      await Promise.all([fetchRouteShapes(), fetchRoutes()]);
    } catch (error) {
      console.error("Error loading stations:", error);
      setApiError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStations();
    setRefreshing(false);
  };

  const handleMarkerPress = (stationOrGroup: MapStation | MapStation[]) => {
    if (Array.isArray(stationOrGroup)) {
      // Handle group of stations (transfer hub)
      const firstStation = stationOrGroup[0];
      setSelectedStation({
        id: firstStation.id,
        name: firstStation.name,
        latitude: firstStation.latitude,
        longitude: firstStation.longitude,
        routes: stationOrGroup.flatMap((s) => s.routes || []),
      });
    } else {
      // Handle single station
      const routeObjs = allRoutes.map((routeId) => {
        const route = routes.find((r) => r.id === routeId);
        return route || { id: routeId, short_name: routeId, long_name: routeId };
      });

      setSelectedStation({
        id: stationOrGroup.id,
        name: stationOrGroup.name,
        latitude: stationOrGroup.latitude,
        longitude: stationOrGroup.longitude,
        routes: stationOrGroup.routes || [],
      });
    }
    setShowStationModal(true);
  };

  const allRoutes = Array.from(
    new Set(
      stations.flatMap((station) => (station.routes || []).map((r) => r.id))
    )
  );

  const handleCloseModal = () => {
    setShowStationModal(false);
    setSelectedStation(null);
  };

  const handleLocationPress = () => {
    // Center map on user's location
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: 40.7831,
        longitude: -73.9712,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  };

  const onRegionChangeComplete = (newRegion: Region) => {
    setRegion(newRegion);
    // Determine zoom level based on delta
    const avgDelta = (newRegion.latitudeDelta + newRegion.longitudeDelta) / 2;
    let newZoomLevel = "city";
    if (avgDelta < 0.01) newZoomLevel = "neighborhood";
    else if (avgDelta < 0.05) newZoomLevel = "city";
    else newZoomLevel = "borough";
    setZoomLevel(newZoomLevel);
  };

  const getMarkerSize = (station: MapStation, zoomLevel: string) => {
    switch (zoomLevel) {
      case "neighborhood":
        return 8;
      case "city":
        return 6;
      default:
        return 4;
    }
  };

  const getMarkerColor = (station: MapStation) => {
    // Use the first route's color for the marker
    if (station.routes && station.routes.length > 0) {
      return getMtaColor(station.routes[0].id).background;
    }
    return "#666";
  };

  const getRouteColor = (routeId: string) => {
    return getMtaColor(routeId).background;
  };

  const getCrowdLevelColor = (stationId: string) => {
    const prediction = crowdPredictions[stationId];
    if (!prediction) return "#2193b0"; // Default color
    
    switch (prediction.prediction.crowd_level) {
      case "low":
        return "#10B981"; // Green
      case "medium":
        return "#F59E0B"; // Yellow
      case "high":
        return "#EF4444"; // Red
      case "very_high":
        return "#DC2626"; // Dark red
      default:
        return "#2193b0";
    }
  };

  // State for trunk segments (shared subway lines)
  const [trunkSegments, setTrunkSegments] = useState<
    {
      route: string;
      polyline: { latitude: number; longitude: number }[];
    }[]
  >([]);

  function getTransferStationIds(stations: MapStation[]): Set<string> {
    const transferStations = new Set<string>();
    stations.forEach((station) => {
      if (station.routes && station.routes.length > 1) {
        transferStations.add(station.id);
      }
    });
    return transferStations;
  }

  function offsetSegment(
    start: { latitude: number; longitude: number },
    end: { latitude: number; longitude: number },
    offsetIndex: number,
    applyOffset: boolean
  ): [
    { latitude: number; longitude: number },
    { latitude: number; longitude: number }
  ] {
    if (!applyOffset) return [start, end];

    const dx = end.longitude - start.longitude;
    const dy = end.latitude - start.latitude;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return [start, end];

    // Normalize and apply perpendicular offset
    const normalizedDx = dx / length;
    const normalizedDy = dy / length;
    const perpDx = -normalizedDy;
    const perpDy = normalizedDx;

    const offsetAmount = offsetIndex * OFFSET;

    return [
      {
        latitude: start.latitude + perpDy * offsetAmount,
        longitude: start.longitude + perpDx * offsetAmount,
      },
      {
        latitude: end.latitude + perpDy * offsetAmount,
        longitude: end.longitude + perpDx * offsetAmount,
      },
    ];
  }

  useEffect(() => {
    console.log("MapScreen mounted, loading stations...");
    loadStations();

    async function fetchTrunkSegments() {
      try {
        // This would fetch actual trunk line data from your API
        // For now, we'll use a placeholder
        setTrunkSegments([]);
      } catch (error) {
        console.error("Error fetching trunk segments:", error);
      }
    }

    fetchTrunkSegments();
  }, []);

  const getDynamicOffset = () => {
    return OFFSET;
  };

  function isMajorTransfer(station: MapStation) {
    return station.routes && station.routes.length > 2;
  }

  function shouldShowStationDots() {
    return zoomLevel === "neighborhood";
  }

  // Helper: Offset dot perpendicular to the line (if possible)
  function getDotOffset(station: MapStation) {
    // For now, just a small fixed offset (could be improved with line direction)
    return { top: 2, left: 2 };
  }

  const toggleControls = () => {
    Animated.timing(fadeAnim, {
      toValue: showControls ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setShowControls(!showControls);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation={true}
        showsMyLocationButton={false}
        mapType="mutedStandard"
        customMapStyle={[
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "transit",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ]}
      >
        {/* Always render subway lines (polylines) at all zoom levels */}
        {(() => {
          console.log(
            "Rendering polylines:",
            trunkSegments.length,
            "trunk segments"
          );
          return trunkSegments.map((segment, index) => (
            <Polyline
              key={`trunk-${index}-${segment.route}`}
              coordinates={segment.polyline}
              strokeColor={getMtaColor(segment.route).background}
              strokeWidth={8}
              zIndex={10}
              lineCap="round"
            />
          ));
        })()}
        {/* Test polyline to ensure rendering works */}
        <Polyline
          key="test-polyline"
          coordinates={[
            { latitude: 40.7831, longitude: -73.9712 },
            { latitude: 40.7589, longitude: -73.9851 },
            { latitude: 40.7505, longitude: -73.9934 },
          ]}
          strokeColor="#FF0000"
          strokeWidth={10}
          zIndex={20}
          lineCap="round"
        />
        {/* Fallback: render routeStationLines if no trunk segments */}
        {trunkSegments.length === 0 &&
          Object.entries(routeStationLines).map(([routeId, coords]) => (
            <Polyline
              key={`fallback-route-${routeId}`}
              coordinates={coords}
              strokeColor={getMtaColor(routeId).background}
              strokeWidth={8}
              zIndex={10}
              lineCap="round"
            />
          ))}
        {/* Draw station markers at all zoom levels */}
        {(() => {
          // Group stations by hub_id
          const hubs: { [hubId: string]: MapStation[] } = {};
          stations.forEach((station) => {
            const hubId = station.hub_id || station.id;
            if (!hubs[hubId]) hubs[hubId] = [];
            hubs[hubId].push(station);
          });
          // For each hub, compute center and routes
          return Object.entries(hubs).map(([hubId, group]) => {
            const lat =
              group.reduce((sum, s) => sum + s.latitude, 0) / group.length;
            const lon =
              group.reduce((sum, s) => sum + s.longitude, 0) / group.length;
            if (group.length === 1) {
              // Regular station dot
              return (
                <Marker
                  key={hubId}
                  coordinate={{ latitude: lat, longitude: lon }}
                  onPress={() => handleMarkerPress(group[0])}
                >
                  <View style={[
                    styles.stationDot, 
                    getDotOffset(group[0]),
                    { borderColor: getCrowdLevelColor(group[0].id) }
                  ]} />
                </Marker>
              );
            } else {
              // Transfer hub ellipse (no route symbols inside)
              const w = Math.max(
                24,
                Math.min(24 + 4 * (group.length - 1), 40)
              );
              const h = Math.max(
                12,
                Math.min(12 + 2 * (group.length - 1), 20)
              );
              return (
                <Marker
                  key={hubId}
                  coordinate={{ latitude: lat, longitude: lon }}
                  onPress={() => handleMarkerPress(group)}
                >
                  <View
                    style={[
                      styles.majorOval,
                      { 
                        width: w, 
                        height: h, 
                        borderRadius: h,
                        borderColor: getCrowdLevelColor(group[0].id)
                      },
                    ]}
                  />
                </Marker>
              );
            }
          });
        })()}
      </MapView>

      {/* Modern Floating Controls */}
      <Animated.View style={[styles.controls, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleLocationPress}
        >
          <Ionicons name="locate" size={24} color="#2193b0" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlButton}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <Ionicons 
            name="refresh" 
            size={24} 
            color="#2193b0" 
            style={refreshing ? styles.spinning : undefined}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={toggleControls}
        >
          <Ionicons name="eye" size={24} color="#2193b0" />
        </TouchableOpacity>
      </Animated.View>

      {/* Modern Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusItem}>
          <Ionicons name="train" size={16} color="#2193b0" />
          <Text style={styles.statusText}>{stations.length} stations</Text>
        </View>
        <View style={styles.statusItem}>
          <Ionicons name="map" size={16} color="#2193b0" />
          <Text style={styles.statusText}>{routes.length} routes</Text>
        </View>
      </View>

      {/* Modern Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <Ionicons name="refresh" size={32} color="#2193b0" style={styles.spinning} />
            <Text style={styles.loadingText}>Loading stations...</Text>
          </View>
        </View>
      )}

      {/* Modern Error Overlay */}
      {apiError && (
        <View style={styles.errorOverlay}>
          <View style={styles.errorCard}>
            <Ionicons name="warning" size={32} color="#FF6B6B" />
            <Text style={styles.errorText}>{apiError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Station Modal */}
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
    backgroundColor: "#f8f9fa",
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
    top: Platform.OS === 'ios' ? 60 : 50,
    right: 20,
    gap: 12,
    zIndex: 10,
  },
  controlButton: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 28,
    width: 56,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  statusBar: {
    position: "absolute",
    bottom: Platform.OS === 'ios' ? 40 : 30,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-around",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  loadingCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  loadingText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  errorOverlay: {
    position: "absolute",
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 20,
    right: 20,
    zIndex: 20,
  },
  errorCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#2193b0",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  retryButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  spinning: {
    transform: [{ rotate: "360deg" }],
  },
  stationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
    borderWidth: 3,
    borderColor: "#2193b0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  majorOval: {
    width: 32,
    height: 20,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 3,
    borderColor: "#2193b0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
});

export default MapScreen;
