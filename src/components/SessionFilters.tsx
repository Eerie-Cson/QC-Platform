import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { FilterState } from "../hooks/useSessions";
import { Severity, Seated, Environment, SystemRating } from "../types";
import { FONT_UI } from "../constants";

// Option arrays
const SEVERITY_OPTIONS: string[] = ["All", ...Object.values(Severity)];
const SEATED_OPTIONS: string[] = ["All", ...Object.values(Seated)];
const ENVIRONMENT_OPTIONS: string[] = ["All", ...Object.values(Environment)];
const OTHER_OPTIONS: string[] = [
  "All",
  ...Object.values(Severity),
  "Unavailable",
  "Processing",
];
const SYSTEM_RATING_OPTIONS: string[] = [
  "All",
  ...Object.values(SystemRating).filter((v) => v !== ""),
  "None",
];

const FILTER_LABELS: Record<keyof FilterState, string> = {
  lighting: "Lighting",
  sharpness: "Sharpness",
  handVisibility: "Hand vis.",
  fovFraming: "FOV/Framing",
  cameraAngle: "Camera angle",
  idle: "Idle",
  seated: "Seated?",
  environment: "Environment",
  other: "Other",
  systemRating: "System rating",
  reviewStatus: "Review status",
  taskSearch: "Task",
};

const REVIEW_STATUS_OPTIONS = ["All", "Rated", "In progress", "Pending"];

interface SessionFiltersProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

interface FilterSelectProps {
  filters: FilterState;
  filterKey: keyof FilterState;
  label: string;
  options: string[];
  onChange: (key: keyof FilterState, value: string) => void;
}

