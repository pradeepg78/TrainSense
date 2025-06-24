import { Ionicons } from "@expo/vector-icons"; //icons like emojis
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const SearchScreen = () => {
  const [fromLocation, setFromLocation] = useState(""); //variable fromLocation default is empty, use setFromLocation to change
  const [toLocation, setToLocation] = useState(""); //variable toLocation default is empty string, use setToLocation to change
  const [searchResults, setSearchResults] = useState([]); //variable searchResults hold results from backendsearch, empty array bc backend not implemented yet
  const [recentSearches, setRecentSearches] = useState([
    //same, recentSearches variable, use setRecentSearches to change; default is just a bunch of defaullt places
    { from: "Times Square", to: "Brooklyn Bridge", time: "2 hours ago" },
    { from: "Central Park", to: "JFK Airport", time: "Yesterday" },
    { from: "Wall Street", to: "Yankee Stadium", time: "2 days ago" },
  ]);

  //search function
  const handleSearch = () => {
    //triggered when user presses "Find Routes"
    if (!fromLocation || !toLocation) {
      //if either input is blank, throws an error
      Alert.alert("Error", "Please enter both origin and destination");
      return;
    }

    // BACKEND TODO: call the backend API for trip planning
    Alert.alert(
      "Search Results",
      `Planning trip from ${fromLocation} to ${toLocation}...`
    );
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

      {/* Popular Destinations - modern grid, more color and spacing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Popular Destinations</Text>
        <View style={styles.popularGrid}>
          {[
            "🏢 Times Square",
            "🌉 Brooklyn Bridge",
            "✈️ JFK Airport",
            "🏟️ Yankee Stadium",
            "🎭 Broadway",
            "🗽 Statue of Liberty",
          ].map((destination, index) => (
            <TouchableOpacity
              key={index}
              style={styles.popularDestination}
              onPress={() => setToLocation(destination.substring(2))}
            >
              <Text style={styles.popularDestinationText}>{destination}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

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
  popularGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 10,
  },
  popularDestination: {
    width: "48%",
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
  popularDestinationText: {
    fontSize: 14,
    color: "#333",
    textAlign: "center",
  },
  bottomPadding: {
    height: 20,
  },
});

export default SearchScreen;
