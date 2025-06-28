import { Ionicons } from "@expo/vector-icons"; //icons
import React, { useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// services
import ApiRouteCard from "../components/ApiRouteCard";
import { apiService, Route, showApiError } from "../services/api";

const RouteScreen = () => {
  const [savedRoutes, setSavedRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load routes on component mount
  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const response = await apiService.getRoutes();
      if (response.success && response.data) {
        setSavedRoutes(response.data);
      } else {
        showApiError(response.error || "Failed to load routes");
      }
    } catch (error) {
      console.error("Error loading routes:", error);
      showApiError("Failed to load routes");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadRoutes();
    } catch (error) {
      showApiError("Failed to refresh routes");
    } finally {
      setRefreshing(false);
    }
  };

  //triggered when a user taps a route CARD
  const handleRoutePress = (route: Route) => {
    Alert.alert(
      //shows an alert with some details in it
      `${route.short_name} Line`,
      `${route.long_name}\n\nRoute ID: ${route.id}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "View Details", onPress: () => {} },
      ]
    );
  };

  //toggles the isFavorite flag on a route to make it fav
  const toggleFavorite = (routeId: string) => {
    // In a real app, this would save to backend/local storage
    Alert.alert("Favorite", "Favorite functionality coming soon!");
  };

  const handleAddRoute = () => {
    Alert.alert("Add Route", "Navigate to Search to plan and save new routes!");
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header - bold, modern, with more spacing */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Available Routes</Text>
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
        <Text style={styles.sectionTitle}>Subway Lines</Text>
        {loading ? (
          <View style={styles.emptyState}>
            <Ionicons name="refresh" size={48} color="#B0BEC5" />
            <Text style={styles.emptyStateText}>Loading routes...</Text>
          </View>
        ) : savedRoutes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="train-outline" size={48} color="#B0BEC5" />
            <Text style={styles.emptyStateText}>No routes available</Text>
            <Text style={styles.emptyStateSubtext}>
              Check your connection and try again
            </Text>
          </View>
        ) : (
          savedRoutes.map((route) => (
            <ApiRouteCard
              key={route.id}
              route={route}
              onPress={() => handleRoutePress(route)}
              onFavoritePress={() => toggleFavorite(route.id)}
              isFavorite={false}
            />
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
