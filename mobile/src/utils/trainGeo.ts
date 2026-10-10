// GeoJSON + bounds helpers for drawing a tracked train on the map
import { TrainLocation } from "../services/api";

export const trainToPathGeoJSON = (train: TrainLocation | null) =>
  train && train.path.length > 1
    ? {
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: train.path.map((p) => [p.longitude, p.latitude]),
        },
        properties: {},
      }
    : null;

export const trainToPositionGeoJSON = (train: TrainLocation | null) =>
  train
    ? {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [train.position.longitude, train.position.latitude],
        },
        properties: {},
      }
    : null;

type LatLng = { latitude: number; longitude: number };

// [southwest, northeast] around the train, its next few stops, and any extra
// points that should stay in view (e.g. the station the user tapped)
export const trainBounds = (
  train: TrainLocation,
  extra: LatLng[] = []
): [[number, number], [number, number]] => {
  const points: LatLng[] = [train.position, ...train.upcoming_stops.slice(0, 4), ...extra];
  if (train.previous_stop) points.push(train.previous_stop);
  const lngs = points.map((p) => p.longitude);
  const lats = points.map((p) => p.latitude);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
};

// GTFS route ids that are drawn under a different `service` in subway-lines.json
const LINE_SERVICE_ALIASES: { [routeId: string]: string } = {
  "6X": "6",
  "7X": "7",
  FX: "F",
  SI: "SIR",
  FS: "SF",
  GS: "ST",
  H: "SR",
};

export const lineServiceForRoute = (routeId: string) => LINE_SERVICE_ALIASES[routeId] || routeId;

// Station route lists use the base letter (e.g. "6", not "6X")
export const stationRouteForRoute = (routeId: string) => routeId.replace(/X$/, "");
