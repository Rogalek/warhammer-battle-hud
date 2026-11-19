import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

/** Klucze podpowiedzi składane w kodzie (tip(env, "X")) nie są widoczne dla walidatora tłumaczeń. */
const used = new Set();
for (const file of readdirSync("scripts/actions")) {
  const source = readFileSync(`scripts/actions/${file}`, "utf8");
  for (const match of source.matchAll(/tip\(env, "([A-Za-z]+)"/g)) used.add(match[1]);
}

describe("klucze podpowiedzi", () => {
  for (const lang of ["en", "pl"]) {
    it(`${lang}: każdy wiersz podpowiedzi ma tłumaczenie`, () => {
      const tips = JSON.parse(readFileSync(`lang/${lang}.json`, "utf8")).WFRP4E_HUD.Tip;
      expect([...used].filter((key) => !(key in tips))).toEqual([]);
    });
  }
});
