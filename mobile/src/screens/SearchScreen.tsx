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
      {/* Search Form */}
      <View style={styles.searchContainer}>
        <Text style={styles.sectionTitle}>Plan Your Trip</Text>

        {/* From Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="location"
              size={20}
              color="#0066CC"
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
            >
              <Ionicons name="locate" size={18} color="#0066CC" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Swap Button */}
        <TouchableOpacity
          style={styles.swapButton}
          onPress={handleSwapLocations}
        >
          <Ionicons name="swap-vertical" size={24} color="#0066CC" />
        </TouchableOpacity>

        {/* To Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="flag"
              size={20}
              color="#FF6600"
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
            >
              <Ionicons name="locate" size={18} color="#0066CC" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Button */}
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Ionicons
            name="search"
            size={20}
            color="#FFFFFF"
            style={styles.searchIcon}
          />
          <Text style={styles.searchButtonText}>Find Routes</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Options */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Options</Text>
        <View style={styles.quickOptionsGrid}>
          <TouchableOpacity style={styles.quickOption}>
            <Ionicons name="time" size={24} color="#0066CC" />
            <Text style={styles.quickOptionText}>Fastest Route</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickOption}>
            <Ionicons name="walk" size={24} color="#0066CC" />
            <Text style={styles.quickOptionText}>Least Walking</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickOption}>
            <Ionicons name="cash" size={24} color="#0066CC" />
            <Text style={styles.quickOptionText}>Cheapest</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickOption}>
            <Ionicons name="accessibility" size={24} color="#0066CC" />
            <Text style={styles.quickOptionText}>Accessible</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Searches */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Searches</Text>
        {recentSearches.map(
          (
            search,
            index //here, we use search
          ) => (
            <TouchableOpacity
              key={index}
              style={styles.recentSearchCard}
              onPress={() => handleRecentSearch(search)}
            >
              <View style={styles.recentSearchContent}>
                <View style={styles.recentSearchRoute}>
                  <Text style={styles.recentSearchFrom}>{search.from}</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color="#666"
                    style={styles.arrowIcon}
                  />
                  <Text style={styles.recentSearchTo}>{search.to}</Text>
                </View>
                <Text style={styles.recentSearchTime}>{search.time}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CCC" />
            </TouchableOpacity>
          )
        )}
      </View>

      {/* Popular Destinations */}
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
    backgroundColor: "#FFFFFF",
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  locationButton: {
    padding: 5,
  },
  swapButton: {
    alignSelf: "center",
    padding: 10,
    marginVertical: 5,
  },
  searchButton: {
    backgroundColor: "#0066CC",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  quickOptionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  quickOption: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
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
  quickOptionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    marginTop: 8,
    textAlign: "center",
  },
  recentSearchCard: {
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recentSearchContent: {
    flex: 1,
  },
  recentSearchRoute: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  recentSearchFrom: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  arrowIcon: {
    marginHorizontal: 8,
  },
  recentSearchTo: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  recentSearchTime: {
    fontSize: 12,
    color: "#999",
  },
  popularGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
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
