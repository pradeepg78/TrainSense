import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiService, BusArrival, BusStop } from "../services/api";
import BusBadge from "./BusBadge";
import { CrowdBars } from "./CrowdBars";

interface BusStopModalProps {
  visible: boolean;
  stop: BusStop | null;
  onClose: () => void;
  // Called when the user taps an arrival to follow that bus
  onBusPress?: (arrival: BusArrival) => void;
}

interface ArrivalGroup {
  route: string;
  destination: string;
  arrivals: BusArrival[];
}

const REFRESH_MS = 30000;

const formatMinutes = (minutes: number | null) => {
  if (minutes === null) return "—";
  if (minutes <= 0) return "Due";
  return `${minutes} min`;
};

// Group by route + destination, keeping the soonest bus of each group first
const groupArrivals = (arrivals: BusArrival[]): ArrivalGroup[] => {
  const groups: ArrivalGroup[] = [];
  arrivals.forEach((arrival) => {
    let group = groups.find(
      (g) => g.route === arrival.route && g.destination === arrival.destination
    );
    if (!group) {
      group = { route: arrival.route, destination: arrival.destination, arrivals: [] };
      groups.push(group);
    }
    group.arrivals.push(arrival);
  });
  return groups;
};

export const BusStopModal: React.FC<BusStopModalProps> = ({ visible, stop, onClose, onBusPress }) => {
  const [arrivals, setArrivals] = useState<BusArrival[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArrivals = async (quiet: boolean) => {
    if (!stop) return;
    if (!quiet) setLoading(true);
    const response = await apiService.getBusArrivals(stop.id);
    if (response.success && response.data) {
      setArrivals(response.data);
      setError(null);
    } else if (!quiet) {
      setError(response.error || "Couldn't load arrivals");
    }
    setLoading(false);
    setRefreshing(false);
  };

  // Load when opened, then keep the times fresh while it stays open
  useEffect(() => {
    if (!visible || !stop) return;
    setArrivals([]);
    setError(null);
    fetchArrivals(false);
    const interval = setInterval(() => fetchArrivals(true), REFRESH_MS);
    return () => clearInterval(interval);
  }, [visible, stop?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchArrivals(true);
  };

  if (!visible || !stop) return null;
  const groups = groupArrivals(arrivals);

  return (
    <View style={styles.sheet}>
      <View style={styles.grabber} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.card}>
            <View style={styles.headerTop}>
              <View style={styles.headerText}>
                <Text style={styles.kicker}>🚌 BUS STOP</Text>
                <Text style={styles.stopName}>{stop.name}</Text>
                {!!stop.direction && <Text style={styles.direction}>{stop.direction}</Text>}
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close">
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            {stop.routes.length > 0 && (
              <View style={styles.routes}>
                {stop.routes.map((r) => (
                  <BusBadge key={r.id} route={r.short_name} />
                ))}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Next buses</Text>
              <TouchableOpacity onPress={onRefresh} style={styles.refreshButton} accessibilityLabel="Refresh">
                <Text style={styles.refreshButtonText}>↻</Text>
              </TouchableOpacity>
            </View>

            {loading && (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color="#1a1a1a" />
              </View>
            )}

            {!loading && error && (
              <View style={styles.centered}>
                <Text style={styles.emptyText}>{error}</Text>
                <TouchableOpacity onPress={() => fetchArrivals(false)} style={styles.retryButton}>
                  <Text style={styles.retryButtonText}>Try again</Text>
                </TouchableOpacity>
              </View>
            )}

            {!loading && !error && groups.length === 0 && (
              <View style={styles.centered}>
                <Text style={styles.emptyText}>No buses on the way right now</Text>
              </View>
            )}

            {!loading &&
              !error &&
              groups.map((group) => (
                <View key={`${group.route}-${group.destination}`} style={styles.group}>
                  <View style={styles.groupHeader}>
                    <BusBadge route={group.route} />
                    <Text style={styles.destination} numberOfLines={1}>
                      to {group.destination}
                    </Text>
                  </View>
                  <View style={styles.rows}>
                    {group.arrivals.slice(0, 3).map((arrival, i) => (
                      <TouchableOpacity
                        key={`${arrival.vehicle_id}-${i}`}
                        style={[styles.row, i > 0 && styles.rowDivider]}
                        disabled={!onBusPress}
                        onPress={() => onBusPress?.(arrival)}
                        activeOpacity={0.6}
                      >
                        <Text style={styles.minutes}>{formatMinutes(arrival.minutes)}</Text>
                        <Text style={styles.distance} numberOfLines={1}>
                          {arrival.distance_text}
                        </Text>
                        <CrowdBars crowd={arrival.crowd} />
                        {onBusPress && <Text style={styles.chevron}>›</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}

            {!loading && groups.length > 0 && (
              <Text style={styles.footer}>
                Tap a bus to follow it live · Crowding shown when the bus reports a passenger count
              </Text>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const card = {
  marginHorizontal: 18,
  backgroundColor: "#FFFFFF",
  borderRadius: 14,
  padding: 18,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 4,
} as const;

const styles = StyleSheet.create({
  // Bottom sheet over the lower half of the map, so the vehicles on this
  // stop's lines stay visible above it
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "52%",
    backgroundColor: "#f5f5f5",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 12,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
    marginTop: 8,
    marginBottom: 4,
  },
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  scrollView: { flex: 1, paddingTop: 20 },
  card: { ...card, marginBottom: 12 },
  headerTop: { flexDirection: "row", alignItems: "flex-start" },
  headerText: { flex: 1, marginRight: 12 },
  kicker: { fontSize: 11, fontWeight: "700", color: "#6B7280", letterSpacing: 0.8, marginBottom: 4 },
  stopName: { fontSize: 22, fontWeight: "bold", color: "#1a1a1a" },
  direction: { fontSize: 14, color: "#666666", marginTop: 2 },
  routes: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: { fontSize: 16, color: "#1a1a1a", fontWeight: "600" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#1a1a1a" },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  refreshButtonText: { fontSize: 14, color: "#FFFFFF", fontWeight: "600" },
  centered: { alignItems: "center", padding: 32 },
  emptyText: { fontSize: 15, color: "#666666", textAlign: "center", fontWeight: "500" },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
  },
  retryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  group: { marginBottom: 16 },
  groupHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  destination: { flex: 1, marginLeft: 8, fontSize: 15, fontWeight: "600", color: "#1a1a1a" },
  rows: { backgroundColor: "#F5F5F5", borderRadius: 10, paddingHorizontal: 12 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: "rgba(0, 0, 0, 0.08)" },
  minutes: { width: 60, fontSize: 16, fontWeight: "bold", color: "#1a1a1a" },
  distance: { flex: 1, fontSize: 13, color: "#666666", marginRight: 8 },
  chevron: { fontSize: 20, color: "#9CA3AF", marginLeft: 8, lineHeight: 20 },
  footer: { fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 4 },
});
