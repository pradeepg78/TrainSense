import { useEffect, useState } from "react";
import { apiService, TrainLocation } from "../services/api";

export interface TrackedTrain {
  tripId: string;
  routeId: string;
}

// MTA feeds refresh roughly every 30s, so polling faster gains nothing
const POLL_INTERVAL_MS = 30000;

// Polls the backend for a train's live position while one is selected
export function useTrainTracking(selected: TrackedTrain | null) {
  const [train, setTrain] = useState<TrainLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTrain(null);
    setError(null);
    if (!selected) return;

    let cancelled = false;

    const fetchTrain = async (isFirst: boolean) => {
      if (isFirst) setLoading(true);
      const response = await apiService.getTrainLocation(selected.tripId, selected.routeId);
      if (cancelled) return;

      if (response.success && response.data) {
        setTrain(response.data);
        setError(null);
      } else {
        setError(response.error || "Couldn't find this train");
      }
      setLoading(false);
    };

    fetchTrain(true);
    const interval = setInterval(() => fetchTrain(false), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selected?.tripId, selected?.routeId]);

  return { train, loading, error };
}
