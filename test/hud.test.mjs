import { describe, expect, it } from "vitest";
import { advantageLevel, advantageOf, clampAnchor, isAnchor } from "../scripts/bar/hud-data.mjs";

describe("położenie HUD-a", () => {
  it("rozpoznaje zapisane położenie", () => {
    expect(isAnchor({ x: 400, bottom: 120 })).toBe(true);
    expect(isAnchor({})).toBe(false);
    expect(isAnchor(undefined)).toBe(false);
    expect(isAnchor({ x: "400", bottom: 120 })).toBe(false);
  });

  it("zostawia położenie mieszczące się na ekranie", () => {
    expect(clampAnchor({ x: 500, bottom: 100 }, 300, 80, 1600, 900)).toEqual({ x: 500, bottom: 100 });
  });

  it("nie wypuszcza HUD-a poza ekran", () => {
    expect(clampAnchor({ x: 10, bottom: -50 }, 300, 80, 1600, 900)).toEqual({ x: 150, bottom: 0 });
    expect(clampAnchor({ x: 1590, bottom: 2000 }, 300, 80, 1600, 900)).toEqual({ x: 1450, bottom: 820 });
  });

  it("HUD szerszy niż ekran trzyma się środka", () => {
    expect(clampAnchor({ x: 0, bottom: 0 }, 2000, 80, 1600, 900).x).toBe(800);
  });
});

describe("Przewaga", () => {
  it("poziomy wyróżnienia", () => {
    expect(advantageLevel(0, 10)).toBe("none");
    expect(advantageLevel(2, 10)).toBe("low");
    expect(advantageLevel(5, 10)).toBe("high");
    expect(advantageLevel(10, 10)).toBe("max");
    expect(advantageLevel(6, 0)).toBe("high");
    expect(advantageLevel(3, 0)).toBe("low");
  });

  it("czyta Przewagę tylko z postaci, która pozwala ją zmieniać", () => {
    const modifyAdvantage = () => {};
    expect(advantageOf({ system: { status: { advantage: { value: 3, max: 8 } } }, modifyAdvantage })).toEqual({ value: 3, max: 8, level: "low" });
    expect(advantageOf({ system: { status: { advantage: { value: 3 } } } })).toBeNull();
    expect(advantageOf({ system: {}, modifyAdvantage })).toBeNull();
    expect(advantageOf(null)).toBeNull();
  });
});

describe("Impet na dużym liczniku (WFRP 5e)", () => {
  it("jest przełącznikiem tak/nie", async () => {
    const { momentumOf } = await import("../scripts/bar/hud-data.mjs");
    expect(momentumOf({ system: { status: { momentum: true } } })).toEqual({ value: 1, max: 0, active: true, level: "high" });
    expect(momentumOf({ system: { status: { momentum: false } } })).toMatchObject({ active: false, level: "none" });
    expect(momentumOf({ system: {} })).toBeNull();
  });
});
