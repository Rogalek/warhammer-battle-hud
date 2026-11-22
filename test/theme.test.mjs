import { describe, expect, it } from "vitest";
import { resolveTheme } from "../scripts/bar/theme.mjs";

describe("wariant kolorystyki", () => {
  it("domyślny: WFRP ciemny, pozostałe systemy jak karta", () => {
    expect(resolveTheme("auto", "wfrp4e")).toBe("dark");
    for (const id of ["whtow", "impmal", "wrath-and-glory", "age-of-sigmar-soulbound"]) expect(resolveTheme("auto", id)).toBe("sheet");
  });
  it("wybór gracza wygrywa z domyślnym", () => {
    expect(resolveTheme("sheet", "wfrp4e")).toBe("sheet");
    expect(resolveTheme("dark", "whtow")).toBe("dark");
    expect(resolveTheme(undefined, "whtow")).toBe("sheet");
  });
});
