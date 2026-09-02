import { AlertTriangle, Check, CheckCheck, Minus } from "lucide-react";
import {
  Severity,
  Seated,
  Environment,
  Other,
  SystemRating,
  SeverityFieldDef,
} from "./types";

export const FONT_DISPLAY = "'Space Grotesk', 'Inter', sans-serif";
export const FONT_UI = "'Inter', system-ui, sans-serif";
export const FONT_DATA = "'JetBrains Mono', ui-monospace, monospace";

export const SEVERITY_OPTIONS = Object.values(Severity);
export const SEATED_OPTIONS = Object.values(Seated);
export const ENVIRONMENT_OPTIONS = Object.values(Environment);
export const OTHER_OPTIONS: Other[] = [
  Severity.NoIssue,
  Severity.Minor,
  Severity.Major,
  "Unavailable",
  "Processing",
];

export const SEVERITY_STYLES: Record<Severity | Other, string> = {
  [Severity.NoIssue]: "bg-emerald-50 text-emerald-700 border-emerald-200",
  [Severity.Minor]: "bg-amber-50 text-amber-700 border-amber-200",
  [Severity.Major]: "bg-rose-50 text-rose-700 border-rose-200",
  Unavailable: "bg-red-900 text-rose-100 border-rose-200",
  Processing: "bg-slate-800 text-white border-slate-800",
};

export const SEATED_STYLE_MAP: Record<Seated, string> = {
  [Seated.StandingMoving]: SEVERITY_STYLES[Severity.NoIssue],
  [Seated.AllowSeated]: SEVERITY_STYLES[Severity.Minor],
  [Seated.Seated]: SEVERITY_STYLES[Severity.Major],
};

export const ENVIRONMENT_STYLE_MAP: Record<Environment, string> = {
  [Environment.CorrectTask]: SEVERITY_STYLES[Severity.NoIssue],
  [Environment.WrongTask]: SEVERITY_STYLES[Severity.Major],
};

export const SYSTEM_RATING_STYLES: Record<SystemRating, string> = {
  [SystemRating.Great]: SEVERITY_STYLES[Severity.NoIssue],
  [SystemRating.Good]: SEVERITY_STYLES[Severity.Minor],
  [SystemRating.NeedsWork]: SEVERITY_STYLES[Severity.Major],
  [SystemRating.None]: "bg-transparent text-slate-400",
};

export const SYSTEM_RATING_ICONS: Record<
  SystemRating,
  React.ComponentType<{ size?: number }>
> = {
  [SystemRating.Great]: CheckCheck,
  [SystemRating.Good]: Check,
  [SystemRating.NeedsWork]: AlertTriangle,
  [SystemRating.None]: Minus,
};

export const SYSTEM_RATING_LABELS: Record<SystemRating, string> = {
  [SystemRating.Great]: "Great",
  [SystemRating.Good]: "Good",
  [SystemRating.NeedsWork]: "Needs work",
  [SystemRating.None]: "None",
};

export const SEVERITY_FIELDS: SeverityFieldDef[] = [
  { key: "lighting", label: "Lighting" },
  { key: "sharpness", label: "Sharpness" },
  { key: "handVisibility", label: "Hand Visibility" },
  { key: "fovFraming", label: "FOV Framing" },
  { key: "cameraAngle", label: "Camera Angle" },
  { key: "idle", label: "Idle" },
];

export const SUMMARY_ABBR: Record<string, string> = {
  lighting: "Li",
  sharpness: "Sh",
  handVisibility: "HV",
  fovFraming: "FOV",
  cameraAngle: "Cam",
  idle: "Idl",
  systemRating: "Sys",
};
