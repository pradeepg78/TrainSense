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
    <TouchableOpacity style={styles.card} onPress={onPress}>
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
    alignItems: "center",
    marginBottom: 12,
  },
  stopIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F8F9FA",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 2,
  },
  stopDistance: {
    fontSize: 14,
    color: "#666",
  },
  lines: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  lineTag: {
    backgroundColor: "#0066CC",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  lineText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  arrivals: {
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingTop: 10,
  },
  arrivalsTitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 6,
  },
  arrivalTimes: {
    flexDirection: "row",
  },
  arrivalTime: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0066CC",
    marginRight: 15,
  },
});

export default StopCard;
