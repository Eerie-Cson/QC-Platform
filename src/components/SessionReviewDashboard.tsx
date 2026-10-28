// components/SessionReviewDashboard.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  Send,
  Loader2,
  Terminal,
  Eye,
  RotateCcw,
  ArrowUpDown,
  MoreHorizontal,
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
const APP_NAV_OFFSET = 56;

const shortId = (id: string) =>
  id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;

const STATUS_GROUPS = [
  { key: "failed", label: "Failed" },
  { key: "pending", label: "Pending" },
  { key: "inProgress", label: "In progress" },
  { key: "reviewed", label: "Reviewed" },
  { key: "submitted", label: "Submitted" },
  { key: "resolved", label: "Resolved" },
];
const GROUP_PREVIEW_COUNT = 1;

type DisplayItem =
  | { type: "row"; row: SessionRow; index: number }
  | {
      type: "header";
      key: string;
      label: string;
      count: number;
      expanded: boolean;
      collapsible: boolean;
    };

function getStatusKey(row: SessionRow, rating: Ratings | undefined): string {
  if (row.submitted === true) return "submitted";
  if (row.submitted === false) return row.resolved ? "resolved" : "failed";
  const isDraft = (rating as any)?.isDraft === true;
  if (isDraft) return "inProgress";
  if (rating && isRatingComplete(rating)) return "reviewed";
  if (rating && !isRatingEmpty(rating)) return "inProgress";
  return "pending";
}

function getReason(row: SessionRow): string {
  return ((row as any).reason as string) || "Unknown error";
}

