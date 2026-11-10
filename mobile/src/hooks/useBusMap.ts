import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiService, Bounds, BusRouteShape, BusStop } from "../services/api";
import {
  BUS_STOP_MIN_ZOOM,
  busRoutesToGeoJSON,
  busStopsToGeoJSON,
} from "../utils/busGeo";

const MAX_CACHED_STOPS = 3000;
// Route lines drawn at once; older ones drop off as you move around the city
const MAX_ROUTE_SHAPES = 60;
const PREF_KEY = "map.showBuses";

// Remembered "Buses" toggle (on by default)
export function useBusToggle() {
  const [showBuses, setShowBuses] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY)
      .then((value) => value !== null && setShowBuses(value === "1"))
      .catch(() => {});
  }, []);

  const toggle = () =>
    setShowBuses((on) => {
      AsyncStorage.setItem(PREF_KEY, on ? "0" : "1").catch(() => {});
      return !on;
    });

  return { showBuses, toggleBuses: toggle };
}

// Loads bus stops and route lines for the visible part of the map. Live buses
// are only shown for the stop the user opens (see useLineBuses).
export function useBusMap(enabled: boolean, bounds: Bounds | null, zoom: number) {
  // Stops never move, so keep every stop we've loaded; panning back is instant
  const stopCache = useRef(new Map<string, BusStop>());
  const [stopsVersion, setStopsVersion] = useState(0);
  // Route shapes never change either; keyed by route id, null while loading
  const shapeCache = useRef(new Map<string, BusRouteShape | null>());
  const [shapesVersion, setShapesVersion] = useState(0);

  const wantStops = enabled && !!bounds && zoom >= BUS_STOP_MIN_ZOOM;
  const boundsKey = bounds ? bounds.map((n) => n.toFixed(3)).join(",") : "";

  useEffect(() => {
    if (!wantStops || !bounds) return;
    let cancelled = false;
    // Small delay so a quick series of pans makes one request
    const timer = setTimeout(async () => {
      const response = await apiService.getBusStops(bounds);
      if (cancelled || !response.success || !response.data) return;
      const cache = stopCache.current;
      response.data.forEach((stop) => cache.set(stop.id, stop));
      if (cache.size > MAX_CACHED_STOPS) {
        Array.from(cache.keys())
          .slice(0, cache.size - MAX_CACHED_STOPS)
          .forEach((id) => cache.delete(id));
      }
      setStopsVersion((v) => v + 1);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wantStops, boundsKey]);

  // Load the line of every route that stops inside the viewport
  useEffect(() => {
    if (!wantStops || !bounds) return;
    const [s, w, n, e] = bounds;
    const routeIds = new Set<string>();
    stopCache.current.forEach((stop) => {
      if (stop.latitude >= s && stop.latitude <= n && stop.longitude >= w && stop.longitude <= e) {
        stop.routes.forEach((r) => routeIds.add(r.id));
      }
    });
    const cache = shapeCache.current;
    const missing = Array.from(routeIds).filter((id) => !cache.has(id));
    if (missing.length === 0) return;

    missing.forEach((id) => cache.set(id, null));
    missing.forEach(async (id) => {
      const response = await apiService.getBusRouteShape(id);
      if (response.success && response.data) {
        cache.set(id, response.data);
      } else {
        cache.delete(id); // try again next time it's in view
      }
      if (cache.size > MAX_ROUTE_SHAPES) {
        Array.from(cache.keys())
          .slice(0, cache.size - MAX_ROUTE_SHAPES)
          .filter((k) => !routeIds.has(k))
          .forEach((k) => cache.delete(k));
      }
      setShapesVersion((v) => v + 1);
    });
  }, [wantStops, boundsKey, stopsVersion]);

  const stopsGeoJSON = useMemo(
    () => busStopsToGeoJSON(Array.from(stopCache.current.values())),
    [stopsVersion]
  );
  const routesGeoJSON = useMemo(
    () =>
      busRoutesToGeoJSON(
        Array.from(shapeCache.current.values()).filter((r): r is BusRouteShape => !!r)
      ),
    [shapesVersion]
  );

  const getStop = (id: string) => stopCache.current.get(id) || null;

  return {
    stopsGeoJSON,
    routesGeoJSON,
    getStop,
    // Buses are on but the map is too far out to show stops yet
    needsZoom: enabled && zoom < BUS_STOP_MIN_ZOOM,
  };
}
