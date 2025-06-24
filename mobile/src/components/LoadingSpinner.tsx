import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

interface LoadingSpinnerProps {
  message?: string;
  size?: "small" | "large";
  color?: "string";
}

// =====================
// LoadingSpinner - visually enhanced and heavily commented
// =====================
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = "Loading...",
  size = "large",
  color = "#2193b0", // modern blue
}) => {
  return (
    <View style={styles.container}>
      {/* ActivityIndicator with modern color */}
      <ActivityIndicator size={size} color={color} />
      {/* Optional loading message */}
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F8F9FA",
  },
  message: {
    marginTop: 18,
    fontSize: 16,
    color: "#2193b0",
    textAlign: "center",
    fontWeight: "500",
    letterSpacing: 0.2,
  },
});

export default LoadingSpinner;
