import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  History,
  Minus,
  Plus,
  X,
} from "lucide-react";
import { FONT_DISPLAY, FONT_UI, FONT_DATA } from "../utilities/constants";
import { useDailyStats, useDayHistory } from "../hooks/useDailyStats";
import type { DailyStatDay } from "../hooks/useDailyStats";

const OPEN_STORAGE_KEY = "sessionQa.trackerOpen";
const MAX_COUNT = 9999;
const HISTORY_DAYS = 60;

type SaveStatus = "idle" | "saving" | "saved" | "error";
type EntryMode = "set" | "add";

interface DailyTrackerProps {
  days?: number;
  tz?: string;
  refreshKey?: number;
}

function loadOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

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
      className={`text-[10px] font-semibold leading-none px-1.5 py-1 rounded border ${
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
/* Segmented Set / Add toggle                                          */
/* ------------------------------------------------------------------ */

function ModeToggle({
  mode,
  onChange,
  size = "md",
}: {
  mode: EntryMode;
  onChange: (next: EntryMode) => void;
  size?: "sm" | "md";
}) {
  const isSet = mode === "set";
  const isCompact = size === "sm";

  // Scaled down to match the h-8 input box
  const baseBtn = isCompact
    ? "h-[22px] px-2 rounded text-[10px] font-medium"
    : "h-[26px] px-3 rounded text-[11px] font-medium";
  const active = "bg-blue-50 text-blue-700 shadow-sm";
  const idle = "text-slate-500 hover:text-slate-800";

  return (
    <div
      role="radiogroup"
      aria-label="Entry mode"
      className={`inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 ${
        isCompact ? "h-7" : "h-8"
      }`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={isSet}
        onClick={() => onChange("set")}
        className={`cursor-pointer transition-colors flex items-center justify-center ${baseBtn} ${
          isSet ? active : idle
        }`}
      >
        Set
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={!isSet}
        onClick={() => onChange("add")}
        className={`cursor-pointer transition-colors flex items-center justify-center ${baseBtn} ${
          !isSet ? active : idle
        }`}
      >
        Add
      </button>
    </div>
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
  const [mode, setMode] = useState<EntryMode>("set");
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const isSetMode = mode === "set";
  const shown = draft ?? (isSetMode ? String(day.count) : "");
  const parsed = Number.parseInt(shown, 10);
  const target = isSetMode
    ? Number.isFinite(parsed)
      ? parsed
      : day.count
    : day.count + (Number.isFinite(parsed) ? parsed : 0);
  const valid = Number.isFinite(parsed) && parsed >= 0 && target <= MAX_COUNT;
  const canSave = valid && target !== day.count && !saving;

  const label = parseDate(day.date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const switchMode = (next: EntryMode) => {
    if (next === mode) return;
    setMode(next);
    setDraft(null);
    setFailed(false);
  };

  const step = (by: number) => {
    let base = 0;
    if (isSetMode) {
      base = valid ? parsed : day.count;
    } else {
      base = valid ? parsed : 0;
    }
    const next = clampCount(base + by);
    setDraft(next === 0 && !isSetMode ? "" : String(next));
    setFailed(false);
  };

  const start = () => {
    setDraft(null);
    setMode("set");
    setFailed(false);
    setEditing(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    const ok = await onSave(day.date, target);
    setSaving(false);
    if (ok) {
      setEditing(false);
      setDraft(null);
    } else setFailed(true);
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
          className="flex-1 flex items-center justify-end gap-1.5"
        >
          {failed && (
            <span className="text-xs text-red-600">Couldn't save</span>
          )}
          <div className="flex items-center h-7 rounded-lg border border-slate-200 bg-white px-0.5">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={isSetMode ? parsed <= 0 : !draft || parsed <= 0}
              className="cursor-pointer p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Minus size={12} />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_COUNT}
              value={shown}
              placeholder={isSetMode ? undefined : "0"}
              onChange={(e) => {
                setDraft(e.target.value);
                setFailed(false);
              }}
              aria-label={`Footage QC'd on ${label}`}
              autoFocus
              className="w-10 h-full text-center text-xs font-semibold text-slate-900 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              style={{ fontFamily: FONT_DATA }}
            />
            <button
              type="button"
              onClick={() => step(1)}
              disabled={isSetMode ? parsed >= MAX_COUNT : target >= MAX_COUNT}
              className="cursor-pointer p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Plus size={12} />
            </button>
          </div>
          <ModeToggle mode={mode} onChange={switchMode} size="sm" />
          <button
            type="submit"
            disabled={!canSave}
            className="cursor-pointer px-2.5 h-7 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="cursor-pointer px-2 h-7 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <div className="flex-1 flex items-center gap-2">
            <span
              className={`text-sm font-semibold ${
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
            className="cursor-pointer px-2.5 py-1 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50"
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
/* Day history                                                         */
/* ------------------------------------------------------------------ */

function DayHistoryModal({
  date,
  tz,
  onClose,
}: {
  date: string;
  tz?: string;
  onClose: () => void;
}) {
  const { history, loading, error, refetch } = useDayHistory({ date, tz });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const label = parseDate(date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-history-title"
        className="w-full max-w-lg max-h-[80vh] flex flex-col bg-white rounded-2xl shadow-xl border border-slate-200"
        style={{ fontFamily: FONT_UI }}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100">
          <div>
            <h2
              id="day-history-title"
              className="text-[15px] font-semibold text-slate-900"
              style={{ fontFamily: FONT_DISPLAY }}
            >
              {label}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              How this day's total was calculated
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer p-1.5 -mr-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto">
          {!history && loading && (
            <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>
          )}
          {!history && error && (
            <p className="px-5 py-6 text-sm text-slate-500">
              Couldn't load history.{" "}
              <button
                type="button"
                onClick={() => refetch()}
                className="font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2"
              >
                Retry
              </button>
            </p>
          )}

          {history && (
            <div className="px-5 py-4 space-y-4">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-slate-600">
                    Auto-submitted ({history.submissions.length}{" "}
                    {history.submissions.length === 1 ? "session" : "sessions"})
                  </span>
                  <span
                    className="font-semibold text-slate-900"
                    style={{ fontFamily: FONT_DATA }}
                  >
                    {history.autoCount}
                  </span>
                </div>
                {history.added !== 0 && (
                  <div className="flex items-baseline justify-between gap-3 text-sm mt-1.5">
                    <span className="text-slate-600">Manual adjustment</span>
                    <span
                      className={`font-semibold ${
                        history.added > 0
                          ? "text-emerald-700"
                          : "text-amber-700"
                      }`}
                      style={{ fontFamily: FONT_DATA }}
                    >
                      {signed(history.added)}
                    </span>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-3 text-sm mt-2 pt-2 border-t border-slate-200">
                  <span className="font-medium text-slate-800">
                    Final total
                  </span>
                  <span
                    className="text-lg font-semibold text-slate-900"
                    style={{ fontFamily: FONT_DATA }}
                  >
                    {history.finalCount}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Submissions
                </h3>
                {history.submissions.length === 0 ? (
                  <p className="text-sm text-slate-400 italic py-2">
                    No individual submissions recorded for this day.
                    {history.finalCount > 0 && (
                      <> The total comes entirely from manual adjustment.</>
                    )}
                  </p>
                ) : (
                  <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {history.submissions.map((s) => (
                      <li key={s.sessionId} className="px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm text-slate-800 truncate">
                              {s.email || "(unknown email)"}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {s.task || "—"}
                              {s.minutes ? ` · ${s.minutes} min` : ""}
                            </p>
                            <p
                              className="text-[10.5px] text-slate-400 mt-0.5 truncate"
                              style={{ fontFamily: FONT_DATA }}
                            >
                              {s.sessionId}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p
                              className="text-[11px] text-slate-500"
                              style={{ fontFamily: FONT_DATA }}
                            >
                              {new Date(s.completedAt).toLocaleTimeString(
                                undefined,
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </p>
                            {s.source && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {s.source}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="text-[11px] text-slate-400">
                Times shown in your local timezone · day boundary uses{" "}
                {history.timezone}
              </p>
            </div>
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
  const [historyDate, setHistoryDate] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const [mode, setMode] = useState<EntryMode>("set");
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
  const visible = series;

  const rangeTotal = visible.reduce((sum, d) => sum + d.count, 0);
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

  const isSetMode = mode === "set";
  const shown = draft ?? (isSetMode ? String(savedCount) : "");
  const parsed = Number.parseInt(shown, 10);

  const targetCount = isSetMode
    ? Number.isFinite(parsed)
      ? parsed
      : savedCount
    : savedCount + (Number.isFinite(parsed) ? parsed : 0);

  const valid =
    Number.isFinite(parsed) && parsed >= 0 && targetCount <= MAX_COUNT;
  const delta = targetCount - savedCount;
  const canSave =
    activeDate !== null &&
    draft !== null &&
    valid &&
    delta !== 0 &&
    status !== "saving";

  const selectDay = (date: string) => {
    setSelected(date);
    setDraft(null);
    setMode("set");
    setStatus("idle");
  };

  const switchMode = (next: EntryMode) => {
    if (next === mode) return;
    setMode(next);
    setDraft(null);
    setStatus("idle");
  };

  const step = (by: number) => {
    let base = 0;
    if (isSetMode) {
      base = valid ? parsed : savedCount;
    } else {
      base = valid ? parsed : 0;
    }
    const next = clampCount(base + by);
    setDraft(next === 0 && !isSetMode ? "" : String(next));
    setStatus("idle");
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave || activeDate === null) return;

    setStatus("saving");
    const result = await saveDay(activeDate, clampCount(targetCount));
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
          {isSetMode
            ? `Enter a whole number from 0 to ${MAX_COUNT}.`
            : `Enter an amount up to ${MAX_COUNT - savedCount}.`}
        </span>
      );
    if (draft !== null && delta !== 0)
      return (
        <span className="text-blue-600 font-medium">
          Will be <span className="font-semibold">{targetCount}</span> (
          {signed(delta)})
        </span>
      );
    return (
      <span>
        Currently{" "}
        <span className="font-semibold text-slate-800">{savedCount}</span> QC'd
        today
        {savedAdded !== 0 && (
          <span className="ml-2 text-slate-400">
            • {signed(savedAdded)} manually
          </span>
        )}
      </span>
    );
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
          className="px-5 pb-5 pt-4 border-t border-slate-100"
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
            <div className="flex flex-col gap-5">
              {/* Top Row: Editor & Calendar */}
              <div className="grid gap-6 lg:grid-cols-[minmax(280px,1fr)_minmax(0,2.5fr)] items-start">
                {/* Left Column: Form */}
                <div className="flex flex-col gap-3 lg:pr-6 lg:border-r lg:border-slate-100">
                  {/* Editor Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] font-semibold text-slate-900">
                        {activeLabel}
                      </p>
                      {activeIsToday && (
                        <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          Today
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => activeDate && setHistoryDate(activeDate)}
                      title="See how this total was calculated"
                      className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      <History size={14} />
                      History
                    </button>
                  </div>

                  {/* Form Controls - Highly compact */}
                  <form onSubmit={handleSave} className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Stepper */}
                      <div className="flex items-center h-8 rounded-lg border border-slate-200 bg-white px-0.5">
                        <button
                          type="button"
                          onClick={() => step(-1)}
                          disabled={
                            isSetMode ? parsed <= 0 : !draft || parsed <= 0
                          }
                          className="cursor-pointer p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          id="daily-tracker-count"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={MAX_COUNT}
                          value={shown}
                          placeholder={isSetMode ? undefined : "0"}
                          onChange={(e) => {
                            setDraft(e.target.value);
                            setStatus("idle");
                          }}
                          className="w-12 h-full text-center text-sm font-semibold text-slate-900 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          style={{ fontFamily: FONT_DATA }}
                        />
                        <button
                          type="button"
                          onClick={() => step(1)}
                          disabled={
                            isSetMode
                              ? parsed >= MAX_COUNT
                              : targetCount >= MAX_COUNT
                          }
                          className="cursor-pointer p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <ModeToggle mode={mode} onChange={switchMode} />

                      <button
                        type="submit"
                        disabled={!canSave}
                        className="cursor-pointer px-4 h-8 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm shadow-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:bg-blue-600"
                      >
                        {status === "saving" ? "Saving…" : "Save"}
                      </button>
                    </div>

                    {/* Status Text */}
                    <p
                      className="text-xs text-slate-500 min-h-[18px]"
                      role="status"
                      aria-live="polite"
                    >
                      {renderStatus()}
                    </p>
                  </form>
                </div>

                {/* Right Column: Calendar Grid */}
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-7 gap-1.5">
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
                          onClick={() => {
                            if (isSelected) {
                              setHistoryDate(day.date);
                            } else {
                              selectDay(day.date);
                            }
                          }}
                          aria-pressed={isSelected}
                          aria-label={`${full}: ${day.count} footage QC'd${
                            added !== 0
                              ? `, ${signed(added)} added manually`
                              : ""
                          }`}
                          title={full}
                          className={`cursor-pointer flex flex-col gap-1.5 rounded-lg border px-2 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 ${
                            isSelected
                              ? "bg-blue-50 border-blue-300"
                              : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                          }`}
                        >
                          <span
                            className={`text-[11px] leading-none truncate ${
                              isToday
                                ? "font-semibold text-blue-600"
                                : "text-slate-400"
                            }`}
                          >
                            {label}
                          </span>
                          <span className="flex flex-wrap items-center justify-between gap-1 mt-auto">
                            <span
                              className={`text-base leading-none font-semibold ${
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
                    <p className="text-[11px] text-slate-400">
                      Badges show footage added or removed manually.
                    </p>
                  )}
                </div>
              </div>

              {/* Bottom Row: Stats & View All */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100">
                <dl className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
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
                  <div className="flex items-center gap-2">
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
                  className="cursor-pointer inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40"
                >
                  <CalendarDays size={14} />
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

      {historyDate && (
        <DayHistoryModal
          date={historyDate}
          tz={tz}
          onClose={() => setHistoryDate(null)}
        />
      )}
    </section>
  );
}
