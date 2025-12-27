import { createStackNavigator } from "@react-navigation/stack";
import React from "react";
import MapScreen from "../screens/MapScreen";
import RouteMapScreen from "../screens/RouteMapScreen";
import RouteScreen from "../screens/RouteScreen";
import SearchScreen from "../screens/SearchScreen";

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Map"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Map" component={MapScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Routes" component={RouteScreen} />
      <Stack.Screen name="RouteMap" component={RouteMapScreen} />
    </Stack.Navigator>
  );
}