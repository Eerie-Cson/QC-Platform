// components/PillSegmentedField.tsx
import React from "react";
import { FONT_UI } from "../utilities/constants";

interface PillSegmentedFieldProps<T extends string> {
  options: T[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  styleMap: Record<string, string>;
  iconMap: Record<string, React.ComponentType<{ size?: number }>>;
  displayMap?: Record<string, string>;
}

export function PillSegmentedField<T extends string>({
  options,
  value,
  onChange,
  styleMap,
  iconMap,
  displayMap,
}: PillSegmentedFieldProps<T>) {
  // Same segmented-track treatment as the dashboard's status tabs.
  return (
    <div
      role="group"
      className="inline-flex flex-wrap items-center bg-slate-200/60 rounded-lg p-1 gap-0.5"
    >
      {options.map((opt) => {
        const active = value === opt;
        const Icon = iconMap[opt];
        const label = displayMap ? displayMap[opt] : opt;
        return (
          <button
            key={opt || "none"}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(value === opt ? undefined : opt)}
            style={{ fontFamily: FONT_UI }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 ${
              active
                ? `${styleMap[opt]} shadow-sm`
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            {Icon && <Icon size={14} />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
