import {
  secsToClock,
  trainingStatusLabel,
  trend,
  sparkPoints,
  fmtVo2,
  chartPaths,
  movingAverage,
} from "./view";

describe("secsToClock", () => {
  it("formats sub-hour as m:ss", () => {
    expect(secsToClock(1296)).toBe("21:36"); // race-pred 5K
    expect(secsToClock(347)).toBe("5:47"); // a station time
  });
  it("formats hour+ as h:mm:ss", () => {
    expect(secsToClock(6708)).toBe("1:51:48"); // race-pred HM
    expect(secsToClock(15383)).toBe("4:16:23"); // race-pred marathon
  });
  it("returns em-dash for null / non-finite", () => {
    expect(secsToClock(null)).toBe("—");
    expect(secsToClock(Infinity)).toBe("—");
  });
});

describe("trainingStatusLabel", () => {
  it("maps known codes", () => {
    expect(trainingStatusLabel(5)).toBe("Peaking");
    expect(trainingStatusLabel(4)).toBe("Productive");
  });
  it("returns null for unknown / null", () => {
    expect(trainingStatusLabel(null)).toBeNull();
    expect(trainingStatusLabel(99)).toBeNull();
  });
});

describe("trend", () => {
  it("falling series is down", () => {
    expect(trend([58, 57, 56])).toEqual({ dir: "down", delta: -2 });
  });
  it("skips leading nulls", () => {
    expect(trend([null, 50, 51])).toEqual({ dir: "up", delta: 1 });
  });
  it("needs two points", () => {
    expect(trend([51])).toEqual({ dir: "flat", delta: null });
    expect(trend([null, null])).toEqual({ dir: "flat", delta: null });
  });
});

describe("sparkPoints", () => {
  it("returns empty string for no data", () => {
    expect(sparkPoints([])).toBe("");
    expect(sparkPoints([null, null])).toBe("");
  });
  it("emits one point per non-null value", () => {
    const pts = sparkPoints([1, 2, 3]);
    expect(pts.split(" ")).toHaveLength(3);
  });
  it("centers a single point", () => {
    expect(sparkPoints([5], 64, 20, 2)).toBe("32,10");
  });
});

describe("fmtVo2", () => {
  it("one decimal or dash", () => {
    expect(fmtVo2(51.1)).toBe("51.1");
    expect(fmtVo2(null)).toBe("—");
  });
});

describe("movingAverage", () => {
  it("trailing average over the window", () => {
    expect(movingAverage([2, 4, 6], 2)).toEqual([2, 3, 5]);
  });
  it("ignores nulls in the window", () => {
    expect(movingAverage([null, 4, 6], 2)).toEqual([null, 4, 5]);
  });
  it("smooths noise (3-wide)", () => {
    expect(movingAverage([3, 9, 3, 9], 3)).toEqual([3, 6, 5, 7]);
  });
});

describe("chartPaths", () => {
  it("returns null with no data", () => {
    expect(chartPaths([], 400, 140)).toBeNull();
    expect(chartPaths([null, null], 400, 140)).toBeNull();
  });
  it("builds a closed area path and an open line path", () => {
    const p = chartPaths([45, 47, 46, 48], 400, 140, 8);
    expect(p).not.toBeNull();
    expect(p!.line.startsWith("M")).toBe(true);
    expect(p!.line.includes("C")).toBe(true); // smoothed beziers
    expect(p!.area.trimEnd().endsWith("Z")).toBe(true);
    expect(p!.min).toBe(45);
    expect(p!.max).toBe(48);
  });
  it("plots the last point at the right edge", () => {
    const p = chartPaths([1, 2, 3], 400, 140, 8);
    expect(p!.lastX).toBeCloseTo(392, 0); // w - pad
  });
});
