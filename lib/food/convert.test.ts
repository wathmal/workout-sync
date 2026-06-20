import {
  fromFmaItem,
  fromFmaLabelItem,
  fromFmaAnalyzeItem,
  fmaComponentToMeal,
  scaleFmaItem,
  scaleMealComponents,
  displayComponents,
  pendingRawResponse,
} from "./convert";
import type {
  FmaItem,
  FmaComponent,
  FmaMacros,
  FmaMatched,
  FmaNutrients,
} from "./types";

const macros = (kcal: number, p = 0, c = 0, f = 0): FmaMacros => ({
  kcal,
  protein_g: p,
  carbs_g: c,
  fat_g: f,
});

const nutrients = (
  grams: number,
  m: FmaMacros,
  over: Partial<FmaNutrients> = {},
): FmaNutrients => ({
  basis: "per_portion",
  grams,
  serving: null,
  macros: m,
  per_100g: null,
  extra: null,
  ...over,
});

const matched = (over: Partial<FmaMatched> = {}): FmaMatched => ({
  food_id: 10908,
  source: "fdc",
  source_id: "2708403",
  name: "Rice, white, cooked",
  locale: "en-US",
  license: "U.S. Public Domain",
  ...over,
});

const comp = (over: Partial<FmaComponent> = {}): FmaComponent => ({
  input_name: "chicken, diced",
  matched: matched({ food_id: 14150, source: "afcd", source_id: "F000564", name: "Beef, diced" }),
  ratio: 0.35,
  nutrients: nutrients(63, macros(92.4, 17.4, 0, 2.5)),
  warnings: [],
  ...over,
});

describe("fromFmaItem", () => {
  it("maps a single matched item", () => {
    const it: FmaItem = {
      input_name: "white rice",
      kind: "single",
      matched: matched(),
      nutrients: nutrients(220, macros(283.8, 5.9, 61.6, 0.6)),
      confidence: 0.95,
      warnings: [],
    };
    const p = fromFmaItem(it, 0, "photo");
    expect(p.name).toBe("Rice, white, cooked");
    expect(p.kind).toBe("single");
    expect(p.enabled).toBe(true);
    expect(p.components).toBeUndefined();
    expect(p.fmaFoodId).toBe(10908);
    expect(p.grams).toBe(220);
    expect(p.kcal).toBeCloseTo(283.8);
    expect(p.basePerG?.kcal).toBeCloseTo(283.8 / 220);
  });

  it("reads the serving from nutrients (not matched)", () => {
    const it: FmaItem = {
      input_name: "crackers",
      kind: "single",
      matched: matched(),
      nutrients: nutrients(100, macros(539, 6.3, 57.5, 30.9), {
        basis: "per_100g",
        serving: { label: "15 g", amount: 15, unit: "g" },
      }),
      confidence: 0.9,
      warnings: [],
    };
    const p = fromFmaItem(it, 0, "barcode");
    expect(p.serving).toEqual({ label: "15 g", amount: 15, unit: "g" });
  });

  it("maps a composite (matched null) without throwing, name from input_name", () => {
    const it: FmaItem = {
      input_name: "chicken curry",
      kind: "composite",
      matched: null,
      components: [comp(), comp({ input_name: "coconut milk", nutrients: nutrients(54, macros(124.2, 1.2, 3, 12.9)) })],
      nutrients: nutrients(180, macros(384.2, 21.1, 11.5, 27.8)),
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
    expect(p.components?.[0].grams).toBe(63);
    expect(p.baseGrams).toBe(180);
  });

  it("disables a no_match single (kind single, matched null)", () => {
    const it: FmaItem = {
      input_name: "curry leaves",
      kind: "single",
      matched: null,
      nutrients: nutrients(4, macros(0)),
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
    const m = fmaComponentToMeal(comp());
    expect(m.matched).toEqual({ source: "afcd", name: "Beef, diced" });
    expect(m.grams).toBe(63);
    expect(m.kcal).toBeCloseTo(92.4);
    const unmatched = fmaComponentToMeal(comp({ input_name: "salt", matched: null, nutrients: nutrients(2, macros(0)) }));
    expect(unmatched.matched).toBeNull();
    expect(unmatched.name).toBe("salt"); // falls back to input_name
  });
});

describe("scaling", () => {
  it("scaleFmaItem scales nutrients, and each component, leaving the sidecar alone", () => {
    const it: FmaItem = {
      input_name: "chicken curry",
      kind: "composite",
      matched: null,
      components: [comp()],
      nutrients: nutrients(180, macros(384.2, 21.1, 11.5, 27.8), {
        per_100g: macros(213, 11.7, 6.4, 15.4),
        serving: { label: "1 bowl", amount: 180, unit: "g" },
      }),
      confidence: 1,
      warnings: [],
    };
    const scaled = scaleFmaItem(it, 2);
    expect(scaled.nutrients.grams).toBe(360);
    expect(scaled.nutrients.macros.kcal).toBeCloseTo(768.4);
    expect(scaled.components?.[0].nutrients.grams).toBe(126);
    expect(scaled.components?.[0].nutrients.macros.kcal).toBeCloseTo(184.8);
    // portion-independent fields untouched
    expect(scaled.nutrients.per_100g).toEqual(macros(213, 11.7, 6.4, 15.4));
    expect(scaled.nutrients.serving).toEqual({ label: "1 bowl", amount: 180, unit: "g" });
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
        nutrients: nutrients(180, macros(384.2)),
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
        nutrients: nutrients(180, macros(384.2)),
        confidence: 1,
        warnings: [],
      },
      0,
      "photo",
    );
    const raw = pendingRawResponse({ ...item, grams: 90 }) as FmaItem;
    expect(raw.nutrients.grams).toBeCloseTo(90);
    expect(raw.components?.[0].nutrients.grams).toBeCloseTo(31.5);

    const single = fromFmaItem(
      { input_name: "rice", kind: "single", matched: matched(), nutrients: nutrients(220, macros(283.8)), confidence: 1, warnings: [] },
      0,
      "photo",
    );
    expect(pendingRawResponse(single)).toBe(single.rawResponse); // unchanged
  });
});

