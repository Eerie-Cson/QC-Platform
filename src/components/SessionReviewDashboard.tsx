import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { SessionRow, Ratings } from "../types";
import { FONT_DISPLAY, FONT_UI, FONT_DATA } from "../constants";
import { formatTimestamp, isRatingEmpty, isRatingComplete } from "../utils";
import { useSessions } from "../hooks/useSessions";
import { useToast } from "../hooks/useToast";
import { useHoverSummary } from "../hooks/useHoverSummary";
import { useReviewingSession } from "../hooks/useReviewingSession";
import { RatingSummaryCard } from "./RatingSummaryCard";
import { RatingModal } from "./RatingModal";
import { SessionFilters } from "./SessionFilters";
import { TaskSearchInput } from "./TaskSearchInput";
import { SessionLink } from "./SessionLink";

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

  const handleSubmitRating = async (
    submittedRatings: Ratings,
    systemRating: string,
    faceVisible?: boolean,
  ) => {
    if (!activeRow) return;
    const result = await submitRating(
      activeRow.sessionId,
      submittedRatings,
      systemRating,
      faceVisible,
    );
    if (result.success) {
      showToast(`Review saved for ${activeRow.email}`);
      setActiveRow(null);
    } else {
      showToast("Failed to save review");
    }
  };

  const handleDownload = async () => {
    const result = await exportCSV();
    if (!result.success) {
      showToast("Failed to export CSV");
    }
  };

  const hasAutoScrolled = useRef(false);
  const scrollTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (scrollTimer.current !== null)
        window.clearTimeout(scrollTimer.current);
    };
  }, []);

  useEffect(() => {
    // Only ever run once, and only once the data has actually arrived
    if (loading || hasAutoScrolled.current || filteredRows.length === 0) return;

    // Target the first session that is fully unrated ("Rate video" state).
    // In-progress drafts are intentionally skipped so the reviewer lands on
    // genuinely fresh footage. If everything is already rated or drafted,
    // there's nothing to resume, so we leave the page at the top.
    const target = filteredRows.find((row) => {
      const rating = ratings[row.sessionId] || {};
      return isRatingEmpty(rating);
    });
    if (!target) {
      hasAutoScrolled.current = true;
      return;
    }

    hasAutoScrolled.current = true;

    // Small delay so the table/cards have laid out before we measure them
    scrollTimer.current = window.setTimeout(() => {
      const el = findVisibleRowElement(target.sessionId);
      if (!el) return;

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      el.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center", // centres the row so the sticky header never covers it
      });

      // Brief pulse so the reviewer can see where they landed
      if (!prefersReducedMotion) {
        el.animate(
          [
            { backgroundColor: "rgba(37, 99, 235, 0.16)" },
            { backgroundColor: "rgba(37, 99, 235, 0)" },
          ],
          { duration: 1600, easing: "ease-out" },
        );
      }
    }, 150);
  }, [loading, filteredRows, ratings]);

  const hoveredRating = hoveredRowId ? ratings[hoveredRowId] : undefined;
  const progressPct = rows.length
    ? Math.round((reviewedCount / rows.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#F7F8FA]" style={{ fontFamily: FONT_UI }}>
      <div className="max-w-8xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-7 sticky top-[56px] z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-[#F7F8FA]/95 backdrop-blur-sm">
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

          {/* Header actions: Task search + Filter toggle + Export button */}
          <div className="flex items-center gap-2 relative self-start sm:self-auto">
            <TaskSearchInput filters={filters} setFilters={setFilters} />
            <SessionFilters
              filters={filters}
              setFilters={setFilters}
              clearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
            />
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
                const done = isRatingComplete(rating);
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
                      {row.email}

                      {row.new && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded"
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
                          onOpen={handleOpenLink}
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
            const done = isRatingComplete(rating);
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
                    <p className="font-medium text-slate-800 text-sm truncate">
                      {row.email}
                    </p>
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
                  {done ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full text-[11px] font-medium shrink-0">
                      <CheckCircle2 size={12} /> Reviewed
                    </span>
                  ) : hasRating ? (
                    <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full text-[11px] font-medium shrink-0">
                      <AlertTriangle size={12} /> In progress
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-full text-[11px] font-medium shrink-0">
                      <Circle size={12} /> Pending
                    </span>
                  )}
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
                    onOpen={handleOpenLink}
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

      {/* Modal */}
      {activeRow && (
        <RatingModal
          row={activeRow}
          initial={ratings[activeRow.sessionId]}
          onClose={() => setActiveRow(null)}
          onSubmit={handleSubmitRating}
          mode="review"
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

/**
 * The desktop table and the mobile card list are both mounted in the DOM
 * (they're toggled with `hidden` / `lg:hidden`), so the same sessionId can
 * match two elements. Return whichever one is actually visible.
 */
function findVisibleRowElement(sessionId: string): HTMLElement | null {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>("[data-session-id]"),
  ).filter((el) => el.dataset.sessionId === sessionId);

  return nodes.find((el) => el.offsetParent !== null) ?? nodes[0] ?? null;
}
