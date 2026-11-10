// Shared constants + GeoJSON helpers for drawing buses on the map
import { BusLocation, BusRouteShape, BusStop } from "../services/api";

// One color for everything bus-related, distinct from subway line colors and
// from the blue "you are here" dot
export const BUS_COLOR = "#1E3A8A";

// Stops only make sense at street level
export const BUS_STOP_MIN_ZOOM = 15;

export const busStopsToGeoJSON = (stops: BusStop[]) => ({
  type: "FeatureCollection" as const,
  features: stops.map((stop) => ({
    type: "Feature" as const,
    id: stop.id,
    geometry: { type: "Point" as const, coordinates: [stop.longitude, stop.latitude] },
    properties: { kind: "bus-stop", id: stop.id },
  })),
});

export const busRoutesToGeoJSON = (routes: BusRouteShape[]) => ({
  type: "FeatureCollection" as const,
  features: routes
    .filter((r) => r.lines.length > 0)
    .map((r) => ({
      type: "Feature" as const,
      geometry: { type: "MultiLineString" as const, coordinates: r.lines },
      properties: { route: r.short_name },
    })),
});

export const busPathGeoJSON = (bus: BusLocation | null) =>
  bus && bus.path.length > 0
    ? {
        type: "Feature" as const,
        geometry: { type: "MultiLineString" as const, coordinates: bus.path },
        properties: {},
      }
    : null;

type LatLng = { latitude: number; longitude: number };

// [southwest, northeast] around the bus, its next few stops, and extra points
export const busBounds = (
  bus: BusLocation,
  extra: LatLng[] = []
): [[number, number], [number, number]] => {
  const points: LatLng[] = [bus.position, ...extra];
  bus.upcoming_stops.slice(0, 5).forEach((s) => {
    if (s.latitude != null && s.longitude != null) {
      points.push({ latitude: s.latitude, longitude: s.longitude });
    }
  });
  const lngs = points.map((p) => p.longitude);
  const lats = points.map((p) => p.latitude);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
};

// Bus Time stop ids sometimes carry an agency prefix ("MTA_403240")
export const sameBusStop = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.replace(/^MTA_/, "") === b.replace(/^MTA_/, "");
