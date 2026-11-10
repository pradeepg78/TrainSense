import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Map, { Layer, MapRef, Marker, Source } from "react-map-gl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { BusPanel } from "../components/BusPanel";
import { BusStopModal } from "../components/BusStopModal";
import { BusToggle } from "../components/BusToggle";
import { StationModal } from "../components/StationModal";
import { TrainPanel } from "../components/TrainPanel";
import { useBusMap, useBusToggle } from "../hooks/useBusMap";
import { TrackedBus, useBusTracking } from "../hooks/useBusTracking";
import { lineBounds, useLineBuses, useLineTrains } from "../hooks/useLineVehicles";
import { TrackedTrain, useTrainTracking } from "../hooks/useTrainTracking";
import { Arrival, Bounds, BusArrival, BusStop, Stop } from "../services/api";
import {
  BUS_COLOR,
  BUS_STOP_MIN_ZOOM,
  busBounds,
  busPathGeoJSON,
} from "../utils/busGeo";
import {
  BUS_HEADING_DATA_URI,
  BUS_HEADING_ID,
  BUS_ICON_DATA_URI,
  BUS_ICON_ID,
} from "../utils/busIcon";
import { getMtaColor } from "../utils/mtaColors";
import {
  lineServiceForRoute,
  lineServicesForStationRoutes,
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

  // Buses
  const [viewBounds, setViewBounds] = useState<Bounds | null>(null);
  const [zoom, setZoom] = useState(12);
  const { showBuses, toggleBuses } = useBusToggle();
  const [selectedBusStop, setSelectedBusStop] = useState<BusStop | null>(null);
  const [trackedBus, setTrackedBus] = useState<TrackedBus | null>(null);
  // Stop the user opened before picking a bus; stays marked on the map
  const [originBusStop, setOriginBusStop] = useState<BusStop | null>(null);
  const { bus, loading: busLoading, error: busError } = useBusTracking(trackedBus);
  const isTracking = !!trackedTrain || !!trackedBus;
  const busMap = useBusMap(showBuses && !isTracking, viewBounds, zoom);
  const [hoveringFeature, setHoveringFeature] = useState(false);

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
    handleStopTracking();
    setOriginStation(selectedStation);
    setShowStationModal(false);
    setSelectedStation(null);
    setTrackedTrain({ tripId: arrival.trip_id, routeId: arrival.route });
  };

  const handleBusPress = (arrival: BusArrival) => {
    handleStopTracking();
    setOriginBusStop(selectedBusStop);
    setSelectedBusStop(null);
    setTrackedBus({ vehicleId: arrival.vehicle_id, route: arrival.route });
  };

  // Only one train or bus is followed at a time
  const handleStopTracking = () => {
    setTrackedTrain(null);
    setOriginStation(null);
    setTrackedBus(null);
    setOriginBusStop(null);
  };

  const updateView = () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    if (!b) return;
    setViewBounds([b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]);
    setZoom(map.getZoom());
  };

  const handleMapLoad = () => {
    const map = mapRef.current?.getMap();
    const addIcon = (id: string, uri: string) => {
      if (!map || map.hasImage(id)) return;
      const img = new window.Image();
      img.onload = () => {
        if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 3 });
      };
      img.src = uri;
    };
    addIcon(BUS_ICON_ID, BUS_ICON_DATA_URI);
    addIcon(BUS_HEADING_ID, BUS_HEADING_DATA_URI);
    updateView();
  };

  const handleZoomToStops = () =>
    mapRef.current?.easeTo({ zoom: BUS_STOP_MIN_ZOOM + 0.5, duration: 500 });

  const trainPathGeoJSON = useMemo(() => trainToPathGeoJSON(train), [train]);
  const busRouteGeoJSON = useMemo(() => busPathGeoJSON(bus), [bus]);

  // Every train / bus on the lines of the station or stop the user opened
  const openStation = showStationModal ? selectedStation : null;
  const stationRouteIds = openStation?.routes?.map((r) => r.id) ?? [];
  const busStopRouteIds = selectedBusStop ? selectedBusStop.routes.map((r) => r.id) : [];
  const lineTrains = useLineTrains(stationRouteIds);
  const lineBuses = useLineBuses(busStopRouteIds);

  // Frame the stop and every vehicle on its lines above the sheet, once per stop
  const framedStop = useRef<string | null>(null);
  useEffect(() => {
    const stop = openStation || selectedBusStop;
    if (!stop) {
      framedStop.current = null;
      return;
    }
    const loaded = openStation ? lineTrains.loaded : lineBuses.loaded;
    const key = `${openStation ? "station" : "bus"}:${stop.id}`;
    if (!loaded || framedStop.current === key) return;
    framedStop.current = key;
    const vehicles = openStation ? lineTrains.trains : lineBuses.buses;
    const [sw, ne] = lineBounds(stop, vehicles);
    mapRef.current?.fitBounds([sw, ne], {
      padding: { top: 70, bottom: Dimensions.get("window").height * 0.52 + 30, left: 50, right: 90 },
      maxZoom: 15,
      duration: 600,
    });
  }, [openStation?.id, selectedBusStop?.id, lineTrains.loaded, lineBuses.loaded]);

  // While tracking, fade every line and station not served by the tracked train
  const trackedService = trackedTrain ? lineServiceForRoute(trackedTrain.routeId) : null;
  const trackedStationRoute = trackedTrain ? stationRouteForRoute(trackedTrain.routeId) : null;
  const openStationServices = openStation ? lineServicesForStationRoutes(stationRouteIds) : null;
  const lineOpacity: any = trackedService
    ? ["case", ["==", ["get", "service"], trackedService], 1, 0.12]
    : openStationServices
    ? ["case", ["in", ["get", "service"], ["literal", openStationServices]], 1, 0.15]
    : trackedBus || selectedBusStop
    ? 0.25
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

  // Frame the bus and its next few stops when following starts
  useEffect(() => {
    if (!bus) return;
    const [sw, ne] = busBounds(bus, originBusStop ? [originBusStop] : []);
    mapRef.current?.fitBounds([sw, ne], {
      padding: { top: 80, bottom: 420, left: 40, right: 90 },
      maxZoom: 16,
      duration: 600,
    });
  }, [bus?.vehicle_id]);

  const handleMapClick = (e: any) => {
    const feature = e.features?.[0];
    if (!feature || feature.geometry?.type !== "Point") return;
    const props = feature.properties || {};

    const layer = feature.layer?.id;
    if (layer === "line-buses-dot" || layer === "line-buses-label") {
      handleStopTracking();
      setOriginBusStop(selectedBusStop);
      setSelectedBusStop(null);
      setTrackedBus({ vehicleId: props.id, route: props.route });
      return;
    }
    if (layer === "line-trains-dot" || layer === "line-trains-label") {
      handleStopTracking();
      setOriginStation(openStation);
      handleCloseModal();
      setTrackedTrain({ tripId: props.trip_id, routeId: props.route });
      return;
    }
    if (layer === "bus-stops-layer") {
      const stop = busMap.getStop(props.id);
      if (stop) {
        handleCloseModal();
        setSelectedBusStop(stop);
      }
      return;
    }

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
    setSelectedBusStop(null);
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
        interactiveLayerIds={[
          "stations-all",
          "bus-stops-layer",
          ...(openStation ? ["line-trains-dot", "line-trains-label"] : []),
          ...(selectedBusStop ? ["line-buses-dot", "line-buses-label"] : []),
        ]}
        onClick={handleMapClick}
        onLoad={handleMapLoad}
        onMoveEnd={updateView}
        onMouseEnter={() => setHoveringFeature(true)}
        onMouseLeave={() => setHoveringFeature(false)}
        cursor={hoveringFeature ? "pointer" : "auto"}
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

        {/* Bus route lines, under the subway so it stays readable */}
        {showBuses && !isTracking && (
          <Source id="bus-routes" type="geojson" data={busMap.routesGeoJSON}>
            <Layer
              id="bus-routes-layer"
              type="line"
              minzoom={BUS_STOP_MIN_ZOOM}
              beforeId={subwayLinesGeoJSON ? "subway-lines-layer" : undefined}
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": BUS_COLOR,
                "line-width": ["interpolate", ["linear"], ["zoom"], 15, 1.5, 18, 3],
                "line-opacity": 0.35,
              }}
            />
            <Layer
              id="bus-routes-label"
              type="symbol"
              minzoom={BUS_STOP_MIN_ZOOM + 0.5}
              layout={{
                "symbol-placement": "line",
                "symbol-spacing": 280,
                "text-field": ["get", "route"],
                "text-size": 10,
                "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
              }}
              paint={{
                "text-color": BUS_COLOR,
                "text-halo-color": "#FFFFFF",
                "text-halo-width": 1.5,
              }}
            />
          </Source>
        )}

        {/* Bus stops (street level only) */}
        {showBuses && !isTracking && (
          <Source id="bus-stops" type="geojson" data={busMap.stopsGeoJSON}>
            <Layer
              id="bus-stops-layer"
              type="circle"
              minzoom={BUS_STOP_MIN_ZOOM}
              paint={{
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 15, 4, 18, 7],
                "circle-color": "#FFFFFF",
                "circle-stroke-color": BUS_COLOR,
                "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 15, 2, 18, 3],
              }}
            />
          </Source>
        )}

        {/* Opened bus stop: its routes, and every bus on them */}
        {selectedBusStop && (
          <Source id="line-bus-routes" type="geojson" data={lineBuses.routesGeoJSON}>
            <Layer
              id="line-bus-routes-layer"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": BUS_COLOR, "line-width": 4, "line-opacity": 0.7 }}
            />
          </Source>
        )}
        {selectedBusStop && (
          <Source id="line-buses" type="geojson" data={lineBuses.geoJSON}>
            <Layer
              id="line-buses-dot"
              type="circle"
              paint={{
                "circle-radius": 7,
                "circle-color": BUS_COLOR,
                "circle-stroke-color": "#FFFFFF",
                "circle-stroke-width": 2,
              }}
            />
            <Layer
              id="line-buses-label"
              type="symbol"
              layout={{
                "text-field": ["get", "route"],
                "text-size": 11,
                "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
                "text-offset": [0, -1.1],
                "text-anchor": "bottom",
              }}
              paint={{
                "text-color": BUS_COLOR,
                "text-halo-color": "#FFFFFF",
                "text-halo-width": 1.5,
              }}
            />
          </Source>
        )}

        {/* Opened station: every train on its lines */}
        {openStation && (
          <Source id="line-trains" type="geojson" data={lineTrains.geoJSON}>
            <Layer
              id="line-trains-dot"
              type="circle"
              paint={{
                "circle-radius": 9,
                "circle-color": ["get", "color"],
                "circle-stroke-color": "#FFFFFF",
                "circle-stroke-width": 2,
              }}
            />
            <Layer
              id="line-trains-label"
              type="symbol"
              layout={{
                "text-field": ["get", "label"],
                "text-size": 10,
                "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
                "text-allow-overlap": true,
                "text-ignore-placement": true,
              }}
              paint={{ "text-color": ["get", "textColor"] }}
            />
          </Source>
        )}

        {/* Station or bus stop the user opened */}
        {(openStation || selectedBusStop) && (
          <Marker
            longitude={(openStation || selectedBusStop)!.longitude}
            latitude={(openStation || selectedBusStop)!.latitude}
            anchor="bottom"
          >
            <View style={{ alignItems: "center" }}>
              <View style={styles.originMarker}>
                <Text style={styles.originMarkerText} numberOfLines={1}>
                  {(openStation || selectedBusStop)!.name}
                </Text>
              </View>
              <View style={styles.originMarkerPin} />
            </View>
          </Marker>
        )}

        {/* Followed bus: its route in this direction */}
        {trackedBus && busRouteGeoJSON && (
          <Source id="bus-route" type="geojson" data={busRouteGeoJSON}>
            <Layer
              id="bus-route-layer"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": BUS_COLOR, "line-width": 5, "line-opacity": 0.8 }}
            />
          </Source>
        )}

        {/* Bus stop the user started from */}
        {trackedBus && originBusStop && (
          <Marker longitude={originBusStop.longitude} latitude={originBusStop.latitude} anchor="bottom">
            <View style={{ alignItems: "center" }}>
              <View style={styles.originMarker}>
                <Text style={styles.originMarkerText} numberOfLines={1}>
                  {originBusStop.name}
                </Text>
              </View>
              <View style={styles.originMarkerPin} />
            </View>
          </Marker>
        )}

        {/* Followed bus's live position */}
        {trackedBus && bus && (
          <Marker longitude={bus.position.longitude} latitude={bus.position.latitude} anchor="center">
            <View style={styles.busMarkerWrap}>
              {bus.bearing != null && (
                <Image
                  source={{ uri: BUS_HEADING_DATA_URI }}
                  style={[styles.busHeading, { transform: [{ rotate: `${bus.bearing}deg` }] }]}
                />
              )}
              <Image source={{ uri: BUS_ICON_DATA_URI }} style={styles.busMarker} />
            </View>
          </Marker>
        )}

        {/* Station the user started from */}
        {trackedTrain && originStation && (
          <Marker
            longitude={originStation.longitude}
            latitude={originStation.latitude}
            anchor="bottom"
          >
            <View style={{ alignItems: "center" }}>
              <View style={styles.originMarker}>
                <Text style={styles.originMarkerText} numberOfLines={1}>
                  {originStation.name}
                </Text>
              </View>
              <View style={styles.originMarkerPin} />
            </View>
          </Marker>
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

      {!isTracking && !openStation && !selectedBusStop && (
        <BusToggle
          on={showBuses}
          onToggle={toggleBuses}
          needsZoom={busMap.needsZoom}
          onZoomToStops={handleZoomToStops}
        />
      )}

      {trackedBus && (
        <BusPanel
          route={trackedBus.route}
          bus={bus}
          loading={busLoading}
          error={busError}
          originStop={originBusStop}
          onClose={handleStopTracking}
        />
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

      <BusStopModal
        visible={!!selectedBusStop}
        stop={selectedBusStop}
        onClose={() => setSelectedBusStop(null)}
        onBusPress={handleBusPress}
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
  // heading image is 96/72 the size of the icon, centered on it
  busMarkerWrap: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  busHeading: { position: "absolute", width: 48, height: 48 },
  busMarker: { width: 36, height: 36 },
  originMarker: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    maxWidth: 180,
  },
  originMarkerText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  originMarkerPin: {
    alignSelf: "center",
    width: 2,
    height: 10,
    backgroundColor: "#1a1a1a",
  },
  stationBadgeText: { fontSize: 13, fontWeight: "600", color: "#3a3a3a", letterSpacing: 0.2 },
});

export default MapScreen;
