import { Ratings } from "../types";
import {
  SEVERITY_STYLES,
  SEATED_STYLE_MAP,
  ENVIRONMENT_STYLE_MAP,
  SYSTEM_RATING_STYLES,
  SUMMARY_ABBR,
  SEVERITY_FIELDS,
} from "../constants";

interface RatingSummaryCardProps {
  rating: Ratings;
  systemRating?: string;
}

export function RatingSummaryCard({
  rating,
  systemRating,
}: RatingSummaryCardProps) {
  const chips: { key: string; label: string; value: Ratings[keyof Ratings] }[] =
    [
      ...SEVERITY_FIELDS.map((f) => ({
        key: f.key,
        label: SUMMARY_ABBR[f.key],
        value: rating[f.key],
      })),
      { key: "seated", label: "Seat", value: rating.seated },
      { key: "environment", label: "Env", value: rating.environment },
      { key: "other", label: "Other", value: rating.other },
      { key: "systemRating", label: "Sys", value: systemRating || "" },
    ];

  const slowLoadingChip = rating.slowLoading ? (
    <span
      key="slowLoading"
      className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border bg-amber-100 text-amber-700 border-amber-200"
    >
      <span className="opacity-60">⏳</span>
    </span>
  ) : null;

  return (
    <div
      className="bg-white border border-slate-200 rounded-lg shadow-md px-2 py-1 pointer-events-none whitespace-nowrap"
      role="tooltip"
    >
      <div className="flex items-center gap-1">
        {chips.map((c) => {
          if (!c.value) return null;
          let style = "";
          if (c.key === "seated") {
            style =
              SEATED_STYLE_MAP[c.value as keyof typeof SEATED_STYLE_MAP] || "";
          } else if (c.key === "environment") {
            style =
              ENVIRONMENT_STYLE_MAP[
                c.value as keyof typeof ENVIRONMENT_STYLE_MAP
              ] || "";
          } else if (c.key === "systemRating") {
            style =
              SYSTEM_RATING_STYLES[
                c.value as keyof typeof SYSTEM_RATING_STYLES
              ] || "";
          } else {
            style =
              SEVERITY_STYLES[c.value as keyof typeof SEVERITY_STYLES] || "";
          }
          return (
            <span
              key={c.key}
              title={`${c.label}: ${c.value || "—"}`}
              className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${style || "bg-slate-50 text-slate-300 border-slate-100"}`}
            >
              <span className="opacity-60">{c.label}</span>
            </span>
          );
        })}
        {slowLoadingChip}
      </div>
    </div>
  );
}
