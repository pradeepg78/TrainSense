import 'dotenv/config';

export default {
  expo: {
    name: "train-sense",
    entryPoint: "./App.tsx",
    plugins: [
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        }
      ],
      [
        "@rnmapbox/maps",
        {
          "RNMapboxMapsVersion": "11.13.4"
        }
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission: "Show current location on map."
        }
      ]
    ],
    slug: "train-sense",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "trainsense",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.anonymous.train-sense"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true
    },
    web: {
      bundler: "metro",
      favicon: "./assets/images/favicon.png"
    },
    extra: {
      mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN
    }
  }
};