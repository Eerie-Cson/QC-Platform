import { useState, useEffect, useMemo, useCallback } from "react";
import { SessionRow, Ratings } from "../types";
import { isRatingEmpty, isRatingComplete } from "../utils";

interface UseSessionsOptions {
  endpoint: string;
  ratingsEndpoint: string;
  exportEndpoint: string;
}

export function useSessions({
  endpoint,
  ratingsEndpoint,
  exportEndpoint,
}: UseSessionsOptions) {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [ratings, setRatings] = useState<Record<string, Ratings>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:5000${endpoint}`);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      const data = await res.json();
      setRows(data);
      const initialRatings: Record<string, Ratings> = {};
      data.forEach((row: SessionRow) => {
        if (row.ratings && !isRatingEmpty(row.ratings)) {
          initialRatings[row.sessionId] = row.ratings;
        }
      });
      setRatings(initialRatings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const submitRating = useCallback(
    async (
      sessionId: string,
      submittedRatings: Ratings,
      systemRating?: string,
      faceVisible?: boolean,
    ) => {
      const isEmpty = isRatingEmpty(submittedRatings);
      const payload: any = {
        sessionId,
        faceVisible,
        ...(isEmpty ? {} : { ratings: submittedRatings }),
      };
      if (systemRating !== undefined) {
        payload.systemRating = systemRating;
      }
      try {
        const res = await fetch(`http://localhost:5000${ratingsEndpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to save rating");
        const data = await res.json();
        const updatedSession = data.session;

        // Update ratings state
        setRatings((prev) => {
          const newRatings = { ...prev };
          if (isEmpty) delete newRatings[sessionId];
          else newRatings[sessionId] = submittedRatings;
          return newRatings;
        });

        // Update rows state with the server response (ensures systemRating is correct)
        if (updatedSession) {
          setRows((prevRows) =>
            prevRows.map((row) =>
              row.sessionId === updatedSession.sessionId ? updatedSession : row,
            ),
          );
        }

        return { success: true, data };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    },
    [ratingsEndpoint],
  );

  const exportCSV = useCallback(async () => {
    try {
      const res = await fetch(`http://localhost:5000${exportEndpoint}`);
      if (!res.ok) throw new Error("Failed to export CSV");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exportEndpoint.includes("crosscheck")
        ? `crosschecked_footages - ${new Date().toISOString().split("T")[0]}.csv`
        : `rated_footages - ${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }, [exportEndpoint]);

  const reviewedCount = useMemo(
    () => Object.values(ratings).filter(isRatingComplete).length,
    [ratings],
  );

  return {
    rows,
    ratings,
    loading,
    error,
    reviewedCount,
    submitRating,
    exportCSV,
    refetch: fetchSessions,
  };
}