function FilterSelect({
  filters,
  filterKey,
  label,
  options,
  onChange,
}: FilterSelectProps) {
  const value = filters[filterKey];
  const isActive = value !== "All";

  return (
    <div>
      <label
        className="block text-[11px] text-slate-400 mb-1"
        style={{ fontFamily: FONT_UI }}
      >
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(filterKey, e.target.value)}
          className={`w-full appearance-none rounded-lg border px-2.5 py-1.5 text-xs transition-colors focus:outline-none focus:ring-2 ${
            isActive
              ? "border-blue-300 bg-blue-50 text-blue-700 font-medium pr-7 focus:ring-blue-600/15"
              : "border-slate-200 bg-white text-slate-700 focus:ring-blue-600/15 focus:border-blue-400"
          }`}
          style={{ fontFamily: FONT_UI }}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "" ? "Not yet rated" : opt}
            </option>
          ))}
        </select>
        {isActive && (
          <button
            type="button"
            onClick={() => onChange(filterKey, "All")}
            aria-label={`Clear ${label} filter`}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-700 transition-colors"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

export function SessionFilters({
  filters,
  setFilters,
  clearFilters,
  hasActiveFilters,
}: SessionFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelOffset, setPanelOffset] = useState(0);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // taskSearch is handled by its own search box, not this dropdown panel,
  // so it's excluded from the chip list here.
  const activeFilterEntries = (
    Object.keys(filters) as (keyof FilterState)[]
  ).filter((key) => key !== "taskSearch" && filters[key] !== "All");

  // Close on outside click or Escape — a popover that only closes via its
  // own toggle is a dead end once it's sitting on top of the table.
  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  // The panel defaults to right-aligned with the toggle button, which
  // breaks in narrow viewports (e.g. split-screen/embedded windows) where
  // there isn't enough room to its left — it just runs off-screen. This
  // measures the available space and nudges the panel back into view.
  useLayoutEffect(() => {
    if (!isOpen) return;

    const reposition = () => {
      if (!containerRef.current || !panelRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const width = panelRef.current.offsetWidth;
      const margin = 12;

      const naturalLeft = containerRect.right - width; // position at right: 0
      const clampedLeft = Math.min(
        Math.max(naturalLeft, margin),
        window.innerWidth - margin - width,
      );
      setPanelOffset(naturalLeft - clampedLeft);
    };

    reposition();
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Toggle button – sits next to Export CSV */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls="session-filter-panel"
        className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          hasActiveFilters || isOpen
            ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
            : "bg-slate-100 text-slate-600 border border-transparent hover:bg-slate-200"
        }`}
        style={{ fontFamily: FONT_UI }}
      >
        <SlidersHorizontal size={15} />
        Filters
        {hasActiveFilters && (
          <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-blue-600 rounded-full">
            {activeFilterEntries.length}
          </span>
        )}
        <ChevronDown
          size={13}
          className={`text-current opacity-60 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Collapsible filter panel — fixed width + right-anchored so it
          doesn't collapse to the width of the toggle/export button row */}
      {isOpen && (
        <div
          id="session-filter-panel"
          ref={panelRef}
          role="dialog"
          aria-label="Session filters"
          className="absolute top-full right-0 mt-2 z-30 w-[min(92vw,640px)] bg-white rounded-xl border border-slate-200 shadow-xl p-4"
          style={{ fontFamily: FONT_UI, right: panelOffset }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-700">Filters</span>
            <div className="flex items-center gap-3">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close filters"
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Active filter chips — see + remove filters one at a time
              without hunting through the selects below */}
          {activeFilterEntries.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4 pb-4 border-b border-slate-100">
              {activeFilterEntries.map((key) => {
                const value = filters[key];
                return (
                  <button
                    key={key}
                    onClick={() => handleFilterChange(key, "All")}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"
                  >
                    {FILTER_LABELS[key]}:{" "}
                    {value === "" ? "Not yet rated" : value}
                    <X size={12} />
                  </button>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-slate-400 mb-2">Quality flags</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-4">
            <FilterSelect
              filters={filters}
              onChange={handleFilterChange}
              filterKey="lighting"
              label="Lighting"
              options={SEVERITY_OPTIONS}
            />
            <FilterSelect
              filters={filters}
              onChange={handleFilterChange}
              filterKey="sharpness"
              label="Sharpness"
              options={SEVERITY_OPTIONS}
            />
            <FilterSelect
              filters={filters}
              onChange={handleFilterChange}
              filterKey="handVisibility"
              label="Hand vis."
              options={SEVERITY_OPTIONS}
            />
            <FilterSelect
              filters={filters}
              onChange={handleFilterChange}
              filterKey="fovFraming"
              label="FOV/Framing"
              options={SEVERITY_OPTIONS}
            />
            <FilterSelect
              filters={filters}
              onChange={handleFilterChange}
              filterKey="cameraAngle"
              label="Camera angle"
              options={SEVERITY_OPTIONS}
            />
            <FilterSelect
              filters={filters}
              onChange={handleFilterChange}
              filterKey="idle"
              label="Idle"
              options={SEVERITY_OPTIONS}
            />
            <FilterSelect
              filters={filters}
              onChange={handleFilterChange}
              filterKey="reviewStatus"
              label="Review status"
              options={REVIEW_STATUS_OPTIONS}
            />
          </div>

          <p className="text-[11px] text-slate-400 mb-2">Session details</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FilterSelect
              filters={filters}
              onChange={handleFilterChange}
              filterKey="seated"
              label="Seated?"
              options={SEATED_OPTIONS}
            />
            <FilterSelect
              filters={filters}
              onChange={handleFilterChange}
              filterKey="environment"
              label="Environment"
              options={ENVIRONMENT_OPTIONS}
            />
            <FilterSelect
              filters={filters}
              onChange={handleFilterChange}
              filterKey="other"
              label="Other"
              options={OTHER_OPTIONS}
            />
            <FilterSelect
              filters={filters}
              onChange={handleFilterChange}
              filterKey="systemRating"
              label="System rating"
              options={SYSTEM_RATING_OPTIONS}
            />
          </div>
        </div>
      )}
    </div>
  );
}
