import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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

  useEffect(() => {
    async function fetchData() {
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
    }
    fetchData();
  }, [routeId]);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        mapType="mutedStandard"
      >
        {routeShape.length > 0 && routeInfo && (
          <Polyline
            coordinates={routeShape}
            strokeColor={getMtaColor(routeInfo.short_name).background}
            strokeWidth={8}
            zIndex={10}
            lineCap="round"
          />
        )}
        {stops.map((stop) => (
          <Marker
            key={stop.id}
            coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
            title={stop.name}
          >
            <RouteSymbol routeId={routeInfo?.short_name || routeId} size={24} />
          </Marker>
        ))}
      </MapView>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      {routeInfo && (
        <View style={styles.routeHeader}>
          <RouteSymbol routeId={routeInfo.short_name} size={32} />
          <Text style={styles.routeTitle}>{routeInfo.long_name}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    backgroundColor: "white",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 20,
  },
  backButtonText: {
    fontSize: 18,
    color: "#2193b0",
    fontWeight: "bold",
  },
  routeHeader: {
    position: "absolute",
    top: 50,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 20,
  },
  routeTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#222",
    marginLeft: 10,
  },
});

export default RouteMapScreen;
