import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";

const { width, height } = Dimensions.get("window");

const MapScreen = () => {
  const [region, setRegion] = useState({
    latitude: 40.7831,
    longitude: -73.9712,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const [zoomLevel, setZoomLevel] = useState("neighborhood"); // neighborhood, city, borough
  const [selectedFilters, setSelectedFilters] = useState({
    subway: true,
    bus: true,
    ferry: false,
    bikeshare: false,
  });

  // Comprehensive NYC transit data
  const [transitData, setTransitData] = useState({
    subway: [
      {
        id: "times-sq",
        coordinate: { latitude: 40.7589, longitude: -73.9851 },
        title: "Times Square - 42nd St",
        subtitle: "N Q R W S 1 2 3 7",
        type: "subway",
        lines: ["N", "Q", "R", "W", "S", "1", "2", "3", "7"],
        nextArrivals: ["2 min", "5 min", "8 min"],
        status: "Good Service",
      },
      {
        id: "grand-central",
        coordinate: { latitude: 40.7527, longitude: -73.9772 },
        title: "Grand Central - 42nd St",
        subtitle: "4 5 6 7 S",
        type: "subway",
        lines: ["4", "5", "6", "7", "S"],
        nextArrivals: ["1 min", "4 min", "9 min"],
        status: "Good Service",
      },
      {
        id: "union-sq",
        coordinate: { latitude: 40.7359, longitude: -73.9911 },
        title: "14th St - Union Sq",
        subtitle: "L N Q R W 4 5 6",
        type: "subway",
        lines: ["L", "N", "Q", "R", "W", "4", "5", "6"],
        nextArrivals: ["3 min", "7 min", "12 min"],
        status: "Good Service",
      },
      {
        id: "brooklyn-bridge",
        coordinate: { latitude: 40.7081, longitude: -73.9956 },
        title: "Brooklyn Bridge - City Hall",
        subtitle: "4 5 6",
        type: "subway",
        lines: ["4", "5", "6"],
        nextArrivals: ["5 min", "10 min", "15 min"],
        status: "Good Service",
      },
      {
        id: "canal-st",
        coordinate: { latitude: 40.7191, longitude: -74.0018 },
        title: "Canal St",
        subtitle: "N Q R W 6",
        type: "subway",
        lines: ["N", "Q", "R", "W", "6"],
        nextArrivals: ["2 min", "6 min", "11 min"],
        status: "Good Service",
      },
      {
        id: "wall-st",
        coordinate: { latitude: 40.7074, longitude: -74.0113 },
        title: "Wall St",
        subtitle: "4 5",
        type: "subway",
        lines: ["4", "5"],
        nextArrivals: ["4 min", "9 min", "14 min"],
        status: "Good Service",
      },
      {
        id: "fulton-st",
        coordinate: { latitude: 40.7097, longitude: -74.0053 },
        title: "Fulton St",
        subtitle: "2 3 4 5 A C J Z",
        type: "subway",
        lines: ["2", "3", "4", "5", "A", "C", "J", "Z"],
        nextArrivals: ["1 min", "3 min", "8 min"],
        status: "Good Service",
      },
      {
        id: "herald-sq",
        coordinate: { latitude: 40.7505, longitude: -73.9884 },
        title: "Herald Sq - 34th St",
        subtitle: "B D F M N Q R W",
        type: "subway",
        lines: ["B", "D", "F", "M", "N", "Q", "R", "W"],
        nextArrivals: ["2 min", "6 min", "10 min"],
        status: "Good Service",
      },
    ],
    bus: [
      {
        id: "bus-42nd-8th",
        coordinate: { latitude: 40.757, longitude: -73.9877 },
        title: "42nd St & 8th Ave",
        subtitle: "M42 Bus Stop",
        type: "bus",
        routes: ["M42"],
        nextArrivals: ["3 min", "8 min", "15 min"],
        status: "On Time",
      },
      {
        id: "bus-34th-7th",
        coordinate: { latitude: 40.7505, longitude: -73.9934 },
        title: "34th St & 7th Ave",
        subtitle: "M4 M16 M34 Bus Stop",
        type: "bus",
        routes: ["M4", "M16", "M34"],
        nextArrivals: ["5 min", "12 min", "18 min"],
        status: "Delayed",
      },
      {
        id: "bus-14th-union",
        coordinate: { latitude: 40.7368, longitude: -73.9918 },
        title: "14th St & Broadway",
        subtitle: "M14 Bus Stop",
        type: "bus",
        routes: ["M14"],
        nextArrivals: ["2 min", "9 min", "16 min"],
        status: "On Time",
      },
      {
        id: "bus-canal-broadway",
        coordinate: { latitude: 40.7185, longitude: -74.0003 },
        title: "Canal St & Broadway",
        subtitle: "M103 Bus Stop",
        type: "bus",
        routes: ["M103"],
        nextArrivals: ["6 min", "14 min", "22 min"],
        status: "On Time",
      },
    ],
    ferry: [
      {
        id: "battery-park",
        coordinate: { latitude: 40.7033, longitude: -74.017 },
        title: "Battery Park Ferry Terminal",
        subtitle: "Staten Island Ferry",
        type: "ferry",
        routes: ["Staten Island Ferry"],
        nextArrivals: ["15 min", "45 min"],
        status: "On Time",
      },
    ],
    bikeshare: [
      {
        id: "citi-times-sq",
        coordinate: { latitude: 40.759, longitude: -73.9847 },
        title: "Times Square Citi Bike",
        subtitle: "15 bikes available",
        type: "bikeshare",
        available: 15,
        capacity: 40,
      },
      {
        id: "citi-union-sq",
        coordinate: { latitude: 40.7347, longitude: -73.9897 },
        title: "Union Square Citi Bike",
        subtitle: "8 bikes available",
        type: "bikeshare",
        available: 8,
        capacity: 30,
      },
    ],
  });

  const handleMarkerPress = (marker: any) => {
    let alertMessage = "";

    if (marker.type === "subway") {
      alertMessage = `Lines: ${marker.lines.join(
        ", "
      )}\n\nNext arrivals:\n${marker.nextArrivals
        .map((time: string) => `• ${time}`)
        .join("\n")}\n\nStatus: ${marker.status}`;
    } else if (marker.type === "bus") {
      alertMessage = `Routes: ${marker.routes.join(
        ", "
      )}\n\nNext arrivals:\n${marker.nextArrivals
        .map((time: string) => `• ${time}`)
        .join("\n")}\n\nStatus: ${marker.status}`;
    } else if (marker.type === "ferry") {
      alertMessage = `Routes: ${marker.routes.join(
        ", "
      )}\n\nNext departures:\n${marker.nextArrivals
        .map((time: string) => `• ${time}`)
        .join("\n")}\n\nStatus: ${marker.status}`;
    } else if (marker.type === "bikeshare") {
      alertMessage = `Available bikes: ${marker.available}\nTotal capacity: ${
        marker.capacity
      }\nDocks available: ${marker.capacity - marker.available}`;
    }

    Alert.alert(marker.title, alertMessage, [
      { text: "Cancel", style: "cancel" },
      { text: "Get Directions", onPress: () => {} },
    ]);
  };

  const handleLocationPress = () => {
    // Center on NYC
    setRegion({
      latitude: 40.7831,
      longitude: -73.9712,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  const handleRefresh = () => {
    Alert.alert("Refresh", "Updating live transit data...");
  };

  const toggleFilter = (filterType: keyof typeof selectedFilters) => {
    setSelectedFilters((prev) => ({
      ...prev,
      [filterType]: !prev[filterType],
    }));
  };

  const getVisibleMarkers = () => {
    let markers: any[] = [];

    if (selectedFilters.subway) {
      markers = [...markers, ...transitData.subway];
    }
    if (selectedFilters.bus) {
      markers = [...markers, ...transitData.bus];
    }
    if (selectedFilters.ferry) {
      markers = [...markers, ...transitData.ferry];
    }
    if (selectedFilters.bikeshare) {
      markers = [...markers, ...transitData.bikeshare];
    }

    return markers;
  };

  const getMarkerColor = (type: string, status?: string) => {
    switch (type) {
      case "subway":
        return status === "Good Service" ? "#0066CC" : "#FF6600";
      case "bus":
        return status === "On Time" ? "#00AA00" : "#FF6600";
      case "ferry":
        return "#0099CC";
      case "bikeshare":
        return "#FF6B35";
      default:
        return "#666";
    }
  };

  const getMarkerIcon = (type: string) => {
    switch (type) {
      case "subway":
        return "train";
      case "bus":
        return "bus";
      case "ferry":
        return "boat";
      case "bikeshare":
        return "bicycle";
      default:
        return "location";
    }
  };

  const onRegionChangeComplete = (newRegion: any) => {
    setRegion(newRegion);

    // Determine zoom level based on latitudeDelta
    if (newRegion.latitudeDelta > 0.05) {
      setZoomLevel("borough");
    } else if (newRegion.latitudeDelta > 0.02) {
      setZoomLevel("city");
    } else {
      setZoomLevel("neighborhood");
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsTraffic={false}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
        mapType="standard"
        minZoomLevel={10}
        maxZoomLevel={18}
      >
        {getVisibleMarkers().map((marker) => (
          <Marker
            key={marker.id}
            coordinate={marker.coordinate}
            title={marker.title}
            description={marker.subtitle}
            onPress={() => handleMarkerPress(marker)}
          >
            <View
              style={[
                styles.markerContainer,
                { backgroundColor: getMarkerColor(marker.type, marker.status) },
              ]}
            >
              <Ionicons
                name={getMarkerIcon(marker.type)}
                size={20}
                color="#FFFFFF"
              />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            selectedFilters.subway && styles.filterButtonActive,
          ]}
          onPress={() => toggleFilter("subway")}
        >
          <Ionicons
            name="train"
            size={20}
            color={selectedFilters.subway ? "#FFFFFF" : "#0066CC"}
          />
          <Text
            style={[
              styles.filterText,
              selectedFilters.subway && styles.filterTextActive,
            ]}
          >
            Subway
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            selectedFilters.bus && styles.filterButtonActive,
          ]}
          onPress={() => toggleFilter("bus")}
        >
          <Ionicons
            name="bus"
            size={20}
            color={selectedFilters.bus ? "#FFFFFF" : "#00AA00"}
          />
          <Text
            style={[
              styles.filterText,
              selectedFilters.bus && styles.filterTextActive,
            ]}
          >
            Bus
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            selectedFilters.ferry && styles.filterButtonActive,
          ]}
          onPress={() => toggleFilter("ferry")}
        >
          <Ionicons
            name="boat"
            size={20}
            color={selectedFilters.ferry ? "#FFFFFF" : "#0099CC"}
          />
          <Text
            style={[
              styles.filterText,
              selectedFilters.ferry && styles.filterTextActive,
            ]}
          >
            Ferry
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            selectedFilters.bikeshare && styles.filterButtonActive,
          ]}
          onPress={() => toggleFilter("bikeshare")}
        >
          <Ionicons
            name="bicycle"
            size={20}
            color={selectedFilters.bikeshare ? "#FFFFFF" : "#FF6B35"}
          />
          <Text
            style={[
              styles.filterText,
              selectedFilters.bikeshare && styles.filterTextActive,
            ]}
          >
            Bikes
          </Text>
        </TouchableOpacity>
      </View>

      {/* Floating Action Buttons */}
      <TouchableOpacity
        style={[styles.fab, styles.locationFab]}
        onPress={handleLocationPress}
      >
        <Ionicons name="locate" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.fab, styles.refreshFab]}
        onPress={handleRefresh}
      >
        <Ionicons name="refresh" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Zoom Level Indicator */}
      <View style={styles.zoomIndicator}>
        <Text style={styles.zoomText}>
          {zoomLevel === "neighborhood"
            ? "🔍 Detailed View"
            : zoomLevel === "city"
            ? "🏙️ City View"
            : "🗺️ Borough View"}
        </Text>
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
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  filterContainer: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  filterButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 70,
    justifyContent: "center",
  },
  filterButtonActive: {
    backgroundColor: "#0066CC",
  },
  filterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    marginLeft: 4,
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  fab: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0066CC",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  locationFab: {
    bottom: 120,
    right: 20,
  },
  refreshFab: {
    bottom: 190,
    right: 20,
  },
  zoomIndicator: {
    position: "absolute",
    bottom: 20,
    left: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  zoomText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
});

export default MapScreen;
