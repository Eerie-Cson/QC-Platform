// components/RatingModal.tsx
import { useState, useEffect, useRef } from "react";
import {
  X,
  Copy,
  Eye,
  EyeOff,
  AlertTriangle,
  Check,
  CheckCheck,
  Edit3,
  RotateCcw,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import {
  SessionRow,
  Ratings,
  Severity,
  Seated,
  Environment,
  Other,
  SystemRating,
} from "../types";
import {
  FONT_DISPLAY,
  FONT_UI,
  FONT_DATA,
  SEVERITY_OPTIONS,
  SEATED_OPTIONS,
  ENVIRONMENT_OPTIONS,
  OTHER_OPTIONS,
  SEATED_STYLE_MAP,
  ENVIRONMENT_STYLE_MAP,
  SYSTEM_RATING_STYLES,
  SYSTEM_RATING_ICONS,
  SYSTEM_RATING_LABELS,
  SEVERITY_FIELDS,
} from "../constants";
import { SegmentedField } from "./SegmentedField";
import { PillSegmentedField } from "./PillSegmentedField";
import {
  generateComment,
  emptyRating,
  isRatingComplete,
  toggleStrikethrough,
} from "../utils";

// ---------------------------------------------------------------------------
// DropdownField – compact version for crosscheck
// ---------------------------------------------------------------------------
interface DropdownFieldProps<T extends string> {
  label: string;
  options: T[];
  value: T | "" | undefined;
  onChange: (value: T | "" | undefined) => void;
  styleMap: Record<string, string>;
}

function DropdownField<T extends string>({
  label,
  options,
  value,
  onChange,
  styleMap,
}: DropdownFieldProps<T>) {
  const selectedClass =
    value && styleMap[value] ? styleMap[value] : "border-slate-200 bg-white";

  return (
    <div className="space-y-0.5">
      <label
        className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"
        style={{ fontFamily: FONT_UI }}
      >
        {label}
      </label>
      <select
        value={value || ""}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === "" ? undefined : (val as T));
        }}
        className={`w-full rounded border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/15 focus:border-blue-400 transition-colors ${selectedClass}`}
        style={{ fontFamily: FONT_UI }}
      >
        <option value="">–</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dropdown style maps for crosscheck (green/amber/rose)
// ---------------------------------------------------------------------------
const SEVERITY_DROPDOWN_STYLES: Record<string, string> = {
  [Severity.NoIssue]:
    "border-l-3 border-l-emerald-400 bg-emerald-50/30 border-slate-200",
  [Severity.Minor]:
    "border-l-3 border-l-amber-400 bg-amber-50/30 border-slate-200",
  [Severity.Major]:
    "border-l-3 border-l-rose-400 bg-rose-50/30 border-slate-200",
};

const SEATED_DROPDOWN_STYLES: Record<string, string> = {
  [Seated.StandingMoving]:
    "border-l-3 border-l-emerald-400 bg-emerald-50/30 border-slate-200",
  [Seated.AllowSeated]:
    "border-l-3 border-l-amber-400 bg-amber-50/30 border-slate-200",
  [Seated.Seated]:
    "border-l-3 border-l-rose-400 bg-rose-50/30 border-slate-200",
};

const ENVIRONMENT_DROPDOWN_STYLES: Record<string, string> = {
  [Environment.CorrectTask]:
    "border-l-3 border-l-emerald-400 bg-emerald-50/30 border-slate-200",
  [Environment.WrongTask]:
    "border-l-3 border-l-rose-400 bg-rose-50/30 border-slate-200",
};

const OTHER_DROPDOWN_STYLES: Record<string, string> = {
  [Severity.NoIssue]:
    "border-l-3 border-l-emerald-400 bg-emerald-50/30 border-slate-200",
  [Severity.Minor]:
    "border-l-3 border-l-amber-400 bg-amber-50/30 border-slate-200",
  [Severity.Major]:
    "border-l-3 border-l-rose-400 bg-rose-50/30 border-slate-200",
  Unavailable: "border-slate-200 bg-white",
  Processing: "border-slate-200 bg-white",
};

