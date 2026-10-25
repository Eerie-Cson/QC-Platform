// components/DailyTracker.tsx
import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { FONT_DISPLAY, FONT_UI, FONT_DATA } from "../utilities/constants";
import { useDailyStats } from "../hooks/useDailyStats";

interface DailyTrackerProps {
  days?: number;
  /** Bump to force an immediate refetch. Wire this to reviewedCount. */
  refreshKey?: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "YYYY-MM-DD" -> local Date (avoids the UTC off-by-one of new Date(iso)). */
function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Tile colour by how busy the day was relative to the busiest day. */
function tileClasses(count: number, max: number): string {
  if (count === 0) return "bg-slate-50 text-slate-300";
  const r = count / max;
  if (r <= 0.25) return "bg-blue-50 text-blue-700";
  if (r <= 0.5) return "bg-blue-100 text-blue-800";
  if (r <= 0.75) return "bg-blue-200 text-blue-900";
  return "bg-blue-500 text-white";
}

export function DailyTracker({ days = 14, refreshKey }: DailyTrackerProps) {
  const { stats, loading, error } = useDailyStats({
    days,
    refreshKey,
    autoRefreshMs: 60_000,
  });

  const maxCount = useMemo(
    () => Math.max(1, ...(stats?.days.map((d) => d.count) ?? [0])),
    [stats],
  );

  if (loading && !stats) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-5 text-sm text-rose-700">
        Couldn’t load daily stats: {error}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-5"
      style={{ fontFamily: FONT_UI }}
    >
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h2
            className="text-lg font-semibold text-slate-900"
            style={{ fontFamily: FONT_DISPLAY }}
          >
            Reviews by day
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {stats.totalInRange} in the last {days} days
          </p>
        </div>
        <p className="text-right">
          <span
            className="block text-3xl leading-none font-semibold text-slate-900 tabular-nums"
            style={{ fontFamily: FONT_DISPLAY }}
          >
            {stats.today}
          </span>
          <span className="text-xs text-slate-500">today</span>
        </p>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {stats.days.map((d) => {
          const dt = parseISODate(d.date);
          const isToday = d.date === stats.endDate;
          return (
            <div
              key={d.date}
              title={`${d.date}: ${d.count} rated`}
              className={`rounded-lg px-2 py-2 sm:px-3 flex flex-col items-center justify-between h-[68px] ${tileClasses(
                d.count,
                maxCount,
              )} ${isToday ? "ring-2 ring-offset-2 ring-blue-600" : ""}`}
            >
              <span className="text-[10px] font-medium opacity-70">
                {WEEKDAYS[dt.getDay()]} {dt.getDate()}
              </span>
              <span
                className="text-xl font-semibold tabular-nums leading-none"
                style={{ fontFamily: FONT_DATA }}
              >
                {d.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
