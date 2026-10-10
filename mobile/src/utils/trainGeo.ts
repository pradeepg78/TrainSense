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

// [southwest, northeast] around the train and its next few stops
export const trainBounds = (train: TrainLocation): [[number, number], [number, number]] => {
  const points = [train.position, ...train.upcoming_stops.slice(0, 4)];
  if (train.previous_stop) points.push(train.previous_stop);
  const lngs = points.map((p) => p.longitude);
  const lats = points.map((p) => p.latitude);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
};
