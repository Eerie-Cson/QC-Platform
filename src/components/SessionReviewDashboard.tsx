import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// Height of the app's top nav. The filter toolbar sticks just beneath it.
const APP_NAV_OFFSET = 56;

export function SessionReviewDashboard() {
  const {
    filteredRows,
    rows,
    ratings,
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

    window.setTimeout(() => scrollRowIntoView(targetRow.sessionId), 100);
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

      window.setTimeout(() => scrollRowIntoView(nextRow.sessionId), 100);
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

  // ----- "Jump to unrated" logic -----
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
    scrollRowIntoView(firstUnratedRow.sessionId, true);
  };

  const hoveredRating = hoveredRowId ? ratings[hoveredRowId] : undefined;

  // ----- Stats & progress -----
  const stats = useMemo(() => {
    let submitted = 0;
    let failed = 0;
    let drafted = 0;
    let pending = 0;

    rows.forEach((row) => {
      const rating = ratings[row.sessionId];
      if (row.submitted === true) submitted++;
      else if (row.submitted === false) failed++;
      else if (rating && !isRatingEmpty(rating)) drafted++;
      else pending++;
    });

    return { total: rows.length, submitted, failed, drafted, pending };
  }, [rows, ratings]);

  const {
    total: totalCount,
    submitted: submittedCount,
    failed: failedCount,
    drafted: draftedCount,
    pending: pendingCount,
  } = stats;

  const handledCount = submittedCount + failedCount + draftedCount;
  const pct = (n: number) => (totalCount ? (n / totalCount) * 100 : 0);
  const handledPct = Math.round(pct(handledCount));

  const progressSegments = [
    {
      key: "submitted",
      label: "Submitted",
      count: submittedCount,
      bar: "bg-emerald-500",
    },
    { key: "failed", label: "Failed", count: failedCount, bar: "bg-rose-500" },
    {
      key: "drafted",
      label: "Drafted",
      count: draftedCount,
      bar: "bg-blue-500",
    },
    {
      key: "pending",
      label: "Pending",
      count: pendingCount,
      bar: "bg-slate-300",
    },
  ];

  const statusTabs = [
    { key: "All", label: "All", count: totalCount },
    { key: "Pending", label: "Pending", count: pendingCount },
    { key: "In progress", label: "Drafted", count: draftedCount },
    { key: "Rated", label: "Submitted", count: submittedCount },
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA]" style={{ fontFamily: FONT_UI }}>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-8 pb-24">
        {/* ───────── PAGE HEADER (scrolls away) ───────── */}
        <header className="flex flex-col gap-6 mb-6">
          {/* Title + actions */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1
                className="text-[26px] leading-tight font-semibold text-slate-900 tracking-tight"
                style={{ fontFamily: FONT_DISPLAY }}
              >
                Session Review Queue
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {pendingCount > 0
                  ? `${pendingCount} of ${totalCount} sessions still to review`
                  : `All ${totalCount} sessions handled`}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                role="switch"
                aria-checked={autoNext}
                onClick={() => setAutoNext((v) => !v)}
                title="After you submit a review, open the next unrated session automatically"
                className="group inline-flex items-center gap-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40"
              >
                <span
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    autoNext ? "bg-blue-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      autoNext ? "translate-x-[18px]" : "translate-x-0.5"
                    }`}
                  />
                </span>
                Auto-next
              </button>

              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white text-slate-700 text-sm font-medium border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40"
              >
                <Download size={15} />
                Export QC CSV
              </button>
            </div>
          </div>

          {/* Progress — one bar, one legend, no card */}
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 mb-2.5">
              <p className="text-sm text-slate-600">
                <span
                  className="font-semibold text-slate-900"
                  style={{ fontFamily: FONT_DATA }}
                >
                  {handledCount}
                </span>{" "}
                of {totalCount} handled
                <span className="text-slate-400"> · {handledPct}%</span>
              </p>

              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                {progressSegments.map((s) => (
                  <li
                    key={s.key}
                    className={`inline-flex items-center gap-1.5 ${
                      s.count === 0 ? "opacity-50" : ""
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${s.bar}`} />
                    {s.label}
                    <span
                      className="text-slate-700 font-medium"
                      style={{ fontFamily: FONT_DATA }}
                    >
                      {s.count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div
              role="progressbar"
              aria-label="Review progress"
              aria-valuemin={0}
              aria-valuemax={totalCount}
              aria-valuenow={handledCount}
              className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden flex"
            >
              {progressSegments
                .filter((s) => s.key !== "pending" && s.count > 0)
                .map((s) => (
                  <div
                    key={s.key}
                    className={`h-full ${s.bar} transition-all duration-300`}
                    style={{ width: `${pct(s.count)}%` }}
                    title={`${s.count} ${s.label}`}
                  />
                ))}
            </div>
          </div>

          {/* Daily tracker — collapsed by default is a single quiet line */}
          <DailyTracker days={14} />
        </header>

        {/* ───────── STICKY TOOLBAR (the only sticky piece) ───────── */}
        <div
          className="sticky z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-4 bg-[#F7F8FA]/90 backdrop-blur-md border-b border-slate-200/70"
          style={{ top: APP_NAV_OFFSET }}
        >
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            {/* Status segmented control */}
            <div
              role="group"
              aria-label="Filter by review status"
              className="inline-flex items-center gap-0.5 p-1 rounded-lg bg-slate-200/60 overflow-x-auto max-w-full scrollbar-hide"
            >
              {statusTabs.map((tab) => {
                const isActive = filters.reviewStatus === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() =>
                      setFilters((f) => ({ ...f, reviewStatus: tab.key }))
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 ${
                      isActive
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`text-xs tabular-nums ${
                        isActive ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search + advanced filters */}
            <div className="flex items-center gap-2 md:ml-auto">
              <div className="flex-1 md:flex-none">
                <TaskSearchInput filters={filters} setFilters={setFilters} />
              </div>
              <SessionFilters
                filters={filters}
                setFilters={setFilters}
                clearFilters={clearFilters}
                hasActiveFilters={hasActiveFilters}
              />
            </div>
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
                const isSubmitted = row.submitted === true;
                const isFailed = row.submitted === false;
                const isRated =
                  rating !== undefined && isRatingComplete(rating);
                const hasRating =
                  rating !== undefined && !isRatingEmpty(rating);
                const isButtonDone = isSubmitted || isRated;
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

                        {isSubmitted && (
                          <span title="Successfully submitted by auto-rater">
                            <CheckCircle2
                              size={14}
                              className="text-emerald-500 shrink-0"
                            />
                          </span>
                        )}
                        {isFailed && (
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
                      {isSubmitted ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap">
                          <CheckCircle2 size={13} /> Reviewed
                        </span>
                      ) : isFailed ? (
                        <span className="inline-flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap">
                          <XCircle size={13} /> Failed
                        </span>
                      ) : isRated ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap">
                          <CheckCircle2 size={13} /> Reviewed
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
                            isButtonDone
                              ? "bg-slate-100 text-blue-500 hover:bg-blue-50 hover:text-blue-700 border-slate-300 hover:border-blue-300"
                              : hasRating
                                ? "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-blue-600 border-slate-300"
                                : "bg-blue-600 text-white hover:bg-blue-700 border-transparent shadow-sm shadow-blue-600/20"
                          }`}
                        >
                          {isButtonDone ? (
                            <SquarePen size={13} />
                          ) : hasRating ? (
                            <Play size={13} />
                          ) : (
                            <Star size={13} />
                          )}
                          {isButtonDone
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
            const isSubmitted = row.submitted === true;
            const isFailed = row.submitted === false;
            const isRated = rating !== undefined && isRatingComplete(rating);
            const hasRating = rating !== undefined && !isRatingEmpty(rating);
            const isButtonDone = isSubmitted || isRated;
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

                      {isSubmitted && (
                        <CheckCircle2
                          size={13}
                          className="text-emerald-500 shrink-0"
                        />
                      )}
                      {isFailed && (
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
                    {isSubmitted ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full text-[11px] font-medium">
                        <CheckCircle2 size={12} /> Reviewed
                      </span>
                    ) : isFailed ? (
                      <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-full text-[11px] font-medium">
                        <XCircle size={12} /> Failed
                      </span>
                    ) : isRated ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full text-[11px] font-medium">
                        <CheckCircle2 size={12} /> Reviewed
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
                      isButtonDone
                        ? "bg-slate-100 text-blue-600 hover:bg-blue-50 hover:text-blue-700 border-slate-300 hover:border-blue-300"
                        : hasRating
                          ? "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-blue-600 border-slate-300"
                          : "bg-blue-600 text-white hover:bg-blue-700 border-transparent shadow-sm shadow-blue-600/20"
                    }`}
                  >
                    {isButtonDone ? (
                      <SquarePen size={13} />
                    ) : hasRating ? (
                      <Play size={13} />
                    ) : (
                      <Star size={13} />
                    )}{" "}
                    {isButtonDone
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

      {/* Floating "Jump to unrated" — only when the next unrated row is off-screen */}
      {firstUnratedRow && !isUnratedVisible && !activeRow && (
        <button
          onClick={handleScrollToUnrated}
          className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 pl-3.5 pr-4 py-2.5 rounded-full bg-blue-600 text-white text-sm font-medium shadow-lg shadow-blue-900/20 hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 focus-visible:ring-offset-2"
        >
          <LocateFixed size={15} />
          Jump to unrated
        </button>
      )}

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
          role="status"
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

/** Scrolls a row to the centre of the viewport, respecting reduced motion. */
function scrollRowIntoView(sessionId: string, flash = false) {
  const el = findVisibleRowElement(sessionId);
  if (!el) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  el.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "center",
  });

  if (flash && !prefersReducedMotion) {
    el.animate(
      [
        { backgroundColor: "rgba(37, 99, 235, 0.16)" },
        { backgroundColor: "rgba(37, 99, 235, 0)" },
      ],
      { duration: 1600, easing: "ease-out" },
    );
  }
}
