import { ExternalLink } from "lucide-react";

interface SessionLinkProps {
  href: string;
  sessionId: string;
  onOpen: (sessionId: string) => void;
  fullWidth?: boolean; // new prop
}

export function SessionLink({
  href,
  sessionId,
  onOpen,
  fullWidth = false,
}: SessionLinkProps) {
  if (fullWidth) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onOpen(sessionId)}
        onAuxClick={() => onOpen(sessionId)}
        onContextMenu={() => onOpen(sessionId)}
        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50"
      >
        <ExternalLink size={13} /> Open footage
      </a>
    );
  }

  // Default: icon only
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onOpen(sessionId)}
      onAuxClick={() => onOpen(sessionId)}
      onContextMenu={() => onOpen(sessionId)}
      title="Open session"
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors"
    >
      <ExternalLink size={15} />
    </a>
  );
}
