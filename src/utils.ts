import { Ratings } from "./types";
import { SEVERITY_FIELDS } from "./constants";

export function formatTimestamp(isoString: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatFileDate(file: string): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  const timestamp = `${year}-${month}-${day}_${hours}${minutes}`;

  const fileName =
    file === "crosscheck"
      ? `${timestamp}_crosschecked_footages.csv`
      : `${timestamp}_rated_footages.csv`;

  return fileName;
}

export function emptyRating(): Ratings {
  return {
    lighting: "",
    sharpness: "",
    handVisibility: "",
    fovFraming: "",
    cameraAngle: "",
    idle: "",
    seated: "",
    environment: "",
    other: "",
    comment: "",
    slowLoading: false,
    crosscheckComment: "",
  };
}

export function isRatingEmpty(rating: Ratings | undefined): boolean {
  if (!rating) return true;
  const fields: (keyof Ratings)[] = [
    "lighting",
    "sharpness",
    "handVisibility",
    "fovFraming",
    "cameraAngle",
    "idle",
    "seated",
    "environment",
    "other",
    "comment",
    "slowLoading",
    "crosscheckComment",
  ];
  return fields.every((key) => {
    const val = rating[key];
    if (key === "slowLoading") return val === false || val === undefined;
    return val === "" || val === undefined;
  });
}

export function isRatingComplete(rating: Ratings | undefined): boolean {
  if (!rating) return false;
  if (rating.other === "Unavailable") {
    return true;
  }
  const severityDone = SEVERITY_FIELDS.every((f) => !!rating[f.key]);
  return (
    severityDone && !!rating.seated && !!rating.environment && !!rating.other
  );
}

export function generateComment(
  rating: Ratings,
  faceVisible: boolean,
  excludeCameraAndFov: boolean = false, // new parameter
): string {
  const parts: string[] = [];
  let hasAnyField = false;

  const fieldLabels: Record<string, string> = {
    lighting: "Lighting",
    sharpness: "Sharpness",
    handVisibility: "Hand visibility",
    fovFraming: "FOV framing",
    cameraAngle: "Camera angle",
    idle: "Idle",
  };

  SEVERITY_FIELDS.forEach(({ key }) => {
    // Skip cameraAngle and fovFraming if excluded
    if (
      excludeCameraAndFov &&
      (key === "cameraAngle" || key === "fovFraming")
    ) {
      return;
    }
    const val = rating[key];
    if (!val) return;
    hasAnyField = true;
    if (val !== "No issue") {
      parts.push(`${val} ${fieldLabels[key]} issue`);
    }
  });

  if (rating.seated && rating.seated !== "Standing/ Moving") {
    hasAnyField = true;
    parts.push(rating.seated);
  }
  if (rating.environment && rating.environment !== "Correct Task") {
    hasAnyField = true;
    parts.push(rating.environment);
  }
  if (rating.other && rating.other !== "No issue" && !rating.slowLoading) {
    hasAnyField = true;
    const otherLabel =
      rating.other === "Processing" || rating.other === "Unavailable"
        ? rating.other
        : `Other issue (${rating.other.toLowerCase()})- privacy concern`;
    parts.push(otherLabel);
  }

  if (rating.slowLoading) {
    hasAnyField = true;
    parts.push("Slow loading...");
  }

  if (faceVisible) {
    hasAnyField = true;
    parts.push("Face/s visible");
  }

  // Add orientation note if flag is set
  if (excludeCameraAndFov) {
    // Avoid duplicate note
    if (!parts.some((p) => p.includes("Wrong camera orientation"))) {
      // Ensure we have at least something to show
      parts.push("Wrong camera orientation");
      hasAnyField = true;
    }
  }

  if (!hasAnyField) return "";
  if (parts.length === 0) return "No issue";
  return parts.join("\n");
}

export function toggleStrikethrough(text: string, start: number, end: number) {
  const selected = text.substring(start, end);
  const hasMarkers = selected.startsWith("~~") && selected.endsWith("~~");
  const newSelected = hasMarkers ? selected.slice(2, -2) : `~~${selected}~~`;
  const newText = text.substring(0, start) + newSelected + text.substring(end);
  return {
    newText,
    newStart: start,
    newEnd: start + newSelected.length,
  };
}
