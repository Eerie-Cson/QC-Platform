// App.tsx
import React, { useState } from "react";
import { ListChecks, ShieldCheck } from "lucide-react";
import { SessionReviewDashboard } from "./components/SessionReviewDashboard";
import { CrosscheckDashboard } from "./components/CrosscheckDashboard";
import { FONT_UI } from "./constants";

export default function App() {
  const [tab, setTab] = useState<"review" | "crosscheck">("review");

  return (
    <div style={{ fontFamily: FONT_UI }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
      `}</style>
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2">
          <button
            onClick={() => setTab("review")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              tab === "review"
                ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <ListChecks size={15} />
            Session Review
          </button>
          <button
            onClick={() => setTab("crosscheck")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              tab === "crosscheck"
                ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <ShieldCheck size={15} />
            Crosscheck
          </button>
        </div>
      </div>
      {tab === "review" ? <SessionReviewDashboard /> : <CrosscheckDashboard />}
    </div>
  );
}
