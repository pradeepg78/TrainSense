import React from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BusLocation, BusStop, BusUpcomingStop } from "../services/api";
import { BUS_COLOR, sameBusStop } from "../utils/busGeo";
import BusBadge from "./BusBadge";
import { CrowdBars } from "./CrowdBars";

interface BusPanelProps {
  route: string;
  bus: BusLocation | null;
  loading: boolean;
  error: string | null;
  // The stop the user opened before choosing this bus
  originStop?: BusStop | null;
  onClose: () => void;
}

const formatMinutes = (minutes: number | null) => {
  if (minutes === null) return "";
  if (minutes <= 0) return "Now";
  return `${minutes} min`;
};

// Bottom sheet following one bus along its route
export const BusPanel: React.FC<BusPanelProps> = ({ route, bus, loading, error, originStop, onClose }) => {
  const upcoming = bus?.upcoming_stops ?? [];
  const next = upcoming[0];
  const isOrigin = (stop: BusUpcomingStop) => sameBusStop(stop.id, originStop?.id);
  const originUpcoming = upcoming.find(isOrigin);

  const statusText = next ? `Next stop: ${next.name}` : "";

  const originText = (() => {
    if (!bus || !originStop) return "";
    if (originUpcoming) {
      return originUpcoming.minutes && originUpcoming.minutes > 0
        ? `Reaches ${originStop.name} in ${originUpcoming.minutes} min`
        : `Arriving at ${originStop.name} now`;
    }
    // Onward calls are capped, so a stop missing from the list may just be far off
    const lastMinutes = upcoming[upcoming.length - 1]?.minutes;
    return upcoming.length >= 15 && lastMinutes !== null
      ? `${originStop.name} is more than ${lastMinutes} min away`
      : `Already passed ${originStop.name}`;
  })();

  const crowdDetail = (() => {
    const crowd = bus?.crowd;
    if (!crowd) return "";
    if (crowd.passengers !== undefined && crowd.capacity) {
      return `${crowd.passengers} riders on board · fits about ${crowd.capacity}`;
    }
    return "";
  })();

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <BusBadge route={route} size="large" />
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {bus ? `to ${bus.destination}` : `${route} bus`}
          </Text>
          {!!statusText && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {statusText}
            </Text>
          )}
          {!!originText && <Text style={styles.originText}>{originText}</Text>}
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Stop following">
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {loading && !bus && (
        <View style={styles.centered}>
          <ActivityIndicator color="#1a1a1a" />
        </View>
      )}

      {error && !bus && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {bus && (
        <View style={styles.crowdSection}>
          {bus.crowd ? (
            <>
              <CrowdBars crowd={bus.crowd} size="large" />
              {!!crowdDetail && <Text style={styles.crowdDetail}>{crowdDetail}</Text>}
            </>
          ) : (
            <Text style={styles.crowdDetail}>This bus doesn't report how full it is</Text>
          )}
        </View>
      )}

      {bus && upcoming.length > 0 && (
        <ScrollView style={styles.stopList} contentContainerStyle={styles.stopListContent}>
          <View style={styles.stopRow}>
            <View style={styles.rail}>
              <View style={[styles.railLine, styles.railLineStart]} />
              <View style={styles.busMarker}>
                <Text style={styles.busMarkerText}>▼</Text>
              </View>
            </View>
            <Text style={styles.busHereText}>Bus is here</Text>
          </View>
          {upcoming.map((stop, index) => (
            <View key={`${stop.id}-${index}`} style={styles.stopRow}>
              <View style={styles.rail}>
                <View style={[styles.railLine, index === upcoming.length - 1 && styles.railLineEnd]} />
                <View style={styles.stopDot} />
              </View>
              <Text style={[styles.stopName, isOrigin(stop) && styles.stopNameBold]} numberOfLines={1}>
                {stop.name}
              </Text>
              {isOrigin(stop) && (
                <View style={styles.yourStopBadge}>
                  <Text style={styles.yourStopText}>Your stop</Text>
                </View>
              )}
              <Text style={styles.stopMinutes}>{formatMinutes(stop.minutes)}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {bus && <Text style={styles.footer}>Live GPS position · updates every 30s</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    left: 12,
    right: 12,
    // Clear the floating tab bar (see MinimalTabBar in App.tsx)
    bottom: Platform.OS === "ios" ? 108 : 100,
    maxHeight: "40%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  header: { flexDirection: "row", alignItems: "center" },
  headerText: { flex: 1, marginLeft: 10, marginRight: 8 },
  title: { fontSize: 17, fontWeight: "bold", color: "#1a1a1a" },
  subtitle: { fontSize: 13, color: "#666666", marginTop: 2 },
  originText: { fontSize: 13, fontWeight: "600", color: "#1a1a1a", marginTop: 2 },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: { fontSize: 16, color: "#1a1a1a", fontWeight: "600" },
  centered: { padding: 24, alignItems: "center" },
  errorText: { fontSize: 14, color: "#666666", textAlign: "center" },
  crowdSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.08)",
  },
  crowdDetail: { marginTop: 4, fontSize: 12, color: "#666666" },
  stopList: { marginTop: 12 },
  stopListContent: { paddingBottom: 4, paddingRight: 12 },
  stopRow: { flexDirection: "row", alignItems: "center", height: 34 },
  rail: { width: 24, height: "100%", alignItems: "center", justifyContent: "center" },
  railLine: { position: "absolute", top: 0, bottom: 0, width: 4, backgroundColor: BUS_COLOR },
  railLineStart: { top: "50%" },
  railLineEnd: { bottom: "50%" },
  stopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: BUS_COLOR,
    backgroundColor: "#FFFFFF",
  },
  busMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: BUS_COLOR,
    justifyContent: "center",
    alignItems: "center",
  },
  busMarkerText: { fontSize: 9, color: "#FFFFFF" },
  busHereText: { marginLeft: 10, fontSize: 13, fontWeight: "700", color: "#1a1a1a" },
  stopName: { flex: 1, marginLeft: 10, fontSize: 14, color: "#1a1a1a" },
  stopNameBold: { fontWeight: "700" },
  yourStopBadge: {
    backgroundColor: "#1a1a1a",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  yourStopText: { fontSize: 10, fontWeight: "700", color: "#FFFFFF" },
  stopMinutes: {
    minWidth: 44,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "600",
    color: "#1a1a1a",
    marginLeft: 8,
  },
  footer: { marginTop: 8, fontSize: 11, color: "#9CA3AF", textAlign: "center" },
});
