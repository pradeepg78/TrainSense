import { useEffect, useState } from "react";
import { apiService, BusLocation } from "../services/api";

export interface TrackedBus {
  vehicleId: string;
  route: string;
}

// Bus Time updates positions about every 30s
const POLL_INTERVAL_MS = 30000;

// Polls the backend for one bus's live position while it's selected
export function useBusTracking(selected: TrackedBus | null) {
  const [bus, setBus] = useState<BusLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBus(null);
    setError(null);
    if (!selected) return;

    let cancelled = false;
    const fetchBus = async (isFirst: boolean) => {
      if (isFirst) setLoading(true);
      const response = await apiService.getBusLocation(selected.vehicleId);
      if (cancelled) return;
      if (response.success && response.data) {
        setBus(response.data);
        setError(null);
      } else {
        setError(response.error || "Couldn't find this bus");
      }
      setLoading(false);
    };

    fetchBus(true);
    const interval = setInterval(() => fetchBus(false), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selected?.vehicleId]);

  return { bus, loading, error };
}
