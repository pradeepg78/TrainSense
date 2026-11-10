import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { TrainCrowd } from "../services/api";

interface CrowdBarsProps {
  // Anything with a level + label: a train estimate or a bus's live count
  crowd: Pick<TrainCrowd, "level" | "label"> | null | undefined;
  size?: "small" | "large";
  showLabel?: boolean;
}

const LEVELS: Record<TrainCrowd["level"], { bars: number; color: string; short: string }> = {
  low: { bars: 1, color: "#10B981", short: "Seats" },
  medium: { bars: 2, color: "#F59E0B", short: "Standing" },
  high: { bars: 3, color: "#F97316", short: "Crowded" },
  very_high: { bars: 4, color: "#EF4444", short: "Packed" },
};

// Four-bar crowding indicator for a single train or bus
export const CrowdBars: React.FC<CrowdBarsProps> = ({ crowd, size = "small", showLabel = true }) => {
  if (!crowd) return null;
  const { bars, color, short } = LEVELS[crowd.level];
  const large = size === "large";

  return (
    <View style={styles.row}>
      <View style={[styles.bars, large && styles.barsLarge]}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.bar,
              large && styles.barLarge,
              { height: (large ? 6 : 4) + i * (large ? 3 : 2) },
              { backgroundColor: i <= bars ? color : "#E5E7EB" },
            ]}
          />
        ))}
      </View>
      {showLabel && (
        <Text style={[styles.label, large && styles.labelLarge]}>{large ? crowd.label : short}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 12,
  },
  barsLarge: {
    gap: 3,
    height: 18,
  },
  bar: {
    width: 4,
    borderRadius: 1.5,
  },
  barLarge: {
    width: 6,
    borderRadius: 2,
  },
  label: {
    marginLeft: 5,
    fontSize: 11,
    fontWeight: "600",
    color: "#4B5563",
  },
  labelLarge: {
    marginLeft: 8,
    fontSize: 14,
    color: "#1a1a1a",
  },
});
