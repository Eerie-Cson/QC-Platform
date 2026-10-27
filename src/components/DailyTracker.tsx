import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { CalendarDays, Check, ChevronDown, Minus, Plus, X } from "lucide-react";
import { FONT_DISPLAY, FONT_UI, FONT_DATA } from "../utilities/constants";
import { useDailyStats } from "../hooks/useDailyStats";
import type { DailyStatDay } from "../hooks/useDailyStats";

const OPEN_STORAGE_KEY = "sessionQa.trackerOpen";
const MAX_COUNT = 9999;
const HISTORY_DAYS = 60; // days shown in "View all dates"

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface DailyTrackerProps {
  days?: number;
  tz?: string;
  /** Bump after a rating save so the numbers refresh. */
  refreshKey?: number;
}

function loadOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

// "YYYY-MM-DD" -> local Date (avoids the UTC off-by-one of new Date(iso))
function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function clampCount(n: number): number {
  return Math.min(MAX_COUNT, Math.max(0, n));
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

function AddedBadge({ added }: { added: number }) {
  if (added === 0) return null;
  return (
    <span
      className={`text-[10.5px] font-semibold leading-none px-1.5 py-1 rounded border ${
        added > 0
          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
          : "text-amber-700 bg-amber-50 border-amber-200"
      }`}
      style={{ fontFamily: FONT_DATA }}
    >
      {signed(added)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* View all dates                                                      */
/* ------------------------------------------------------------------ */

function HistoryRow({
  day,
  isToday,
  onSave,
}: {
  day: DailyStatDay;
  isToday: boolean;
  onSave: (date: string, count: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const n = Number.parseInt(draft, 10);
  const valid = Number.isFinite(n) && n >= 0 && n <= MAX_COUNT;
  const canSave = valid && n !== day.count && !saving;

  const label = parseDate(day.date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const start = () => {
    setDraft(String(day.count));
    setFailed(false);
    setEditing(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    const ok = await onSave(day.date, n);
    setSaving(false);
    if (ok) setEditing(false);
    else setFailed(true);
  };

  return (
    <li className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-100 last:border-0">
      <div className="w-32 shrink-0 flex items-center gap-2 text-sm text-slate-700">
        {label}
        {isToday && (
          <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
            Today
          </span>
        )}
      </div>

      {editing ? (
        <form
          onSubmit={submit}
          className="flex-1 flex items-center justify-end gap-2"
        >
          {failed && (
            <span className="text-xs text-red-600">Couldn't save</span>
          )}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_COUNT}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setFailed(false);
            }}
            aria-label={`Footage QC'd on ${label}`}
            autoFocus
            className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            style={{ fontFamily: FONT_DATA }}
          />
          <button
            type="submit"
            disabled={!canSave}
            className="cursor-pointer px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="cursor-pointer px-2 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <div className="flex-1 flex items-center gap-2">
            <span
              className={`text-base font-semibold ${
                day.count ? "text-slate-800" : "text-slate-300"
              }`}
              style={{ fontFamily: FONT_DATA }}
            >
              {day.count || "–"}
            </span>
            <AddedBadge added={day.added ?? 0} />
          </div>
          <button
            type="button"
            onClick={start}
            className="cursor-pointer px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50"
          >
            Edit
          </button>
        </>
      )}
    </li>
  );
}

function AllDatesModal({
  tz,
  onClose,
}: {
  tz?: string;
  onClose: (changed: boolean) => void;
}) {
  const { stats, loading, error, refetch, saveDay } = useDailyStats({
    days: HISTORY_DAYS,
    tz,
  });
  const changed = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(changed.current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = useMemo(
    () =>
      stats ? [...stats.days].sort((a, b) => b.date.localeCompare(a.date)) : [],
    [stats],
  );

  const handleSave = async (date: string, count: number) => {
    const result = await saveDay(date, count);
    if (result.success) changed.current = true;
    return result.success;
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose(changed.current);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="all-dates-title"
        className="w-full max-w-lg max-h-[80vh] flex flex-col bg-white rounded-2xl shadow-xl border border-slate-200"
        style={{ fontFamily: FONT_UI }}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100">
          <div>
            <h2
              id="all-dates-title"
              className="text-[15px] font-semibold text-slate-900"
              style={{ fontFamily: FONT_DISPLAY }}
            >
              All dates
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Last {HISTORY_DAYS} days. Edit any day's total.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose(changed.current)}
            aria-label="Close"
            className="cursor-pointer p-1.5 -mr-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto">
          {!stats && loading && (
            <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>
          )}
          {!stats && error && (
            <p className="px-5 py-6 text-sm text-slate-500">
              Couldn't load dates.{" "}
              <button
                type="button"
                onClick={() => refetch()}
                className="font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2"
              >
                Retry
              </button>
            </p>
          )}
          {stats && (
            <ul>
              {rows.map((day) => (
                <HistoryRow
                  key={day.date}
                  day={day}
                  isToday={day.date === stats.endDate}
                  onSave={handleSave}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tracker                                                             */
/* ------------------------------------------------------------------ */

export function DailyTracker({ days = 14, tz, refreshKey }: DailyTrackerProps) {
  const { stats, loading, error, refetch, saveDay } = useDailyStats({
    days,
    tz,
    refreshKey,
  });

  const [open, setOpen] = useState<boolean>(loadOpen);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  // null = not editing, show the saved value
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const statusTimer = useRef<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_STORAGE_KEY, open ? "1" : "0");
    } catch {}
  }, [open]);

  useEffect(() => {
    return () => {
      if (statusTimer.current !== null)
        window.clearTimeout(statusTimer.current);
    };
  }, []);

  const series = useMemo(
    () =>
      stats ? [...stats.days].sort((a, b) => a.date.localeCompare(b.date)) : [],
    [stats],
  );
  const visible = series; // every day in the `days` range

  const rangeTotal = visible.reduce((sum, d) => sum + d.count, 0);
  // Average over days that actually had footage, so empty days don't drag it down.
  const activeDayCount = visible.filter((d) => d.count > 0).length;
  const avgPerActiveDay = activeDayCount
    ? Math.round(rangeTotal / activeDayCount)
    : 0;
  const hasAdjustments = visible.some((d) => (d.added ?? 0) !== 0);

  const todayDate = stats?.endDate ?? null;
  const activeDate = selected ?? todayDate;
  const activeDay = series.find((d) => d.date === activeDate);
  const savedCount = activeDay?.count ?? 0;
  const savedAdded = activeDay?.added ?? 0;

  const shown = draft ?? String(savedCount);
  const parsed = Number.parseInt(shown, 10);
  const valid = Number.isFinite(parsed) && parsed >= 0 && parsed <= MAX_COUNT;
  const delta = valid ? parsed - savedCount : 0;
  const canSave =
    activeDate !== null &&
    draft !== null &&
    valid &&
    delta !== 0 &&
    status !== "saving";

  const selectDay = (date: string) => {
    setSelected(date);
    setDraft(null);
    setStatus("idle");
  };

  const step = (by: number) => {
    const base = valid ? parsed : savedCount;
    setDraft(String(clampCount(base + by)));
    setStatus("idle");
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave || activeDate === null) return;

    setStatus("saving");
    const result = await saveDay(activeDate, parsed);
    if (!result.success) {
      setStatus("error");
      return;
    }
    setDraft(null);
    setStatus("saved");
    if (statusTimer.current !== null) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus("idle"), 2000);
  };

  const activeLabel = activeDate
    ? parseDate(activeDate).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";
  const activeIsToday = activeDate !== null && activeDate === todayDate;

  const renderStatus = () => {
    if (status === "saved")
      return (
        <span className="inline-flex items-center gap-1 text-emerald-700">
          <Check size={13} /> Saved
        </span>
      );
    if (status === "error")
      return <span className="text-red-600">Couldn't save. Try again.</span>;
    if (draft !== null && !valid)
      return (
        <span className="text-slate-500">
          Enter a whole number from 0 to {MAX_COUNT}.
        </span>
      );
    if (draft !== null && delta !== 0)
      return (
        <span className={delta > 0 ? "text-emerald-700" : "text-amber-700"}>
          <span className="font-semibold" style={{ fontFamily: FONT_DATA }}>
            {signed(delta)}
          </span>{" "}
          from {savedCount}
        </span>
      );
    if (savedAdded !== 0)
      return (
        <span className="text-slate-500">
          Added manually:{" "}
          <span
            className="font-semibold text-slate-700"
            style={{ fontFamily: FONT_DATA }}
          >
            {signed(savedAdded)}
          </span>
        </span>
      );
    return null;
  };

  return (
    <section
      className="bg-white rounded-2xl border border-slate-200 shadow-sm"
      style={{ fontFamily: FONT_UI }}
    >
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="daily-tracker-body"
        className="cursor-pointer w-full flex items-center justify-between gap-4 px-5 py-3.5 text-left rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40"
      >
        <div className="flex items-baseline gap-3 min-w-0">
          <h2
            className="text-[15px] font-semibold text-slate-900 tracking-tight"
            style={{ fontFamily: FONT_DISPLAY }}
          >
            Daily QC
          </h2>
          {stats && (
            <p className="text-sm text-slate-500 truncate">
              <span
                className="font-semibold text-slate-800"
                style={{ fontFamily: FONT_DATA }}
              >
                {stats.today}
              </span>{" "}
              today
              {!open && (
                <>
                  <span className="mx-2 text-slate-300">|</span>
                  <span
                    className="font-semibold text-slate-800"
                    style={{ fontFamily: FONT_DATA }}
                  >
                    {stats.totalInRange}
                  </span>{" "}
                  in {days} days
                </>
              )}
            </p>
          )}
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Body */}
      {open && (
        <div
          id="daily-tracker-body"
          className="px-5 pb-5 pt-5 border-t border-slate-100"
        >
          {!stats && loading && (
            <p className="text-sm text-slate-400">Loading…</p>
          )}

          {!stats && error && (
            <p className="text-sm text-slate-500">
              Couldn't load daily stats.{" "}
              <button
                type="button"
                onClick={() => refetch()}
                className="font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2"
              >
                Retry
              </button>
            </p>
          )}

          {stats && activeDate && (
            <div className="grid gap-y-6 lg:grid-cols-[288px_minmax(0,1fr)] xl:grid-cols-[288px_minmax(0,1fr)_260px]">
              {/* Editor */}
              <form onSubmit={handleSave} className="lg:pr-6">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-sm font-semibold text-slate-800">
                    {activeLabel}
                  </p>
                  {activeIsToday && (
                    <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                      Today
                    </span>
                  )}
                </div>

                <label
                  htmlFor="daily-tracker-count"
                  className="block text-xs text-slate-500 mb-1.5"
                >
                  Footage QC'd
                </label>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-blue-600/30 focus-within:border-blue-400">
                    <button
                      type="button"
                      onClick={() => step(-1)}
                      disabled={valid ? parsed <= 0 : savedCount <= 0}
                      aria-label="Decrease"
                      className="cursor-pointer p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-l-lg disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      id="daily-tracker-count"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_COUNT}
                      step={1}
                      value={shown}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        setStatus("idle");
                      }}
                      className="w-14 py-2 text-center text-sm font-semibold text-slate-900 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      style={{ fontFamily: FONT_DATA }}
                    />
                    <button
                      type="button"
                      onClick={() => step(1)}
                      disabled={valid ? parsed >= MAX_COUNT : false}
                      aria-label="Increase"
                      className="cursor-pointer p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-r-lg disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={!canSave}
                    className="cursor-pointer px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm shadow-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:bg-blue-600"
                  >
                    {status === "saving" ? "Saving…" : "Save"}
                  </button>
                </div>

                <p
                  className="min-h-5 mt-2 text-xs"
                  role="status"
                  aria-live="polite"
                >
                  {renderStatus()}
                </p>
              </form>

              {/* Recent days */}
              <div className="lg:border-l lg:border-slate-100 lg:px-6 flex flex-col justify-center">
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {visible.map((day) => {
                    const date = parseDate(day.date);
                    const isSelected = day.date === activeDate;
                    const isToday = day.date === todayDate;
                    const added = day.added ?? 0;
                    const full = date.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    });
                    const label = isToday
                      ? "Today"
                      : `${date.toLocaleDateString(undefined, {
                          weekday: "short",
                        })} ${date.getDate()}`;

                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => selectDay(day.date)}
                        aria-pressed={isSelected}
                        aria-label={`${full}: ${day.count} footage QC'd${
                          added !== 0 ? `, ${signed(added)} added manually` : ""
                        }`}
                        title={full}
                        className={`cursor-pointer flex flex-col gap-1.5 rounded-lg border px-2.5 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 ${
                          isSelected
                            ? "bg-blue-50 border-blue-300"
                            : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <span
                          className={`text-[11px] leading-none ${
                            isToday
                              ? "font-semibold text-blue-600"
                              : "text-slate-400"
                          }`}
                        >
                          {label}
                        </span>
                        <span className="flex items-center justify-between gap-1">
                          <span
                            className={`text-lg leading-none font-semibold ${
                              isSelected
                                ? "text-blue-700"
                                : day.count
                                  ? "text-slate-800"
                                  : "text-slate-300"
                            }`}
                            style={{ fontFamily: FONT_DATA }}
                          >
                            {day.count || "–"}
                          </span>
                          <AddedBadge added={added} />
                        </span>
                      </button>
                    );
                  })}
                </div>

                {hasAdjustments && (
                  <p className="mt-3 text-xs text-slate-400">
                    Badges show footage added or removed manually.
                  </p>
                )}
              </div>

              {/* Summary + view all */}
              <div className="pt-5 border-t border-slate-100 lg:col-span-2 xl:col-span-1 xl:pt-0 xl:border-t-0 xl:border-l xl:pl-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-stretch xl:justify-center">
                <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm xl:flex-col xl:flex-nowrap xl:gap-y-2.5">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-slate-500">
                      Last {visible.length} days
                    </dt>
                    <dd
                      className="font-semibold text-slate-900"
                      style={{ fontFamily: FONT_DATA }}
                    >
                      {rangeTotal}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-slate-500">Avg per active day</dt>
                    <dd
                      className="font-semibold text-slate-900"
                      style={{ fontFamily: FONT_DATA }}
                    >
                      {avgPerActiveDay}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="cursor-pointer inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40"
                >
                  <CalendarDays size={15} />
                  View all dates
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {historyOpen && (
        <AllDatesModal
          tz={tz}
          onClose={(changed) => {
            setHistoryOpen(false);
            if (changed) refetch();
          }}
        />
      )}
    </section>
  );
}
