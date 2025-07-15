import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Arrival } from "../services/api";

interface ArrivalCardProps {
  arrival: Arrival;
  onPress?: () => void;
}

const ArrivalCard: React.FC<ArrivalCardProps> = ({ arrival, onPress }) => {
  const getRouteColor = (route: string) => {
    const routeColors: { [key: string]: string } = {
      A: "#0039A6",
      C: "#0039A6",
      E: "#0039A6",
      B: "#FF6319",
      D: "#FF6319",
      F: "#FF6319",
      M: "#FF6319",
      G: "#6CBE45",
      J: "#996633",
      Z: "#996633",
      L: "#A7A9AC",
      N: "#FCCC0A",
      Q: "#FCCC0A",
      R: "#FCCC0A",
      W: "#FCCC0A",
      "1": "#EE352E",
      "2": "#EE352E",
      "3": "#EE352E",
      "4": "#00933C",
      "5": "#00933C",
      "6": "#00933C",
      "7": "#B933AD",
      SI: "#0039A6",
    };

    return routeColors[route] || "#2193b0";
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "on time":
        return "#00C851";
      case "approaching":
        return "#FF6B35";
      case "delayed":
        return "#FF6600";
      default:
        return "#666";
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.routeSection}>
        <View
          style={[
            styles.routeBadge,
            { backgroundColor: getRouteColor(arrival.route) },
          ]}
        >
          <Text style={styles.routeText}>{arrival.route}</Text>
        </View>
        <View style={styles.routeInfo}>
          <Text style={styles.direction}>{arrival.direction}</Text>
          <Text
            style={[styles.status, { color: getStatusColor(arrival.status) }]}
          >
            {arrival.status}
          </Text>
        </View>
      </View>

      <View style={styles.timeSection}>
        <Text style={styles.minutes}>{arrival.minutes}</Text>
        <Text style={styles.minutesLabel}>min</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
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
  routeSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  routeBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  routeText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  routeInfo: {
    flex: 1,
  },
  direction: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  status: {
    fontSize: 12,
    fontWeight: "500",
  },
  timeSection: {
    alignItems: "center",
  },
  minutes: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  minutesLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
});

export default ArrivalCard;
