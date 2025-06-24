import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps"; //for the map

const MapScreen = () => {
  const [region, setRegion] = useState({
    //stores maps's visible area, intialize
    latitude: 40.7589,
    longitude: -73.9851,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const [markers, setMarkers] = useState([
    //stores a list of transit locations, DEFAULT
    {
      id: 1,
      coordinate: { latitude: 40.7589, longitude: -73.9851 },
      title: "Times Square - 42nd St",
      subtitle: "Subway Station",
      type: "subway",
    },
    {
      id: 2,
      coordinate: { latitude: 40.7505, longitude: -73.9934 },
      title: "Herald Square",
      subtitle: "Bus Stop",
      type: "bus",
    },
    {
      id: 3,
      coordinate: { latitude: 40.7614, longitude: -73.9776 },
      title: "Grand Central",
      subtitle: "Major Hub",
      type: "hub",
    },
  ]);

  const handleMarkerPress = (marker: any) => {
    Alert.alert(
      //called when user taps a marker
      marker.title,
      `${marker.subtitle}\n\nNext arrivals:\n• 4 min\n• 8 min\n• 12 min`, //displays dummy values BACKEND TODO: make it not bs
      [
        { text: "Cancel", style: "cancel" },
        { text: "Get Directions", onPress: () => {} },
      ]
    );
  };

  //gets user's current location
  const handleLocationPress = () => {
    // BACKEND TODO: get user's current location
    Alert.alert("Location", "Getting your location...");
  };

  //refresh
  const handleRefresh = () => {
    //BACKEDN TODO: refresh
    Alert.alert("Refresh", "Updating live transit data...");
  };

  //returns the right emoji for watevr the marker is
  const getMarkerIcon = (type: string) => {
    switch (type) {
      case "subway":
        return "🚇";
      case "bus":
        return "🚌";
      case "hub":
        return "🚉";
      default:
        return "📍";
    }
  };

  return (
    <View style={styles.container}>
      {/* MapView - main map area */}
      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        // showsTraffic={true}
      >
        {/* Render all transit markers with custom icons */}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={marker.coordinate}
            title={marker.title}
            description={marker.subtitle}
            onPress={() => handleMarkerPress(marker)}
          >
            <View style={styles.markerContainer}>
              <Text style={styles.markerIcon}>
                {getMarkerIcon(marker.type)}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Floating Action Buttons - modern, with shadow and color */}
      <TouchableOpacity
        style={[styles.fab, styles.locationFab]}
        onPress={handleLocationPress}
        activeOpacity={0.85}
      >
        <Ionicons name="locate" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.fab, styles.refreshFab]}
        onPress={handleRefresh}
        activeOpacity={0.85}
      >
        <Ionicons name="refresh" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Legend - modern card with shadow and color */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Live Transit</Text>
        <View style={styles.legendItem}>
          <Text style={styles.legendIcon}>🚇</Text>
          <Text style={styles.legendText}>Subway</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.legendIcon}>🚌</Text>
          <Text style={styles.legendText}>Bus</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.legendIcon}>🚉</Text>
          <Text style={styles.legendText}>Hub</Text>
        </View>
      </View>
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
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2193b0",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#2193b0",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  markerIcon: {
    fontSize: 22,
    color: "#fff",
  },
  fab: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2193b0",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2193b0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
  locationFab: {
    bottom: 120,
    right: 20,
  },
  refreshFab: {
    bottom: 190,
    right: 20,
  },
  legend: {
    position: "absolute",
    top: 24,
    left: 20,
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 16,
    shadowColor: "#2193b0",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2193b0",
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  legendIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  legendText: {
    fontSize: 15,
    color: "#333",
  },
});

export default MapScreen;
