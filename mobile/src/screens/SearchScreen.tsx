import { Ionicons } from "@expo/vector-icons"; //icons like emojis
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// services
import { apiService, showApiError, Stop, TripPlan } from "../services/api";

const SearchScreen = () => {
  const [fromLocation, setFromLocation] = useState(""); //variable fromLocation default is empty, use setFromLocation to change
  const [toLocation, setToLocation] = useState(""); //variable toLocation default is empty string, use setToLocation to change
  const [searchResults, setSearchResults] = useState<Stop[]>([]); //variable searchResults hold results from backendsearch, empty array bc backend not implemented yet
  const [recentSearches, setRecentSearches] = useState([
    //same, recentSearches variable, use setRecentSearches to change; default is just a bunch of defaullt places
    { from: "Times Square", to: "Brooklyn Bridge", time: "2 hours ago" },
    { from: "Central Park", to: "JFK Airport", time: "Yesterday" },
    { from: "Wall Street", to: "Yankee Stadium", time: "2 days ago" },
  ]);
  const [loading, setLoading] = useState(false);
  const [stops, setStops] = useState<Stop[]>([]);

  // Load stops on component mount
  useEffect(() => {
    loadStops();
  }, []);

  const loadStops = async () => {
    setLoading(true);
    try {
      const response = await apiService.getStops(); // Load all stops
      if (response.success && response.data) {
        setStops(response.data);
      } else {
        showApiError(response.error || "Failed to load stops");
      }
    } catch (error) {
      console.error("Error loading stops:", error);
      showApiError("Failed to load stops");
    } finally {
      setLoading(false);
    }
  };

  //search function
  const handleSearch = async () => {
    //triggered when user presses "Find Routes"
    if (!fromLocation || !toLocation) {
      //if either input is blank, throws an error
      Alert.alert("Error", "Please enter both origin and destination");
      return;
    }

    // Find stop IDs for the locations
    const fromStop = stops.find((stop) =>
      stop.name.toLowerCase().includes(fromLocation.toLowerCase())
    );
    const toStop = stops.find((stop) =>
      stop.name.toLowerCase().includes(toLocation.toLowerCase())
    );

    if (!fromStop || !toStop) {
      Alert.alert(
        "Error",
        "Could not find the specified stations. Please check the station names."
      );
      return;
    }

    // Call the backend API for trip planning
    try {
      const response = await apiService.planTrip(fromStop.id, toStop.id);
      if (response.success && response.data) {
        const trip: TripPlan = response.data;

        // Show trip plan in an alert
        const routeDetails =
          trip.routes.length > 0
            ? trip.routes
                .map(
                  (routeInfo, index) =>
                    `${index + 1}. Take ${routeInfo.route.short_name} line (${
                      routeInfo.type
                    })`
                )
                .join("\n")
            : "No direct route found";

        Alert.alert(
          "Trip Plan",
          `From: ${trip.origin.name}\nTo: ${trip.destination.name}\n\nEstimated Time: ${trip.estimated_time}\nTransfers: ${trip.transfers}\n\n${routeDetails}`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Start Navigation",
              onPress: () => {
                // In a real app, this would start turn-by-turn navigation
                Alert.alert(
                  "Navigation",
                  "Turn-by-turn navigation coming soon!"
                );
              },
            },
          ]
        );
      } else {
        showApiError(response.error || "Failed to plan trip");
      }
    } catch (error) {
      console.error("Error planning trip:", error);
      showApiError("Failed to plan trip");
    }
  };

  //swaps the to, from inputs
  const handleSwapLocations = () => {
    const temp = fromLocation;
    setFromLocation(toLocation); //example of using the const variables in searchScreen in the beginning to change values
    setToLocation(temp);
  };

  //pretend current location button, doesnt work
  const handleCurrentLocation = (field: "from" | "to") => {
    // BACKEND TODO: get user's current location
    const location = "Current Location";
    if (field === "from") {
      setFromLocation(location);
    } else {
      setToLocation(location);
    }
  };

  //fills the inputs in with values from a recent trip, when the user taps
  const handleRecentSearch = (search: any) => {
    //search is an object for when we loop through the recentSearches array using a map down below
    setFromLocation(search.from); //recentSearches has a .from and .to attribute
    setToLocation(search.to);
  };

  const handleStopSelect = (stop: Stop, field: "from" | "to") => {
    if (field === "from") {
      setFromLocation(stop.name);
    } else {
      setToLocation(stop.name);
    }
  };

  const renderStopItem = ({ item }: { item: Stop }) => (
    <TouchableOpacity
      style={styles.stopItem}
      onPress={() => handleStopSelect(item, "to")}
      activeOpacity={0.7}
    >
      <Ionicons name="train" size={20} color="#2193b0" />
      <View style={styles.stopInfo}>
        <Text style={styles.stopName}>{item.name}</Text>
        <Text style={styles.stopId}>ID: {item.id}</Text>
        {item.routes && item.routes.length > 0 && (
          <Text style={styles.stopRoutes}>
            Routes: {item.routes.map((route) => route.short_name).join(", ")}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Search Form - modern card with shadow and color */}
      <View style={styles.searchContainer}>
        <Text style={styles.sectionTitle}>Plan Your Trip</Text>

        {/* From Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="location"
              size={20}
              color="#2193b0"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.textInput}
              placeholder="From where?"
              value={fromLocation}
              onChangeText={setFromLocation}
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              onPress={() => handleCurrentLocation("from")}
              style={styles.locationButton}
              activeOpacity={0.7}
            >
              <Ionicons name="locate" size={18} color="#2193b0" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Swap Button */}
        <TouchableOpacity
          style={styles.swapButton}
          onPress={handleSwapLocations}
          activeOpacity={0.7}
        >
          <Ionicons name="swap-vertical" size={24} color="#2193b0" />
        </TouchableOpacity>

        {/* To Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="flag"
              size={20}
              color="#FF6B6B"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.textInput}
              placeholder="To where?"
              value={toLocation}
              onChangeText={setToLocation}
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              onPress={() => handleCurrentLocation("to")}
              style={styles.locationButton}
              activeOpacity={0.7}
            >
              <Ionicons name="locate" size={18} color="#2193b0" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Button - modern color and shadow */}
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearch}
          activeOpacity={0.85}
        >
          <Ionicons
            name="search"
            size={20}
            color="#FFFFFF"
            style={styles.searchIcon}
          />
          <Text style={styles.searchButtonText}>Find Routes</Text>
        </TouchableOpacity>
      </View>

      {/* Available Stops */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Stops</Text>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Ionicons name="refresh" size={24} color="#B0BEC5" />
            <Text style={styles.loadingText}>Loading stops...</Text>
          </View>
        ) : stops.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="train-outline" size={48} color="#B0BEC5" />
            <Text style={styles.emptyStateText}>No stops available</Text>
            <Text style={styles.emptyStateSubtext}>
              Check your connection and try again
            </Text>
          </View>
        ) : (
          <FlatList
            data={stops.slice(0, 20)} // Show first 20 stops
            renderItem={renderStopItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            style={styles.stopsList}
          />
        )}
      </View>

      {/* Quick Options - modern grid, more color and spacing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Options</Text>
        <View style={styles.quickOptionsGrid}>
          <TouchableOpacity style={styles.quickOption} activeOpacity={0.8}>
            <Ionicons name="time" size={24} color="#2193b0" />
            <Text style={styles.quickOptionText}>Fastest Route</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickOption} activeOpacity={0.8}>
            <Ionicons name="walk" size={24} color="#2193b0" />
            <Text style={styles.quickOptionText}>Least Walking</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickOption} activeOpacity={0.8}>
            <Ionicons name="cash" size={24} color="#2193b0" />
            <Text style={styles.quickOptionText}>Cheapest</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickOption} activeOpacity={0.8}>
            <Ionicons name="accessibility" size={24} color="#2193b0" />
            <Text style={styles.quickOptionText}>Accessible</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Searches - card-based, with modern color and spacing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Searches</Text>
        {recentSearches.map((search, index) => (
          <TouchableOpacity
            key={index}
            style={styles.recentSearchCard}
            onPress={() => handleRecentSearch(search)}
            activeOpacity={0.8}
          >
            <View style={styles.recentSearchContent}>
              <View style={styles.recentSearchRoute}>
                <Text style={styles.recentSearchFrom}>{search.from}</Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color="#90A4AE"
                  style={styles.arrowIcon}
                />
                <Text style={styles.recentSearchTo}>{search.to}</Text>
              </View>
              <Text style={styles.recentSearchTime}>{search.time}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#B0BEC5" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Extra bottom padding for scrollable content */}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  searchContainer: {
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 18,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#2193b0",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2193b0",
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  inputContainer: {
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F8FF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#2193b0",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    paddingVertical: 4,
  },
  locationButton: {
    marginLeft: 8,
    padding: 4,
    borderRadius: 8,
    backgroundColor: "#E3F2FD",
  },
  swapButton: {
    alignSelf: "center",
    marginVertical: 6,
    backgroundColor: "#E3F2FD",
    borderRadius: 16,
    padding: 6,
    shadowColor: "#2193b0",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  searchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2193b0",
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 10,
    shadowColor: "#2193b0",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.2,
  },
  section: {
    marginHorizontal: 18,
    marginBottom: 18,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#2193b0",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  quickOptionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 10,
  },
  quickOption: {
    width: "47%",
    backgroundColor: "#F1F8FF",
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 18,
    marginBottom: 12,
    shadowColor: "#2193b0",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  quickOptionText: {
    marginTop: 8,
    fontSize: 15,
    color: "#2193b0",
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  recentSearchCard: {
    backgroundColor: "#F1F8FF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#2193b0",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  recentSearchContent: {
    flex: 1,
  },
  recentSearchRoute: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  recentSearchFrom: {
    fontSize: 15,
    color: "#2193b0",
    fontWeight: "bold",
  },
  arrowIcon: {
    marginHorizontal: 6,
  },
  recentSearchTo: {
    fontSize: 15,
    color: "#FF6B6B",
    fontWeight: "bold",
  },
  recentSearchTime: {
    fontSize: 13,
    color: "#90A4AE",
  },
  stopsList: {
    marginTop: 10,
  },
  stopItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  stopInfo: {
    flex: 1,
    marginLeft: 10,
  },
  stopName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2193b0",
  },
  stopId: {
    fontSize: 14,
    color: "#90A4AE",
  },
  stopRoutes: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#2193b0",
    marginTop: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 18,
    color: "#2193b0",
    marginBottom: 10,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#90A4AE",
  },
  bottomPadding: {
    height: 20,
  },
});

export default SearchScreen;
