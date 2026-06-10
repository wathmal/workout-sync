import { favoriteSignature, signatureFromMealItems } from "./favorite-signature";
import type { MealItem } from "./types";

describe("favoriteSignature", () => {
  it("is order-independent across items", () => {
    const a = favoriteSignature("Lunch", ["Chicken", "Rice", "Salad"]);
    const b = favoriteSignature("Lunch", ["Salad", "Chicken", "Rice"]);
    expect(a).toBe(b);
  });

  it("is portion-agnostic (grams never enter the signature)", () => {
    // Same names, different portions handled by caller — signature ignores grams entirely.
    const a = favoriteSignature("Lunch", ["Chicken", "Rice"]);
    const b = favoriteSignature("Lunch", ["Chicken", "Rice"]);
    expect(a).toBe(b);
  });

  it("normalizes case and whitespace", () => {
    const a = favoriteSignature("  Big   Breakfast ", ["  EGGS ", "bacon"]);
    const b = favoriteSignature("big breakfast", ["eggs", "BACON"]);
    expect(a).toBe(b);
  });

  it("treats a null meal name like an empty one", () => {
    const a = favoriteSignature(null, ["Apple"]);
    const b = favoriteSignature("", ["Apple"]);
    expect(a).toBe(b);
  });

  it("distinguishes different meal names", () => {
    const a = favoriteSignature("Lunch", ["Chicken"]);
    const b = favoriteSignature("Dinner", ["Chicken"]);
    expect(a).not.toBe(b);
  });

  it("distinguishes different item sets", () => {
    const a = favoriteSignature("Lunch", ["Chicken", "Rice"]);
    const b = favoriteSignature("Lunch", ["Chicken", "Rice", "Beans"]);
    expect(a).not.toBe(b);
  });

  it("drops blank item names", () => {
    const a = favoriteSignature("Snack", ["Banana", "  ", ""]);
    const b = favoriteSignature("Snack", ["Banana"]);
    expect(a).toBe(b);
  });

  it("signatureFromMealItems uses the batch meal name + item names", () => {
    const items = [
      { mealName: "Lunch", name: "Rice" },
      { mealName: "Lunch", name: "Chicken" },
    ] as MealItem[];
    expect(signatureFromMealItems(items)).toBe(
      favoriteSignature("Lunch", ["Rice", "Chicken"]),
    );
  });
});
