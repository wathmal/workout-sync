/**
 * Static mock data for the Overview surface. Each section's component
 * takes data as props; swap this module for a real API in follow-ups
 * without touching the components.
 *
 * Values mirror tmp/dashboard.html where applicable.
 */

export type SessionStatus = "done" | "planned" | "rest";
export type SessionSource = "hevy" | "garmin" | "calendar";

export interface Session {
  name: string;
  /** Where the card came from — shown as a small source label. */
  source?: SessionSource;
  /** Local start time, e.g. "07:00". */
  time?: string;
  /** Sub-line, e.g. "52m". Omitted for planned (calendar) cards. */
  meta?: string;
  status: SessionStatus;
}

export type DayName = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export interface DayAgenda {
  day: DayName;
  date: number;
  sessions: Session[];
  isToday?: boolean;
  isRest?: boolean;
}

export type CalDay = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export interface CalorieDay {
  day: CalDay;
  protein: number;
  carbs: number;
  fat: number;
  total: number;
  isToday?: boolean;
  isPlanned?: boolean;
}

export type {
  MuscleBucket,
  MuscleCoverageEntry,
  AttentionRow,
} from "./muscle-coverage";

export interface TrendPoint {
  date: string; // ISO YYYY-MM-DD
  bodyFatPct: number;
  weightKg: number;
}

export type LogKind = "workout" | "food" | "measurement";

export interface LogEntry {
  kind: LogKind;
  label: string;
  time: string;
}

export interface OverviewMock {
  heading: {
    date: string;       // "Saturday"
    week: number;
    fullDate: string;   // "May 23 · 2026"
    streak: number;
    weeklyLoad: number; // kg
    bodyFat: number;
    bodyFatDelta: number;
    raceInDays: number;
    title: string;
    subtitle: string;
  };
  calories: {
    week: CalorieDay[];
    targetTotal: number;
    targetProtein: number;
    targetCarbs: number;
    targetFat: number;
    todayMeals: { name: string; kcal: number; time: string }[];
    avgDelta: number;
  };
  muscles: {
    entries: import("./muscle-coverage").MuscleCoverageEntry[];
    attention: import("./muscle-coverage").AttentionRow[];
  };
  log: LogEntry[];
  actions: {
    lastSync: string; // e.g. "Synced 5m"
    quickAdd: { name: string; kcal: number }[];
  };
  trend: TrendPoint[]; // 90 days, oldest → newest
}

// ── 90 days of BF% + weight, gentle downward trend ─────────────────
function buildTrend(): TrendPoint[] {
  const pts: TrendPoint[] = [];
  const end = new Date("2026-05-23");
  const start = new Date(end);
  start.setDate(end.getDate() - 89);
  // start: BF 18.6, weight 85.1
  // end:   BF 17.4, weight 83.2
  for (let i = 0; i < 90; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const progress = i / 89;
    // base linear with tiny periodic noise so the line isn't dead-straight
    const noise = Math.sin(i * 0.55) * 0.06;
    const bf = 18.6 + (17.4 - 18.6) * progress + noise;
    const wkg = 85.1 + (83.2 - 85.1) * progress + noise * 0.4;
    pts.push({
      date: d.toISOString().slice(0, 10),
      bodyFatPct: Math.round(bf * 100) / 100,
      weightKg: Math.round(wkg * 100) / 100,
    });
  }
  return pts;
}

