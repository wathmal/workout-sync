/**
 * Static mock data for the Overview surface. Each section's component
 * takes data as props; swap this module for a real API in follow-ups
 * without touching the components.
 *
 * Values mirror tmp/dashboard.html where applicable.
 */

export type SessionTag = "push" | "pull" | "legs" | "run" | "hyrox" | "mob";
export type SessionStatus = "done" | "planned" | "rest";

export interface Session {
  name: string;
  tag: SessionTag;
  meta: string;
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

export type EventCategory = "hyrox" | "road" | "team";
export type EventStatus = "past" | "next" | "upcoming";

export interface RaceEvent {
  name: string;
  date: string;       // human label e.g. "Jun 14"
  fullDate: string;   // ISO YYYY-MM-DD for axis math
  category: EventCategory;
  meta: string;
  status: EventStatus;
  lane?: 1 | 2;
  result?: string;    // e.g. "1:25:00"
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

export type MuscleBucket = 1 | 2 | 3 | 4 | 5;

export interface MuscleCoverageEntry {
  group: string;
  bucket: MuscleBucket;
}

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
  agenda: DayAgenda[];
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
    front: MuscleCoverageEntry[];
    back: MuscleCoverageEntry[];
    attention: { label: string; meta: string; bucket: MuscleBucket }[];
  };
  races: RaceEvent[];
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

  agenda: [
    {
      day: "Mon",
      date: 18,
      sessions: [
        { name: "Push", tag: "push", meta: "52m · 5.8t", status: "done" },
        { name: "5 km easy", tag: "run", meta: "27:14 · z2", status: "done" },
      ],
    },
    {
      day: "Tue",
      date: 19,
      sessions: [
        { name: "Pull", tag: "pull", meta: "58m · 6.2t", status: "done" },
        { name: "Mobility", tag: "mob", meta: "22m", status: "done" },
      ],
    },
    {
      day: "Wed",
      date: 20,
      sessions: [
        { name: "Legs", tag: "legs", meta: "64m · 8.4t", status: "done" },
      ],
    },
    {
      day: "Thu",
      date: 21,
      sessions: [
        { name: "Hyrox sim", tag: "hyrox", meta: "48:32 · pr", status: "done" },
      ],
    },
    { day: "Fri", date: 22, sessions: [], isRest: true },
    {
      day: "Sat",
      date: 23,
      isToday: true,
      sessions: [
        { name: "Push", tag: "push", meta: "5×5 + acc.", status: "planned" },
        { name: "8 km easy", tag: "run", meta: "z2 · 42m", status: "planned" },
      ],
    },
    {
      day: "Sun",
      date: 24,
      sessions: [
        { name: "Long run", tag: "run", meta: "15 km · z2", status: "planned" },
      ],
    },
  ],

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
    attention: [
      { label: "Calves", meta: "9d stale · last May 14", bucket: 4 },
      { label: "Forearms · Triceps", meta: "no direct work · 14d+", bucket: 5 },
      { label: "Hamstrings", meta: "1 session · sub-volume", bucket: 3 },
    ],
    front: [
      { group: "chest", bucket: 1 },
      { group: "front-delts", bucket: 2 },
      { group: "biceps", bucket: 2 },
      { group: "abs", bucket: 3 },
      { group: "obliques", bucket: 4 },
      { group: "quads", bucket: 1 },
      { group: "forearms", bucket: 3 },
      { group: "adductors", bucket: 5 },
    ],
    back: [
      { group: "rear-delts", bucket: 4 },
      { group: "traps", bucket: 2 },
      { group: "lats", bucket: 2 },
      { group: "lower-back", bucket: 3 },
      { group: "triceps", bucket: 2 },
      { group: "glutes", bucket: 1 },
      { group: "hamstrings", bucket: 1 },
      { group: "calves", bucket: 4 },
    ],
  },

  races: [
    {
      name: "Hyrox Brisbane",
      date: "Apr 11",
      fullDate: "2026-04-11",
      category: "hyrox",
      meta: "mixed doubles",
      result: "1:25:00",
      status: "past",
    },
    {
      name: "Bay 2 Bay Run",
      date: "Jun 14",
      fullDate: "2026-06-14",
      category: "road",
      meta: "22d · 12 km",
      status: "next",
    },
    {
      name: "Hyrox Sydney",
      date: "Jul 5",
      fullDate: "2026-07-05",
      category: "hyrox",
      meta: "solo",
      status: "upcoming",
      lane: 2,
    },
    {
      name: "City 2 Surf",
      date: "Aug 9",
      fullDate: "2026-08-09",
      category: "road",
      meta: "14 km Sydney",
      status: "upcoming",
    },
    {
      name: "REVL Team Games",
      date: "Oct 24",
      fullDate: "2026-10-24",
      category: "team",
      meta: "Superordinary, BNE",
      status: "upcoming",
      lane: 2,
    },
    {
      name: "Hyrox Melbourne",
      date: "Dec · TBC",
      fullDate: "2026-12-15",
      category: "hyrox",
      meta: "mixed doubles",
      status: "upcoming",
    },
  ],

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
