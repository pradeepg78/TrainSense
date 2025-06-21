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

const RouteCard: React.FC<RouteCardProps> = ({
  route,
  onPress,
  onFavoritePress,
}) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.routeInfo}>
          <Text style={styles.routeName}>{route.name}</Text>
          <Text style={styles.routeDestination}>
            {route.from} → {route.to}
          </Text>
        </View>
        {onFavoritePress && (
          <TouchableOpacity
            onPress={onFavoritePress}
            style={styles.favoriteButton}
          >
            <Ionicons
              name={route.isFavorite ? "heart" : "heart-outline"}
              size={24}
              color={route.isFavorite ? "#FF6B6B" : "#CCC"}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Ionicons name="time" size={16} color="#0066CC" />
          <Text style={styles.detailText}>{route.duration}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="train" size={16} color="#0066CC" />
          <Text style={styles.detailText}>Next: {route.nextDeparture}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
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
    fontSize: 16,
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
  details: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailText: {
    fontSize: 14,
    color: "#333",
    marginLeft: 6,
  },
});

export default RouteCard;
