import { useState } from "react";

export function useReviewingSession() {
  const [reviewingRowId, setReviewingRowId] = useState<string | null>(null);

  const handleOpenLink = (sessionId: string) => {
    setReviewingRowId(sessionId);
  };

  return { reviewingRowId, setReviewingRowId, handleOpenLink };
}
