// components/RatingModal.tsx
import { useState, useEffect, useRef, MouseEvent, ReactNode } from "react";
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
  ExternalLink,
  UserPlus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Lock,
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
} from "../utilities/types";
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
} from "../utilities/constants";
import { SegmentedField } from "./SegmentedField";
import { PillSegmentedField } from "./PillSegmentedField";
import {
  generateComment,
  isRatingComplete,
  toggleStrikethrough,
  isRatingEmpty,
} from "../utilities/utils";

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------
const FIELD_LABEL = "block text-xs font-medium text-slate-500";
const FOCUS_RING =
  "cursor-pointer disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40";
const TEXT_INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-400 transition-colors disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed";

function Notice({
  tone,
  children,
}: {
  tone: "amber" | "rose";
  children: ReactNode;
}) {
  const styles =
    tone === "amber"
      ? "bg-amber-50 border-amber-200 text-amber-800"
      : "bg-rose-50 border-rose-200 text-rose-800";
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm ${styles}`}
    >
      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function ConfirmDialog({
  title,
  children,
  actions,
  labelId,
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  labelId: string;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-200"
        style={{ fontFamily: FONT_UI }}
      >
        <h3
          id={labelId}
          className="text-[15px] font-semibold text-slate-900"
          style={{ fontFamily: FONT_DISPLAY }}
        >
          {title}
        </h3>
        <p className="text-sm text-slate-600 mt-2">{children}</p>
        <div className="flex justify-end gap-2 mt-6">{actions}</div>
      </div>
    </div>
  );
}

const BTN_GHOST = `px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors ${FOCUS_RING}`;
const BTN_PRIMARY = `px-3.5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm shadow-blue-600/20 ${FOCUS_RING}`;
const NAV_ARROW = `inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:shadow-none transition-colors ${FOCUS_RING}`;

// ---------------------------------------------------------------------------
// DropdownField – compact version for crosscheck
// ---------------------------------------------------------------------------
interface DropdownFieldProps<T extends string> {
  label: string;
  options: T[];
  value: T | "" | undefined;
  onChange: (value: T | "" | undefined) => void;
  styleMap: Record<string, string>;
  disabled?: boolean;
}

function DropdownField<T extends string>({
  label,
  options,
  value,
  onChange,
  styleMap,
  disabled = false,
}: DropdownFieldProps<T>) {
  const selectedClass =
    value && styleMap[value] ? styleMap[value] : "border-slate-200 bg-white";

  return (
    <div className="space-y-1">
      <label className={FIELD_LABEL} style={{ fontFamily: FONT_UI }}>
        {label}
      </label>
      <select
        value={value || ""}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === "" ? undefined : (val as T));
        }}
        disabled={disabled}
        className={`w-full cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-400 transition-colors disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ${selectedClass}`}
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
// Dropdown style maps for crosscheck
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
    isDraft?: boolean,
  ) => void;
  mode: "review" | "crosscheck";
  readOnly?: boolean;
  autoNext: boolean;
  setAutoNext: (val: boolean) => void;
  hasPrev: boolean;
  hasNext: boolean;
  onNavigate: (direction: "prev" | "next") => void;
  reviewedCount: number;
  pendingCount: number;
}

export function RatingModal({
  row,
  initial,
  onClose,
  onSubmit,
  mode,
  readOnly = false,
  autoNext,
  setAutoNext,
  hasPrev,
  hasNext,
  onNavigate,
  reviewedCount,
  pendingCount,
}: RatingModalProps) {
  const [rating, setRating] = useState<Ratings>(() => {
    if (initial) return initial;

    const defaultRating = {
      lighting: Severity.NoIssue,
      sharpness: Severity.NoIssue,
      handVisibility: Severity.NoIssue,
      fovFraming: Severity.NoIssue,
      cameraAngle: Severity.NoIssue,
      idle: Severity.NoIssue,
      seated: Seated.StandingMoving,
      environment: Environment.CorrectTask,
      other: Severity.NoIssue,
      slowLoading: false,
    } as Ratings;

    defaultRating.comment = generateComment(
      defaultRating,
      row.faceVisible ?? false,
      false,
    );
    return defaultRating;
  });

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
  const [showMidciDialog, setShowMidciDialog] = useState(false);
  const [copiedSessionId, setCopiedSessionId] = useState(false);
  const [commentCopied, setCommentCopied] = useState(false); // ← new
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const crosscheckCommentRef = useRef<HTMLTextAreaElement>(null);

  const isCrosscheck = mode === "crosscheck";
  const originalComment = initial?.comment || "";
  const crosscheckComment = rating.crosscheckComment || "";
  const isApproved = crosscheckComment === "Ok";

  const isLinkMismatch = !row.link.endsWith(row.sessionId);
  const hasAlerts = !!(row.duplicate || isLinkMismatch || row.personalGmail);

  // ---- Queue progress ----
  const totalCount = reviewedCount + pendingCount;
  const progressPct =
    totalCount > 0 ? Math.min(100, (reviewedCount / totalCount) * 100) : 0;
  const allDone = totalCount > 0 && pendingCount === 0;
  const progressTitle = allDone
    ? `All ${totalCount} sessions reviewed`
    : `${reviewedCount} reviewed · ${pendingCount} pending · ${Math.round(progressPct)}%`;

  // Auto-show comment box if there's a non-"Ok" custom comment
  useEffect(() => {
    if (isCrosscheck && crosscheckComment && !isApproved) {
      setShowCommentBox(true);
    }
  }, [isCrosscheck, crosscheckComment, isApproved]);

  const handleFaceVisibleChange = (checked: boolean) => {
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
    setSystemRating(value === SystemRating.None ? "" : value || "");
  };

  const update = <K extends keyof Ratings>(key: K, value: Ratings[K]) => {
    if (readOnly) return;
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

  const handleSetAllNoIssue = () => {
    if (readOnly) return;
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

  const handleClearRating = () => {
    if (readOnly) return;
    setRating((prev) => {
      const newRating: Ratings = { ...prev, slowLoading: false, comment: "" };
      SEVERITY_FIELDS.forEach((f) => {
        newRating[f.key] = "";
      });
      newRating.seated = "";
      newRating.environment = "";
      newRating.other = "";
      return newRating;
    });
    setCommentManuallyEdited(false);
  };

  const complete = isRatingComplete(rating);

  useEffect(() => {
    if (isCrosscheck || readOnly) return;

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
    readOnly,
  ]);

  const handleOrientationYes = () => {
    const newComment = generateComment(rating, faceVisible, true);
    setRating((prev) => ({
      ...prev,
      comment: newComment,
    }));
    setIsOrientationConfirmed(true);
    setCommentManuallyEdited(false);
    setOrientationDialogShown(true);
    setShowOrientationDialog(false);
  };

  const handleOrientationNo = () => {
    setOrientationDialogShown(true);
    setShowOrientationDialog(false);
  };

  const hasMajorIssue = (r: Ratings): boolean => {
    const severityKeys: (keyof Pick<
      Ratings,
      | "lighting"
      | "sharpness"
      | "handVisibility"
      | "fovFraming"
      | "cameraAngle"
      | "idle"
    >)[] = [
      "lighting",
      "sharpness",
      "handVisibility",
      "fovFraming",
      "cameraAngle",
      "idle",
    ];
    for (const f of severityKeys) {
      if (r[f] === Severity.Major) return true;
    }
    if (r.seated === Seated.Seated || r.other === Severity.Major) return true;
    return false;
  };

  const getMajorFieldsString = (r: Ratings): string => {
    const majorKeys: string[] = [];
    const severityKeys: (keyof Pick<
      Ratings,
      | "lighting"
      | "sharpness"
      | "handVisibility"
      | "fovFraming"
      | "cameraAngle"
      | "idle"
    >)[] = [
      "lighting",
      "sharpness",
      "handVisibility",
      "fovFraming",
      "cameraAngle",
      "idle",
    ];
    for (const key of severityKeys) {
      if (r[key] === Severity.Major) {
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        majorKeys.push(label);
      }
    }
    if (r.seated === Seated.Seated) majorKeys.push("Seated");
    if (r.environment === Environment.WrongTask) majorKeys.push("Environment");
    if (r.other === Severity.Major) majorKeys.push("Other");
    return majorKeys.join("_");
  };

  const handleSubmitClick = (isDraft = false) => {
    if (readOnly) return;
    if (
      !isDraft &&
      row.email === "accounts@midcitigarments.com" &&
      hasMajorIssue(rating)
    ) {
      const majorFields = getMajorFieldsString(rating);
      const copyText = `${row.sessionId}_${majorFields}`;
      navigator.clipboard.writeText(copyText).catch(console.error);
      setShowMidciDialog(true);
      return;
    }
    onSubmit(rating, systemRating, faceVisible, isDraft);
  };

  const handleSubmitClickRef = useRef(handleSubmitClick);
  useEffect(() => {
    handleSubmitClickRef.current = handleSubmitClick;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showOrientationDialog) {
          setShowOrientationDialog(false);
        } else {
          onClose();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (readOnly) return;
        handleSubmitClickRef.current(!complete && !isCrosscheck);
      }

      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        if (hasPrev) onNavigate("prev");
      }
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        if (hasNext) onNavigate("next");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    showOrientationDialog,
    onClose,
    hasPrev,
    hasNext,
    onNavigate,
    complete,
    isCrosscheck,
    readOnly,
  ]);

  const handleCopyOriginal = () => {
    navigator.clipboard.writeText(originalComment);
  };

  // ← new
  const handleCopyComment = () => {
    const text = rating.comment || "";
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCommentCopied(true);
        window.setTimeout(() => setCommentCopied(false), 1500);
      })
      .catch(console.error);
  };

  const handleCopySessionId = () => {
    navigator.clipboard
      .writeText(row.sessionId)
      .then(() => {
        setCopiedSessionId(true);
        window.setTimeout(() => setCopiedSessionId(false), 1500);
      })
      .catch(console.error);
  };

  const toggleOriginalVisibility = () => {
    setShowOriginalComment((prev) => !prev);
  };

  const handleApprove = () => {
    if (readOnly) return;
    setRating((prev) => ({ ...prev, crosscheckComment: "Ok" }));
    setShowCommentBox(false);
  };

  const handleRevoke = () => {
    if (readOnly) return;
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
    if (readOnly || isApproved) return;
    setShowCommentBox((prev) => !prev);
    if (!showCommentBox) {
      setTimeout(() => {
        crosscheckCommentRef.current?.focus();
      }, 100);
    }
  };

  const handleOpenSplit = (e: MouseEvent) => {
    e.preventDefault();
    window.postMessage({ type: "OPEN_VIDEO_IN_SPLIT", url: row.link }, "*");
  };

  const sectionDivider = "pt-5 border-t border-slate-100";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rating-modal-title"
        className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[95vh] flex flex-col border border-slate-200"
        style={{ fontFamily: FONT_UI }}
      >
        {/* ───────── Header ───────── */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h2
                id="rating-modal-title"
                className="text-lg font-semibold text-slate-900 tracking-tight break-words"
                style={{ fontFamily: FONT_DISPLAY }}
              >
                {row.task}
              </h2>
              {row.new && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0"
                  title="This session comes from a newly-created account"
                >
                  <UserPlus size={11} /> New account
                </span>
              )}
              {row.duplicate && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shrink-0"
                  title="This sessionId appeared more than once in the QC input"
                >
                  <Copy size={11} /> Duplicate
                </span>
              )}
              {readOnly && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded shrink-0"
                  title="This review is read-only because the session is not editable"
                >
                  <Lock size={10} /> Read-only
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {row.link && (
                <a
                  href={row.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleOpenSplit}
                  title="Open session link in split view"
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 bg-white border border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors cursor-pointer ${FOCUS_RING}`}
                >
                  <ExternalLink size={15} />
                </a>
              )}
              <button
                onClick={onClose}
                className={`text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 transition-colors ${FOCUS_RING}`}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="min-w-0 flex flex-col gap-1">
              <p className="text-xs text-slate-500 break-all">{row.email}</p>
              <div className="flex items-start gap-1.5">
                <p
                  className="text-xs text-slate-400 break-all"
                  style={{ fontFamily: FONT_DATA }}
                >
                  {row.sessionId}
                </p>
                <button
                  type="button"
                  onClick={handleCopySessionId}
                  title={copiedSessionId ? "Copied" : "Copy session ID"}
                  aria-label="Copy session ID"
                  className={`shrink-0 -mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors ${FOCUS_RING} ${
                    copiedSessionId
                      ? "text-emerald-600 bg-emerald-50"
                      : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {copiedSessionId ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            <div
              className={`flex flex-col gap-1.5 shrink-0 ${
                readOnly ? "pointer-events-none opacity-60" : ""
              }`}
            >
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                System rating
              </span>
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
        </div>

        {/* ───────── Body ───────── */}
        <div className="px-6 py-5 overflow-y-auto space-y-5">
          {hasAlerts && (
            <div className="space-y-2">
              {row.duplicate && (
                <Notice tone="amber">
                  This session appeared more than once. Double-check the task
                  and session ID before rating.
                </Notice>
              )}
              {isLinkMismatch && (
                <Notice tone="rose">
                  Session ID does not appear in the link. Verify correct video.
                </Notice>
              )}
              {row.personalGmail && (
                <Notice tone="amber">
                  This session uses a personal Gmail account. Skip this session!
                </Notice>
              )}
            </div>
          )}

          {/* REVIEW MODE */}
          {!isCrosscheck && (
            <>
              <div className={hasAlerts ? sectionDivider : ""}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Video quality
                  </h3>

                  {!readOnly &&
                    (isRatingEmpty(rating) ? (
                      <button
                        type="button"
                        onClick={handleSetAllNoIssue}
                        title="Set all fields to No issue"
                        className={`inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${FOCUS_RING}`}
                      >
                        <CheckCheck size={14} />
                        Mark all no issue
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleClearRating}
                        title="Clear all rating fields"
                        className={`inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${FOCUS_RING}`}
                      >
                        <Trash2 size={14} />
                        Clear rating
                      </button>
                    ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  {SEVERITY_FIELDS.map((f) => (
                    <SegmentedField<Severity>
                      key={f.key}
                      label={f.label}
                      options={SEVERITY_OPTIONS}
                      value={rating[f.key] || undefined}
                      onChange={(v) => update(f.key, v || "")}
                      tone="severity"
                      disabled={readOnly}
                      compact
                    />
                  ))}
                </div>
              </div>

              <div className={sectionDivider}>
                <h3 className="text-sm font-semibold text-slate-800 mb-3">
                  Session details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <SegmentedField<Seated>
                    label="Seated?"
                    options={SEATED_OPTIONS}
                    value={rating.seated || undefined}
                    onChange={(v) => update("seated", v || "")}
                    styleMap={SEATED_STYLE_MAP}
                    disabled={readOnly}
                    compact
                  />

                  <SegmentedField<Environment>
                    label="Environment"
                    options={ENVIRONMENT_OPTIONS}
                    value={rating.environment || undefined}
                    onChange={(v) => update("environment", v || "")}
                    styleMap={ENVIRONMENT_STYLE_MAP}
                    disabled={readOnly}
                    compact
                  />

                  <div className="sm:col-span-2">
                    <SegmentedField<Other>
                      label="Other"
                      options={OTHER_OPTIONS}
                      value={rating.other || undefined}
                      onChange={(v) => update("other", v || "")}
                      tone="severity"
                      disabled={readOnly}
                      compact
                    />
                  </div>
                </div>
              </div>

              <div className={`${sectionDivider} space-y-3`}>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="rating-comment" className={FIELD_LABEL}>
                      Comments
                    </label>
                    <button
                      type="button"
                      onClick={handleCopyComment}
                      disabled={!rating.comment}
                      title={commentCopied ? "Copied!" : "Copy comment"}
                      aria-label={commentCopied ? "Copied" : "Copy comment"}
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors ${FOCUS_RING} disabled:opacity-40 disabled:cursor-not-allowed ${
                        commentCopied
                          ? "text-emerald-700 bg-emerald-50"
                          : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {commentCopied ? <Check size={13} /> : <Copy size={13} />}
                      {commentCopied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <textarea
                    id="rating-comment"
                    ref={commentRef}
                    value={rating.comment || ""}
                    onChange={(e) => update("comment", e.target.value)}
                    placeholder="Add any additional notes…"
                    style={{ fontFamily: FONT_UI }}
                    className={`${TEXT_INPUT} resize-y min-h-[40px]`}
                    rows={2}
                    readOnly={readOnly}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
                  <label
                    htmlFor="slowLoading"
                    className={`inline-flex items-center gap-2 text-sm text-slate-600 select-none ${
                      readOnly ? "opacity-60" : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      id="slowLoading"
                      checked={rating.slowLoading || false}
                      onChange={(e) => update("slowLoading", e.target.checked)}
                      disabled={readOnly}
                      className="w-4 h-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                    />
                    Slow loading
                  </label>
                  <label
                    htmlFor="faceVisible"
                    className={`inline-flex items-center gap-2 text-sm text-slate-600 select-none ${
                      readOnly ? "opacity-60" : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      id="faceVisible"
                      checked={faceVisible}
                      onChange={(e) =>
                        handleFaceVisibleChange(e.target.checked)
                      }
                      disabled={readOnly}
                      className="w-4 h-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                    />
                    Faces visible
                  </label>
                </div>
              </div>
            </>
          )}

          {/* CROSSCHECK MODE */}
          {isCrosscheck && (
            <>
              <div className={hasAlerts ? sectionDivider : ""}>
                <h3 className="text-sm font-semibold text-slate-800 mb-3">
                  Video quality
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {SEVERITY_FIELDS.map((f) => (
                    <DropdownField<Severity>
                      key={f.key}
                      label={f.label}
                      options={SEVERITY_OPTIONS}
                      value={rating[f.key] || undefined}
                      onChange={(v) => update(f.key, v || "")}
                      styleMap={SEVERITY_DROPDOWN_STYLES}
                      disabled={readOnly}
                    />
                  ))}
                </div>
              </div>

              <div className={sectionDivider}>
                <h3 className="text-sm font-semibold text-slate-800 mb-3">
                  Session details
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <DropdownField<Seated>
                    label="Seated?"
                    options={SEATED_OPTIONS}
                    value={rating.seated || undefined}
                    onChange={(v) => update("seated", v || "")}
                    styleMap={SEATED_DROPDOWN_STYLES}
                    disabled={readOnly}
                  />

                  <DropdownField<Environment>
                    label="Environment"
                    options={ENVIRONMENT_OPTIONS}
                    value={rating.environment || undefined}
                    onChange={(v) => update("environment", v || "")}
                    styleMap={ENVIRONMENT_DROPDOWN_STYLES}
                    disabled={readOnly}
                  />

                  <DropdownField<Other>
                    label="Other"
                    options={OTHER_OPTIONS}
                    value={rating.other || undefined}
                    onChange={(v) => update("other", v || "")}
                    styleMap={OTHER_DROPDOWN_STYLES}
                    disabled={readOnly}
                  />
                </div>
              </div>

              {originalComment && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      Original QC comment
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleCopyOriginal}
                        className={`p-1.5 rounded-md hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer ${FOCUS_RING}`}
                        title="Copy"
                        aria-label="Copy original comment"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={toggleOriginalVisibility}
                        className={`p-1.5 rounded-md hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer ${FOCUS_RING}`}
                        title={
                          showOriginalComment ? "Hide comment" : "Show comment"
                        }
                        aria-label={
                          showOriginalComment ? "Hide comment" : "Show comment"
                        }
                      >
                        {showOriginalComment ? (
                          <EyeOff size={14} />
                        ) : (
                          <Eye size={14} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={isApproved ? handleRevoke : handleApprove}
                        onMouseEnter={() => setIsHoveringApproval(true)}
                        onMouseLeave={() => setIsHoveringApproval(false)}
                        disabled={readOnly}
                        title={
                          readOnly
                            ? "Read-only"
                            : isApproved
                              ? isHoveringApproval
                                ? "Undo confirm"
                                : "Confirmed"
                              : "Confirm match"
                        }
                        aria-label={
                          isApproved ? "Undo confirm" : "Confirm match"
                        }
                        className={`cursor-pointer rounded-full ${FOCUS_RING} disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        <div
                          className={`relative w-6 h-6 rounded-full flex items-center justify-center overflow-hidden transition-colors ${
                            isApproved
                              ? isHoveringApproval
                                ? "bg-rose-50"
                                : "bg-emerald-50 border border-emerald-200"
                              : isHoveringApproval
                                ? "bg-emerald-50"
                                : "bg-white border border-slate-300"
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
                                    className="text-emerald-700"
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
                        className="text-sm text-slate-700 whitespace-pre-wrap mt-2"
                        style={{ fontFamily: FONT_UI }}
                      >
                        {originalComment}
                      </p>

                      {!readOnly && (
                        <div className="border-t border-slate-200 mt-3 pt-3 flex items-center gap-3 flex-wrap">
                          {!isApproved && (
                            <button
                              type="button"
                              onClick={toggleCommentBox}
                              className={`inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md transition-colors cursor-pointer ${FOCUS_RING}`}
                            >
                              <Edit3 size={13} />
                              {crosscheckComment ? "Edit note" : "Add note"}
                            </button>
                          )}
                          {isApproved && (
                            <button
                              type="button"
                              onClick={handleRevoke}
                              className={`text-xs font-medium text-slate-500 hover:text-slate-800 rounded-md transition-colors cursor-pointer ${FOCUS_RING}`}
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      )}

                      {showCommentBox && !isApproved && !readOnly && (
                        <div className="mt-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label
                              htmlFor="crosscheck-comment"
                              className={FIELD_LABEL}
                            >
                              Your crosscheck comment
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleStrikethrough}
                                className={`px-1.5 py-0.5 rounded-md hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer ${FOCUS_RING}`}
                                title="Toggle strikethrough"
                                aria-label="Toggle strikethrough"
                              >
                                <span className="font-mono text-xs font-medium">
                                  ~~
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={toggleCommentBox}
                                className={`text-xs font-medium text-slate-500 hover:text-slate-800 rounded-md cursor-pointer ${FOCUS_RING}`}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                          <textarea
                            id="crosscheck-comment"
                            ref={crosscheckCommentRef}
                            value={crosscheckComment}
                            onChange={(e) =>
                              update("crosscheckComment", e.target.value)
                            }
                            placeholder="Add your review notes, strike through parts you disagree with…"
                            style={{ fontFamily: FONT_UI }}
                            className={`${TEXT_INPUT} resize-y min-h-[60px]`}
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

        {/* ───────── Footer ───────── */}
        <div className="relative px-6 py-3.5 flex items-center justify-between gap-3 flex-wrap bg-white rounded-b-2xl">
          <div
            role="progressbar"
            aria-label="Review progress"
            aria-valuemin={0}
            aria-valuemax={totalCount}
            aria-valuenow={reviewedCount}
            aria-valuetext={progressTitle}
            title={progressTitle}
            className="absolute inset-x-0 top-0 h-[2px] bg-slate-100 overflow-hidden"
          >
            <motion.div
              className={`h-full ${allDone ? "bg-emerald-500" : "bg-blue-600"}`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{ minWidth: reviewedCount > 0 ? 6 : 0 }}
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-0.5 p-1 rounded-lg bg-slate-200/60">
              <button
                onClick={() => onNavigate("prev")}
                disabled={!hasPrev}
                title="Previous session (Alt+Left)"
                aria-label="Previous session"
                className={NAV_ARROW}
              >
                <ChevronLeft size={16} />
              </button>

              <span
                className={`inline-flex items-center gap-1 px-2 text-xs font-medium tabular-nums select-none whitespace-nowrap ${
                  allDone ? "text-emerald-700" : "text-slate-500"
                }`}
                style={{ fontFamily: FONT_DATA }}
                title={progressTitle}
                aria-label={progressTitle}
              >
                {allDone ? (
                  <>
                    <CheckCheck size={13} />
                    <span className="hidden sm:inline">
                      All {totalCount} done
                    </span>
                    <span className="sm:hidden">{totalCount}</span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">
                      {reviewedCount}/{totalCount}
                    </span>
                    <span className="hidden sm:inline">
                      {reviewedCount} of {totalCount} done
                    </span>
                  </>
                )}
              </span>

              <button
                onClick={() => onNavigate("next")}
                disabled={!hasNext}
                title="Next session (Alt+Right)"
                aria-label="Next session"
                className={NAV_ARROW}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {!readOnly && (
              <button
                type="button"
                role="switch"
                aria-checked={autoNext}
                onClick={() => setAutoNext(!autoNext)}
                title="After you submit, open the next unrated session automatically"
                className={`inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-md ${FOCUS_RING}`}
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
            )}
          </div>

          <div className="flex items-center gap-2">
            {readOnly ? (
              <button onClick={onClose} className={BTN_PRIMARY}>
                Close
              </button>
            ) : (
              <>
                {!isCrosscheck && (
                  <button
                    onClick={() => handleSubmitClick(true)}
                    className={BTN_GHOST}
                    title="Save progress without submitting"
                  >
                    Save draft
                  </button>
                )}
                <button
                  onClick={() => handleSubmitClick(false)}
                  disabled={!isCrosscheck && !complete}
                  title={
                    !isCrosscheck && !complete
                      ? "Fill in every field to submit"
                      : "Ctrl/⌘ + Enter"
                  }
                  className={
                    isCrosscheck || complete
                      ? BTN_PRIMARY
                      : `px-3.5 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-400 cursor-not-allowed transition-colors`
                  }
                >
                  {isCrosscheck ? "Save crosscheck" : "Submit review"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showOrientationDialog && !readOnly && (
        <ConfirmDialog
          labelId="orientation-title"
          title="Camera orientation"
          actions={
            <>
              <button onClick={handleOrientationNo} className={BTN_GHOST}>
                No, keep separate
              </button>
              <button onClick={handleOrientationYes} className={BTN_PRIMARY}>
                Yes, wrong orientation
              </button>
            </>
          }
        >
          It looks like both Camera Angle and FOV Framing have issues. Is this
          due to wrong camera orientation?
        </ConfirmDialog>
      )}

      {showMidciDialog && !readOnly && (
        <ConfirmDialog
          labelId="midci-title"
          title="Major issue detected"
          actions={
            <>
              <button
                onClick={() => {
                  setShowMidciDialog(false);
                  onSubmit(rating, systemRating, faceVisible, false);
                }}
                className={BTN_GHOST}
              >
                No
              </button>
              <button
                onClick={() => {
                  setShowMidciDialog(false);
                  window.postMessage(
                    { type: "OPEN_VIDEO_IN_SPLIT", url: row.link },
                    "*",
                  );
                  onSubmit(rating, systemRating, faceVisible, false);
                }}
                className={BTN_PRIMARY}
              >
                Yes
              </button>
            </>
          }
        >
          This session from midcitigarments has a major issue. Would you like to
          open the video link in a new tab?
        </ConfirmDialog>
      )}
    </div>
  );
}
