import { buildAgenda, type BuildAgendaInput } from "./agenda";
import type { JoinedWorkout } from "@/lib/hevy/workouts-since";
import type { GarminActivity, CalendarItem } from "@/lib/agenda/types";

const TZ = "Australia/Sydney"; // UTC+10 in May 2026 (AEST, no DST)

function hevy(p: Partial<JoinedWorkout> & { start_time: string }): JoinedWorkout {
  return { id: "w", title: "", exercises: [], ...p };
}
function garmin(p: Partial<GarminActivity> & { startTime: string }): GarminActivity {
  return {
    garminId: "g",
    activityType: "running",
    name: null,
    durationS: null,
    distanceM: null,
    ...p,
  };
}
function cal(p: Partial<CalendarItem> & { start: string; title: string }): CalendarItem {
  return { gcalId: "c", ...p };
}

function base(overrides: Partial<BuildAgendaInput> = {}): BuildAgendaInput {
  return {
    hevy: [],
    garmin: [],
    calendar: [],
    now: new Date("2026-05-20T14:00:00+10:00"), // Wed 20 May, 14:00 Sydney
    tz: TZ,
    ...overrides,
  };
}

function dayOf(result: ReturnType<typeof buildAgenda>, name: string) {
  return result.days.find((d) => d.day === name)!;
}

