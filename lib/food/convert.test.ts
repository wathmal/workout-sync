import {
  fromFmaItem,
  fmaComponentToMeal,
  scaleFmaItem,
  scaleMealComponents,
  displayComponents,
  pendingRawResponse,
} from "./convert";
import type { FmaItem, FmaComponent, FmaMacros, FmaMatched } from "./types";

const macros = (kcal: number, p = 0, c = 0, f = 0): FmaMacros => ({
  kcal,
  protein_g: p,
  carbs_g: c,
  fat_g: f,
});

const matched = (over: Partial<FmaMatched> = {}): FmaMatched => ({
  food_id: 10908,
  source: "fdc",
  source_id: "2708403",
  name: "Rice, white, cooked",
  locale: "en-US",
  license: "U.S. Public Domain",
  serving: null,
  ...over,
});

const comp = (over: Partial<FmaComponent> = {}): FmaComponent => ({
  input_name: "chicken, diced",
  matched: matched({ food_id: 14150, source: "afcd", source_id: "F000564", name: "Beef, diced" }),
  grams: 63,
  ratio: 0.35,
  macros: macros(92.4, 17.4, 0, 2.5),
  warnings: [],
  ...over,
});

describe("fromFmaItem", () => {
  it("maps a single matched item", () => {
    const it: FmaItem = {
      input_name: "white rice",
      kind: "single",
      matched: matched(),
      grams: 220,
      macros: macros(283.8, 5.9, 61.6, 0.6),
      confidence: 0.95,
      warnings: [],
    };
    const p = fromFmaItem(it, 0, "photo");
    expect(p.name).toBe("Rice, white, cooked");
    expect(p.kind).toBe("single");
    expect(p.enabled).toBe(true);
    expect(p.components).toBeUndefined();
    expect(p.fmaFoodId).toBe(10908);
    expect(p.basePerG?.kcal).toBeCloseTo(283.8 / 220);
  });

  it("maps a composite (matched null) without throwing, name from input_name", () => {
    const it: FmaItem = {
      input_name: "chicken curry",
      kind: "composite",
      matched: null,
      components: [comp(), comp({ input_name: "coconut milk", grams: 54, macros: macros(124.2, 1.2, 3, 12.9) })],
      grams: 180,
      macros: macros(384.2, 21.1, 11.5, 27.8),
      confidence: 1,
      warnings: ["decomposed_estimate"],
    };
    const p = fromFmaItem(it, 1, "photo");
    expect(p.kind).toBe("composite");
    expect(p.name).toBe("chicken curry"); // matched is null -> input_name
    expect(p.enabled).toBe(true);
    expect(p.fmaFoodId).toBeNull();
    expect(p.components).toHaveLength(2);
    expect(p.components?.[0].name).toBe("Beef, diced"); // component matched name
    expect(p.baseGrams).toBe(180);
  });

  it("disables a no_match single (kind single, matched null)", () => {
    const it: FmaItem = {
      input_name: "curry leaves",
      kind: "single",
      matched: null,
      grams: 4,
      macros: macros(0),
      confidence: 0,
      warnings: ["no_match"],
    };
    const p = fromFmaItem(it, 2, "text");
    expect(p.kind).toBe("single");
    expect(p.enabled).toBe(false); // unticked by default
    expect(p.name).toBe("curry leaves");
  });
});

describe("fmaComponentToMeal", () => {
  it("maps matched + unmatched components", () => {
    expect(fmaComponentToMeal(comp()).matched).toEqual({ source: "afcd", name: "Beef, diced" });
    const unmatched = fmaComponentToMeal(comp({ input_name: "salt", matched: null, macros: macros(0) }));
    expect(unmatched.matched).toBeNull();
    expect(unmatched.name).toBe("salt"); // falls back to input_name
  });
});

describe("scaling", () => {
  it("scaleFmaItem scales grams, macros, and each component", () => {
    const it: FmaItem = {
      input_name: "chicken curry",
      kind: "composite",
      matched: null,
      components: [comp()],
      grams: 180,
      macros: macros(384.2, 21.1, 11.5, 27.8),
      confidence: 1,
      warnings: [],
    };
    const scaled = scaleFmaItem(it, 2);
    expect(scaled.grams).toBe(360);
    expect(scaled.macros.kcal).toBeCloseTo(768.4);
    expect(scaled.components?.[0].grams).toBe(126);
    expect(scaled.components?.[0].macros.kcal).toBeCloseTo(184.8);
  });

  it("scaleMealComponents scales the camel breakdown", () => {
    const m = fmaComponentToMeal(comp());
    const [s] = scaleMealComponents([m], 0.5);
    expect(s.grams).toBe(31.5);
    expect(s.kcal).toBeCloseTo(46.2);
  });

  it("displayComponents rescales from base and recovers from 0", () => {
    const item = fromFmaItem(
      {
        input_name: "chicken curry",
        kind: "composite",
        matched: null,
        components: [comp()],
        grams: 180,
        macros: macros(384.2),
        confidence: 1,
        warnings: [],
      },
      0,
      "photo",
    );
    // at base grams -> unchanged
    expect(displayComponents(item)[0].grams).toBeCloseTo(63);
    // double grams -> double components
    expect(displayComponents({ ...item, grams: 360 })[0].grams).toBeCloseTo(126);
    // grams 0 -> 0, then back to base recovers (base is immutable)
    expect(displayComponents({ ...item, grams: 0 })[0].grams).toBe(0);
    expect(displayComponents({ ...item, grams: 180 })[0].grams).toBeCloseTo(63);
  });

  it("pendingRawResponse rescales a grams-edited composite, passes singles through", () => {
    const item = fromFmaItem(
      {
        input_name: "chicken curry",
        kind: "composite",
        matched: null,
        components: [comp()],
        grams: 180,
        macros: macros(384.2),
        confidence: 1,
        warnings: [],
      },
      0,
      "photo",
    );
    const raw = pendingRawResponse({ ...item, grams: 90 }) as FmaItem;
    expect(raw.grams).toBeCloseTo(90);
    expect(raw.components?.[0].grams).toBeCloseTo(31.5);

    const single = fromFmaItem(
      { input_name: "rice", kind: "single", matched: matched(), grams: 220, macros: macros(283.8), confidence: 1, warnings: [] },
      0,
      "photo",
    );
    expect(pendingRawResponse(single)).toBe(single.rawResponse); // unchanged
  });
});

describe("real multi-dish sample (regression: no throw on matched:null)", () => {
  it("maps rice (single) + chicken curry + pol sambol (composite) to 3 items", () => {
    const items: FmaItem[] = [
      { input_name: "white rice", kind: "single", matched: matched(), grams: 220, macros: macros(283.8), confidence: 0.95, warnings: [] },
      { input_name: "chicken curry", kind: "composite", matched: null, components: [comp(), comp({ input_name: "onion" })], grams: 180, macros: macros(384.2), confidence: 1, warnings: ["decomposed_estimate"] },
      { input_name: "pol sambol", kind: "composite", matched: null, components: [comp({ input_name: "coconut, grated" })], grams: 80, macros: macros(347.4), confidence: 1, warnings: ["decomposed_estimate"] },
    ];
    const pending = items.map((it, i) => fromFmaItem(it, i, "photo"));
    expect(pending.map((p) => p.kind)).toEqual(["single", "composite", "composite"]);
    expect(pending.every((p) => p.enabled)).toBe(true);
    expect(pending[1].components).toHaveLength(2);
  });
});