describe("fromFmaLabelItem (per_serving, servings axis)", () => {
  // Big Arch shape: per_serving, brand, per_100g sidecar, unit-less serving.
  const bigArch: FmaItem = {
    input_name: "Big Arch",
    kind: "single",
    matched: null,
    source_ref: { kind: "label", brand: "McDonald's" },
    nutrients: nutrients(0, macros(1101, 58.8, 57.5, 69.2), {
      basis: "per_serving",
      serving: { label: "1 burger", amount: 1, unit: null },
      per_100g: macros(272, 14.5, 14.2, 17.1),
    }),
    confidence: 0.9,
    warnings: ["label_transcription"],
  };

  it("maps to a grams-free servings item with brand-prefixed name", () => {
    const p = fromFmaLabelItem(bigArch, 0);
    expect(p.name).toBe("McDonald's Big Arch");
    expect(p.source).toBe("label");
    expect(p.unit).toBe("serving");
    expect(p.servings).toBe(1);
    expect(p.servingLabel).toBe("1 burger");
    expect(p.grams).toBe(0);
    expect(p.basePerG).toBeNull();
    expect(p.kcal).toBeCloseTo(1101);
    expect(p.proteinG).toBeCloseTo(58.8);
    expect(p.warnings).toContain("label_transcription");
    expect(p.enabled).toBe(true);
  });

  it("falls back to input_name when brand is null, and serving label default", () => {
    const noBrand: FmaItem = {
      ...bigArch,
      source_ref: { kind: "label", brand: null },
      nutrients: nutrients(0, macros(389, 6.1, 43.3, 20.5), { basis: "per_serving", serving: null }),
    };
    const p = fromFmaLabelItem(noBrand, 1);
    expect(p.name).toBe("Big Arch");
    expect(p.servingLabel).toBe("1 serving");
  });

  it("fromFmaAnalyzeItem dispatches on basis", () => {
    const labelItem = fromFmaAnalyzeItem(bigArch, 0, "label");
    expect(labelItem.unit).toBe("serving");

    const gramItem = fromFmaAnalyzeItem(
      { input_name: "rice", kind: "single", matched: matched(), nutrients: nutrients(220, macros(283.8)), confidence: 1, warnings: [] },
      0,
      "text",
    );
    expect(gramItem.unit).toBeUndefined(); // grams axis (fromFmaItem leaves unit unset)
    expect(gramItem.grams).toBe(220);
  });
});

describe("real multi-dish sample (regression: no throw on matched:null)", () => {
  it("maps rice (single) + chicken curry + pol sambol (composite) to 3 items", () => {
    const items: FmaItem[] = [
      { input_name: "white rice", kind: "single", matched: matched(), nutrients: nutrients(220, macros(283.8)), confidence: 0.95, warnings: [] },
      { input_name: "chicken curry", kind: "composite", matched: null, components: [comp(), comp({ input_name: "onion" })], nutrients: nutrients(180, macros(384.2)), confidence: 1, warnings: ["decomposed_estimate"] },
      { input_name: "pol sambol", kind: "composite", matched: null, components: [comp({ input_name: "coconut, grated" })], nutrients: nutrients(80, macros(347.4)), confidence: 1, warnings: ["decomposed_estimate"] },
    ];
    const pending = items.map((it, i) => fromFmaItem(it, i, "photo"));
    expect(pending.map((p) => p.kind)).toEqual(["single", "composite", "composite"]);
    expect(pending.every((p) => p.enabled)).toBe(true);
    expect(pending[1].components).toHaveLength(2);
  });
});
