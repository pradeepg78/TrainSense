import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BUS_COLOR } from "../utils/busGeo";

interface BusBadgeProps {
  route: string;
  size?: "small" | "large";
}

// Rounded-rectangle route label, so buses never look like round subway bullets
const BusBadge: React.FC<BusBadgeProps> = ({ route, size = "small" }) => {
  const large = size === "large";
  const isSbs = /SBS|\+$/.test(route);
  return (
    <View style={[styles.badge, large && styles.badgeLarge, isSbs && styles.sbs]}>
      <Text style={[styles.text, large && styles.textLarge]} numberOfLines={1}>
        {route}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    backgroundColor: BUS_COLOR,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 34,
    alignItems: "center",
  },
  badgeLarge: {
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
    minWidth: 48,
  },
  // Select Bus Service gets MTA's lighter SBS blue
  sbs: { backgroundColor: "#0078C6" },
  text: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", letterSpacing: 0.2 },
  textLarge: { fontSize: 16 },
});

export default BusBadge;
