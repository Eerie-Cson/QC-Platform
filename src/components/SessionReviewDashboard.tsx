import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Star,
  Play,
  SquarePen,
  Circle,
  CheckCircle2,
  AlertTriangle,
  Copy,
  UserPlus,
  Zap,
  LocateFixed,
  XCircle,
} from "lucide-react";
import { SessionRow, Ratings } from "../utilities/types";
import { FONT_DISPLAY, FONT_UI, FONT_DATA } from "../utilities/constants";
import { DailyTracker } from "./DailyTracker";
import {
  formatTimestamp,
  isRatingEmpty,
  isRatingComplete,
} from "../utilities/utils";
import { useSessions } from "../hooks/useSessions";
import { useToast } from "../hooks/useToast";
import { useHoverSummary } from "../hooks/useHoverSummary";
import { useReviewingSession } from "../hooks/useReviewingSession";
import { RatingSummaryCard } from "./RatingSummaryCard";
import { RatingModal } from "./RatingModal";
import { SessionFilters } from "./SessionFilters";
import { TaskSearchInput } from "./TaskSearchInput";
import { SessionLink } from "./SessionLink";

const AUTO_NEXT_STORAGE_KEY = "sessionQa.autoNext";

export function SessionReviewDashboard() {
  const {
    filteredRows,
    rows,
    ratings,
    loading,
    reviewedCount,
    submitRating,
    exportCSV,
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
  } = useSessions({
    endpoint: "/api/sessions",
    ratingsEndpoint: "/api/ratings",
    exportEndpoint: "/api/export-csv",
  });

  const { toast, showToast } = useToast();
  const { hoveredRowId, hoverRect, handleRowEnter, handleRowLeave } =
    useHoverSummary();
  const [activeRow, setActiveRow] = useState<
    (SessionRow & { faceVisible?: boolean }) | null
  >(null);
  const { reviewingRowId, setReviewingRowId, handleOpenLink } =
    useReviewingSession();

  const [autoNext, setAutoNext] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AUTO_NEXT_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(AUTO_NEXT_STORAGE_KEY, autoNext ? "1" : "0");
    } catch {}
  }, [autoNext]);

  const findNextUnratedRow = useCallback(
    (currentSessionId: string): SessionRow | undefined => {
      const idx = filteredRows.findIndex(
        (r) => r.sessionId === currentSessionId,
      );
      if (idx === -1) return undefined;

      const isCandidate = (r: SessionRow) =>
        r.sessionId !== currentSessionId &&
        isRatingEmpty(ratings[r.sessionId] || {});

      return (
        filteredRows.slice(idx + 1).find(isCandidate) ??
        filteredRows.slice(0, idx).find(isCandidate)
      );
    },
    [filteredRows, ratings],
  );

  const activeRowIndex = activeRow
    ? filteredRows.findIndex((r) => r.sessionId === activeRow.sessionId)
    : -1;
  const hasPrev = activeRowIndex > 0;
  const hasNext =
    activeRowIndex >= 0 && activeRowIndex < filteredRows.length - 1;

  const handleNavigate = (direction: "prev" | "next") => {
    if (!activeRow) return;
    const targetIndex =
      direction === "prev" ? activeRowIndex - 1 : activeRowIndex + 1;
    if (targetIndex < 0 || targetIndex >= filteredRows.length) return;

    const targetRow = filteredRows[targetIndex];
    setReviewingRowId(targetRow.sessionId);
    setActiveRow(targetRow);

    window.setTimeout(() => {
      const el = findVisibleRowElement(targetRow.sessionId);
      if (!el) return;
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      el.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
      });
    }, 100);
  };

  const handleSubmitRating = async (
    submittedRatings: Ratings,
    systemRating: string,
    faceVisible?: boolean,
  ) => {
    if (!activeRow) return;

    const currentSessionId = activeRow.sessionId;
    const nextRow = autoNext ? findNextUnratedRow(currentSessionId) : undefined;

    if (nextRow) {
      window.postMessage(
        { type: "OPEN_VIDEO_IN_SPLIT", url: nextRow.link },
        "*",
      );
    }

    const result = await submitRating(
      currentSessionId,
      submittedRatings,
      systemRating,
      faceVisible,
    );

    if (!result.success) {
      showToast("Failed to save review");
      return;
    }

    if (nextRow) {
      showToast(`Review saved · next: ${nextRow.email}`);
      setReviewingRowId(nextRow.sessionId);
      setActiveRow(nextRow);

      window.setTimeout(() => {
        const el = findVisibleRowElement(nextRow.sessionId);
        if (!el) return;
        const prefersReducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        el.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "center",
        });
      }, 100);
    } else {
      showToast(
        autoNext
          ? `Review saved for ${activeRow.email} · all caught up`
          : `Review saved for ${activeRow.email}`,
      );
      setActiveRow(null);
      setReviewingRowId(null);
    }
  };

  const handleDownload = async () => {
    const result = await exportCSV();
    if (!result.success) {
      showToast("Failed to export CSV");
    }
  };

  // ----- Floating Widget Logic -----
  const firstUnratedRow = filteredRows.find((row) =>
    isRatingEmpty(ratings[row.sessionId] || {}),
  );
  const firstUnratedId = firstUnratedRow?.sessionId;

  const [isUnratedVisible, setIsUnratedVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!firstUnratedId) {
      setIsUnratedVisible(false);
      return;
    }

    const timer = setTimeout(() => {
      const el = findVisibleRowElement(firstUnratedId);
      if (!el) {
        setIsUnratedVisible(false);
        return;
      }

      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          setIsUnratedVisible(entry.isIntersecting);
        },
        { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
      );

      observerRef.current.observe(el);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [firstUnratedId, filteredRows]);

  const handleScrollToUnrated = () => {
    if (!firstUnratedRow) return;
    const el = findVisibleRowElement(firstUnratedRow.sessionId);
    if (!el) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    el.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "center",
    });

    if (!prefersReducedMotion) {
      el.animate(
        [
          { backgroundColor: "rgba(37, 99, 235, 0.16)" },
          { backgroundColor: "rgba(37, 99, 235, 0)" },
        ],
        { duration: 1600, easing: "ease-out" },
      );
    }
  };

  const hoveredRating = hoveredRowId ? ratings[hoveredRowId] : undefined;
  const progressPct = rows.length
    ? Math.round((reviewedCount / rows.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#F7F8FA]" style={{ fontFamily: FONT_UI }}>
      <div className="max-w-8xl mx-auto px-4 sm:px-6 py-10 pb-24">
        {/* STICKY HEADER & TRACKER */}
        <div className="sticky top-[56px] z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-7 bg-[#F7F8FA] border-b border-slate-200/50 shadow-[0_4px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 mb-1.5"
                style={{ fontFamily: FONT_UI }}
              >
                Minute · Session QA
              </p>
              <h1
                className="text-[28px] leading-none font-semibold text-slate-900 tracking-tight"
                style={{ fontFamily: FONT_DISPLAY }}
              >
                Session Review Queue
              </h1>
              <div className="flex items-center gap-3 mt-3">
                <div className="w-28 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-700">
                    {reviewedCount}
                  </span>{" "}
                  of {rows.length} reviewed
                </p>
                {hasActiveFilters && (
                  <span className="text-sm text-blue-600">
                    ({filteredRows.length} shown)
                  </span>
                )}
              </div>
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-2 relative self-start sm:self-auto">
              <TaskSearchInput filters={filters} setFilters={setFilters} />
              <SessionFilters
                filters={filters}
                setFilters={setFilters}
                clearFilters={clearFilters}
                hasActiveFilters={hasActiveFilters}
              />
              <button
                type="button"
                onClick={() => setAutoNext((v) => !v)}
                aria-pressed={autoNext}
                title={
                  autoNext
                    ? "Auto-next is on — submitting a review opens the next unrated session"
                    : "Auto-next is off — enable to jump to the next unrated session after submitting"
                }
                className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  autoNext
                    ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Zap size={16} />
                <span className="hidden lg:inline">
                  {autoNext ? "Auto-next on" : "Auto-next"}
                </span>
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:bg-slate-950 transition-colors shadow-sm"
              >
                <Download size={16} />
                <span className="hidden lg:inline">Export QC CSV</span>
                <span className="lg:hidden">Export</span>
              </button>
            </div>
          </div>

          {/* Daily Tracker */}
          <div className="mt-4">
            <DailyTracker days={14} />
          </div>
        </div>

        {/* Table (desktop) */}
        <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-left text-[10.5px] uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3 font-semibold">Device / Email</th>
                <th className="px-5 py-3 font-semibold">Session ID</th>
                <th className="px-5 py-3 font-semibold">Task</th>
                <th className="px-5 py-3 font-semibold">Duration</th>
                <th className="px-5 py-3 font-semibold">Recorded</th>
                <th className="px-5 py-3 font-semibold">Uploaded</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => {
                const rating = ratings[row.sessionId];
                const done = row.submitted === true;
                const failed = row.submitted === false;
                const hasRating =
                  rating !== undefined && !isRatingEmpty(rating);
                const isHighlighted = reviewingRowId === row.sessionId;

                return (
                  <tr
                    key={row.sessionId}
                    data-session-id={row.sessionId}
                    onMouseEnter={(e) => handleRowEnter(row.sessionId, e)}
                    onMouseLeave={handleRowLeave}
                    className={`border-b border-slate-100 last:border-0 transition-colors ${
                      i % 2 === 1 ? "bg-slate-50/40" : ""
                    } ${
                      isHighlighted
                        ? "bg-blue-50/30 hover:bg-blue-50/50"
                        : "hover:bg-slate-50/70"
                    }`}
                  >
                    <td
                      className={`py-4 font-medium text-slate-700 transition-[border-color,padding] ${
                        isHighlighted
                          ? "pl-4 pr-5 border-l-4 border-l-blue-600"
                          : "pl-5 pr-5"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{row.email}</span>

                        {done && (
                          <span title="Successfully submitted by auto-rater">
                            <CheckCircle2
                              size={14}
                              className="text-emerald-500 shrink-0"
                            />
                          </span>
                        )}
                        {failed && (
                          <span title="Auto-rater failed to submit (or not found in queue)">
                            <XCircle
                              size={14}
                              className="text-rose-500 shrink-0"
                            />
                          </span>
                        )}
                      </div>

                      {row.new && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded mt-1"
                          title="This session comes from a newly-created account"
                        >
                          <UserPlus size={11} /> New account
                        </span>
                      )}
                    </td>
                    <td
                      className="px-5 py-4 text-slate-500 text-[13px]"
                      style={{ fontFamily: FONT_DATA }}
                    >
                      {row.sessionId}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <div className="flex items-center gap-2">
                        <span>{row.task}</span>
                        {row.duplicate && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                            title="This sessionId appeared more than once in the QC input"
                          >
                            <Copy size={11} /> Duplicate
                          </span>
                        )}
                      </div>
                    </td>

                    <td
                      className="px-5 py-4 text-slate-600 text-[13px]"
                      style={{ fontFamily: FONT_DATA }}
                    >
                      {row.minutes} min
                    </td>
                    <td
                      className="px-5 py-4 text-slate-500 text-[13px]"
                      style={{ fontFamily: FONT_DATA }}
                    >
                      {formatTimestamp(row.recordedTimestamp)}
                    </td>
                    <td
                      className="px-5 py-4 text-slate-500 text-[13px]"
                      style={{ fontFamily: FONT_DATA }}
                    >
                      {formatTimestamp(row.uploadedTimestamp)}
                    </td>
                    <td className="px-5 py-4">
                      {done ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap">
                          <CheckCircle2 size={13} /> Reviewed
                        </span>
                      ) : failed ? (
                        <span className="inline-flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap">
                          <XCircle size={13} /> Failed
                        </span>
                      ) : hasRating ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap">
                          <AlertTriangle size={13} /> In progress
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap">
                          <Circle size={13} /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                        <SessionLink
                          href={row.link}
                          sessionId={row.sessionId}
                          onOpen={(sessionId, href) => {
                            handleOpenLink(sessionId);
                            window.postMessage(
                              { type: "OPEN_VIDEO_IN_SPLIT", url: href },
                              "*",
                            );
                          }}
                        />
                        <button
                          onClick={() => {
                            setReviewingRowId(row.sessionId);
                            setActiveRow(row);
                          }}
                          className={`inline-flex items-center justify-center gap-1.5 min-w-[120px] px-3 py-2 rounded-lg text-xs font-semibold transition-all border cursor-pointer whitespace-nowrap ${
                            done
                              ? "bg-slate-100 text-blue-500 hover:bg-blue-50 hover:text-blue-700 border-slate-300 hover:border-blue-300"
                              : hasRating
                                ? "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-blue-600 border-slate-300"
                                : "bg-blue-600 text-white hover:bg-blue-700 border-transparent shadow-sm shadow-blue-600/20"
                          }`}
                        >
                          {done ? (
                            <SquarePen size={13} />
                          ) : hasRating ? (
                            <Play size={13} />
                          ) : (
                            <Star size={13} />
                          )}
                          {done
                            ? "Edit review"
                            : hasRating
                              ? "Update draft"
                              : "Rate video"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-12 text-center text-slate-400 text-sm"
                  >
                    No sessions match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden space-y-3">
          {filteredRows.map((row) => {
            const rating = ratings[row.sessionId];
            const done = row.submitted === true;
            const failed = row.submitted === false;
            const hasRating = rating !== undefined && !isRatingEmpty(rating);
            const isHighlighted = reviewingRowId === row.sessionId;
            return (
              <div
                key={row.sessionId}
                data-session-id={row.sessionId}
                onMouseEnter={(e) => handleRowEnter(row.sessionId, e)}
                onMouseLeave={handleRowLeave}
                className={`bg-white rounded-xl border p-4 shadow-sm transition-all ${
                  isHighlighted
                    ? "border-l-4 border-l-blue-600 bg-blue-50/30 border-slate-200"
                    : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-slate-800 text-sm truncate">
                        {row.email}
                      </p>

                      {done && (
                        <CheckCircle2
                          size={13}
                          className="text-emerald-500 shrink-0"
                        />
                      )}
                      {failed && (
                        <XCircle size={13} className="text-rose-500 shrink-0" />
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-slate-500 text-sm">{row.task}</p>
                      {row.new && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded"
                          title="This session comes from a newly-created account"
                        >
                          <UserPlus size={10} /> New
                        </span>
                      )}
                      {row.duplicate && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                          title="This sessionId appeared more than once in the QC input"
                        >
                          <Copy size={10} /> Duplicate
                        </span>
                      )}
                    </div>
                    <p
                      className="text-slate-400 text-[11px] mt-1 truncate"
                      style={{ fontFamily: FONT_DATA }}
                    >
                      {row.sessionId}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {done ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full text-[11px] font-medium">
                        <CheckCircle2 size={12} /> Reviewed
                      </span>
                    ) : failed ? (
                      <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-full text-[11px] font-medium">
                        <XCircle size={12} /> Failed
                      </span>
                    ) : hasRating ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full text-[11px] font-medium">
                        <AlertTriangle size={12} /> In progress
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-full text-[11px] font-medium">
                        <Circle size={12} /> Pending
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100"
                  style={{ fontFamily: FONT_DATA }}
                >
                  <span
                    className="text-slate-400"
                    style={{ fontFamily: FONT_UI }}
                  >
                    Duration
                  </span>
                  <span className="text-right text-slate-600">
                    {row.minutes} min
                  </span>
                  <span
                    className="text-slate-400"
                    style={{ fontFamily: FONT_UI }}
                  >
                    Recorded
                  </span>
                  <span
                    className="text-right text-slate-600 truncate"
                    title={row.recordedTimestamp}
                  >
                    {formatTimestamp(row.recordedTimestamp)}
                  </span>
                  <span
                    className="text-slate-400"
                    style={{ fontFamily: FONT_UI }}
                  >
                    Uploaded
                  </span>
                  <span
                    className="text-right text-slate-600 truncate"
                    title={row.uploadedTimestamp}
                  >
                    {formatTimestamp(row.uploadedTimestamp)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <SessionLink
                    href={row.link}
                    sessionId={row.sessionId}
                    onOpen={(sessionId, href) => {
                      handleOpenLink(sessionId);
                      window.postMessage(
                        { type: "OPEN_VIDEO_IN_SPLIT", url: href },
                        "*",
                      );
                    }}
                    fullWidth={true}
                  />
                  <button
                    onClick={() => {
                      setReviewingRowId(row.sessionId);
                      setActiveRow(row);
                    }}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 min-w-[120px] px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                      done
                        ? "bg-slate-100 text-blue-600 hover:bg-blue-50 hover:text-blue-700 border-slate-300 hover:border-blue-300"
                        : hasRating
                          ? "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-blue-600 border-slate-300"
                          : "bg-blue-600 text-white hover:bg-blue-700 border-transparent shadow-sm shadow-blue-600/20"
                    }`}
                  >
                    {done ? (
                      <SquarePen size={13} />
                    ) : hasRating ? (
                      <Play size={13} />
                    ) : (
                      <Star size={13} />
                    )}{" "}
                    {done
                      ? "Edit review"
                      : hasRating
                        ? "Update draft"
                        : "Rate video"}
                  </button>
                </div>
              </div>
            );
          })}
          {filteredRows.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-sm">
              No sessions match the current filters.
            </div>
          )}
        </div>
      </div>

      {/* Hover summary */}
      {hoveredRowId && hoverRect && hoveredRating && (
        <div
          style={{
            position: "fixed",
            top: hoverRect.top,
            left: hoverRect.left + hoverRect.width / 2,
            transform: "translate(-50%, calc(-100% - 6px))",
          }}
          className="z-30"
        >
          <RatingSummaryCard
            rating={hoveredRating}
            systemRating={
              rows.find((r) => r.sessionId === hoveredRowId)?.systemRating || ""
            }
          />
        </div>
      )}

      {/* Floating Widget */}
      {firstUnratedRow && !isUnratedVisible && (
        <div className="fixed bottom-6 right-6 z-40 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <button
            onClick={handleScrollToUnrated}
            className="flex items-center gap-2 px-4 py-3 rounded-full bg-blue-600 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            <LocateFixed size={18} />
            <span className="pr-1">Jump to Unrated</span>
          </button>
        </div>
      )}

      {/* Modal */}
      {activeRow && (
        <RatingModal
          key={activeRow.sessionId}
          row={activeRow}
          initial={ratings[activeRow.sessionId]}
          onClose={() => {
            setActiveRow(null);
            setReviewingRowId(null);
          }}
          onSubmit={handleSubmitRating}
          mode="review"
          autoNext={autoNext}
          setAutoNext={setAutoNext}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onNavigate={handleNavigate}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg z-50"
          style={{ fontFamily: FONT_UI }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function findVisibleRowElement(sessionId: string): HTMLElement | null {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>("[data-session-id]"),
  ).filter((el) => el.dataset.sessionId === sessionId);

  return nodes.find((el) => el.offsetParent !== null) ?? nodes[0] ?? null;
}
