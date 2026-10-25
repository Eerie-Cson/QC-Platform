// hooks/useDailyStats.ts
import { useCallback, useEffect, useState } from "react";

const API_BASE = "http://localhost:5000";

export interface DailyStatDay {
  date: string;
  count: number;
  /** Net footage added by manual edits for this day (may be negative). */
  added?: number;
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
        `${API_BASE}/api/stats/daily?${params.toString()}`,
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

  /**
   * Set the footage total for one day (today or any past date).
   * `added` is the running net of manual changes for that day:
   * previous `added` + (new count - old count).
   *
   * ASSUMED endpoint: PUT /api/stats/daily/:date  with body { count, added, tz }.
   * ASSUMED GET response: each day may include `added`.
   * Adjust the URL/body here if your backend differs.
   */
  const saveDay = useCallback(
    async (date: string, count: number): Promise<{ success: boolean }> => {
      const current = stats?.days.find((d) => d.date === date);
      const added = (current?.added ?? 0) + (count - (current?.count ?? 0));

      try {
        const res = await fetch(`${API_BASE}/api/stats/daily/${date}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count, added, tz }),
        });
        if (!res.ok) throw new Error("Failed to save daily count");

        // Update locally so the UI responds instantly...
        setStats((prev) => {
          if (!prev) return prev;
          const nextDays = prev.days.map((d) =>
            d.date === date ? { ...d, count, added } : d,
          );
          return {
            ...prev,
            days: nextDays,
            totalInRange: nextDays.reduce((sum, d) => sum + d.count, 0),
            today: date === prev.endDate ? count : prev.today,
          };
        });
        // ...then reconcile with the server's numbers.
        void fetchStats();
        return { success: true };
      } catch {
        return { success: false };
      }
    },
    [stats, tz, fetchStats],
  );

  return { stats, loading, error, refetch: fetchStats, saveDay };
}
