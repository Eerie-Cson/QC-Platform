// hooks/useDailyStats.ts
import { useCallback, useEffect, useState } from "react";

export interface DailyStatDay {
  date: string;
  count: number;
}

export interface DailyStats {
  timezone: string;
  startDate: string;
  endDate: string;
  days: DailyStatDay[];
  totalInRange: number;
  today: number;
}

interface UseDailyStatsOptions {
  days?: number;
  tz?: string;
  /** Bump this to force an immediate refetch (e.g. after a rating save). */
  refreshKey?: number;
  /** Polling interval in ms. 0 (default) = disabled. */
  autoRefreshMs?: number;
}

export function useDailyStats({
  days = 14,
  tz,
  refreshKey,
  autoRefreshMs = 0,
}: UseDailyStatsOptions = {}) {
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (tz) params.set("tz", tz);
      const res = await fetch(
        `http://localhost:5000/api/stats/daily?${params.toString()}`,
      );
      if (!res.ok) throw new Error("Failed to fetch daily stats");
      setStats((await res.json()) as DailyStats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [days, tz]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refreshKey]);

  useEffect(() => {
    if (!autoRefreshMs) return;
    const id = window.setInterval(fetchStats, autoRefreshMs);
    return () => window.clearInterval(id);
  }, [autoRefreshMs, fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
