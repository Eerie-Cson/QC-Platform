// hooks/useSessions.ts
import { useState, useEffect, useMemo, useCallback } from "react";
import { SessionRow, Ratings } from "../types";
import { isRatingEmpty, isRatingComplete } from "../utils";

export type FilterState = {
  lighting: string;
  sharpness: string;
  handVisibility: string;
  fovFraming: string;
  cameraAngle: string;
  idle: string;
  seated: string;
  environment: string;
  other: string;
  systemRating: string;
  reviewStatus: string;
  taskSearch: string;
};

const initialFilters: FilterState = {
  lighting: "All",
  sharpness: "All",
  handVisibility: "All",
  fovFraming: "All",
  cameraAngle: "All",
  idle: "All",
  seated: "All",
  environment: "All",
  other: "All",
  systemRating: "All",
  reviewStatus: "All",
  taskSearch: "",
};

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

  const [filters, setFilters] = useState<FilterState>(initialFilters);

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

  // ---------- Filtered rows with special handling for systemRating "None" ----------
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const rating = ratings[row.sessionId] || {};
      const match = (filterVal: string, actualVal: string | undefined) =>
        filterVal === "All" || actualVal === filterVal;

      // System rating logic (unchanged)
      let systemMatch = true;
      if (filters.systemRating === "All") {
        systemMatch = true;
      } else if (filters.systemRating === "None") {
        systemMatch = row.systemRating === "";
      } else {
        systemMatch = row.systemRating === filters.systemRating;
      }

      // Review status logic
      let statusMatch = true;
      const isEmpty = isRatingEmpty(rating);
      const isComplete = isRatingComplete(rating);
      if (filters.reviewStatus === "Rated") {
        statusMatch = isComplete;
      } else if (filters.reviewStatus === "In progress") {
        statusMatch = !isEmpty && !isComplete;
      } else if (filters.reviewStatus === "Pending") {
        statusMatch = isEmpty;
      } // "All" -> statusMatch stays true

      // Task name search — case-insensitive substring match
      const taskMatch =
        filters.taskSearch.trim() === "" ||
        row.task
          .toLowerCase()
          .includes(filters.taskSearch.trim().toLowerCase());

      return (
        match(filters.lighting, rating.lighting) &&
        match(filters.sharpness, rating.sharpness) &&
        match(filters.handVisibility, rating.handVisibility) &&
        match(filters.fovFraming, rating.fovFraming) &&
        match(filters.cameraAngle, rating.cameraAngle) &&
        match(filters.idle, rating.idle) &&
        match(filters.seated, rating.seated) &&
        match(filters.environment, rating.environment) &&
        match(filters.other, rating.other) &&
        systemMatch &&
        statusMatch &&
        taskMatch
      );
    });
  }, [rows, ratings, filters]);

  const hasActiveFilters = useMemo(
    () =>
      filters.taskSearch.trim() !== "" ||
      Object.entries(filters).some(
        ([key, v]) => key !== "taskSearch" && v !== "All",
      ),
    [filters],
  );

  const clearFilters = useCallback(() => setFilters(initialFilters), []);

  // ---------- submitRating and exportCSV (unchanged) ----------
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

        setRatings((prev) => {
          const newRatings = { ...prev };
          if (isEmpty) delete newRatings[sessionId];
          else newRatings[sessionId] = submittedRatings;
          return newRatings;
        });

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
    filteredRows,
    ratings,
    loading,
    error,
    reviewedCount,
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    submitRating,
    exportCSV,
    refetch: fetchSessions,
  };
}