// ---------------------------------------------------------------------------
// RatingModal
// ---------------------------------------------------------------------------
interface RatingModalProps {
  row: SessionRow & { faceVisible?: boolean };
  initial?: Ratings;
  onClose: () => void;
  onSubmit: (
    rating: Ratings,
    systemRating: string,
    faceVisible: boolean,
  ) => void;
  mode: "review" | "crosscheck";
}

export function RatingModal({
  row,
  initial,
  onClose,
  onSubmit,
  mode,
}: RatingModalProps) {
  const [rating, setRating] = useState<Ratings>(initial ?? emptyRating());
  const [commentManuallyEdited, setCommentManuallyEdited] = useState(false);
  const [showOrientationDialog, setShowOrientationDialog] = useState(false);
  const [orientationDialogShown, setOrientationDialogShown] = useState(false);
  const [isOrientationConfirmed, setIsOrientationConfirmed] = useState(false);
  const [faceVisible, setFaceVisible] = useState<boolean>(
    row.faceVisible ?? false,
  );
  const [showOriginalComment, setShowOriginalComment] = useState(false);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [isHoveringApproval, setIsHoveringApproval] = useState(false);
  const [systemRating, setSystemRating] = useState(row.systemRating || "");

  const commentRef = useRef<HTMLTextAreaElement>(null);
  const crosscheckCommentRef = useRef<HTMLTextAreaElement>(null);

  const isCrosscheck = mode === "crosscheck";
  const originalComment = initial?.comment || "";
  const crosscheckComment = rating.crosscheckComment || "";
  const isApproved = crosscheckComment === "Ok";

  const isLinkMismatch = !row.link.includes(row.sessionId);

  // Auto‑show comment box if there's a non‑"Ok" custom comment
  useEffect(() => {
    if (isCrosscheck && crosscheckComment && !isApproved) {
      setShowCommentBox(true);
    }
  }, [isCrosscheck, crosscheckComment, isApproved]);

  // ESC key to close modal (or close orientation dialog first)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showOrientationDialog) {
          setShowOrientationDialog(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showOrientationDialog, onClose]);

  const handleFaceVisibleChange = (checked: boolean) => {
    setFaceVisible(checked);
    if (!commentManuallyEdited && !isCrosscheck) {
      setRating((prev) => {
        const newComment = generateComment(
          prev,
          checked,
          isOrientationConfirmed,
        );
        return { ...prev, comment: newComment };
      });
    }
  };

  const handleStrikethrough = () => {
    const textarea = isCrosscheck
      ? crosscheckCommentRef.current
      : commentRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value } = textarea;
    if (selectionStart === selectionEnd) return;

    const { newText, newStart, newEnd } = toggleStrikethrough(
      value,
      selectionStart,
      selectionEnd,
    );

    if (isCrosscheck) {
      setRating((prev) => ({ ...prev, crosscheckComment: newText }));
    } else {
      setRating((prev) => ({ ...prev, comment: newText }));
      setCommentManuallyEdited(true);
    }

    setTimeout(() => {
      textarea.setSelectionRange(newStart, newEnd);
      textarea.focus();
    }, 0);
  };

  const handleSystemRatingChange = (value: SystemRating | undefined) => {
    setSystemRating(value === SystemRating.None ? "" : value || "");
  };

  const update = <K extends keyof Ratings>(key: K, value: Ratings[K]) => {
    if (key === "comment" || key === "crosscheckComment") {
      if (key === "comment") setCommentManuallyEdited(true);
      setRating((prev): Ratings => ({ ...prev, [key]: value }));
      return;
    }

    if (key === "slowLoading") {
      setRating((prev): Ratings => {
        const newRating = { ...prev, slowLoading: value as boolean };
        if (value === true) {
          newRating.other = "Processing";
        } else {
          newRating.other = "";
        }
        if (!commentManuallyEdited && !isCrosscheck) {
          newRating.comment = generateComment(
            newRating,
            faceVisible,
            isOrientationConfirmed,
          );
        }
        return newRating;
      });
      return;
    }

    setRating((prev): Ratings => {
      const newRating = { ...prev, [key]: value };
      if (
        key === "other" &&
        (value === "Processing" || value === "Unavailable") &&
        !prev.slowLoading
      ) {
        SEVERITY_FIELDS.forEach((f) => {
          newRating[f.key] = "";
        });
        newRating.seated = "";
        newRating.environment = "";
        newRating.comment = value as string;
        setCommentManuallyEdited(false);
        return newRating;
      }
      if (!isCrosscheck && !commentManuallyEdited) {
        newRating.comment = generateComment(
          newRating,
          faceVisible,
          isOrientationConfirmed,
        );
      } else {
        newRating.comment = prev.comment;
      }
      return newRating;
    });
  };

  // Quick action: set every quality field (except System rating) to its
  // "no issue" / green state in one click.
  const handleSetAllNoIssue = () => {
    setRating((prev) => {
      const newRating: Ratings = { ...prev, slowLoading: false };

      SEVERITY_FIELDS.forEach((f) => {
        newRating[f.key] = Severity.NoIssue;
      });
      newRating.seated = Seated.StandingMoving;
      newRating.environment = Environment.CorrectTask;
      newRating.other = Severity.NoIssue;

      if (!commentManuallyEdited) {
        newRating.comment = generateComment(
          newRating,
          faceVisible,
          isOrientationConfirmed,
        );
      }

      return newRating;
    });
  };

  const complete = isRatingComplete(rating);

  useEffect(() => {
    if (isCrosscheck) return;

    const isCameraAngleIssue =
      rating.cameraAngle === Severity.Minor ||
      rating.cameraAngle === Severity.Major;
    const isFovIssue =
      rating.fovFraming === Severity.Minor ||
      rating.fovFraming === Severity.Major;
    const bothIssues = isCameraAngleIssue && isFovIssue;

    if (bothIssues && !isOrientationConfirmed && !orientationDialogShown) {
      if (
        rating.comment &&
        rating.comment.includes("Wrong camera orientation")
      ) {
        setOrientationDialogShown(true);
      } else {
        setShowOrientationDialog(true);
      }
    } else if (!bothIssues && !isOrientationConfirmed) {
      setOrientationDialogShown(false);
    }
  }, [
    rating.cameraAngle,
    rating.fovFraming,
    rating.comment,
    isCrosscheck,
    isOrientationConfirmed,
  ]);

  const handleOrientationYes = () => {
    // Generate new comment with camera/fov excluded and orientation note
    const newComment = generateComment(rating, faceVisible, true);
    setRating((prev) => ({
      ...prev,
      comment: newComment,
    }));
    setIsOrientationConfirmed(true);
    setCommentManuallyEdited(false); // Keep auto‑generate active for other fields
    setOrientationDialogShown(true);
    setShowOrientationDialog(false);
  };

  const handleOrientationNo = () => {
    setOrientationDialogShown(true);
    setShowOrientationDialog(false);
  };

  const handleSubmitClick = () => {
    onSubmit(rating, systemRating, faceVisible);
  };

  const handleCopyOriginal = () => {
    navigator.clipboard.writeText(originalComment);
  };

  const toggleOriginalVisibility = () => {
    setShowOriginalComment((prev) => !prev);
  };

  const handleApprove = () => {
    setRating((prev) => ({ ...prev, crosscheckComment: "Ok" }));
    setShowCommentBox(false);
  };

  const handleRevoke = () => {
    if (
      window.confirm(
        "Are you sure you want to revoke approval? This will clear the crosscheck comment.",
      )
    ) {
      setRating((prev) => ({ ...prev, crosscheckComment: "" }));
      setShowCommentBox(false);
    }
  };

  const toggleCommentBox = () => {
    if (isApproved) return;
    setShowCommentBox((prev) => !prev);
    if (!showCommentBox) {
      setTimeout(() => {
        crosscheckCommentRef.current?.focus();
      }, 100);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[95vh] flex flex-col border border-slate-200/60">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <p
              className="text-[10px] font-semibold uppercase tracking-wider text-blue-600"
              style={{ fontFamily: FONT_UI }}
            >
              {isCrosscheck ? "Crosscheck video" : "Rate video"}
            </p>
            <h2
              className="text-lg font-semibold text-slate-900 mt-0.5 tracking-tight truncate"
              style={{ fontFamily: FONT_DISPLAY }}
            >
              {row.task}
            </h2>
            <p
              className="text-xs text-slate-400 mt-0.5"
              style={{ fontFamily: FONT_DATA }}
            >
              {row.email} · {row.sessionId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1.5 transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto space-y-4">
          {isLinkMismatch && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>
                Session ID does not appear in the link. Verify correct video.
              </span>
            </div>
          )}

          {/* System rating – compact */}
          <div>
            <span
              className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"
              style={{ fontFamily: FONT_UI }}
            >
              System rating
            </span>
            <div className="mt-1">
              <PillSegmentedField<SystemRating>
                options={Object.values(SystemRating)}
                value={(systemRating as SystemRating) || SystemRating.None}
                onChange={handleSystemRatingChange}
                styleMap={SYSTEM_RATING_STYLES}
                iconMap={SYSTEM_RATING_ICONS}
                displayMap={SYSTEM_RATING_LABELS}
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* REVIEW MODE – compact 2‑column layout */}
          {!isCrosscheck && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                    style={{ fontFamily: FONT_UI }}
                  >
                    Video quality
                  </p>
                  <button
                    type="button"
                    onClick={handleSetAllNoIssue}
                    title="Set Lighting, Sharpness, Hand Visibility, FOV Framing, Camera Angle, Idle, Seated, Environment and Other to No issue"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                  >
                    <CheckCheck size={13} />
                    Mark all no issue
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  {SEVERITY_FIELDS.map((f) => (
                    <SegmentedField<Severity>
                      key={f.key}
                      label={f.label}
                      options={SEVERITY_OPTIONS}
                      value={rating[f.key] || undefined}
                      onChange={(v) => update(f.key, v || "")}
                      tone="severity"
                      disabled={false}
                      compact
                    />
                  ))}
                </div>
              </div>

              <hr className="border-slate-100" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                <SegmentedField<Seated>
                  label="Seated?"
                  options={SEATED_OPTIONS}
                  value={rating.seated || undefined}
                  onChange={(v) => update("seated", v || "")}
                  styleMap={SEATED_STYLE_MAP}
                  disabled={false}
                  compact
                />

                <SegmentedField<Environment>
                  label="Environment"
                  options={ENVIRONMENT_OPTIONS}
                  value={rating.environment || undefined}
                  onChange={(v) => update("environment", v || "")}
                  styleMap={ENVIRONMENT_STYLE_MAP}
                  disabled={false}
                  compact
                />

                <div className="sm:col-span-2">
                  <SegmentedField<Other>
                    label="Other"
                    options={OTHER_OPTIONS}
                    value={rating.other || undefined}
                    onChange={(v) => update("other", v || "")}
                    tone="severity"
                    compact
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                    style={{ fontFamily: FONT_UI }}
                  >
                    Comments
                  </span>
                  <textarea
                    ref={commentRef}
                    value={rating.comment || ""}
                    onChange={(e) => update("comment", e.target.value)}
                    placeholder="Add any additional notes..."
                    style={{ fontFamily: FONT_UI }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/15 focus:border-blue-400 resize-y min-h-[40px]"
                    rows={2}
                  />
                </div>

                <div className="sm:col-span-2 flex flex-wrap items-center justify-end gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="slowLoading"
                      checked={rating.slowLoading || false}
                      onChange={(e) => update("slowLoading", e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label
                      htmlFor="slowLoading"
                      className="text-sm text-slate-600 cursor-pointer select-none"
                      style={{ fontFamily: FONT_UI }}
                    >
                      Slow loading
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="faceVisible"
                      checked={faceVisible}
                      onChange={(e) =>
                        handleFaceVisibleChange(e.target.checked)
                      }
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label
                      htmlFor="faceVisible"
                      className="text-sm text-slate-600 cursor-pointer select-none"
                      style={{ fontFamily: FONT_UI }}
                    >
                      Faces visible
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ============================================================ */}
          {/* CROSSCHECK MODE */}
          {/* ============================================================ */}
          {isCrosscheck && (
            <>
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2"
                  style={{ fontFamily: FONT_UI }}
                >
                  Video quality
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {SEVERITY_FIELDS.map((f) => (
                    <DropdownField<Severity>
                      key={f.key}
                      label={f.label}
                      options={SEVERITY_OPTIONS}
                      value={rating[f.key] || undefined}
                      onChange={(v) => update(f.key, v || "")}
                      styleMap={SEVERITY_DROPDOWN_STYLES}
                    />
                  ))}
                </div>
              </div>

              <hr className="border-slate-100" />

              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <DropdownField<Seated>
                  label="Seated?"
                  options={SEATED_OPTIONS}
                  value={rating.seated || undefined}
                  onChange={(v) => update("seated", v || "")}
                  styleMap={SEATED_DROPDOWN_STYLES}
                />

                <DropdownField<Environment>
                  label="Environment"
                  options={ENVIRONMENT_OPTIONS}
                  value={rating.environment || undefined}
                  onChange={(v) => update("environment", v || "")}
                  styleMap={ENVIRONMENT_DROPDOWN_STYLES}
                />

                <DropdownField<Other>
                  label="Other"
                  options={OTHER_OPTIONS}
                  value={rating.other || undefined}
                  onChange={(v) => update("other", v || "")}
                  styleMap={OTHER_DROPDOWN_STYLES}
                />
              </div>

              {/* Original QC comment block */}
              {originalComment && (
                <div className="bg-slate-50 rounded border border-slate-200 p-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                      style={{ fontFamily: FONT_UI }}
                    >
                      Original QC comment
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleCopyOriginal}
                        className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                        title="Copy"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={toggleOriginalVisibility}
                        className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                        title={
                          showOriginalComment ? "Hide comment" : "Show comment"
                        }
                      >
                        {showOriginalComment ? (
                          <EyeOff size={13} />
                        ) : (
                          <Eye size={13} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={isApproved ? handleRevoke : handleApprove}
                        onMouseEnter={() => setIsHoveringApproval(true)}
                        onMouseLeave={() => setIsHoveringApproval(false)}
                        title={
                          isApproved
                            ? isHoveringApproval
                              ? "Undo confirm"
                              : "Confirmed"
                            : "Confirm match"
                        }
                        className="cursor-pointer"
                      >
                        <div
                          className={`relative w-6 h-6 rounded-full flex items-center justify-center overflow-hidden transition-colors ${
                            isApproved
                              ? isHoveringApproval
                                ? "bg-rose-50"
                                : "bg-green-100 border border-green-200"
                              : isHoveringApproval
                                ? "bg-emerald-50"
                                : "bg-slate-100 border border-slate-300"
                          }`}
                        >
                          <AnimatePresence mode="wait" initial={false}>
                            {isApproved ? (
                              isHoveringApproval ? (
                                <motion.div
                                  key="undo"
                                  initial={{
                                    opacity: 0,
                                    scale: 0.5,
                                    rotate: -90,
                                  }}
                                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                  exit={{ opacity: 0, scale: 0.5 }}
                                  transition={{ duration: 0.15 }}
                                >
                                  <RotateCcw
                                    size={14}
                                    className="text-rose-700"
                                  />
                                </motion.div>
                              ) : (
                                <motion.div
                                  key="check"
                                  initial={{ opacity: 0, scale: 0.4 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.5 }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 20,
                                  }}
                                >
                                  <Check
                                    size={14}
                                    className="text-green-800"
                                    strokeWidth={2.5}
                                  />
                                </motion.div>
                              )
                            ) : (
                              <motion.span
                                key="ok"
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                                transition={{ duration: 0.15 }}
                                className={`text-[10px] font-medium leading-none ${
                                  isHoveringApproval
                                    ? "text-emerald-600"
                                    : "text-slate-500"
                                }`}
                              >
                                OK
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                      </button>
                    </div>
                  </div>

                  {showOriginalComment && (
                    <>
                      <p
                        className="text-xs text-slate-700 whitespace-pre-wrap mt-1"
                        style={{ fontFamily: FONT_UI }}
                      >
                        {originalComment}
                      </p>

                      <hr className="border-slate-200 my-2" />

                      <div className="flex items-center gap-3 flex-wrap">
                        {!isApproved && (
                          <button
                            type="button"
                            onClick={toggleCommentBox}
                            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline transition-colors cursor-pointer"
                          >
                            <Edit3 size={13} />
                            {crosscheckComment ? "Edit note" : "Add note"}
                          </button>
                        )}
                        {isApproved && (
                          <button
                            type="button"
                            onClick={handleRevoke}
                            className="text-xs text-slate-400 hover:text-slate-600 underline-offset-2 hover:underline transition-colors cursor-pointer"
                          >
                            Revoke
                          </button>
                        )}
                      </div>

                      {showCommentBox && !isApproved && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <span
                              className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                              style={{ fontFamily: FONT_UI }}
                            >
                              Your crosscheck comment
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={handleStrikethrough}
                                className="p-1 rounded hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
                                title="Toggle strikethrough"
                              >
                                <span className="font-mono text-xs font-medium">
                                  ~~
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={toggleCommentBox}
                                className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                          <textarea
                            ref={crosscheckCommentRef}
                            value={crosscheckComment}
                            onChange={(e) =>
                              update("crosscheckComment", e.target.value)
                            }
                            placeholder="Add your review notes, strike through parts you disagree with..."
                            style={{ fontFamily: FONT_UI }}
                            className="w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/15 focus:border-blue-400 resize-y min-h-[60px]"
                            rows={3}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50 rounded-b-2xl flex-wrap">
          <span
            className={`text-xs font-medium ${complete ? "text-emerald-600" : "text-slate-400"}`}
            style={{ fontFamily: FONT_UI }}
          >
            {complete
              ? "✓ All fields complete"
              : "Fill in every field to submit"}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              style={{ fontFamily: FONT_UI }}
              className="px-4 py-2 rounded-lg cursor-pointer text-sm font-medium text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitClick}
              style={{ fontFamily: FONT_UI }}
              className={`px-4 py-2 rounded-lg text-sm cursor-pointer font-semibold transition-colors ${
                isCrosscheck || complete
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20 border-transparent"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-blue-600 border border-slate-300"
              }`}
            >
              {isCrosscheck ? "Save crosscheck" : "Submit review"}
            </button>
          </div>
        </div>
      </div>

      {/* Orientation confirmation dialog (review only) */}
      {showOrientationDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">
              Camera orientation
            </h3>
            <p className="text-sm text-slate-600 mt-2">
              It looks like both Camera Angle and FOV Framing have issues. Is
              this due to wrong camera orientation?
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleOrientationNo}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 transition-colors"
              >
                No, keep separate
              </button>
              <button
                onClick={handleOrientationYes}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20"
              >
                Yes, it's wrong orientation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
