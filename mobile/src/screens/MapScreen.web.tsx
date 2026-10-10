import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Map, { Layer, MapRef, Marker, Source } from "react-map-gl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { StationModal } from "../components/StationModal";
import { TrainPanel } from "../components/TrainPanel";
import { TrackedTrain, useTrainTracking } from "../hooks/useTrainTracking";
import { Arrival, Stop } from "../services/api";
import { getMtaColor } from "../utils/mtaColors";
import {
  lineServiceForRoute,
  originStationGeoJSON,
  stationRouteForRoute,
  trainBounds,
  trainToPathGeoJSON,
} from "../utils/trainGeo";

// Import local subway lines and stops data
import subwayLinesData from "../assets/subway-lines.json";
import subwayStopsData from "../assets/subway-stops.json";

const mapboxToken = Constants.expoConfig?.extra?.mapboxAccessToken as string | undefined;

// Manhattan center location (Times Square area)
const MANHATTAN_CENTER = { latitude: 40.758, longitude: -73.9855 };

// Color map based on route symbol
const COLOR_MAP: { [key: string]: string } = {
  A: "#0039A6",
  B: "#FF6319",
  G: "#6CBE45",
  J: "#996633",
  L: "#A7A9AC",
  N: "#FCCC0A",
  S: "#808183",
  "1": "#EE352E",
  "4": "#00933C",
  "7": "#B933AD",
};

// Get color from route name (e.g., "A-C-E" -> "A" -> blue)
const getLineColor = (name: string): string => {
  if (!name) return "#999999";
  const firstRoute = name.split("-")[0];
  if (COLOR_MAP[firstRoute]) return COLOR_MAP[firstRoute];
  if (["1", "2", "3"].includes(firstRoute)) return COLOR_MAP["1"];
  if (["4", "5", "6"].includes(firstRoute)) return COLOR_MAP["4"];
  if (["7"].includes(firstRoute)) return COLOR_MAP["7"];
  if (["A", "C", "E"].includes(firstRoute)) return COLOR_MAP["A"];
  if (["B", "D", "F", "M"].includes(firstRoute)) return COLOR_MAP["B"];
  if (["N", "Q", "R", "W"].includes(firstRoute)) return COLOR_MAP["N"];
  if (["J", "Z"].includes(firstRoute)) return COLOR_MAP["J"];
  return "#999999";
};

