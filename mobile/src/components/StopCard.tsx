import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface StopCardProps {
  stop: {
    id: string;
    name: string;
    distance: string;
    type: "subway" | "bus" | "hub";
    lines: string[];
    nextArrivals: string[];
  };
  onPress?: () => void;
}

const StopCard: React.FC<StopCardProps> = ({ stop, onPress }) => {
  const getStopIcon = (type: string) => {
    switch (type) {
      case "subway":
        return "train";
      case "bus":
        return "bus";
      case "hub":
        return "business";
      default:
        return "location";
    }
  };

  const getStopColor = (type: string) => {
    switch (type) {
      case "subway":
        return "#0066CC";
      case "bus":
        return "#FF6600";
      case "hub":
        return "#00AA00";
      default:
        return "#666";
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.header}>
        <View style={styles.stopIcon}>
          <Ionicons
            name={getStopIcon(stop.type)}
            size={24}
            color={getStopColor(stop.type)}
          />
        </View>
        <View style={styles.stopInfo}>
          <Text style={styles.stopName}>{stop.name}</Text>
          <Text style={styles.stopDistance}>{stop.distance} away</Text>
        </View>
      </View>

      <View style={styles.lines}>
        {stop.lines.map((line, index) => (
          <View key={index} style={styles.lineTag}>
            <Text style={styles.lineText}>{line}</Text>
          </View>
        ))}
      </View>

      <View style={styles.arrivals}>
        <Text style={styles.arrivalsTitle}>Next arrivals:</Text>
        <View style={styles.arrivalTimes}>
          {stop.nextArrivals.slice(0, 3).map((time, index) => (
            <Text key={index} style={styles.arrivalTime}>
              {time}
            </Text>
          ))}
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
    alignItems: "center",
    marginBottom: 12,
  },
  stopIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#2193b0",
    marginBottom: 2,
  },
  stopDistance: {
    fontSize: 15,
    color: "#666",
  },
  lines: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  lineTag: {
    backgroundColor: "#2193b0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  lineText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },
  arrivals: {
    borderTopWidth: 1,
    borderTopColor: "#E3F2FD",
    paddingTop: 10,
  },
  arrivalsTitle: {
    fontSize: 14,
    color: "#90A4AE",
    marginBottom: 6,
  },
  arrivalTimes: {
    flexDirection: "row",
  },
  arrivalTime: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2193b0",
    marginRight: 15,
  },
});

export default StopCard;
