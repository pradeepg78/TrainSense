import { Ionicons } from "@expo/vector-icons"; //icons
import { LinearGradient } from "expo-linear-gradient"; //colorful bg
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

// components
import RouteCard from "../components/RouteCard";

const HomeScreen = () => {
  const [refreshing, setRefreshing] = useState(false); //var refreshing used to show pull to refresh spinner, setRefreshing to change
  const [currentTime, setCurrentTime] = useState(new Date()); //currentTime updates every min to show live time
  const [nearbyStops, setNearbyStops] = useState([]); //nearbyStops for nearby stops, needs to be implemented
  const [favoriteRoutes, setFavoriteRoutes] = useState([]); //fav routes

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date()); //updates every min
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  //called when the user pulls to refresh the screen
  const onRefresh = async () => {
    setRefreshing(true);
    // BACKEND TODO: fetch fresh data from your backend
    setTimeout(() => {
      setRefreshing(false);
    }, 2000); //2 seconds, fake
  };

  //placeholder function
  const handleQuickPlan = () => {
    Alert.alert("Quick Plan", "Trip planning feature coming soon!");
  };

  const handleNearbyStops = () => {
    Alert.alert("Nearby Stops", "Location-based features coming soon!");
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header Section - uses a vibrant blue gradient for a modern transit feel */}
      <LinearGradient
        colors={["#2193b0", "#6dd5ed"]} // more vibrant blue gradient
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <Text style={styles.greetingText}>{getGreeting()}!</Text>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <Text style={styles.locationText}>📍 New York City</Text>
        </View>
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

          <TouchableOpacity style={styles.quickActionCard} activeOpacity={0.8}>
            <Ionicons name="time" size={32} color="#2193b0" />
            <Text style={styles.quickActionText}>Live Times</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionCard} activeOpacity={0.8}>
            <Ionicons name="notifications" size={32} color="#2193b0" />
            <Text style={styles.quickActionText}>Alerts</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Service Status - card with colored dots and more spacing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Service Status</Text>
        <View style={styles.serviceStatusCard}>
          <View style={styles.serviceItem}>
            <View style={[styles.statusDot, { backgroundColor: "#00C851" }]} />
            <Text style={styles.serviceText}>Subway: Good Service</Text>
          </View>
          <View style={styles.serviceItem}>
            <View style={[styles.statusDot, { backgroundColor: "#ffbb33" }]} />
            <Text style={styles.serviceText}>Bus: Some Delays</Text>
          </View>
          <View style={styles.serviceItem}>
            <View style={[styles.statusDot, { backgroundColor: "#00C851" }]} />
            <Text style={styles.serviceText}>LIRR: Good Service</Text>
          </View>
        </View>
      </View>

      {/* Favorite Routes - card with empty state illustration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Favorite Routes</Text>
        {favoriteRoutes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={48} color="#B0BEC5" />
            <Text style={styles.emptyStateText}>No favorite routes yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Add routes to see them here
            </Text>
          </View>
        ) : (
          favoriteRoutes.map((route, index) => (
            <RouteCard key={index} route={route} />
          ))
        )}
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
});

export default HomeScreen;
