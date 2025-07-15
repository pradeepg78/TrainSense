import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
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

  const mapRef = useRef<MapView>(null);

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

      // Normalize the direction vector
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length === 0) return point; // No direction, return original point

      // Calculate perpendicular vector (rotate 90 degrees)
      const perpX = -dy / length;
      const perpY = dx / length;

      // Apply offset perpendicular to the line direction
      return {
        latitude: point.latitude + perpY * actualOffset,
        longitude: point.longitude + perpX * actualOffset,
      };
    });
  }

  function offsetCoords(
    coords: { latitude: number; longitude: number }[],
    offsetIndex: number
  ) {
    // Offset latitude and longitude slightly for each route
    // This is a simple diagonal offset; for more realism, you could offset perpendicular to the segment direction
    return coords.map((coord) => ({
      latitude: coord.latitude + offsetIndex * OFFSET,
      longitude: coord.longitude + offsetIndex * OFFSET,
    }));
  }

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

  useEffect(() => {
    async function fetchRouteShapes() {
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
    }
    if (stations.length > 0) fetchRouteShapes();
  }, [stations]);

  useEffect(() => {
    async function fetchRoutes() {
      const response = await apiService.getRoutes();
      if (response.success && response.data) {
        setRoutes(response.data);
      }
    }
    fetchRoutes();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStations();
    setRefreshing(false);
  };

  const handleMarkerPress = (stationOrGroup: MapStation | MapStation[]) => {
    let stopData: Stop;
    if (Array.isArray(stationOrGroup)) {
      // Transfer hub: aggregate all unique routes from all stations in the group
      const allRoutes = Array.from(
        new Set(
          stationOrGroup.flatMap((s) => (s.routes || []).map((r) => r.id))
        )
      );
      // Find route objects for allRoutes from the stations
      const routeObjs = allRoutes.map((routeId) => {
        // Find the first matching route object from any station
        for (const s of stationOrGroup) {
          const found = (s.routes || []).find((r) => r.id === routeId);
          if (found) return found;
        }
        return {
          id: routeId,
          short_name: routeId,
          long_name: routeId,
          route_color: "000000",
          text_color: "FFFFFF",
        };
      });
      // Always use the first real station's id, not the synthetic hub_id
      const stopId = stationOrGroup[0].id;
      stopData = {
        id: stopId,
        name: stationOrGroup[0].name,
        latitude:
          stationOrGroup.reduce((sum, s) => sum + s.latitude, 0) /
          stationOrGroup.length,
        longitude:
          stationOrGroup.reduce((sum, s) => sum + s.longitude, 0) /
          stationOrGroup.length,
        routes: routeObjs,
      };
    } else {
      stopData = {
        id: stationOrGroup.id,
        name: stationOrGroup.name,
        latitude: stationOrGroup.latitude,
        longitude: stationOrGroup.longitude,
        routes: stationOrGroup.routes || [],
      };
    }
    setSelectedStation(stopData);
    setShowStationModal(true);
  };

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
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const onRegionChangeComplete = (newRegion: Region) => {
    setRegion(newRegion);

    // Determine zoom level based on delta
    let newZoomLevel = "city";
    if (newRegion.latitudeDelta < 0.03) {
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

  const getRouteColor = (routeId: string) => {
    // Try to get color from loaded routes
    const found = routes.find((r) => r.id === routeId);
    if (found) return `#${found.route_color}`;
    // Fallback to hardcoded map
    const routeColors: { [key: string]: string } = {
      A: "#0039A6",
      C: "#0039A6",
      E: "#0039A6",
      B: "#FF6319",
      D: "#FF6319",
      F: "#FF6319",
      M: "#FF6319",
      G: "#6CBE45",
      J: "#996633",
      Z: "#996633",
      L: "#A7A9AC",
      N: "#FCCC0A",
      Q: "#FCCC0A",
      R: "#FCCC0A",
      W: "#FCCC0A",
      "1": "#EE352E",
      "2": "#EE352E",
      "3": "#EE352E",
      "4": "#00933C",
      "5": "#00933C",
      "6": "#00933C",
      "7": "#B933AD",
      SI: "#0039A6",
    };
    return routeColors[routeId] || "#2193b0";
  };

  // Utility: Identify transfer stations (served by more than one route)
  function getTransferStationIds(stations: MapStation[]): Set<string> {
    return new Set(
      stations
        .filter((station) => (station.routes?.length || 0) > 1)
        .map((station) => station.id)
    );
  }

  // Utility: Offset a segment between two points, but keep endpoints at the station coordinates
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
    const OFFSET = 0.00008; // Adjust as needed
    // Calculate direction vector
    const dx = end.longitude - start.longitude;
    const dy = end.latitude - start.latitude;
    const length = Math.sqrt(dx * dx + dy * dy);
    // Perpendicular vector (normalized)
    const px = -dy / length;
    const py = dx / length;
    // Offset both points perpendicular to the segment
    return [
      {
        latitude: start.latitude + px * offsetIndex * OFFSET,
        longitude: start.longitude + py * offsetIndex * OFFSET,
      },
      {
        latitude: end.latitude + px * offsetIndex * OFFSET,
        longitude: end.longitude + py * offsetIndex * OFFSET,
      },
    ];
  }

  const [trunkSegments, setTrunkSegments] = useState<
    {
      color: string;
      route: string;
      polyline: { latitude: number; longitude: number }[];
    }[]
  >([]);

  // Fetch trunk segments for merged lines
  useEffect(() => {
    async function fetchTrunkSegments() {
      try {
        console.log("Fetching trunk segments...");
        const response = await fetch("http://127.0.0.1:5001/api/trunk-shapes");
        const data = await response.json();
        if (data.success && data.data) {
          console.log("Loaded trunk segments:", data.data.length);
          setTrunkSegments(data.data);
        } else {
          console.error("Failed to load trunk segments:", data.error);
        }
      } catch (e) {
        console.error("Error fetching trunk shapes", e);
      }
    }
    fetchTrunkSegments();
  }, []);

  // Dynamic offset based on zoom level
  const getDynamicOffset = () => {
    if (zoomLevel === "borough") return 0.0004; // very zoomed out
    if (zoomLevel === "city") return 0.0002; // medium
    return 0.0001; // zoomed in
  };

  // Helper: is major transfer station (4+ routes)
  function isMajorTransfer(station: MapStation) {
    return (station.routes?.length || 0) >= 4;
  }

  // Helper: Only show dots if zoomed in close enough
  function shouldShowStationDots() {
    return zoomLevel === "neighborhood" || zoomLevel === "city";
  }

  // Helper: Offset dot perpendicular to the line (if possible)
  function getDotOffset(station: MapStation) {
    // For now, just a small fixed offset (could be improved with line direction)
    return { top: 2, left: 2 };
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation={true}
        showsMyLocationButton={false}
        mapType="mutedStandard"
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
        {/* Draw station markers */}
        {zoomLevel === "neighborhood" &&
          (() => {
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
                    <View style={[styles.stationDot, getDotOffset(group[0])]} />
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
                        { width: w, height: h, borderRadius: h },
                      ]}
                    />
                  </Marker>
                );
              }
            });
          })()}
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
  spinning: {
    transform: [{ rotate: "360deg" }],
  },
  stationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#222",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  majorOval: {
    width: 24,
    height: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#6dd5ed", // accent color for major hub
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default MapScreen;
