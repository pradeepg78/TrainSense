import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Route } from "../services/api";

interface ApiRouteCardProps {
  route: Route;
  onPress?: () => void;
  onFavoritePress?: () => void;
  isFavorite?: boolean;
}

const ApiRouteCard: React.FC<ApiRouteCardProps> = ({
  route,
  onPress,
  onFavoritePress,
  isFavorite = false,
}) => {
  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: `#${route.route_color}` }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.header}>
        <View style={styles.routeInfo}>
          <View style={styles.routeNameContainer}>
            <View
              style={[
                styles.routeBadge,
                {
                  backgroundColor: `#${route.route_color}`,
                },
              ]}
            >
              <Text
                style={[
                  styles.routeShortName,
                  { color: `#${route.text_color}` },
                ]}
              >
                {route.short_name}
              </Text>
            </View>
            <Text style={styles.routeLongName}>{route.long_name}</Text>
          </View>
        </View>
        {onFavoritePress && (
          <TouchableOpacity
            onPress={onFavoritePress}
            style={styles.favoriteButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={24}
              color={isFavorite ? "#FF6B6B" : "#B0BEC5"}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Ionicons name="train" size={16} color="#2193b0" />
          <Text style={styles.detailText}>Subway Line</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="information-circle" size={16} color="#2193b0" />
          <Text style={styles.detailText}>Tap for details</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  routeNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  routeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    minWidth: 30,
    alignItems: "center",
  },
  routeShortName: {
    fontSize: 14,
    fontWeight: "bold",
  },
  routeLongName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
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
    color: "#666",
    marginLeft: 6,
  },
});

export default ApiRouteCard;
