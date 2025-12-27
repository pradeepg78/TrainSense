import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { apiService, Stop, TripPlan } from "../services/api";

const SearchScreen = () => {
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [stops, setStops] = useState<Stop[]>([]);
  const [filteredStops, setFilteredStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeInput, setActiveInput] = useState<"from" | "to" | null>(null);
  const [recentSearches, setRecentSearches] = useState([
    { from: "Times Square", to: "Brooklyn Bridge", time: "2h ago" },
    { from: "Central Park", to: "JFK Airport", time: "Yesterday" },
  ]);

  useEffect(() => {
    loadStops();
  }, []);

  const loadStops = async () => {
    setLoading(true);
    try {
      const response = await apiService.getStops();
      if (response.success && response.data) {
        setStops(response.data);
      }
    } catch (error) {
      console.error("Error loading stops:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (text: string, field: "from" | "to") => {
    if (field === "from") {
      setFromLocation(text);
    } else {
      setToLocation(text);
    }

    // Filter stops based on input
    if (text.length > 0) {
      const filtered = stops.filter((stop) =>
        stop.name.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredStops(filtered.slice(0, 5));
      setActiveInput(field);
    } else {
      setFilteredStops([]);
      setActiveInput(null);
    }
  };

  const handleStopSelect = (stop: Stop) => {
    if (activeInput === "from") {
      setFromLocation(stop.name);
    } else {
      setToLocation(stop.name);
    }
    setFilteredStops([]);
    setActiveInput(null);
    Keyboard.dismiss();
  };

  const handleSwapLocations = () => {
    const temp = fromLocation;
    setFromLocation(toLocation);
    setToLocation(temp);
  };

  const handleCurrentLocation = (field: "from" | "to") => {
    const location = "Current Location";
    if (field === "from") {
      setFromLocation(location);
    } else {
      setToLocation(location);
    }
  };

  const handleSearch = async () => {
    if (!fromLocation || !toLocation) {
      Alert.alert("Missing Info", "Please enter both origin and destination");
      return;
    }

    const fromStop = stops.find((stop) =>
      stop.name.toLowerCase().includes(fromLocation.toLowerCase())
    );
    const toStop = stops.find((stop) =>
      stop.name.toLowerCase().includes(toLocation.toLowerCase())
    );

    if (!fromStop || !toStop) {
      Alert.alert("Not Found", "Could not find the specified stations");
      return;
    }

    try {
      const response = await apiService.planTrip(fromStop.id, toStop.id);
      if (response.success && response.data) {
        const trip: TripPlan = response.data;
        Alert.alert(
          "Route Found",
          `From: ${trip.origin.name}\nTo: ${trip.destination.name}\nEstimated Time: ${trip.estimated_time}\nTransfers: ${trip.transfers}`,
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to plan trip");
    }
  };

  const handleRecentSearch = (search: any) => {
    setFromLocation(search.from);
    setToLocation(search.to);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Plan Trip</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search Card */}
          <View style={styles.searchCard}>
            {/* From Input */}
            <View style={styles.inputRow}>
              <View style={styles.inputDot}>
                <View style={styles.dotInner} />
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="From"
                  value={fromLocation}
                  onChangeText={(text) => handleInputChange(text, "from")}
                  onFocus={() => setActiveInput("from")}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  style={styles.locationButton}
                  onPress={() => handleCurrentLocation("from")}
                >
                  <Ionicons name="locate" size={18} color="#1a1a1a" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Connector Line */}
            <View style={styles.connectorContainer}>
              <View style={styles.connectorLine} />
              <TouchableOpacity
                style={styles.swapButton}
                onPress={handleSwapLocations}
              >
                <Ionicons name="swap-vertical" size={18} color="#1a1a1a" />
              </TouchableOpacity>
            </View>

            {/* To Input */}
            <View style={styles.inputRow}>
              <View style={[styles.inputDot, styles.inputDotDestination]}>
                <View style={styles.dotInnerDestination} />
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="To"
                  value={toLocation}
                  onChangeText={(text) => handleInputChange(text, "to")}
                  onFocus={() => setActiveInput("to")}
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            {/* Autocomplete Suggestions */}
            {filteredStops.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {filteredStops.map((stop) => (
                  <TouchableOpacity
                    key={stop.id}
                    style={styles.suggestionItem}
                    onPress={() => handleStopSelect(stop)}
                  >
                    <Ionicons name="train-outline" size={16} color="#666" />
                    <Text style={styles.suggestionText}>{stop.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Search Button */}
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
              activeOpacity={0.8}
            >
              <Text style={styles.searchButtonText}>Find Route</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="time-outline" size={16} color="#1a1a1a" />
                <Text style={styles.sectionTitle}>Recent</Text>
              </View>
              {recentSearches.map((search, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.recentCard}
                  onPress={() => handleRecentSearch(search)}
                  activeOpacity={0.7}
                >
                  <View style={styles.recentRoute}>
                    <Text style={styles.recentFrom}>{search.from}</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color="#ccc"
                      style={styles.recentArrow}
                    />
                    <Text style={styles.recentTo}>{search.to}</Text>
                  </View>
                  <Text style={styles.recentTime}>{search.time}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flash-outline" size={16} color="#1a1a1a" />
              <Text style={styles.sectionTitle}>Quick Actions</Text>
            </View>
            <View style={styles.quickActionsGrid}>
              <TouchableOpacity style={styles.quickAction} activeOpacity={0.7}>
                <Ionicons name="home-outline" size={22} color="#1a1a1a" />
                <Text style={styles.quickActionText}>Home</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickAction} activeOpacity={0.7}>
                <Ionicons name="briefcase-outline" size={22} color="#1a1a1a" />
                <Text style={styles.quickActionText}>Work</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickAction} activeOpacity={0.7}>
                <Ionicons name="airplane-outline" size={22} color="#1a1a1a" />
                <Text style={styles.quickActionText}>Airport</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom spacing for tab bar */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    paddingTop: Platform.OS === "ios" ? 60 : 48,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: "#F8F9FA",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a1a",
    letterSpacing: -0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  searchCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  inputDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(26, 26, 26, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  inputDotDestination: {
    backgroundColor: "rgba(26, 26, 26, 0.08)",
  },
  dotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1a1a1a",
  },
  dotInnerDestination: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: "#1a1a1a",
  },
  inputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#1a1a1a",
    paddingVertical: 14,
  },
  locationButton: {
    padding: 6,
  },
  connectorContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 11,
    marginVertical: 4,
  },
  connectorLine: {
    width: 2,
    height: 24,
    backgroundColor: "rgba(26, 26, 26, 0.1)",
    borderRadius: 1,
  },
  swapButton: {
    marginLeft: "auto",
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F8F9FA",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionsContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.05)",
    paddingTop: 12,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  suggestionText: {
    fontSize: 15,
    color: "#1a1a1a",
  },
  searchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 20,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
    letterSpacing: 0.2,
  },
  recentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  recentRoute: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  recentFrom: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  recentArrow: {
    marginHorizontal: 8,
  },
  recentTo: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  recentTime: {
    fontSize: 13,
    color: "#999",
  },
  quickActionsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  quickAction: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
    marginTop: 8,
  },
  bottomSpacer: {
    height: 120,
  },
});

export default SearchScreen;