export function SessionReviewDashboard() {
  const {
    filteredRows,
    baseFilteredRows,
    rows,
    ratings,
    submitRating,
    updateReason,
    toggleResolved,
    exportCSV,
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    refetch,
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

  // --- NEW: State to force DailyTracker to refresh ---
  const [dailyRefreshKey, setDailyRefreshKey] = useState(0);
  const bumpDailyStats = useCallback(
    () => setDailyRefreshKey((k) => k + 1),
    [],
  );

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
    isDraft?: boolean,
  ) => {
    if (!activeRow) return;

    const currentSessionId = activeRow.sessionId;
    const nextRow =
      autoNext && !isDraft ? findNextUnratedRow(currentSessionId) : undefined;

    if (nextRow) {
      window.postMessage(
        { type: "OPEN_VIDEO_IN_SPLIT", url: nextRow.link },
        "*",
      );
    }

    const result = await submitRating(
      currentSessionId,
      { ...submittedRatings, isDraft } as Ratings,
      systemRating,
      faceVisible,
    );

    if (!result.success) {
      showToast("Failed to save review");
      return;
    }

    // --- NEW: Bump daily stats if a manual rating was saved ---
    bumpDailyStats();

    if (nextRow) {
      showToast(`Review saved · next: ${nextRow.email}`);
      setReviewingRowId(nextRow.sessionId);
      setActiveRow(nextRow);
      window.setTimeout(() => scrollRowIntoView(nextRow.sessionId), 100);
    } else {
      showToast(
        isDraft
          ? `Draft saved for ${activeRow.email}`
          : autoNext
            ? `Review saved for ${activeRow.email} · all caught up`
            : `Review saved for ${activeRow.email}`,
      );
      setActiveRow(null);
      setReviewingRowId(null);
    }
  };

  const handleToggleResolved = async (row: SessionRow, resolved: boolean) => {
    const result = await toggleResolved(row.sessionId, resolved);
    if (result.success) {
      showToast(
        resolved ? `Marked ${row.email} as resolved` : `Unmarked ${row.email}`,
      );
    } else {
      showToast("Failed to update resolution");
    }
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const resolvableRows = filteredRows.filter(
    (r) => r.submitted === false && r.resolved !== true,
  );
  const selectedRows = resolvableRows.filter((r) =>
    selectedIds.has(r.sessionId),
  );
  const allResolvableSelected =
    resolvableRows.length > 0 && selectedRows.length === resolvableRows.length;

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = () =>
    setSelectedIds(
      allResolvableSelected
        ? new Set()
        : new Set(resolvableRows.map((r) => r.sessionId)),
    );

  const handleBulkResolve = async () => {
    const targets = selectedRows;
    const results = await Promise.all(
      targets.map((r) => toggleResolved(r.sessionId, true)),
    );
    const ok = results.filter((r) => r.success).length;
    showToast(
      ok === targets.length
        ? `Marked ${ok} ${ok === 1 ? "session" : "sessions"} as resolved`
        : `Resolved ${ok} of ${targets.length} · some failed`,
    );
    setSelectedIds(new Set());
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard
      .writeText(id)
      .then(() => showToast("Session ID copied"))
      .catch(() => showToast("Failed to copy session ID"));
  };

  const [commentRow, setCommentRow] = useState<SessionRow | null>(null);

  const handleSaveReason = async (row: SessionRow, reason: string) => {
    const result = await updateReason(row.sessionId, reason);
    if (result.success) {
      showToast(`Reason saved for ${row.email}`);
      setCommentRow(null);
    } else {
      showToast("Failed to save reason");
    }
  };

  const [sortByStatus, setSortByStatus] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(["failed", "pending"]),
  );

  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const displayItems = useMemo<DisplayItem[]>(() => {
    if (!sortByStatus) {
      return filteredRows.map((row, index) => ({
        type: "row" as const,
        row,
        index,
      }));
    }

    const buckets: Record<string, SessionRow[]> = {};
    filteredRows.forEach((row) => {
      const key = getStatusKey(row, ratings[row.sessionId]);
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(row);
    });

    const items: DisplayItem[] = [];
    let index = 0;
    STATUS_GROUPS.forEach((g) => {
      const groupRows = buckets[g.key];
      if (!groupRows || groupRows.length === 0) return;

      const expanded = expandedGroups.has(g.key);
      items.push({
        type: "header",
        key: g.key,
        label: g.label,
        count: groupRows.length,
        expanded,
        collapsible: groupRows.length > GROUP_PREVIEW_COUNT,
      });
      (expanded ? groupRows : groupRows.slice(0, GROUP_PREVIEW_COUNT)).forEach(
        (row) => items.push({ type: "row", row, index: index++ }),
      );
    });
    return items;
  }, [filteredRows, ratings, sortByStatus, expandedGroups]);

  const handleDownload = async () => {
    const result = await exportCSV();
    if (!result.success) {
      showToast("Failed to export CSV");
    }
  };

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

  const stats = useMemo(() => {
    let submitted = 0;
    let failed = 0;
    let resolved = 0;
    let reviewed = 0;
    let inProgress = 0;
    let pending = 0;

    baseFilteredRows.forEach((row) => {
      const rating = ratings[row.sessionId];
      const isDraft = (rating as any)?.isDraft === true;

      if (row.submitted === true) submitted++;
      else if (row.submitted === false) {
        if (row.resolved) resolved++;
        else failed++;
      } else if (isDraft) inProgress++;
      else if (rating && isRatingComplete(rating)) reviewed++;
      else if (rating && !isRatingEmpty(rating)) inProgress++;
      else pending++;
    });

    return {
      total: baseFilteredRows.length,
      submitted,
      failed,
      resolved,
      reviewed,
      inProgress,
      pending,
    };
  }, [baseFilteredRows, ratings]);

  const {
    total: totalCount,
    submitted: submittedCount,
    failed: failedCount,
    resolved: resolvedCount,
    reviewed: reviewedCount,
    inProgress: inProgressCount,
    pending: pendingCount,
  } = stats;

  const handledCount =
    submittedCount +
    resolvedCount +
    failedCount +
    reviewedCount +
    inProgressCount;
  const pct = (n: number) => (totalCount ? (n / totalCount) * 100 : 0);
  const handledPct = Math.round(pct(handledCount));

  const progressSegments = [
    {
      key: "submitted",
      label: "Submitted",
      count: submittedCount,
      bar: "bg-emerald-400",
    },
    {
      key: "reviewed",
      label: "Reviewed",
      count: reviewedCount,
      bar: "bg-emerald-800",
    },
    {
      key: "resolved",
      label: "Resolved",
      count: resolvedCount,
      bar: "bg-sky-500",
    },
    { key: "failed", label: "Failed", count: failedCount, bar: "bg-rose-500" },
    {
      key: "inProgress",
      label: "In progress",
      count: inProgressCount,
      bar: "bg-amber-500",
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
    { key: "In progress", label: "In progress", count: inProgressCount },
    { key: "Reviewed", label: "Reviewed", count: reviewedCount },
    { key: "Submitted", label: "Submitted", count: submittedCount },
    { key: "Resolved", label: "Resolved", count: resolvedCount },
    { key: "Failed", label: "Failed", count: failedCount },
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA]" style={{ fontFamily: FONT_UI }}>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-8 pb-24">
        <header className="flex flex-col gap-6 mb-6">
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
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${autoNext ? "bg-blue-600" : "bg-slate-300"}`}
                >
                  <span
                    className={`cursor-pointer inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${autoNext ? "translate-x-[18px]" : "translate-x-0.5"}`}
                  />
                </span>
                Auto-next
              </button>

              <RunAutoRaterButton
                onComplete={() => {
                  refetch();
                  bumpDailyStats();
                }}
                onProgress={bumpDailyStats}
                onToast={showToast}
                reviewedCount={reviewedCount}
              />

              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white text-slate-700 text-sm font-medium border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40"
              >
                <Download size={15} />
                Export QC CSV
              </button>
            </div>
          </div>

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
                    className={`inline-flex items-center gap-1.5 ${s.count === 0 ? "opacity-50" : ""}`}
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
          {/* Pass the refresh key here so it updates as the auto-rater polls */}
          <DailyTracker days={14} refreshKey={dailyRefreshKey} />
        </header>

        <div
          className="sticky z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-4 bg-[#F7F8FA]/90 backdrop-blur-md border-b border-slate-200/70"
          style={{ top: APP_NAV_OFFSET }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Filter by review status"
              className="flex items-center gap-0.5 p-1 rounded-lg bg-slate-200/60 overflow-x-auto scrollbar-hide w-full lg:w-auto shrink-0"
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
                    className={`cursor-pointer shrink-0 flex-1 lg:flex-none inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 ${isActive ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    {tab.label}
                    <span
                      className={`text-xs tabular-nums ${isActive ? "text-slate-500" : "text-slate-400"}`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 w-full lg:w-auto">
              <button
                type="button"
                aria-pressed={sortByStatus}
                aria-label="Sort by status"
                onClick={() => setSortByStatus((v) => !v)}
                title="Group sessions by status"
                className={`cursor-pointer shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 ${sortByStatus ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"}`}
              >
                <ArrowUpDown size={15} />
                <span className="hidden sm:inline">Sort by status</span>
              </button>
              <div className="flex-1 lg:w-64 lg:flex-none">
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

        <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {selectedRows.length > 0 && (
            <div className="flex items-center gap-3 px-5 py-2.5 bg-sky-50 border-b border-sky-200 text-sm text-sky-900">
              <span className="font-medium">
                {selectedRows.length} selected
              </span>
              <button
                onClick={handleBulkResolve}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 text-white hover:bg-sky-700 transition-colors cursor-pointer"
              >
                <CheckCircle2 size={13} /> Mark resolved
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs font-medium text-sky-800 hover:underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-left text-[10.5px] uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      aria-label="Select all failed sessions"
                      checked={allResolvableSelected}
                      disabled={resolvableRows.length === 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                    />
                    Device / Email
                  </div>
                </th>
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
              {displayItems.map((item) => {
                if (item.type === "header") {
                  return (
                    <tr
                      key={`hdr-${item.key}`}
                      className="bg-slate-50 border-b border-slate-200"
                    >
                      <td colSpan={8} className="px-5 py-2.5 align-middle">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                          <span>
                            {item.label} · {item.count}
                          </span>
                          {item.collapsible && (
                            <button
                              type="button"
                              onClick={() => toggleGroup(item.key)}
                              aria-expanded={item.expanded}
                              className="font-medium text-slate-500 hover:text-slate-800 rounded transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40"
                            >
                              {item.expanded ? "Show less" : "Show all"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }
                const { row, index: i } = item;
                const rating = ratings[row.sessionId];
                const isSubmitted = row.submitted === true;
                const isFailed = row.submitted === false;
                const isResolved = isFailed && row.resolved === true;
                const isDraft = (rating as any)?.isDraft === true;
                const isRated =
                  rating !== undefined && isRatingComplete(rating) && !isDraft;
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
                      i % 2 === 1 && !(isFailed && !isResolved)
                        ? "bg-slate-50/40"
                        : ""
                    } ${isResolved ? "opacity-70 hover:opacity-100" : ""} ${isHighlighted ? "bg-blue-50/30 hover:bg-blue-50/50" : "hover:bg-slate-50/70"}`}
                  >
                    <td
                      className={`py-4 align-middle font-medium text-slate-700 transition-[border-color,padding] ${
                        isHighlighted
                          ? "pl-4 pr-5 border-l-4 border-l-blue-600"
                          : isFailed && !isResolved
                            ? "pl-4 pr-5 border-l-4 border-l-rose-300"
                            : "pl-5 pr-5"
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        {isFailed && !isResolved ? (
                          <input
                            type="checkbox"
                            aria-label={`Select ${row.email}`}
                            checked={selectedIds.has(row.sessionId)}
                            onChange={() => toggleSelected(row.sessionId)}
                            className="w-4 h-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="w-4 shrink-0" aria-hidden="true" />
                        )}
                        <span>{row.email}</span>
                      </div>
                      {row.new && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider text-emerald-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded mt-1"
                          title="This session comes from a newly-created account"
                        >
                          <UserPlus size={11} /> New account
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-middle whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleCopyId(row.sessionId)}
                        title={`${row.sessionId} · click to copy`}
                        className="text-[13px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded px-1 -mx-1 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40"
                        style={{ fontFamily: FONT_DATA }}
                      >
                        {shortId(row.sessionId)}
                      </button>
                    </td>
                    <td className="px-5 py-4 align-middle text-slate-600">
                      <div className="flex items-center gap-2">
                        <span>{row.task}</span>
                        {row.duplicate && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded"
                            title="This sessionId appeared more than once in the QC input"
                          >
                            <Copy size={11} /> Duplicate
                          </span>
                        )}
                      </div>
                      {isFailed && (
                        <p className="text-xs text-red-400 mt-0.5">
                          {getReason(row)}
                        </p>
                      )}
                    </td>
                    <td
                      className="px-5 py-4 align-middle text-slate-600 text-[13px] whitespace-nowrap"
                      style={{ fontFamily: FONT_DATA }}
                    >
                      {row.minutes} min
                    </td>
                    <td
                      className="px-5 py-4 align-middle text-slate-500 text-[13px]"
                      style={{ fontFamily: FONT_DATA }}
                    >
                      {formatTimestamp(row.recordedTimestamp)}
                    </td>
                    <td
                      className="px-5 py-4 align-middle text-slate-500 text-[13px]"
                      style={{ fontFamily: FONT_DATA }}
                    >
                      {formatTimestamp(row.uploadedTimestamp)}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <StatusBadge
                        isSubmitted={isSubmitted}
                        isFailed={isFailed}
                        isResolved={isResolved}
                        isRated={isRated}
                        hasRating={hasRating}
                        isDraft={isDraft}
                      />
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap h-full">
                        {isFailed ? (
                          <>
                            <RowActionsMenu
                              isResolved={isResolved}
                              onEditReason={() => setCommentRow(row)}
                              onToggleResolved={() =>
                                handleToggleResolved(row, !isResolved)
                              }
                            />
                            <button
                              onClick={() => {
                                setReviewingRowId(row.sessionId);
                                setActiveRow(row);
                              }}
                              className="inline-flex items-center justify-center gap-1.5 h-9 min-w-[110px] px-3 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all cursor-pointer whitespace-nowrap"
                            >
                              <Eye size={13} /> View rating
                            </button>
                          </>
                        ) : (
                          <>
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
                              className={`inline-flex items-center justify-center gap-1.5 h-9 min-w-[110px] px-3 rounded-lg text-xs font-semibold transition-all border cursor-pointer whitespace-nowrap ${
                                !hasRating
                                  ? "bg-blue-600 text-white hover:bg-blue-700 border-transparent shadow-sm shadow-blue-600/20"
                                  : "bg-white text-blue-600 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
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
                                  ? "Edit draft"
                                  : "Rate video"}
                            </button>
                          </>
                        )}
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
          {displayItems.map((item) => {
            if (item.type === "header") {
              return (
                <div
                  key={`hdr-${item.key}`}
                  className="flex items-center justify-between pt-3 px-1 text-xs font-semibold text-slate-500"
                >
                  <span>
                    {item.label} · {item.count}
                  </span>
                  {item.collapsible && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.key)}
                      aria-expanded={item.expanded}
                      className="font-medium text-slate-500 hover:text-slate-800 rounded transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40"
                    >
                      {item.expanded ? "Show less" : "Show all"}
                    </button>
                  )}
                </div>
              );
            }
            const row = item.row;
            const rating = ratings[row.sessionId];
            const isSubmitted = row.submitted === true;
            const isFailed = row.submitted === false;
            const isResolved = isFailed && row.resolved === true;
            const isDraft = (rating as any)?.isDraft === true;
            const isRated =
              rating !== undefined && isRatingComplete(rating) && !isDraft;
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
                    : isFailed && !isResolved
                      ? "border-slate-200 border-l-4 border-l-rose-300"
                      : "border-slate-200"
                } ${isResolved ? "opacity-70" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-slate-800 text-sm truncate">
                        {row.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-slate-500 text-sm">{row.task}</p>
                      {row.new && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded"
                          title="This session comes from a newly-created account"
                        >
                          <UserPlus size={10} /> New
                        </span>
                      )}
                      {row.duplicate && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded"
                          title="This sessionId appeared more than once in the QC input"
                        >
                          <Copy size={10} /> Duplicate
                        </span>
                      )}
                    </div>
                    {isFailed && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {getReason(row)}
                      </p>
                    )}
                    <p
                      className="text-slate-400 text-[11px] mt-1 truncate"
                      style={{ fontFamily: FONT_DATA }}
                    >
                      {row.sessionId}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge
                      isSubmitted={isSubmitted}
                      isFailed={isFailed}
                      isResolved={isResolved}
                      isRated={isRated}
                      hasRating={hasRating}
                      isDraft={isDraft}
                      compact
                    />
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
                  {isFailed ? (
                    <>
                      <RowActionsMenu
                        isResolved={isResolved}
                        onEditReason={() => setCommentRow(row)}
                        onToggleResolved={() =>
                          handleToggleResolved(row, !isResolved)
                        }
                      />
                      <button
                        onClick={() => {
                          setReviewingRowId(row.sessionId);
                          setActiveRow(row);
                        }}
                        className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all"
                      >
                        <Eye size={13} /> View rating
                      </button>
                    </>
                  ) : (
                    <>
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
                        className={`flex-1 h-9 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-semibold border cursor-pointer transition-all ${
                          !hasRating
                            ? "bg-blue-600 text-white hover:bg-blue-700 border-transparent shadow-sm shadow-blue-600/20"
                            : "bg-white text-blue-600 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
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
                            ? "Edit draft"
                            : "Rate video"}
                      </button>
                    </>
                  )}
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

      {firstUnratedRow && !isUnratedVisible && !activeRow && (
        <button
          onClick={handleScrollToUnrated}
          className="cursor-pointer fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 pl-3.5 pr-4 py-2.5 rounded-full bg-blue-600 text-white text-sm font-medium shadow-lg shadow-blue-900/20 hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 focus-visible:ring-offset-2"
        >
          <LocateFixed size={15} /> Jump to unrated
        </button>
      )}

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
          readOnly={activeRow.submitted === false}
          autoNext={autoNext}
          setAutoNext={setAutoNext}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onNavigate={handleNavigate}
          reviewedCount={reviewedCount}
          pendingCount={pendingCount}
        />
      )}

      {commentRow && (
        <CommentDialog
          key={commentRow.sessionId}
          row={commentRow}
          initial={(commentRow as any).reason || ""}
          onClose={() => setCommentRow(null)}
          onSave={(reason) => handleSaveReason(commentRow, reason)}
        />
      )}

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

function RowActionsMenu({
  isResolved,
  onEditReason,
  onToggleResolved,
}: {
  isResolved: boolean;
  onEditReason: () => void;
  onToggleResolved: () => void;
}) {
  const [pos, setPos] = useState<{
    top?: number;
    bottom?: number;
    right: number;
  } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const open = pos !== null;
  const close = useCallback(() => setPos(null), []);

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const right = window.innerWidth - rect.right;
    setPos(
      rect.bottom + 110 > window.innerHeight
        ? { bottom: window.innerHeight - rect.top + 6, right }
        : { top: rect.bottom + 6, right },
    );
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        btnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  const itemClass =
    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none cursor-pointer";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        title="More actions"
        onClick={toggle}
        className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 ${
          open
            ? "bg-slate-100 border-slate-300 text-slate-800"
            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        }`}
      >
        <MoreHorizontal size={16} />
      </button>

      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[70]" onClick={close} />
            <div
              role="menu"
              style={{
                position: "fixed",
                top: pos.top,
                bottom: pos.bottom,
                right: pos.right,
                fontFamily: FONT_UI,
              }}
              className="z-[71] w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                autoFocus
                onClick={() => {
                  close();
                  onEditReason();
                }}
                className={itemClass}
              >
                <SquarePen size={14} className="text-slate-400" /> Edit reason
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  onToggleResolved();
                }}
                className={itemClass}
              >
                {isResolved ? (
                  <RotateCcw size={14} className="text-slate-400" />
                ) : (
                  <CheckCircle2 size={14} className="text-slate-400" />
                )}
                {isResolved ? "Unmark as resolved" : "Mark as resolved"}
              </button>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

function CommentDialog({
  row,
  initial,
  onClose,
  onSave,
}: {
  row: SessionRow;
  initial: string;
  onClose: () => void;
  onSave: (reason: string) => Promise<void>;
}) {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(text);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reason-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200"
        style={{ fontFamily: FONT_UI }}
      >
        <h3
          id="reason-dialog-title"
          className="text-[15px] font-semibold text-slate-900"
          style={{ fontFamily: FONT_DISPLAY }}
        >
          Edit reason
        </h3>
        <p className="text-xs text-slate-500 mt-1 break-words">
          {row.email} · {row.task}
        </p>
        <label htmlFor="session-reason" className="sr-only">
          Reason
        </label>
        <textarea
          id="session-reason"
          autoFocus
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a reason for this session…"
          className="mt-4 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-400"
          style={{ fontFamily: FONT_UI }}
        />
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-3.5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm shadow-blue-600/20 cursor-pointer"
          >
            {saving ? "Saving…" : "Save reason"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  isSubmitted,
  isFailed,
  isResolved = false,
  isRated,
  hasRating,
  isDraft = false,
  compact = false,
}: {
  isSubmitted: boolean;
  isFailed: boolean;
  isResolved?: boolean;
  isRated: boolean;
  hasRating: boolean;
  isDraft?: boolean;
  compact?: boolean;
}) {
  const size = compact ? 12 : 13;
  const base = compact
    ? "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium whitespace-nowrap"
    : "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap";

  if (isSubmitted)
    return (
      <span
        className={`${base} text-emerald-700 bg-emerald-50 border border-emerald-200`}
      >
        <Send size={size} /> Submitted
      </span>
    );
  if (isFailed && isResolved)
    return (
      <span
        className={`${base} text-emerald-700 bg-emerald-50 border border-emerald-200`}
      >
        <CheckCircle2 size={size} /> Resolved
      </span>
    );
  if (isFailed)
    return (
      <span
        className={`${base} text-rose-700 bg-rose-50 border border-rose-200`}
      >
        <XCircle size={size} /> Failed
      </span>
    );
  if (isDraft)
    return (
      <span
        className={`${base} text-amber-700 bg-amber-50 border border-amber-200`}
      >
        <AlertTriangle size={size} /> In progress
      </span>
    );
  if (isRated)
    return (
      <span
        className={`${base} text-emerald-700 bg-emerald-50 border border-emerald-200`}
      >
        <CheckCircle2 size={size} /> Reviewed
      </span>
    );
  if (hasRating)
    return (
      <span
        className={`${base} text-amber-700 bg-amber-50 border border-amber-200`}
      >
        <AlertTriangle size={size} /> In progress
      </span>
    );

  return (
    <span
      className={`${base} text-slate-600 bg-slate-100 border border-slate-200`}
    >
      <Circle size={size} /> Pending
    </span>
  );
}

type RateStatus = "idle" | "running" | "success" | "failed";

function RunAutoRaterButton({
  onComplete,
  onToast,
  reviewedCount = 0,
  onProgress, // NEW: Callback for live updates during run
}: {
  onComplete?: () => void | Promise<void>;
  onToast?: (msg: string) => void;
  reviewedCount?: number;
  onProgress?: () => void; // NEW
}) {
  const [status, setStatus] = useState<RateStatus>("idle");
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState("");
  const [starting, setStarting] = useState(false);
  const [limit, setLimit] = useState<string>("");
  const pollRef = useRef<number | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:5000/api/rate/status");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data: {
        status: RateStatus;
        running: boolean;
        logs: string;
        lastRunAt: string | null;
      } = await res.json();

      let actualStatus = data.status;
      if (
        !data.running &&
        (data.status === "success" || data.status === "failed")
      ) {
        if (
          data.lastRunAt &&
          localStorage.getItem("autoRaterAckRunAt") === data.lastRunAt
        ) {
          actualStatus = "idle";
        }
      }

      setStatus(actualStatus);
      setLastRunAt(data.lastRunAt);
      setLogs(data.logs || "");

      // --- NEW: Notify parent to refresh stats while running ---
      if (data.running) {
        onProgress?.();
      }

      if (!data.running) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
        if (actualStatus === "success")
          onToast?.("Auto-rater finished successfully");
        else if (actualStatus === "failed")
          onToast?.("Auto-rater finished with errors");
        await onComplete?.();
      }
    } catch (err) {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
      setStatus("failed");
      setLogs(
        `${logs}\n[client error] ${err instanceof Error ? err.message : String(err)}\n`,
      );
      onToast?.("Lost connection to auto-rater status endpoint");
    }
  }, [onComplete, onToast, logs, onProgress]); // Added onProgress to deps

  const startPolling = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(poll, 1500);
    void poll();
  }, [poll]);

  const closeModal = () => {
    setOpen(false);
    if (status === "success" || status === "failed") {
      setStatus("idle");
      if (lastRunAt) {
        localStorage.setItem("autoRaterAckRunAt", lastRunAt);
      }
    }
  };

  const start = async () => {
    if (status === "running" || starting) {
      setOpen(true);
      return;
    }

    if (status === "success" || status === "failed") {
      setOpen(true);
      return;
    }

    // Validate limit against the actual number of Reviewed sessions
    const parsedLimit = parseInt(limit, 10);
    if (!isNaN(parsedLimit) && parsedLimit > reviewedCount) {
      onToast?.(
        `Cannot run auto-rater - Limit: (${parsedLimit}), Reviewed sessions: (${reviewedCount}).`,
      );
      return;
    }

    if (reviewedCount === 0) {
      onToast?.("Cannot run: No Reviewed sessions available to submit.");
      return;
    }

    setStarting(true);
    setOpen(true);
    try {
      const res = await fetch("http://localhost:5000/api/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit:
            isNaN(parsedLimit) || parsedLimit <= 0 ? undefined : parsedLimit,
        }),
      });
      if (res.status === 409) {
        // Already running
      } else if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        onToast?.(body?.error ?? "Failed to start auto-rater");
        setStatus("failed");
        return;
      }
      startPolling();
    } catch (err) {
      onToast?.(
        err instanceof Error ? err.message : "Failed to start auto-rater",
      );
      setStatus("failed");
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("http://localhost:5000/api/rate/status");
        const data = await res.json();
        if (cancelled) return;

        let actualStatus = data.status;
        if (
          !data.running &&
          (data.status === "success" || data.status === "failed")
        ) {
          if (
            data.lastRunAt &&
            localStorage.getItem("autoRaterAckRunAt") === data.lastRunAt
          ) {
            actualStatus = "idle";
          }
        }

        setStatus(actualStatus);
        setLastRunAt(data.lastRunAt);
        setLogs(data.logs || "");
        if (data.running) startPolling();
      } catch {}
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, []);

  const running = status === "running" || starting;
  const finished = status === "success" || status === "failed";
  const disabled = starting;

  return (
    <>
      <div className="flex items-stretch rounded-lg border border-slate-300 bg-white shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-blue-600/40 focus-within:border-blue-600 transition-all">
        <div className="flex items-center bg-slate-50 border-r border-slate-200 pl-3 pr-1">
          <input
            type="number"
            min={1}
            placeholder="Limit"
            title="Max submissions for this run (leave blank for unlimited)"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            disabled={disabled || running}
            className="w-[60px] bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
          />
        </div>
        <button
          onClick={start}
          disabled={disabled}
          title={
            finished ? "View the auto-rater logs" : "Run the auto-rater script"
          }
          className={`cursor-pointer inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors focus:outline-none ${
            disabled
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : finished
                ? "bg-slate-800 text-white hover:bg-slate-700"
                : "bg-slate-900 text-slate-100 hover:bg-slate-800"
          }`}
        >
          {running ? (
            <Loader2 size={15} className="animate-spin text-amber-400" />
          ) : finished ? (
            <Eye size={15} className="text-amber-400" />
          ) : (
            <Terminal size={15} className="text-emerald-400" />
          )}
          {running ? "Running…" : finished ? "View log" : "Run"}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-slate-900 text-slate-100 rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <div className="text-sm font-medium flex items-center gap-2">
                <Terminal size={16} className="text-slate-400" /> Auto-rater —
                <span
                  className={
                    status === "success"
                      ? "text-emerald-400"
                      : status === "failed"
                        ? "text-rose-400"
                        : status === "running"
                          ? "text-amber-400"
                          : "text-slate-300"
                  }
                >
                  {status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {status === "running" && (
                  <button
                    onClick={async () => {
                      try {
                        await fetch("http://localhost:5000/api/rate/cancel", {
                          method: "POST",
                        });
                      } catch {}
                    }}
                    className="cursor-pointer text-xs px-2 py-1 rounded border border-rose-500/60 text-rose-300 hover:bg-rose-500/10"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={closeModal}
                  className="cursor-pointer text-xs px-2 py-1 rounded border border-slate-600 hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-[12px] leading-relaxed font-mono whitespace-pre-wrap">
              {logs || "Waiting for output…"}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}

function findVisibleRowElement(sessionId: string): HTMLElement | null {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>("[data-session-id]"),
  ).filter((el) => el.dataset.sessionId === sessionId);
  return nodes.find((el) => el.offsetParent !== null) ?? nodes[0] ?? null;
}

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
