import { useEffect, useMemo, useState } from "react";
import { apiService, BusRouteShape, BusVehicle, LineTrain } from "../services/api";
import { busRoutesToGeoJSON } from "../utils/busGeo";
import { getMtaColor } from "../utils/mtaColors";

// Feeds refresh about every 30s
const POLL_MS = 30000;

type LatLng = { latitude: number; longitude: number };

// Polls fetch(ids) while ids is non-empty; clears when it empties
function usePolled<T>(ids: string[], fetch: (ids: string[]) => Promise<{ success: boolean; data?: T[] }>) {
  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const key = ids.join(",");

  useEffect(() => {
    setItems([]);
    setLoaded(false);
    if (!key) return;
    let cancelled = false;
    const load = async () => {
      const response = await fetch(ids);
      if (cancelled) return;
      if (response.success && response.data) setItems(response.data);
      setLoaded(true);
    };
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [key]);

  return { items, loaded };
}

// Every train on the lines serving the selected station
export function useLineTrains(routeIds: string[]) {
  const { items: trains, loaded } = usePolled<LineTrain>(routeIds, apiService.getLineTrains);
  const geoJSON = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: trains.map((t) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [t.longitude, t.latitude] },
        properties: {
          kind: "line-train",
          trip_id: t.trip_id,
          route: t.route_id,
          label: t.route_id.replace(/X$/, "").replace(/^SI$/, "SIR"),
          color: getMtaColor(t.route_id).background,
          // Yellow lines need dark text to be readable
          textColor: /^[NQRW]$/.test(t.route_id) ? "#1a1a1a" : "#FFFFFF",
        },
      })),
    }),
    [trains]
  );
  return { trains, geoJSON, loaded };
}

// Every bus on the routes serving the selected stop, plus those routes' lines
export function useLineBuses(routeIds: string[]) {
  const { items: buses, loaded } = usePolled<BusVehicle>(routeIds, apiService.getBusRouteVehicles);
  const [shapes, setShapes] = useState<BusRouteShape[]>([]);
  const key = routeIds.join(",");

  useEffect(() => {
    setShapes([]);
    if (!key) return;
    let cancelled = false;
    Promise.all(routeIds.map((id) => apiService.getBusRouteShape(id))).then((responses) => {
      if (cancelled) return;
      setShapes(responses.filter((r) => r.success && r.data).map((r) => r.data!));
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const geoJSON = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: buses.map((v) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [v.longitude, v.latitude] },
        properties: {
          kind: "line-bus",
          id: v.id,
          route: v.route,
          ...(v.bearing != null ? { bearing: v.bearing } : {}),
        },
      })),
    }),
    [buses]
  );
  const routesGeoJSON = useMemo(() => busRoutesToGeoJSON(shapes), [shapes]);
  return { buses, geoJSON, routesGeoJSON, loaded };
}

// [southwest, northeast] around a stop and the vehicles on its lines
export const lineBounds = (
  center: LatLng,
  vehicles: LatLng[]
): [[number, number], [number, number]] => {
  const points = [center, ...vehicles];
  const lngs = points.map((p) => p.longitude);
  const lats = points.map((p) => p.latitude);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
};
