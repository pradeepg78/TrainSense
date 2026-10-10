import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Stop, TrainLocation, TrainStop } from "../services/api";
import { getMtaColor } from "../utils/mtaColors";
import RouteSymbol from "./RouteSymbol";

interface TrainPanelProps {
  routeId: string;
  train: TrainLocation | null;
  loading: boolean;
  error: string | null;
  // The station the user opened before choosing this train
  originStation?: Stop | null;
  onClose: () => void;
}

const metersBetween = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) => {
  const dLat = (a.latitude - b.latitude) * 111320;
  const dLon = (a.longitude - b.longitude) * 111320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon);
};

const formatMinutes = (minutes?: number): string => {
  if (minutes === undefined) return "";
  if (minutes <= 0) return "Now";
  return `${minutes} min`;
};

// Bottom sheet showing where a train is along its line
export const TrainPanel: React.FC<TrainPanelProps> = ({
  routeId,
  train,
  loading,
  error,
  originStation,
  onClose,
}) => {
  const lineColor = getMtaColor(routeId).background;
  const isStopped = train?.status === "stopped_at";

  const statusText = (() => {
    if (!train) return "";
    if (isStopped) return `At ${train.next_stop.name}`;
    if (train.previous_stop) {
      return `Between ${train.previous_stop.name} and ${train.next_stop.name}`;
    }
    return `Approaching ${train.next_stop.name}`;
  })();

  // Transfer complexes (e.g. Times Sq) use a different stop id per line, so
  // also treat any stop within ~300m of the tapped station as the same place
  const isOriginStop = (stop: TrainStop) =>
    !!originStation &&
    (stop.parent_station === originStation.id ||
      metersBetween(stop, originStation) < 300);
  const originUpcoming = train?.upcoming_stops.find(isOriginStop);

  const originText = (() => {
    if (!train || !originStation) return "";
    if (originUpcoming) {
      return originUpcoming.minutes && originUpcoming.minutes > 0
        ? `Reaches ${originStation.name} in ${originUpcoming.minutes} min`
        : `Arriving at ${originStation.name} now`;
    }
    return `Already left ${originStation.name}`;
  })();

  const renderStop = (stop: TrainStop, kind: "passed" | "current" | "upcoming", isLast: boolean) => (
    <View key={`${kind}-${stop.id}`} style={styles.stopRow}>
      <View style={styles.rail}>
        <View
          style={[
            styles.railLine,
            { backgroundColor: kind === "passed" ? "#D1D5DB" : lineColor },
            isLast && styles.railLineEnd,
          ]}
        />
        <View
          style={[
            styles.stopDot,
            { borderColor: kind === "passed" ? "#D1D5DB" : lineColor },
            kind === "current" && { backgroundColor: lineColor },
          ]}
        />
      </View>
      <Text
        style={[
          styles.stopName,
          kind === "passed" && styles.stopNamePassed,
          kind === "current" && styles.stopNameCurrent,
        ]}
        numberOfLines={1}
      >
        {stop.name}
      </Text>
      {kind !== "passed" && isOriginStop(stop) && (
        <View style={styles.yourStopBadge}>
          <Text style={styles.yourStopText}>Your stop</Text>
        </View>
      )}
      {kind !== "passed" && (
        <Text style={styles.stopMinutes}>{formatMinutes(stop.minutes)}</Text>
      )}
    </View>
  );

  const renderTrainMarker = () => (
    <View key="train" style={styles.stopRow}>
      <View style={styles.rail}>
        <View style={[styles.railLine, { backgroundColor: lineColor }]} />
        <View style={[styles.trainMarker, { backgroundColor: lineColor }]}>
          <Text style={styles.trainMarkerText}>▼</Text>
        </View>
      </View>
      <Text style={styles.trainHereText}>Train is here</Text>
    </View>
  );

  const upcoming = train?.upcoming_stops ?? [];

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <RouteSymbol routeId={routeId} size={30} />
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {train ? `to ${train.destination}` : `${routeId} train`}
          </Text>
          {!!statusText && (
            <Text style={styles.subtitle} numberOfLines={2}>
              {statusText}
            </Text>
          )}
          {!!originText && <Text style={styles.originText}>{originText}</Text>}
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {loading && !train && (
        <View style={styles.centered}>
          <ActivityIndicator color="#1a1a1a" />
        </View>
      )}

      {error && !train && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {train && (
        <ScrollView style={styles.stopList} contentContainerStyle={styles.stopListContent}>
          {train.previous_stop && !isStopped && renderStop(train.previous_stop, "passed", false)}
          {!isStopped && renderTrainMarker()}
          {upcoming.map((stop, index) =>
            renderStop(
              stop,
              index === 0 && isStopped ? "current" : "upcoming",
              index === upcoming.length - 1
            )
          )}
        </ScrollView>
      )}

      {train && <Text style={styles.footer}>Live position · updates every 30s</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 24,
    maxHeight: "45%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
    marginLeft: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 13,
    color: "#666666",
    marginTop: 2,
  },
  originText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1a1a1a",
    marginTop: 2,
  },
  yourStopBadge: {
    backgroundColor: "#1a1a1a",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  yourStopText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 16,
    color: "#1a1a1a",
    fontWeight: "600",
  },
  centered: {
    padding: 24,
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
  },
  stopList: {
    marginTop: 12,
  },
  stopListContent: {
    paddingBottom: 4,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 34,
  },
  rail: {
    width: 24,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  railLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 4,
  },
  railLineEnd: {
    bottom: "50%",
  },
  stopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    backgroundColor: "#FFFFFF",
  },
  trainMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  trainMarkerText: {
    fontSize: 9,
    color: "#FFFFFF",
  },
  trainHereText: {
    marginLeft: 10,
    fontSize: 13,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  stopName: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: "#1a1a1a",
  },
  stopNamePassed: {
    color: "#9CA3AF",
  },
  stopNameCurrent: {
    fontWeight: "700",
  },
  stopMinutes: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1a1a1a",
    marginLeft: 8,
  },
  footer: {
    marginTop: 8,
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
  },
});
