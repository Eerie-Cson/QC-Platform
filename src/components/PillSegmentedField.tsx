// components/PillSegmentedField.tsx
import React from "react";
import { FONT_UI } from "../constants";

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
  return (
    <div className="inline-flex flex-wrap items-center bg-slate-100 rounded-full p-1 gap-0.5">
      {options.map((opt) => {
        const active = value === opt;
        const Icon = iconMap[opt];
        const label = displayMap ? displayMap[opt] : opt;
        return (
          <button
            key={opt || "none"}
            type="button"
            onClick={() => onChange(value === opt ? undefined : opt)}
            style={{ fontFamily: FONT_UI }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium transition-all duration-150 ${
              active
                ? `${styleMap[opt]} shadow-sm`
                : "text-slate-500 hover:text-slate-700 hover:bg-white/70"
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
