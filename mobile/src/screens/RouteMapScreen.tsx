import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import {
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import MapView, { Marker, Polyline, Region } from "react-native-maps";
import RouteSymbol from "../components/RouteSymbol";
import { apiService, Route, Stop } from "../services/api";
import { getMtaColor } from "../utils/mtaColors";

const RouteMapScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { routeId } = route.params;

  const [routeShape, setRouteShape] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [routeInfo, setRouteInfo] = useState<Route | null>(null);
  const [region, setRegion] = useState<Region>({
    latitude: 40.7831,
    longitude: -73.9712,
    latitudeDelta: 0.15,
    longitudeDelta: 0.15,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      
      try {
        const [shapeRes, stopsRes, routesRes] = await Promise.all([
          apiService.getRouteShape(routeId),
          apiService.getRouteStations(routeId),
          apiService.getRoutes(),
        ]);
        
        if (shapeRes.success && shapeRes.data) setRouteShape(shapeRes.data);
        if (stopsRes.success && stopsRes.data) setStops(stopsRes.data);
        if (routesRes.success && routesRes.data) {
          const info = routesRes.data.find((r: Route) => r.id === routeId);
          if (info) setRouteInfo(info);
        }
        
        // Center map on first stop if available
        if (stopsRes.success && stopsRes.data && stopsRes.data.length > 0) {
          setRegion({
            latitude: stopsRes.data[0].latitude,
            longitude: stopsRes.data[0].longitude,
            latitudeDelta: 0.15,
            longitudeDelta: 0.15,
          });
        }
      } catch (err) {
        setError("Failed to load route data");
        console.error("Error fetching route data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [routeId]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
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
        {routeShape.length > 0 && routeInfo && (
          <Polyline
            coordinates={routeShape}
            strokeColor={getMtaColor(routeInfo.short_name).background}
            strokeWidth={10}
            zIndex={10}
            lineCap="round"
            lineJoin="round"
          />
        )}
        {stops.map((stop) => (
          <Marker
            key={stop.id}
            coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
            title={stop.name}
          >
            <View style={styles.stopMarker}>
              <RouteSymbol routeId={routeInfo?.short_name || routeId} size={20} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Modern Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <View style={styles.backButtonContent}>
          <Text style={styles.backButtonIcon}>←</Text>
          <Text style={styles.backButtonText}>Back</Text>
        </View>
      </TouchableOpacity>

      {/* Modern Route Header */}
      {routeInfo && (
        <View style={styles.routeHeader}>
          <View style={styles.routeSymbolContainer}>
            <RouteSymbol routeId={routeInfo.short_name} size={32} />
          </View>
          <View style={styles.routeInfo}>
            <Text style={styles.routeTitle}>{routeInfo.long_name}</Text>
            <Text style={styles.routeSubtitle}>{stops.length} stations</Text>
          </View>
        </View>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <Text style={styles.loadingText}>Loading route...</Text>
          </View>
        </View>
      )}

      {/* Error Overlay */}
      {error && (
        <View style={styles.errorOverlay}>
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.retryButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  stopMarker: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    position: "absolute",
    top: Platform.OS === 'ios' ? 60 : 50,
    left: 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  backButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backButtonIcon: {
    fontSize: 18,
    color: "#2193b0",
    fontWeight: "bold",
  },
  backButtonText: {
    fontSize: 16,
    color: "#2193b0",
    fontWeight: "600",
  },
  routeHeader: {
    position: "absolute",
    top: Platform.OS === 'ios' ? 60 : 50,
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    zIndex: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  routeSymbolContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 16,
    padding: 4,
  },
  routeInfo: {
    flex: 1,
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#222",
    marginBottom: 2,
  },
  routeSubtitle: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
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
    zIndex: 30,
  },
  loadingCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  loadingText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
  },
  errorOverlay: {
    position: "absolute",
    top: Platform.OS === 'ios' ? 120 : 100,
    left: 20,
    right: 20,
    zIndex: 30,
  },
  errorCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
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
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#2193b0",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  retryButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default RouteMapScreen;