describe("buildAgenda", () => {
  it("lays out Mon–Sun for the current week with a range label", () => {
    const { days, rangeLabel } = buildAgenda(base());
    expect(days.map((d) => d.day)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(days.map((d) => d.date)).toEqual([18, 19, 20, 21, 22, 23, 24]);
    expect(rangeLabel).toBe("May 18 – 24");
    expect(dayOf({ days, rangeLabel }, "Wed").isToday).toBe(true);
  });

  it("past day shows Hevy done card with duration", () => {
    const r = buildAgenda(
      base({
        hevy: [hevy({ title: "Pull", start_time: "2026-05-18T07:00:00+10:00", end_time: "2026-05-18T07:52:00+10:00" })],
      }),
    );
    const mon = dayOf(r, "Mon");
    expect(mon.isRest).toBeUndefined();
    expect(mon.sessions).toEqual([
      { name: "Pull", source: "hevy", time: "07:00", meta: "52m", status: "done" },
    ]);
  });

  it("drops a Garmin activity whose interval overlaps a Hevy workout, keeps non-overlapping ones", () => {
    const r = buildAgenda(
      base({
        hevy: [hevy({ title: "Push", start_time: "2026-05-18T07:00:00+10:00", end_time: "2026-05-18T08:00:00+10:00" })],
        garmin: [
          garmin({ garminId: "s", activityType: "strength_training", name: "Strength", durationS: 3000, startTime: "2026-05-18T07:10:00+10:00" }), // 07:10-08:00 overlaps -> drop
          garmin({ garminId: "run", activityType: "running", name: "Evening Run", durationS: 1800, startTime: "2026-05-18T18:00:00+10:00" }), // 18:00-18:30 no overlap -> keep
        ],
      }),
    );
    expect(dayOf(r, "Mon").sessions.map((s) => s.name)).toEqual(["Push", "Evening Run"]);
  });

  it("drops a Garmin RUN that overlaps a Hevy session (Hyrox sim logged in both)", () => {
    const r = buildAgenda(
      base({
        hevy: [hevy({ title: "Hyrox Sim", start_time: "2026-05-18T08:30:00+10:00", end_time: "2026-05-18T09:59:00+10:00" })],
        garmin: [garmin({ garminId: "r", activityType: "running", name: "Central Coast Running", durationS: 5377, startTime: "2026-05-18T08:20:00+10:00" })], // 08:20-09:50 overlaps
      }),
    );
    expect(dayOf(r, "Mon").sessions.map((s) => s.name)).toEqual(["Hyrox Sim"]);
  });

  it("keeps a Garmin run that is back-to-back (starts exactly when the Hevy workout ends)", () => {
    const r = buildAgenda(
      base({
        hevy: [hevy({ title: "Push", start_time: "2026-05-18T07:00:00+10:00", end_time: "2026-05-18T08:00:00+10:00" })],
        garmin: [garmin({ garminId: "r", activityType: "running", name: "Post Run", durationS: 1800, startTime: "2026-05-18T08:00:00+10:00" })], // touches end, strict overlap -> keep
      }),
    );
    expect(dayOf(r, "Mon").sessions.map((s) => s.name)).toEqual(["Push", "Post Run"]);
  });

  it("today before 21:00 shows actuals as soon as anything is logged (hybrid), ignoring the plan", () => {
    const r = buildAgenda(
      base({
        now: new Date("2026-05-20T14:00:00+10:00"),
        hevy: [hevy({ title: "Morning Push", start_time: "2026-05-20T07:00:00+10:00", end_time: "2026-05-20T08:00:00+10:00" })],
        calendar: [cal({ title: "Move Total", start: "2026-05-20T07:00:00+10:00" })],
      }),
    );
    const wed = dayOf(r, "Wed");
    expect(wed.sessions).toEqual([
      { name: "Morning Push", source: "hevy", time: "07:00", meta: "60m", status: "done" },
    ]);
  });

  it("today before 21:00 falls back to planned calendar when nothing is logged yet", () => {
    const r = buildAgenda(
      base({
        now: new Date("2026-05-20T14:00:00+10:00"),
        calendar: [cal({ title: "Move Total", start: "2026-05-20T07:00:00+10:00" })],
      }),
    );
    const wed = dayOf(r, "Wed");
    expect(wed.sessions).toEqual([
      { name: "Move Total", source: "calendar", time: "07:00", status: "planned" },
    ]);
  });

  it("today at/after 21:00 flips to actuals, ignores calendar", () => {
    const r = buildAgenda(
      base({
        now: new Date("2026-05-20T22:00:00+10:00"),
        hevy: [hevy({ title: "Morning Push", start_time: "2026-05-20T07:00:00+10:00", end_time: "2026-05-20T08:00:00+10:00" })],
        calendar: [cal({ title: "Move Total", start: "2026-05-20T07:00:00+10:00" })],
      }),
    );
    const wed = dayOf(r, "Wed");
    expect(wed.sessions).toEqual([
      { name: "Morning Push", source: "hevy", time: "07:00", meta: "60m", status: "done" },
    ]);
  });

  it("21:00 is the exact flip boundary", () => {
    const at2059 = buildAgenda(base({ now: new Date("2026-05-20T20:59:00+10:00"), calendar: [cal({ title: "Move Total", start: "2026-05-20T07:00:00+10:00" })] }));
    const at2101 = buildAgenda(base({ now: new Date("2026-05-20T21:01:00+10:00"), calendar: [cal({ title: "Move Total", start: "2026-05-20T07:00:00+10:00" })] }));
    expect(dayOf(at2059, "Wed").sessions[0].status).toBe("planned");
    expect(dayOf(at2101, "Wed").sessions).toEqual([]); // actuals path, no Hevy/Garmin -> empty
    expect(dayOf(at2101, "Wed").isRest).toBe(true);
  });

  it("future day shows planned calendar items, verbatim title, whitelist-only", () => {
    const r = buildAgenda(
      base({
        calendar: [
          cal({ title: "Perform Push 5x5", start: "2026-05-21T06:00:00+10:00" }),
          cal({ title: "Pay ANZ CC", start: "2026-05-21T09:00:00+10:00" }),
          cal({ title: "race prep", start: "2026-05-21T17:30:00+10:00" }),
        ],
      }),
    );
    const thu = dayOf(r, "Thu");
    expect(thu.sessions.map((s) => s.name)).toEqual(["Perform Push 5x5", "race prep"]);
    expect(thu.sessions.every((s) => s.status === "planned")).toBe(true);
  });

  it("marks empty days as rest", () => {
    const r = buildAgenda(base());
    expect(dayOf(r, "Fri").isRest).toBe(true);
    expect(dayOf(r, "Fri").sessions).toEqual([]);
  });

  it("buckets by LOCAL day, not UTC day", () => {
    // 2026-05-19T23:30Z == 2026-05-20T09:30 in Sydney -> belongs to Wed 20, not Tue 19.
    const r = buildAgenda(
      base({
        now: new Date("2026-05-20T22:00:00+10:00"), // so Wed uses actuals
        garmin: [garmin({ garminId: "x", activityType: "running", name: "Dawn Run", durationS: 1200, startTime: "2026-05-19T23:30:00Z" })],
      }),
    );
    expect(dayOf(r, "Tue").sessions).toEqual([]);
    expect(dayOf(r, "Wed").sessions.map((s) => s.name)).toEqual(["Dawn Run"]);
  });

  it("anchor selects a past week — every day renders as actuals, calendar ignored, none flagged today", () => {
    const r = buildAgenda(
      base({
        now: new Date("2026-05-20T14:00:00+10:00"), // real today: current week
        anchor: new Date("2026-05-13T12:00:00Z"), // Wed of the previous week
        hevy: [hevy({ title: "Last Pull", start_time: "2026-05-11T07:00:00+10:00", end_time: "2026-05-11T07:45:00+10:00" })],
        calendar: [cal({ title: "Perform Push", start: "2026-05-15T06:00:00+10:00" })],
      }),
    );
    expect(r.days.map((d) => d.date)).toEqual([11, 12, 13, 14, 15, 16, 17]);
    expect(r.rangeLabel).toBe("May 11 – 17");
    expect(dayOf(r, "Mon").sessions).toEqual([
      { name: "Last Pull", source: "hevy", time: "07:00", meta: "45m", status: "done" },
    ]);
    // Past week uses actuals for every day, so calendar planned items never show.
    expect(dayOf(r, "Fri").sessions).toEqual([]);
    expect(r.days.every((d) => !d.isToday)).toBe(true);
  });

  it("anchor === now is identical to the no-anchor current week", () => {
    const withAnchor = buildAgenda(base({ anchor: new Date("2026-05-20T14:00:00+10:00") }));
    const without = buildAgenda(base());
    expect(withAnchor).toEqual(without);
  });
});
