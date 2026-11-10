import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BUS_COLOR } from "../utils/busGeo";

interface BusToggleProps {
  on: boolean;
  onToggle: () => void;
  // Show the "zoom in" nudge (buses on, but too far out to see stops)
  needsZoom: boolean;
  onZoomToStops: () => void;
}

// Top-left map control: turn buses on/off, and a one-tap way to zoom to street level
export const BusToggle: React.FC<BusToggleProps> = ({ on, onToggle, needsZoom, onZoomToStops }) => (
  <View style={styles.container} pointerEvents="box-none">
    <TouchableOpacity
      style={[styles.pill, on && styles.pillOn]}
      onPress={onToggle}
      activeOpacity={0.8}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel="Show buses"
    >
      <Text style={styles.icon}>🚌</Text>
      <Text style={[styles.label, on && styles.labelOn]}>Buses</Text>
      <View style={[styles.switch, on && styles.switchOn]}>
        <View style={[styles.knob, on && styles.knobOn]} />
      </View>
    </TouchableOpacity>

    {needsZoom && (
      <TouchableOpacity style={styles.hint} onPress={onZoomToStops} activeOpacity={0.8}>
        <Text style={styles.hintText}>Zoom in to see bus stops ›</Text>
      </TouchableOpacity>
    )}
  </View>
);

const shadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 4,
} as const;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    top: Platform.OS === "ios" ? 60 : 40,
    alignItems: "flex-start",
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    ...shadow,
  },
  pillOn: {},
  icon: { fontSize: 18, marginRight: 6 },
  label: { fontSize: 15, fontWeight: "600", color: "#6B7280", marginRight: 10 },
  labelOn: { color: "#1a1a1a" },
  switch: {
    width: 34,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#D1D5DB",
    padding: 2,
    justifyContent: "center",
  },
  switchOn: { backgroundColor: BUS_COLOR },
  knob: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#FFFFFF" },
  knobOn: { alignSelf: "flex-end" },
  hint: {
    backgroundColor: "rgba(26, 26, 26, 0.88)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  hintText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
});
