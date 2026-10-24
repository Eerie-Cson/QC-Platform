import { ExternalLink } from "lucide-react";
import React from "react";

interface SessionLinkProps {
  href: string;
  sessionId: string;
  onOpen: (sessionId: string, href: string) => void;
  fullWidth?: boolean;
}

export function SessionLink({
  href,
  sessionId,
  onOpen,
  fullWidth = false,
}: SessionLinkProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Stops the browser from opening a standard tab
    onOpen(sessionId, href);
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
      // Middle click
      e.preventDefault();
      onOpen(sessionId, href);
    }
  };

  if (fullWidth) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        onAuxClick={handleAuxClick}
        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 cursor-pointer"
      >
        <ExternalLink size={13} /> Open footage
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      onAuxClick={handleAuxClick}
      title="Open session"
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
    >
      <ExternalLink size={15} />
    </a>
  );
}
