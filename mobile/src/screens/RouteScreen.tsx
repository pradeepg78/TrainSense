import { Ionicons } from "@expo/vector-icons"; //icons
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const RouteScreen = () => {
  //savedRoutes is a predefined (for now some bs values) user routes
  const [savedRoutes, setSavedRoutes] = useState([
    {
      id: 1,
      name: "Home to Work",
      from: "Brooklyn Heights",
      to: "Midtown Manhattan",
      duration: "35 min",
      steps: [
        "Walk 5 min to High St-Brooklyn Bridge",
        "Take 4,5,6 to 14th St-Union Sq",
        "Transfer to N,Q,R,W",
        "Take N,Q,R,W to Times Sq-42nd St",
      ],
      nextDeparture: "8:15 AM",
      isFavorite: true,
    },
    {
      id: 2,
      name: "Weekend Trip",
      from: "Manhattan",
      to: "Coney Island",
      duration: "45 min",
      steps: ["Take N,Q to Coney Island-Stillwell Av"],
      nextDeparture: "10:30 AM",
      isFavorite: false,
    },
  ]);

  //triggered when a user taps a route CARD
  const handleRoutePress = (route: any) => {
    Alert.alert(
      //shows an alert with some details in it
      route.name,
      `${route.from} → ${route.to}\n\nDuration: ${route.duration}\nNext departure: ${route.nextDeparture}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Start Navigation", onPress: () => {} },
      ]
    );
  };

  //toggles the isFavorite flag on a rooute to make it fav
  const toggleFavorite = (routeId: number) => {
    setSavedRoutes((routes) =>
      routes.map((route) =>
        route.id === routeId
          ? { ...route, isFavorite: !route.isFavorite }
          : route
      )
    );
  };

  const handleAddRoute = () => {
    Alert.alert("Add Route", "Navigate to Search to plan and save new routes!");
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Routes</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddRoute}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Live Updates Banner */}
      <View style={styles.liveUpdatesBanner}>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
        <Text style={styles.bannerText}>Real-time updates active</Text>
        <Ionicons name="refresh" size={20} color="#00AA00" />
      </View>

      {/* Saved Routes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Saved Routes</Text>
        {savedRoutes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="map-outline" size={48} color="#CCC" />
            <Text style={styles.emptyStateText}>No saved routes yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Plan a trip to get started
            </Text>
          </View>
        ) : (
          savedRoutes.map((route) => (
            <TouchableOpacity
              key={route.id}
              style={styles.routeCard}
              onPress={() => handleRoutePress(route)}
            >
              <View style={styles.routeHeader}>
                <View style={styles.routeInfo}>
                  <Text style={styles.routeName}>{route.name}</Text>
                  <Text style={styles.routeDestination}>
                    {route.from} → {route.to}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => toggleFavorite(route.id)}
                  style={styles.favoriteButton}
                >
                  <Ionicons
                    name={route.isFavorite ? "heart" : "heart-outline"}
                    size={24}
                    color={route.isFavorite ? "#FF6B6B" : "#CCC"}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.routeDetails}>
                <View style={styles.routeStat}>
                  <Ionicons name="time" size={16} color="#0066CC" />
                  <Text style={styles.routeStatText}>{route.duration}</Text>
                </View>
                <View style={styles.routeStat}>
                  <Ionicons name="train" size={16} color="#0066CC" />
                  <Text style={styles.routeStatText}>
                    Next: {route.nextDeparture}
                  </Text>
                </View>
              </View>

              <View style={styles.routeSteps}>
                {route.steps.slice(0, 2).map((step, index) => (
                  <Text key={index} style={styles.stepText}>
                    {index + 1}. {step}
                  </Text>
                ))}
                {route.steps.length > 2 && (
                  <Text style={styles.moreSteps}>
                    +{route.steps.length - 2} more steps
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity style={styles.quickAction}>
            <Ionicons name="notifications" size={24} color="#0066CC" />
            <Text style={styles.quickActionText}>Route Alerts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <Ionicons name="time" size={24} color="#0066CC" />
            <Text style={styles.quickActionText}>Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <Ionicons name="analytics" size={24} color="#0066CC" />
            <Text style={styles.quickActionText}>Trip History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <Ionicons name="settings" size={24} color="#0066CC" />
            <Text style={styles.quickActionText}>Preferences</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
  },
  addButton: {
    backgroundColor: "#0066CC",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  liveUpdatesBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E8",
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00AA00",
    marginRight: 6,
  },
  liveText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#00AA00",
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    color: "#00AA00",
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  emptyState: {
    backgroundColor: "#FFFFFF",
    padding: 40,
    borderRadius: 12,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 4,
  },
  routeCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  routeDestination: {
    fontSize: 14,
    color: "#666",
  },
  favoriteButton: {
    padding: 4,
  },
  routeDetails: {
    flexDirection: "row",
    marginBottom: 12,
  },
  routeStat: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
  },
  routeStatText: {
    fontSize: 14,
    color: "#333",
    marginLeft: 6,
  },
  routeSteps: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  stepText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  moreSteps: {
    fontSize: 12,
    color: "#0066CC",
    fontStyle: "italic",
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  quickAction: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginTop: 8,
    textAlign: "center",
  },
  bottomPadding: {
    height: 20,
  },
});

export default RouteScreen;
