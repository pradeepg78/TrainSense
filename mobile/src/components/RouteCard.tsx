import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface RouteCardProps {
  route: {
    id: number;
    name: string;
    from: string;
    to: string;
    duration: string;
    nextDeparture: string;
    isFavorite?: boolean;
  };
  onPress?: () => void;
  onFavoritePress?: () => void;
}

// =====================
// RouteCard - visually enhanced and heavily commented
// =====================
const RouteCard: React.FC<RouteCardProps> = ({
  route,
  onPress,
  onFavoritePress,
}) => {
  return (
    // TouchableOpacity for card press, with modern shadow and rounded corners
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.header}>
        <View style={styles.routeInfo}>
          {/* Route name - bold and colored for emphasis */}
          <Text style={styles.routeName}>{route.name}</Text>
          {/* Route destination - lighter color for secondary info */}
          <Text style={styles.routeDestination}>
            {route.from} → {route.to}
          </Text>
        </View>
        {/* Favorite button, if provided */}
        {onFavoritePress && (
          <TouchableOpacity
            onPress={onFavoritePress}
            style={styles.favoriteButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name={route.isFavorite ? "heart" : "heart-outline"}
              size={24}
              color={route.isFavorite ? "#FF6B6B" : "#B0BEC5"}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Details row - duration and next departure */}
      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Ionicons name="time" size={16} color="#2193b0" />
          <Text style={styles.detailText}>{route.duration}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="train" size={16} color="#2193b0" />
          <Text style={styles.detailText}>Next: {route.nextDeparture}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F1F8FF",
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    shadowColor: "#2193b0",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
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
  details: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  detailText: {
    fontSize: 14,
    color: "#2193b0",
    marginLeft: 6,
    fontWeight: "600",
  },
});

export default RouteCard;
