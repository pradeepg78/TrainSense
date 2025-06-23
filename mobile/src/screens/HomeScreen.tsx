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
      {/* Header Section */}
      <LinearGradient
        colors={["#0066CC", "#004499"]}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <Text style={styles.greetingText}>{getGreeting()}!</Text>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <Text style={styles.locationText}>📍 New York City</Text>
        </View>
      </LinearGradient>

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={handleQuickPlan}
          >
            <Ionicons name="navigate" size={32} color="#0066CC" />
            <Text style={styles.quickActionText}>Plan Trip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={handleNearbyStops}
          >
            <Ionicons name="location" size={32} color="#0066CC" />
            <Text style={styles.quickActionText}>Nearby Stops</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionCard}>
            <Ionicons name="time" size={32} color="#0066CC" />
            <Text style={styles.quickActionText}>Live Times</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionCard}>
            <Ionicons name="notifications" size={32} color="#0066CC" />
            <Text style={styles.quickActionText}>Alerts</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Service Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Service Status</Text>
        <View style={styles.serviceStatusCard}>
          <View style={styles.serviceItem}>
            <View style={[styles.statusDot, { backgroundColor: "#00AA00" }]} />
            <Text style={styles.serviceText}>Subway: Good Service</Text>
          </View>
          <View style={styles.serviceItem}>
            <View style={[styles.statusDot, { backgroundColor: "#FF6600" }]} />
            <Text style={styles.serviceText}>Bus: Some Delays</Text>
          </View>
          <View style={styles.serviceItem}>
            <View style={[styles.statusDot, { backgroundColor: "#00AA00" }]} />
            <Text style={styles.serviceText}>LIRR: Good Service</Text>
          </View>
        </View>
      </View>

      {/* Favorite Routes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Favorite Routes</Text>
        {favoriteRoutes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={48} color="#CCC" />
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

      {/* Recent Activity */}
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
    paddingVertical: 30,
    marginBottom: 20,
  },
  headerContent: {
    alignItems: "center",
  },
  greetingText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 5,
  },
  timeText: {
    fontSize: 18,
    color: "#FFFFFF",
    opacity: 0.9,
    marginBottom: 5,
  },
  locationText: {
    fontSize: 16,
    color: "#FFFFFF",
    opacity: 0.8,
  },
  quickActionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  quickActionCard: {
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
  section: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  serviceStatusCard: {
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  serviceItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  serviceText: {
    fontSize: 16,
    color: "#333",
  },
  emptyState: {
    backgroundColor: "#FFFFFF",
    padding: 40,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  recentActivityCard: {
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 12,
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
  recentActivityText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 4,
  },
  recentActivityTime: {
    fontSize: 12,
    color: "#999",
  },
  bottomPadding: {
    height: 20,
  },
});

export default HomeScreen;
