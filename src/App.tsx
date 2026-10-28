// App.tsx
import { useEffect, useState } from "react";
import { ArrowUp, ListChecks, ShieldCheck } from "lucide-react";
import { SessionReviewDashboard } from "./components/SessionReviewDashboard";
import { CrosscheckDashboard } from "./components/CrosscheckDashboard";
import { FONT_UI } from "./utilities/constants";

export default function App() {
  const [tab, setTab] = useState<"review" | "crosscheck">("review");
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div style={{ fontFamily: FONT_UI }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
      `}</style>
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2">
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
      {showTop && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Back to top"
          title="Back to top"
          className="fixed bottom-20 right-6 z-30 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white text-slate-600 border border-slate-200 shadow-lg shadow-slate-900/10 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40"
        >
          <ArrowUp size={16} />
        </button>
      )}
    </div>
  );
}
