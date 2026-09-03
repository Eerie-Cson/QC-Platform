import { Search, X } from "lucide-react";
import { FilterState } from "../hooks/useSessions";
import { FONT_UI } from "../constants";

interface TaskSearchInputProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
}

export function TaskSearchInput({ filters, setFilters }: TaskSearchInputProps) {
  const value = filters.taskSearch;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setFilters((prev) => ({ ...prev, taskSearch: next }));
  };

  const handleClear = () => {
    setFilters((prev) => ({ ...prev, taskSearch: "" }));
  };

  return (
    <div className="relative">
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="Search task or email..." // 👈 updated
        aria-label="Search by task or email"
        className={`w-full sm:w-56 rounded-lg border py-2.5 pl-9 text-sm transition-colors focus:outline-none focus:ring-2 ${
          value
            ? "border-blue-300 bg-blue-50 text-blue-700 font-medium pr-8 focus:ring-blue-600/15"
            : "border-slate-200 bg-white text-slate-700 pr-3 focus:ring-blue-600/15 focus:border-blue-400"
        }`}
        style={{ fontFamily: FONT_UI }}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-700 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
