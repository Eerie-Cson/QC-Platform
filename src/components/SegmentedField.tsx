// components/SegmentedField.tsx
import { FONT_UI, SEVERITY_STYLES } from "../utilities/constants";

interface SegmentedFieldProps<T extends string> {
  label: string;
  options: T[];
  value: T | "" | undefined;
  onChange: (value: T | "" | undefined) => void;
  tone?: "default" | "severity";
  styleMap?: Record<string, string>;
  disabled?: boolean;
  displayMap?: Record<string, string>;
  compact?: boolean;
  title?: string;
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
  title,
}: SegmentedFieldProps<T>) {
  return (
    <div className="space-y-1.5">
      {label && (
        <span
          className="block text-xs font-medium text-slate-500"
          style={{ fontFamily: FONT_UI }}
        >
          {label}
        </span>
      )}
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt;
          let stateClass = "";
          if (active) {
            if (styleMap && styleMap[opt]) {
              stateClass = `${styleMap[opt]} ring-1 ring-offset-0`;
            } else if (tone === "severity") {
              stateClass = `${SEVERITY_STYLES[opt as unknown as keyof typeof SEVERITY_STYLES]} ring-1 ring-offset-0`;
            } else {
              stateClass =
                "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20";
            }
          } else {
            stateClass =
              "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50";
          }
          const displayText = displayMap ? displayMap[opt] : opt;
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={active}
              onClick={() => {
                if (disabled) return;
                if (value === opt) onChange(undefined);
                else onChange(opt);
              }}
              disabled={disabled}
              title={title}
              style={{ fontFamily: FONT_UI }}
              className={`${compact ? "px-3 py-1.5 text-xs" : "px-3.5 py-2 text-[13px]"} rounded-lg font-medium border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 ${stateClass} ${
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
