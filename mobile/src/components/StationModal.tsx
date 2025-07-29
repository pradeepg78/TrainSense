import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { apiService, Arrival, Route, Stop } from "../services/api";
import RouteSymbol from "./RouteSymbol";

interface StationModalProps {
  visible: boolean;
  station: Stop | null;
  onClose: () => void;
}

interface ArrivalGroup {
  route: Route;
  direction: string;
  arrivals: Arrival[];
}

interface CrowdPrediction {
  station_id: string;
  prediction: {
    crowd_level: "low" | "medium" | "high" | "very_high";
    confidence: number;
    timestamp: string;
    factors: string[];
  };
  historical_data?: {
    average_crowd: number;
    peak_hours: string[];
    trends: string[];
  };
}

const MTA_ROUTE_ORDER = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "A",
  "C",
  "E",
  "B",
  "D",
  "F",
  "M",
  "N",
  "Q",
  "R",
  "W",
  "L",
  "G",
  "J",
  "Z",
  "S",
];

function sortRoutes(routes: Route[]) {
  return [...routes].sort((a, b) => {
    const aName = a.short_name || a.id;
    const bName = b.short_name || b.id;
    const aIdx = MTA_ROUTE_ORDER.indexOf(aName);
    const bIdx = MTA_ROUTE_ORDER.indexOf(bName);
    if (aIdx === -1 && bIdx === -1) return aName.localeCompare(bName);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
}

export const StationModal: React.FC<StationModalProps> = ({
  visible,
  station,
  onClose,
}) => {
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastStationId, setLastStationId] = useState<string | null>(null);
  
  // Crowd prediction state
  const [crowdPrediction, setCrowdPrediction] = useState<CrowdPrediction | null>(null);
  const [crowdLoading, setCrowdLoading] = useState(false);
  const [crowdError, setCrowdError] = useState<string | null>(null);

  const fetchArrivals = async (isRefresh = false) => {
    if (!station) return;

    // Don't fetch if we already have data for this station and it's not a refresh
    if (!isRefresh && lastStationId === station.id && arrivals.length > 0) {
      return;
    }

    try {
      setLoading(!isRefresh);
      setError(null);

      const response = await apiService.getRealtimeUpdates(station.id);

      if (response.success && response.data) {
        setArrivals(response.data.arrivals || []);
        setLastStationId(station.id);
      } else {
        setError(response.error || "Failed to fetch arrivals");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCrowdPrediction = async () => {
    if (!station) return;

    try {
      setCrowdLoading(true);
      setCrowdError(null);

      const response = await apiService.getCrowdPrediction(station.id);

      if (response.success && response.data) {
        setCrowdPrediction(response.data);
      } else {
        setCrowdError(response.error || "Failed to fetch crowd prediction");
      }
    } catch (err) {
      setCrowdError("Network error. Please try again.");
    } finally {
      setCrowdLoading(false);
    }
  };

  useEffect(() => {
    if (visible && station) {
      fetchArrivals();
      fetchCrowdPrediction();
    }
  }, [visible, station]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchArrivals(true);
  };

  const groupArrivalsByRoute = (arrivals: Arrival[]): ArrivalGroup[] => {
    const groups: { [key: string]: ArrivalGroup } = {};

    // Deduplicate arrivals first
    const uniqueArrivals = arrivals.filter(
      (arrival, index, self) =>
        index ===
        self.findIndex(
          (a) =>
            a.route === arrival.route &&
            a.direction === arrival.direction &&
            a.minutes === arrival.minutes
        )
    );

    uniqueArrivals.forEach((arrival) => {
      const routeId = arrival.route;
      const direction = arrival.direction;
      const groupKey = `${routeId}-${direction}`;
      
      if (!groups[groupKey]) {
        // Find the actual route data from station routes
        const actualRoute = station?.routes?.find((r) => r.id === routeId);
        groups[groupKey] = {
          route: actualRoute || {
            id: routeId,
            short_name: routeId,
            long_name: `${routeId} Train`,
            route_color: "000000",
            text_color: "FFFFFF",
          },
          direction: direction,
          arrivals: [],
        };
      }
      groups[groupKey].arrivals.push(arrival);
    });

    return Object.values(groups).sort((a, b) => {
      // First sort by route name
      const routeComparison = a.route.short_name.localeCompare(b.route.short_name);
      if (routeComparison !== 0) return routeComparison;
      // Then sort by direction (Northbound first, then Southbound, etc.)
      return a.direction.localeCompare(b.direction);
    });
  };

  const getCrowdLevelStyle = (level: string) => {
    switch (level) {
      case "low":
        return styles.crowdLow;
      case "medium":
        return styles.crowdMedium;
      case "high":
        return styles.crowdHigh;
      case "very_high":
        return styles.crowdVeryHigh;
      default:
        return styles.crowdLow;
    }
  };

  const formatArrivalTime = (minutes: number): string => {
    if (minutes <= 0) return "Due";
    if (minutes === 1) return "1 min";
    return `${minutes} min`;
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case "arriving":
        return "#FF4444";
      case "approaching":
        return "#FF8800";
      case "on time":
        return "#00AA00";
      default:
        return "#666666";
    }
  };

  const arrivalGroups = groupArrivalsByRoute(arrivals);

  if (!station) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { marginBottom: 8 }]}>
          <View style={styles.stationHeader}>
            <Text style={styles.stationName}>{station.name}</Text>
            {station.routes && sortRoutes(station.routes).length > 0 && (
              <View style={styles.routeSymbols}>
                {sortRoutes(station.routes).map((route) => (
                  <RouteSymbol
                    key={route.id}
                    routeId={route.short_name}
                    size={32}
                  />
                ))}
              </View>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Crowd Prediction Section */}
        <View style={styles.crowdSection}>
          <View style={styles.crowdHeader}>
            <Text style={styles.crowdTitle}>Crowd Prediction</Text>
            <TouchableOpacity onPress={fetchCrowdPrediction} style={styles.refreshButton}>
              <Text style={styles.refreshButtonText}>↻</Text>
            </TouchableOpacity>
          </View>

          {crowdLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#2193b0" />
              <Text style={styles.loadingText}>Analyzing crowd patterns...</Text>
            </View>
          )}

          {crowdError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{crowdError}</Text>
              <TouchableOpacity onPress={fetchCrowdPrediction} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {!crowdLoading && !crowdError && crowdPrediction && (
            <View style={styles.crowdCard}>
              <View style={styles.crowdLevelContainer}>
                <View style={[styles.crowdIndicator, getCrowdLevelStyle(crowdPrediction.prediction.crowd_level)]}>
                  <Text style={styles.crowdLevelText}>
                    {crowdPrediction.prediction.crowd_level.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.crowdDetails}>
                  <Text style={styles.confidenceText}>
                    {Math.round(crowdPrediction.prediction.confidence * 100)}% confidence
                  </Text>
                  <Text style={styles.timestampText}>
                    Updated {new Date(crowdPrediction.prediction.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
              </View>
              
              {crowdPrediction.prediction.factors.length > 0 && (
                <View style={styles.factorsContainer}>
                  <Text style={styles.factorsTitle}>Key Factors:</Text>
                  {crowdPrediction.prediction.factors.map((factor, index) => (
                    <Text key={index} style={styles.factorText}>• {factor}</Text>
                  ))}
                </View>
              )}

              {crowdPrediction.historical_data && (
                <View style={styles.historicalContainer}>
                  <Text style={styles.historicalTitle}>Historical Insights:</Text>
                  <Text style={styles.historicalText}>
                    Average crowd level: {crowdPrediction.historical_data.average_crowd}/10
                  </Text>
                  {crowdPrediction.historical_data.peak_hours.length > 0 && (
                    <Text style={styles.historicalText}>
                      Peak hours: {crowdPrediction.historical_data.peak_hours.join(", ")}
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {!crowdLoading && !crowdError && !crowdPrediction && (
            <View style={styles.noCrowdContainer}>
              <Text style={styles.noCrowdText}>
                Crowd prediction not available for this station
              </Text>
            </View>
          )}
        </View>

        {/* Arrivals Section */}
        <View style={[styles.arrivalsSection, { marginTop: 8 }]}>
          <View style={styles.arrivalsHeader}>
            <Text style={styles.arrivalsTitle}>Real-Time Arrivals</Text>
            <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
              <Text style={styles.refreshButtonText}>↻</Text>
            </TouchableOpacity>
          </View>
          <View style={{ marginBottom: 10 }} />

          {loading && !refreshing && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading arrivals...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && arrivalGroups.length === 0 && (
            <View style={styles.noArrivalsContainer}>
              <Text style={styles.noArrivalsText}>
                No arrivals scheduled at this time
              </Text>
            </View>
          )}

          {!loading && !error && arrivalGroups.length > 0 && (
            <ScrollView
              style={styles.arrivalsList}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              {arrivalGroups.map((group) => (
                <View key={`${group.route.id}-${group.direction}`} style={styles.routeGroup}>
                  <View style={styles.routeHeader}>
                    <RouteSymbol routeId={group.route.short_name} size={28} />
                    <Text style={styles.directionHeader}>{group.direction}</Text>
                  </View>

                  <View style={styles.arrivalsContainer}>
                    {group.arrivals
                      .sort((a, b) => a.minutes - b.minutes)
                      .slice(0, 5)
                      .map((arrival, index) => (
                        <View key={index} style={styles.arrivalItem}>
                          <View style={styles.arrivalTime}>
                            <Text style={styles.arrivalMinutes}>
                              {formatArrivalTime(arrival.minutes)}
                            </Text>
                            <Text
                              style={[
                                styles.arrivalStatus,
                                { color: getStatusColor(arrival.status) },
                              ]}
                            >
                              {arrival.status}
                            </Text>
                          </View>
                          <View style={styles.arrivalDetails}>
                            <Text style={[styles.arrivalDirection, { fontSize: 12, opacity: 0.7 }]}>
                              {arrival.direction}
                            </Text>
                          </View>
                        </View>
                      ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E1E5E9",
  },
  stationHeader: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  stationName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1A1A1A",
    flex: 1,
  },
  routeSymbols: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    rowGap: 10,
    marginBottom: 6,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 18,
    color: "#666666",
  },
  stationInfo: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E1E5E9",
  },
  routesContainer: {
    marginTop: 10,
  },
  routesLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  routeTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  routeTag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    minWidth: 36,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  routeTagText: {
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
    includeFontPadding: false,
  },
  arrivalsSection: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  arrivalsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E1E5E9",
  },
  arrivalsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1A1A1A",
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  refreshButtonText: {
    fontSize: 18,
    color: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: "#FF4444",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#007AFF",
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  noArrivalsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  noArrivalsText: {
    fontSize: 16,
    color: "#666666",
    textAlign: "center",
  },
  arrivalsList: {
    flex: 1,
  },
  routeGroup: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  routeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  directionHeader: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    marginLeft: 12,
  },
  routeName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    flex: 1,
  },
  arrivalsContainer: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
  },
  arrivalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E1E5E9",
  },
  arrivalTime: {
    alignItems: "flex-start",
  },
  arrivalMinutes: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1A1A1A",
  },
  arrivalStatus: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  arrivalDetails: {
    alignItems: "flex-end",
  },
  arrivalDirection: {
    fontSize: 14,
    color: "#666666",
  },
  crowdSection: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E1E5E9",
  },
  crowdHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  crowdTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1A1A1A",
  },
  crowdCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
  },
  crowdLevelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  crowdIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  crowdLow: {
    backgroundColor: "#E0F2F7",
    borderWidth: 1,
    borderColor: "#A7DBE8",
  },
  crowdMedium: {
    backgroundColor: "#FDE68A",
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  crowdHigh: {
    backgroundColor: "#FCA5A5",
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  crowdVeryHigh: {
    backgroundColor: "#FECACA",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  crowdLevelText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1A1A1A",
  },
  crowdDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  confidenceText: {
    fontSize: 14,
    color: "#666666",
  },
  timestampText: {
    fontSize: 14,
    color: "#666666",
  },
  factorsContainer: {
    marginBottom: 10,
  },
  factorsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  factorText: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 4,
  },
  historicalContainer: {
    marginTop: 10,
  },
  historicalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  historicalText: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 4,
  },
  noCrowdContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  noCrowdText: {
    fontSize: 16,
    color: "#666666",
    textAlign: "center",
  },
});