const MapScreen = () => {
  const mapRef = useRef<MapRef>(null);
  const [selectedStation, setSelectedStation] = useState<Stop | null>(null);
  const [showStationModal, setShowStationModal] = useState(false);
  const [subwayLinesGeoJSON, setSubwayLinesGeoJSON] = useState<any>(null);
  const [subwayStopsGeoJSON, setSubwayStopsGeoJSON] = useState<any>(null);
  const [trackedTrain, setTrackedTrain] = useState<TrackedTrain | null>(null);
  // Station the user opened before picking a train; stays marked on the map
  const [originStation, setOriginStation] = useState<Stop | null>(null);
  const { train, loading: trainLoading, error: trainError } = useTrainTracking(trackedTrain);

  // User location stays at Manhattan center (mirrors native behavior)
  const userLocation = MANHATTAN_CENTER;

  // Load subway stops from local JSON file
  useEffect(() => {
    try {
      const stopsData = subwayStopsData as any;
      if (stopsData && stopsData.features) {
        const stopsByComplex: { [key: string]: any } = {};
        stopsData.features.forEach((feature: any) => {
          const complexId =
            feature.properties?.complex_id || feature.properties?.station_id || "unknown";
          if (!stopsByComplex[complexId]) {
            stopsByComplex[complexId] = {
              ...feature,
              properties: {
                ...feature.properties,
                id: complexId,
                name: feature.properties?.stop_name || "Unknown Station",
                gtfs_stop_id:
                  feature.properties?.gtfs_stop_id || feature.properties?.id || complexId,
                routes: feature.properties?.daytime_routes || "",
              },
            };
          } else {
            const existingRoutes = stopsByComplex[complexId].properties.daytime_routes || "";
            const newRoutes = feature.properties?.daytime_routes || "";
            const allRoutes = new Set(
              [...existingRoutes.split(" "), ...newRoutes.split(" ")].filter((r) => r)
            );
            stopsByComplex[complexId].properties.daytime_routes = Array.from(allRoutes).join(" ");
            if (
              !stopsByComplex[complexId].properties.gtfs_stop_id &&
              feature.properties?.gtfs_stop_id
            ) {
              stopsByComplex[complexId].properties.gtfs_stop_id = feature.properties.gtfs_stop_id;
            }
          }
        });

        const features = Object.values(stopsByComplex).map((feature: any) => {
          const routes = (feature.properties?.daytime_routes || "")
            .split(" ")
            .filter((r: string) => r && r.trim());
          const routeCount = new Set(routes).size;
          return {
            ...feature,
            properties: { ...feature.properties, isTransfer: routeCount >= 3, routeCount },
          };
        });

        setSubwayStopsGeoJSON({ type: "FeatureCollection", features });
        console.log("Loaded", features.length, "stations from subway-stops.json");
      }
    } catch (e) {
      console.error("Error loading subway stops from JSON:", e);
    }
  }, []);

  // Load subway lines from local JSON file
  useEffect(() => {
    try {
      const data = subwayLinesData as any;
      if (data && data.features) {
        const coloredFeatures = data.features.map((feature: any) => ({
          ...feature,
          properties: {
            ...feature.properties,
            color: getLineColor(
              feature.properties?.service || feature.properties?.service_name || ""
            ),
          },
        }));
        setSubwayLinesGeoJSON({ type: "FeatureCollection", features: coloredFeatures });
        console.log("Loaded subway lines from local JSON:", coloredFeatures.length, "segments");
      }
    } catch (e) {
      console.error("Error loading subway lines from local JSON:", e);
    }
  }, []);

  const userLocationGeoJSON = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [userLocation.longitude, userLocation.latitude],
          },
          properties: {},
        },
      ],
    }),
    [userLocation.latitude, userLocation.longitude]
  );

  const handleLocationPress = () => {
    mapRef.current?.flyTo({
      center: [MANHATTAN_CENTER.longitude, MANHATTAN_CENTER.latitude],
      zoom: 13,
      duration: 500,
    });
  };

  const handleZoomIn = () => mapRef.current?.zoomIn({ duration: 300 });
  const handleZoomOut = () => mapRef.current?.zoomOut({ duration: 300 });

  const handleCloseModal = () => {
    setShowStationModal(false);
    setSelectedStation(null);
  };

  const handleTrainPress = (arrival: Arrival) => {
    if (!arrival.trip_id) return;
    setOriginStation(selectedStation);
    setShowStationModal(false);
    setSelectedStation(null);
    setTrackedTrain({ tripId: arrival.trip_id, routeId: arrival.route });
  };

  const handleStopTracking = () => {
    setTrackedTrain(null);
    setOriginStation(null);
  };

  const trainPathGeoJSON = useMemo(() => trainToPathGeoJSON(train), [train]);
  const originGeoJSON = useMemo(() => originStationGeoJSON(originStation), [originStation]);

  // While tracking, fade every line and station not served by the tracked train
  const trackedService = trackedTrain ? lineServiceForRoute(trackedTrain.routeId) : null;
  const trackedStationRoute = trackedTrain ? stationRouteForRoute(trackedTrain.routeId) : null;
  const lineOpacity: any = trackedService
    ? ["case", ["==", ["get", "service"], trackedService], 1, 0.12]
    : 1;
  const stationOpacity: any = trackedStationRoute
    ? ["case", ["in", trackedStationRoute, ["coalesce", ["get", "daytime_routes"], ""]], 1, 0.15]
    : 1;

  // Frame the train and its next few stops when tracking starts
  useEffect(() => {
    if (!train) return;
    const [sw, ne] = trainBounds(train, originStation ? [originStation] : []);
    mapRef.current?.fitBounds([sw, ne], {
      padding: { top: 80, bottom: 420, left: 40, right: 90 },
      maxZoom: 15,
      duration: 600,
    });
  }, [train?.trip_id]);

  const handleMapClick = (e: any) => {
    const feature = e.features?.[0];
    if (!feature || feature.geometry?.type !== "Point") return;
    const props = feature.properties || {};
    const coords = feature.geometry.coordinates as [number, number];
    const routes = (props.daytime_routes || "").split(" ").filter((r: string) => r && r.trim());
    const stopId = props.gtfs_stop_id || props.id || props.complex_id || props.station_id || "";

    setSelectedStation({
      id: stopId,
      name: props.name || props.stop_name || "Unknown Station",
      latitude: coords[1],
      longitude: coords[0],
      routes: routes.map((routeId: string) => ({
        id: routeId,
        short_name: routeId,
        long_name: `${routeId} Train`,
        route_color: getLineColor(routeId),
        text_color: "#FFFFFF",
      })),
    });
    setShowStationModal(true);
  };

  if (!mapboxToken) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text>Mapbox access token not found. Add MAPBOX_ACCESS_TOKEN to your .env file.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Map
        ref={mapRef}
        mapLib={mapboxgl as any}
        mapboxAccessToken={mapboxToken}
        initialViewState={{
          longitude: MANHATTAN_CENTER.longitude,
          latitude: MANHATTAN_CENTER.latitude,
          zoom: 12,
        }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={["stations-all"]}
        onClick={handleMapClick}
        cursor="auto"
        attributionControl={false}
      >
        {/* Subway Lines */}
        {subwayLinesGeoJSON && (
          <Source id="subway-lines" type="geojson" data={subwayLinesGeoJSON}>
            <Layer
              id="subway-lines-layer"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": ["get", "color"],
                "line-width": 3,
                "line-opacity": lineOpacity,
              }}
            />
          </Source>
        )}

        {/* Tracked train: remaining track + live position */}
        {trackedTrain && trainPathGeoJSON && (
          <Source id="train-path" type="geojson" data={trainPathGeoJSON}>
            <Layer
              id="train-path-layer"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": getMtaColor(trackedTrain.routeId).background,
                "line-width": 7,
                "line-opacity": 0.85,
              }}
            />
          </Source>
        )}

        {/* Station Markers (only when zoomed in) */}
        {subwayStopsGeoJSON && (
          <Source id="stations" type="geojson" data={subwayStopsGeoJSON}>
            <Layer
              id="stations-all"
              type="circle"
              minzoom={13}
              paint={{
                "circle-radius": 4,
                "circle-color": "#FFFFFF",
                "circle-stroke-color": "#1a1a1a",
                "circle-stroke-width": 1.2,
                "circle-opacity": stationOpacity,
                "circle-stroke-opacity": stationOpacity,
              }}
            />
          </Source>
        )}

        {/* Station the user started from */}
        {trackedTrain && originGeoJSON && (
          <Source id="origin-station" type="geojson" data={originGeoJSON}>
            <Layer
              id="origin-station-dot"
              type="circle"
              paint={{
                "circle-radius": 6,
                "circle-color": "#FFFFFF",
                "circle-stroke-color": "#1a1a1a",
                "circle-stroke-width": 3,
              }}
            />
            <Layer
              id="origin-station-label"
              type="symbol"
              layout={{
                "text-field": ["get", "name"],
                "text-size": 13,
                "text-anchor": "left",
                "text-offset": [0.9, 0],
                "text-allow-overlap": true,
              }}
              paint={{
                "text-color": "#1a1a1a",
                "text-halo-color": "#FFFFFF",
                "text-halo-width": 1.5,
              }}
            />
          </Source>
        )}

        {/* Tracked train's live position */}
        {trackedTrain && train && (
          <Marker
            longitude={train.position.longitude}
            latitude={train.position.latitude}
            anchor="center"
          >
            <View
              style={[
                styles.trainMarker,
                { borderColor: getMtaColor(trackedTrain.routeId).background },
              ]}
            >
              <Text style={styles.trainMarkerEmoji}>🚆</Text>
            </View>
          </Marker>
        )}

        {/* User location dot (rendered last so it's on top) */}
        <Source id="user-location" type="geojson" data={userLocationGeoJSON}>
          <Layer
            id="user-location-outer"
            type="circle"
            paint={{ "circle-radius": 12, "circle-color": "#007AFF", "circle-opacity": 0.25 }}
          />
          <Layer
            id="user-location-middle"
            type="circle"
            paint={{ "circle-radius": 8, "circle-color": "#007AFF", "circle-opacity": 0.5 }}
          />
          <Layer
            id="user-location-inner"
            type="circle"
            paint={{
              "circle-radius": 6,
              "circle-color": "#007AFF",
              "circle-stroke-color": "#FFFFFF",
              "circle-stroke-width": 2,
            }}
          />
        </Source>
      </Map>

      {/* Floating Controls */}
      <View style={styles.controlsContainer} pointerEvents="box-none">
        <TouchableOpacity style={styles.controlButton} onPress={handleLocationPress} activeOpacity={0.8}>
          <Ionicons name="locate" size={22} color="#1a1a1a" />
        </TouchableOpacity>

        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={[styles.controlButton, styles.zoomButton]}
            onPress={handleZoomIn}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="#1a1a1a" />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity
            style={[styles.controlButton, styles.zoomButton]}
            onPress={handleZoomOut}
            activeOpacity={0.8}
          >
            <Ionicons name="remove" size={22} color="#1a1a1a" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Station Count Badge */}
      {subwayStopsGeoJSON && subwayStopsGeoJSON.features.length > 0 && (
        <View style={styles.stationBadge} pointerEvents="none">
          <Text style={styles.stationBadgeText}>
            {subwayStopsGeoJSON.features.length} stations
          </Text>
        </View>
      )}

      {trackedTrain && (
        <TrainPanel
          routeId={trackedTrain.routeId}
          train={train}
          loading={trainLoading}
          error={trainError}
          originStation={originStation}
          onClose={handleStopTracking}
        />
      )}

      <StationModal
        visible={showStationModal}
        onClose={handleCloseModal}
        station={selectedStation}
        onTrainPress={handleTrainPress}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  controlsContainer: {
    position: "absolute",
    right: 16,
    top: Platform.OS === "ios" ? 60 : 40,
    gap: 12,
  },
  controlButton: {
    width: 48,
    height: 48,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  zoomControls: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden",
  },
  zoomButton: { borderRadius: 0, shadowOpacity: 0, elevation: 0 },
  zoomDivider: { height: 1, backgroundColor: "rgba(0, 0, 0, 0.08)", marginHorizontal: 8 },
  stationBadge: {
    position: "absolute",
    bottom: 110,
    left: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  trainMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  trainMarkerEmoji: { fontSize: 20 },
  stationBadgeText: { fontSize: 13, fontWeight: "600", color: "#3a3a3a", letterSpacing: 0.2 },
});

export default MapScreen;