export const overviewMock: OverviewMock = {
  heading: {
    date: "Saturday",
    week: 21,
    fullDate: "May 23 · 2026",
    streak: 12,
    weeklyLoad: 23420,
    bodyFat: 17.4,
    bodyFatDelta: -0.8,
    raceInDays: 22,
    title: "Push day.",
    subtitle: "8 km easy after.",
  },

  calories: {
    week: [
      { day: "MON", protein: 680, carbs: 1280, fat: 792, total: 2752 },
      { day: "TUE", protein: 700, carbs: 1400, fat: 819, total: 2919 },
      { day: "WED", protein: 672, carbs: 1248, fat: 756, total: 2676 },
      { day: "THU", protein: 660, carbs: 1460, fat: 981, total: 3101 },
      { day: "FRI", protein: 712, carbs: 1160, fat: 711, total: 2583 },
      { day: "SAT", protein: 672, carbs: 960, fat: 774, total: 2406, isToday: true },
      { day: "SUN", protein: 0, carbs: 0, fat: 0, total: 0, isPlanned: true },
    ],
    targetTotal: 2855,
    targetProtein: 720,
    targetCarbs: 1280,
    targetFat: 855,
    todayMeals: [
      { name: "Oats + whey + banana", kcal: 620, time: "07:12" },
      { name: "Chicken bowl, rice, slaw", kcal: 880, time: "12:45" },
      { name: "Apple + almonds", kcal: 220, time: "15:30" },
      { name: "Eggs, sourdough, avo", kcal: 680, time: "19:05" },
    ],
    avgDelta: 180,
  },

  muscles: {
    entries: [
      { group: "chest", sets: 12, bucket: "met" },
      { group: "shoulders", sets: 8, bucket: "below" },
      { group: "biceps", sets: 6, bucket: "below" },
      { group: "abdominals", sets: 4, bucket: "below" },
      { group: "quadriceps", sets: 14, bucket: "met" },
      { group: "forearms", sets: 0, bucket: "untouched" },
      { group: "abductors", sets: 0, bucket: "untouched" },
      { group: "adductors", sets: 0, bucket: "untouched" },
      { group: "traps", sets: 10, bucket: "met" },
      { group: "lats", sets: 11, bucket: "met" },
      { group: "lower_back", sets: 3, bucket: "below" },
      { group: "upper_back", sets: 6, bucket: "below" },
      { group: "triceps", sets: 5, bucket: "below" },
      { group: "glutes", sets: 12, bucket: "met" },
      { group: "hamstrings", sets: 9, bucket: "below" },
      { group: "calves", sets: 0, bucket: "untouched" },
    ],
    attention: [
      { group: "abductors", label: "Abductors", meta: "0/10", bucket: "untouched", sets: 0, region: "lower" },
      { group: "adductors", label: "Adductors", meta: "0/10", bucket: "untouched", sets: 0, region: "lower" },
      { group: "calves", label: "Calves", meta: "0/10", bucket: "untouched", sets: 0, region: "lower" },
      { group: "forearms", label: "Forearms", meta: "0/10", bucket: "untouched", sets: 0, region: "upper" },
      { group: "lower_back", label: "Lower Back", meta: "3/10", bucket: "below", sets: 3, region: "lower" },
      { group: "abdominals", label: "Abdominals", meta: "4/10", bucket: "below", sets: 4, region: "upper" },
      { group: "triceps", label: "Triceps", meta: "5/10", bucket: "below", sets: 5, region: "upper" },
      { group: "biceps", label: "Biceps", meta: "6/10", bucket: "below", sets: 6, region: "upper" },
      { group: "upper_back", label: "Upper Back", meta: "6/10", bucket: "below", sets: 6, region: "upper" },
      { group: "shoulders", label: "Shoulders", meta: "8/10", bucket: "below", sets: 8, region: "upper" },
      { group: "hamstrings", label: "Hamstrings", meta: "9/10", bucket: "below", sets: 9, region: "lower" },
    ],
  },

  log: [
    { kind: "workout", label: "Pull — 58m · 6.2t", time: "Tue 18:24" },
    { kind: "measurement", label: "Body comp · 17.4% / 83.2kg", time: "Sat 07:10" },
    { kind: "food", label: "Chicken bowl · 880 kcal", time: "Fri 12:45" },
    { kind: "workout", label: "Hyrox sim — 48:32 PR", time: "Thu 17:55" },
    { kind: "measurement", label: "Waist 82.0 cm", time: "Sat 07:08" },
  ],

  actions: {
    lastSync: "Synced 5m",
    quickAdd: [
      { name: "Coffee", kcal: 5 },
      { name: "Ham & Cheese Croissant", kcal: 420 },
      { name: "Banana", kcal: 95 },
      { name: "Greek yogurt", kcal: 130 },
      { name: "Whey shake", kcal: 160 },
    ],
  },

  trend: buildTrend(),
};
