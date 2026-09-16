import { useEffect, useState } from 'react';

export function usePolling(enabled, callback, intervalMs = 2500) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const id = setInterval(() => {
      setTick((value) => value + 1);
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    callback();
    return undefined;
  }, [tick, enabled, callback]);
}
