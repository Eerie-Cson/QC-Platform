// utilities/dailyStats.ts

export interface DailyStatDay {
  date: string; // YYYY-MM-DD (in the requested tz)
  submitted: number;
  processed: number;
}

export interface DailyStatsResult {
  timezone: string;
  startDate: string;
  endDate: string;
  days: DailyStatDay[];
  totals: {
    submitted: number;
    pending: number;
    inProgress: number;
    all: number;
  };
  today: {
    date: string;
    submitted: number;
    processed: number;
    pending: number;
    inProgress: number;
  };
  streak: { current: number; best: number };
  goal: { daily: number; todayProgress: number };
}

const SEVERITY_FIELDS = [
  "lighting",
  "sharpness",
  "handVisibility",
  "fovFraming",
  "cameraAngle",
  "idle",
  "seated",
  "environment",
  "other",
] as const;

function isRatingComplete(ratings: any): boolean {
  if (!ratings) return false;
  return SEVERITY_FIELDS.every((k) => {
    const v = ratings[k];
    return v !== null && v !== undefined && String(v).trim() !== "";
  });
}

function isRatingEmpty(ratings: any): boolean {
  if (!ratings) return true;
  return SEVERITY_FIELDS.every((k) => {
    const v = ratings[k];
    return v === null || v === undefined || String(v).trim() === "";
  });
}

// ---------- Timezone-aware date keys ----------

const tzCache = new Map<string, Intl.DateTimeFormat>();
function getFormatter(tz: string): Intl.DateTimeFormat {
  let f = tzCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    tzCache.set(tz, f);
  }
  return f;
}

export function ymdInTz(
  iso: string | undefined | null,
  tz: string,
): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = getFormatter(tz).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return null;
  return `${y}-${m}-${day}`;
}

function todayYmd(tz: string): string {
  const parts = getFormatter(tz).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

function addDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12)); // noon avoids DST edge cases
  t.setUTCDate(t.getUTCDate() + delta);
  const yy = t.getUTCFullYear();
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(t.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const t1 = Date.UTC(ay, am - 1, ad);
  const t2 = Date.UTC(by, bm - 1, bd);
  return Math.round((t2 - t1) / 86_400_000);
}

// ---------- Main computation ----------

export function computeDailyStats(
  sessions: any[],
  opts: { days?: number; tz?: string; goal?: number } = {},
): DailyStatsResult {
  const tz = opts.tz || "Asia/Manila";
  const windowDays = Math.min(Math.max(opts.days ?? 14, 1), 90);
  const goal = Math.max(opts.goal ?? 20, 0);

  const today = todayYmd(tz);
  const startDate = addDays(today, -(windowDays - 1));

  const submittedByDate = new Map<string, number>();
  const processedByDate = new Map<string, number>();

  let totalSubmitted = 0;
  let totalPending = 0;
  let totalInProgress = 0;
  const todayByStatus = {
    submitted: 0,
    processed: 0,
    pending: 0,
    inProgress: 0,
  };

  for (const s of sessions) {
    const isSubmitted = s?.submitted === true;
    const complete = isRatingComplete(s?.ratings);
    const hasRating = !isRatingEmpty(s?.ratings);

    // Attribute "done" sessions to the moment they were touched:
    //   submittedAt (rate-qc) → ratedAt (POST /api/ratings) → undefined
    const submissionDate =
      ymdInTz(s?.submittedAt, tz) ?? ymdInTz(s?.ratedAt, tz);
    const processedAt = ymdInTz(s?.processedAt, tz);

    if (isSubmitted || complete) {
      totalSubmitted++;
      if (submissionDate) {
        submittedByDate.set(
          submissionDate,
          (submittedByDate.get(submissionDate) || 0) + 1,
        );
        if (submissionDate === today) todayByStatus.submitted++;
      }
    } else if (hasRating) {
      totalInProgress++;
      todayByStatus.inProgress++;
    } else {
      totalPending++;
      todayByStatus.pending++;
    }

    if (processedAt) {
      processedByDate.set(
        processedAt,
        (processedByDate.get(processedAt) || 0) + 1,
      );
      if (processedAt === today) todayByStatus.processed++;
    }
  }

  const days: DailyStatDay[] = [];
  for (let i = 0; i < windowDays; i++) {
    const date = addDays(startDate, i);
    days.push({
      date,
      submitted: submittedByDate.get(date) || 0,
      processed: processedByDate.get(date) || 0,
    });
  }

  // Current streak: consecutive days ending today (or yesterday if today is 0)
  let current = 0;
  {
    let cursor = today;
    if ((submittedByDate.get(cursor) || 0) === 0) cursor = addDays(cursor, -1);
    while ((submittedByDate.get(cursor) || 0) > 0) {
      current++;
      cursor = addDays(cursor, -1);
    }
  }

  // Best streak: longest run of consecutive days with submitted > 0
  let best = 0;
  {
    const activeDates = Array.from(submittedByDate.entries())
      .filter(([, c]) => c > 0)
      .map(([d]) => d)
      .sort();
    let run = 0;
    let prev: string | null = null;
    for (const d of activeDates) {
      run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
      if (run > best) best = run;
      prev = d;
    }
  }

  return {
    timezone: tz,
    startDate,
    endDate: today,
    days,
    totals: {
      submitted: totalSubmitted,
      pending: totalPending,
      inProgress: totalInProgress,
      all: sessions.length,
    },
    today: { date: today, ...todayByStatus },
    streak: { current, best },
    goal: {
      daily: goal,
      todayProgress: goal > 0 ? Math.min(todayByStatus.submitted / goal, 1) : 0,
    },
  };
}
