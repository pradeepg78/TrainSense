import { Ionicons } from "@expo/vector-icons"; //icons
import { LinearGradient } from "expo-linear-gradient"; //colorful bg
import React, { useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import RouteSymbol from "../components/RouteSymbol";

// components
// services
import { apiService, Route, ServiceStatus } from "../services/api";

const HomeScreen = () => {
  const [refreshing, setRefreshing] = useState(false); //var refreshing used to show pull to refresh spinner, setRefreshing to change
  const [currentTime, setCurrentTime] = useState(new Date()); //currentTime updates every min to show live time
  const [nearbyStops, setNearbyStops] = useState([]); //nearbyStops for nearby stops, needs to be implemented
  const [favoriteRoutes, setFavoriteRoutes] = useState<Route[]>([]); //fav routes
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date()); //updates every min
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load service status
      const statusResponse = await apiService.getServiceStatus();
      if (statusResponse.success && statusResponse.data) {
        setServiceStatus(statusResponse.data);
      }

      // Load some routes for favorites (first 5)
      const routesResponse = await apiService.getRoutes();
      if (routesResponse.success && routesResponse.data) {
        setFavoriteRoutes(routesResponse.data.slice(0, 5));
      }
    } catch (error) {
      console.error("Error loading initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  //called when the user pulls to refresh the screen
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadInitialData();
    } catch (error) {
      Alert.alert("Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  };

  //placeholder function
  const handleQuickPlan = () => {
    // Navigate to Search screen for trip planning
    Alert.alert("Plan Trip", "Navigate to the Search tab to plan your trip!", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Go to Search",
        onPress: () => {
          // In a real app, this would navigate to the Search tab
          // For now, just show an alert
          Alert.alert(
            "Navigation",
            "This would navigate to the Search tab in a real app"
          );
        },
      },
    ]);
  };

  const handleNearbyStops = async () => {
    // Get user's current location and find nearby stops
    try {
      // For demo purposes, use Times Square coordinates
      const latitude = 40.7589;
      const longitude = -73.9851;

      // Get all stops and filter by distance
      const response = await apiService.getStops();
      if (response.success && response.data) {
        // Calculate distance and filter nearby stops
        const nearbyStops = response.data
          .map((stop) => {
            const distance =
              Math.sqrt(
                Math.pow(stop.latitude - latitude, 2) +
                  Math.pow(stop.longitude - longitude, 2)
              ) * 111; // Convert to km
            return { ...stop, distance_km: distance };
          })
          .filter((stop) => stop.distance_km <= 1.0)
          .sort((a, b) => a.distance_km - b.distance_km)
          .slice(0, 5);

        const stopsList = nearbyStops
          .map(
            (stop) => `• ${stop.name} (${stop.distance_km.toFixed(1)}km away)`
          )
          .join("\n");

        Alert.alert(
          "Nearby Stops",
          `Stops near Times Square:\n\n${stopsList}`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "View on Map",
              onPress: () => {
                Alert.alert(
                  "Map",
                  "This would open the map with nearby stops highlighted"
                );
              },
            },
          ]
        );
      } else {
        Alert.alert("Failed to load nearby stops");
      }
    } catch (error) {
      console.error("Error getting nearby stops:", error);
      Alert.alert(
        "Nearby Stops",
        "Unable to load nearby stops. Please try again."
      );
    }
  };

  const handleLiveTimes = () => {
    // Show live arrival times for major stations
    Alert.alert(
      "Live Times",
      "Major Station Arrivals:\n\nTimes Square:\n• N train: 2 min\n• Q train: 5 min\n• 1 train: 3 min\n\nGrand Central:\n• 4 train: 1 min\n• 5 train: 4 min\n• 6 train: 7 min\n\nUnion Square:\n• L train: 3 min\n• N train: 6 min\n• 4 train: 2 min",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "View All",
          onPress: () => {
            Alert.alert(
              "Live Times",
              "This would show a full list of all station arrivals"
            );
          },
        },
      ]
    );
  };

  const handleAlerts = () => {
    // Show service alerts
    Alert.alert(
      "Service Alerts",
      "Current Alerts:\n\n✅ Subway: Good Service\n⚠️  Some delays on 4/5/6 lines due to signal work\n✅ All other lines running normally\n\nLast updated: 2 minutes ago",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "View Details",
          onPress: () => {
            Alert.alert(
              "Alerts",
              "This would show detailed service alerts and updates"
            );
          },
        },
      ]
    );
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatRouteName = (routeName: string) => {
    // Convert X routes to diamond symbols
    if (routeName.endsWith("X")) {
      const baseRoute = routeName.slice(0, -1); // Remove the X
      return `${baseRoute}◆`;
    }
    return routeName;
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const renderServiceStatus = () => {
    if (serviceStatus.length === 0) {
      return (
        <View style={styles.serviceStatusCard}>
          <Text style={styles.loadingText}>Loading service status...</Text>
        </View>
      );
    }

    // Filter out routes with "Unable to determine status" and only show actual issues
    const problematicRoutes = serviceStatus.filter(
      (status) =>
        status.status.message !== "Unable to determine status" &&
        status.status.status !== "good_service"
    );

    if (problematicRoutes.length === 0) {
      return (
        <View style={styles.serviceStatusCard}>
          <View style={styles.serviceItem}>
            <View style={[styles.statusDot, { backgroundColor: "#00AA00" }]} />
            <Text style={styles.serviceText}>
              All subway lines running normally
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.serviceStatusCard}>
        {problematicRoutes.slice(0, 5).map((status, index) => (
          <View key={status.id} style={styles.serviceItem}>
            <RouteSymbol routeId={status.short_name} size={28} />
            <Text style={styles.serviceText}>{status.status.message}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header Section - gradient now bleeds into the top safe area */}
      <LinearGradient
        colors={["#2193b0", "#6dd5ed"]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={{ backgroundColor: "transparent" }}>
          <View style={styles.headerContent}>
            <Text style={styles.greetingText}>{getGreeting()}!</Text>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            <Text style={styles.locationText}>📍 New York City</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Quick Actions - now with more spacing and shadow for a card effect */}
      <View style={styles.quickActionsContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {/* Each action is a card with a subtle shadow and press feedback */}
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={handleQuickPlan}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={32} color="#2193b0" />
            <Text style={styles.quickActionText}>Plan Trip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={handleNearbyStops}
            activeOpacity={0.8}
          >
            <Ionicons name="location" size={32} color="#2193b0" />
            <Text style={styles.quickActionText}>Nearby Stops</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={handleLiveTimes}
            activeOpacity={0.8}
          >
            <Ionicons name="time" size={32} color="#2193b0" />
            <Text style={styles.quickActionText}>Live Times</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={handleAlerts}
            activeOpacity={0.8}
          >
            <Ionicons name="notifications" size={32} color="#2193b0" />
            <Text style={styles.quickActionText}>Alerts</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Service Status - card with colored dots and more spacing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Service Status</Text>
        {renderServiceStatus()}
      </View>

      {/* Recent Activity - card with subtle background and spacing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.recentActivityCard}>
          <Text style={styles.recentActivityText}>
            🚇 Searched: Times Square to Brooklyn Bridge
          </Text>
          <Text style={styles.recentActivityTime}>2 hours ago</Text>
        </View>
        <View style={styles.recentActivityCard}>
          <Text style={styles.recentActivityText}>
            🚌 Planned: Central Park to JFK Airport
          </Text>
          <Text style={styles.recentActivityTime}>Yesterday</Text>
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
  headerGradient: {
    paddingHorizontal: 20,
    paddingVertical: 36,
    marginBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: "#2193b0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    alignItems: "center",
    paddingTop: 32,
  },
  greetingText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 20,
    color: "#FFFFFF",
    opacity: 0.95,
    marginBottom: 6,
    fontWeight: "500",
  },
  locationText: {
    fontSize: 16,
    color: "#E3F2FD",
    marginTop: 2,
  },
  quickActionsContainer: {
    marginHorizontal: 18,
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
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 10,
  },
  quickActionCard: {
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
  section: {
    marginHorizontal: 18,
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
  serviceStatusCard: {
    backgroundColor: "#F1F8FF",
    borderRadius: 12,
    padding: 14,
    marginTop: 6,
    shadowColor: "#2193b0",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  serviceItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  serviceText: {
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
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
  recentActivityCard: {
    backgroundColor: "#F1F8FF",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#2193b0",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  recentActivityText: {
    fontSize: 15,
    color: "#333",
    marginBottom: 2,
  },
  recentActivityTime: {
    fontSize: 13,
    color: "#90A4AE",
  },
  bottomPadding: {
    height: 40,
  },
  loadingText: {
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
    textAlign: "center",
  },
});

export default HomeScreen;
