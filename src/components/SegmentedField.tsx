// components/SegmentedField.tsx
import { FONT_UI, SEVERITY_STYLES } from "../constants";

interface SegmentedFieldProps<T extends string> {
  label: string;
  options: T[];
  value: T | "" | undefined;
  onChange: (value: T | "" | undefined) => void;
  tone?: "default" | "severity";
  styleMap?: Record<string, string>;
  disabled?: boolean;
  displayMap?: Record<string, string>;
  compact?: boolean; // ✅ new – reduces size
}

export function SegmentedField<T extends string>({
  label,
  options,
  value,
  onChange,
  tone = "default",
  styleMap,
  disabled = false,
  displayMap,
  compact = false,
}: SegmentedFieldProps<T>) {
  return (
    <div className="space-y-1.5">
      {label && (
        <span
          className={`${compact ? "text-[10px]" : "text-[10.5px]"} font-semibold uppercase tracking-wider text-slate-400`}
          style={{ fontFamily: FONT_UI }}
        >
          {label}
        </span>
      )}
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt;
          let activeClass = "";
          if (active) {
            if (styleMap && styleMap[opt]) {
              activeClass = `${styleMap[opt]} ring-1 ring-offset-0`;
            } else if (tone === "severity") {
              activeClass = `${SEVERITY_STYLES[opt as unknown as keyof typeof SEVERITY_STYLES]} ring-1 ring-offset-0`;
            } else {
              activeClass =
                "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20";
            }
          } else {
            activeClass =
              "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50";
          }
          const displayText = displayMap ? displayMap[opt] : opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => {
                if (disabled) return;
                if (value === opt) onChange(undefined);
                else onChange(opt);
              }}
              disabled={disabled}
              style={{ fontFamily: FONT_UI }}
              className={`${compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[13px]"} rounded-md font-medium border transition-all duration-150 ${activeClass} ${
                disabled
                  ? "opacity-40 cursor-not-allowed pointer-events-none"
                  : ""
              }`}
            >
              {displayText}
            </button>
          );
        })}
      </div>
    </div>
  );
}
