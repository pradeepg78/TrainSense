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
      {/* Header - bold, modern, with more spacing */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Routes</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddRoute}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Live Updates Banner - more color and shadow for visibility */}
      <View style={styles.liveUpdatesBanner}>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
        <Text style={styles.bannerText}>Real-time updates active</Text>
        <Ionicons name="refresh" size={20} color="#00C851" />
      </View>

      {/* Saved Routes - card-based, with empty state illustration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Saved Routes</Text>
        {savedRoutes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="map-outline" size={48} color="#B0BEC5" />
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
              activeOpacity={0.85}
            >
              {/* Route Header - name, destination, favorite button */}
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
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={route.isFavorite ? "heart" : "heart-outline"}
                    size={24}
                    color={route.isFavorite ? "#FF6B6B" : "#B0BEC5"}
                  />
                </TouchableOpacity>
              </View>

              {/* Route Details - duration, next departure */}
              <View style={styles.routeDetails}>
                <View style={styles.routeStat}>
                  <Ionicons name="time" size={16} color="#2193b0" />
                  <Text style={styles.routeStatText}>{route.duration}</Text>
                </View>
                <View style={styles.routeStat}>
                  <Ionicons name="train" size={16} color="#2193b0" />
                  <Text style={styles.routeStatText}>
                    Next: {route.nextDeparture}
                  </Text>
                </View>
              </View>

              {/* Route Steps - show first 2, then a summary if more */}
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

      {/* Quick Actions - modern grid, more color and spacing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity style={styles.quickAction} activeOpacity={0.8}>
            <Ionicons name="notifications" size={24} color="#2193b0" />
            <Text style={styles.quickActionText}>Route Alerts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} activeOpacity={0.8}>
            <Ionicons name="time" size={24} color="#2193b0" />
            <Text style={styles.quickActionText}>Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} activeOpacity={0.8}>
            <Ionicons name="analytics" size={24} color="#2193b0" />
            <Text style={styles.quickActionText}>Trip History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} activeOpacity={0.8}>
            <Ionicons name="settings" size={24} color="#2193b0" />
            <Text style={styles.quickActionText}>Preferences</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Extra bottom padding for scrollable content */}
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
    paddingHorizontal: 22,
    paddingVertical: 28,
    backgroundColor: "#2193b0",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: "#2193b0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 0.5,
  },
  addButton: {
    backgroundColor: "#FF6B6B",
    borderRadius: 20,
    padding: 8,
    shadowColor: "#FF6B6B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  liveUpdatesBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0F7FA",
    padding: 14,
    borderRadius: 14,
    marginHorizontal: 22,
    marginBottom: 18,
    shadowColor: "#2193b0",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#00C851",
    marginRight: 4,
  },
  liveText: {
    fontSize: 13,
    color: "#00C851",
    fontWeight: "bold",
    letterSpacing: 1,
  },
  bannerText: {
    fontSize: 15,
    color: "#2193b0",
    fontWeight: "500",
    flex: 1,
  },
  section: {
    marginHorizontal: 22,
    marginBottom: 18,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#2193b0",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2193b0",
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyStateText: {
    fontSize: 17,
    color: "#90A4AE",
    fontWeight: "bold",
    marginTop: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#B0BEC5",
    marginTop: 2,
  },
  routeCard: {
    backgroundColor: "#F1F8FF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#2193b0",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  routeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#2193b0",
    marginBottom: 2,
  },
  routeDestination: {
    fontSize: 15,
    color: "#666",
  },
  favoriteButton: {
    padding: 4,
  },
  routeDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  routeStat: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  routeStatText: {
    fontSize: 14,
    color: "#2193b0",
    marginLeft: 6,
    fontWeight: "600",
  },
  routeSteps: {
    marginTop: 4,
  },
  stepText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 2,
  },
  moreSteps: {
    fontSize: 13,
    color: "#90A4AE",
    fontStyle: "italic",
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 10,
  },
  quickAction: {
    width: "47%",
    backgroundColor: "#F1F8FF",
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 18,
    marginBottom: 12,
    shadowColor: "#2193b0",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionText: {
    marginTop: 8,
    fontSize: 15,
    color: "#2193b0",
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  bottomPadding: {
    height: 40,
  },
});

export default RouteScreen;
