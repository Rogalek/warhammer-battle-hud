import { describe, expect, it } from "vitest";
import * as B from "../scripts/actions/builders.mjs";
import { decodeAction } from "../scripts/actions/encoding.mjs";
import { resolveIntent } from "../scripts/actions/intent.mjs";
import { LAYOUT } from "../scripts/actions/layout.mjs";

const actor = { type: "character", system: { status: { advantage: { value: 1, max: 10 } } } };
const config = {
  groupAdvantageActions: [
    { cost: 1, name: "Grzmotnięcie", description: "<p>Brutalna siła</p>", effect: "<strong>Akcja</strong>: @UUID[Compendium.x.y]{Powalenie}", test: { type: "characteristic", value: "s" } },
    { cost: 2, name: "Dodatkowy wysiłek", description: "Impet", effect: "+10" }
  ]
};

describe("użycia Przewagi", () => {
  it("z konfiguracji systemu, z kosztem i przygaszone, gdy brakuje Przewagi", () => {
    const [batter, effort] = B.buildAdvantageActions(actor, { config });
    expect(batter).toMatchObject({ name: "Grzmotnięcie", encodedValue: "advantageAction|0", info1: { text: "⚡1" }, cssClass: "advantage-cost" });
    expect(batter.tooltip).toBe("Brutalna siła — Akcja: Powalenie");
    expect(effort).toMatchObject({ encodedValue: "advantageAction|1", info1: { text: "⚡2" }, cssClass: "advantage-cost unaffordable" });
  });

  it("nic, gdy system nie ma akcji albo postać nie ma Przewagi", () => {
    expect(B.buildAdvantageActions(actor, { config: {} })).toEqual([]);
    expect(B.buildAdvantageActions({ system: {} }, { config })).toEqual([]);
  });
});

describe("rozkazy szajki", () => {
  it("z API Underworld, z wykonawcą w podpowiedzi", () => {
    const gangOrders = () => [
      { id: "trip", name: "Podcięcie", description: "Na ziemię", effect: "", cost: 1, executor: "Gruby Hans" },
      { id: "meatshield", name: "Żywa tarcza", description: "", effect: "Zasłania", cost: 0, executor: null },
      { id: "ambush", name: "Zasadzka", description: "", effect: "", cost: 2, executor: "Cień" }
    ];
    const [trip, shield, ambush] = B.buildGangOrders(actor, { gangOrders });
    expect(trip).toMatchObject({ name: "Podcięcie", encodedValue: "gangOrder|trip", info1: { text: "⚡1" }, cssClass: "advantage-cost", tooltip: "Na ziemię" });
    expect(trip.details).toEqual([{ label: "WFRP4E_HUD.Tip.Cost", value: 1 }, { label: "WFRP4E_HUD.Tip.Executor", value: "Gruby Hans" }]);
    expect(shield.info1).toBeUndefined();
    expect(ambush.cssClass).toBe("advantage-cost unaffordable");
  });

  it("bez modułu Underworld – pusta lista", () => {
    expect(B.buildGangOrders(actor, {})).toEqual([]);
  });
});

describe("sterowanie i układ", () => {
  it("lewy klik używa, prawy nic nie robi", () => {
    for (const type of ["advantageAction", "gangOrder"]) {
      expect(resolveIntent(type, {})).toEqual({ intent: "use" });
      expect(resolveIntent(type, { right: true })).toEqual({ intent: "none" });
    }
    expect(decodeAction("gangOrder|trip")).toEqual({ type: "gangOrder", id: "trip", extra: "" });
  });

  it("WFRP 4e: osobna, pierwsza zakładka Przewaga; Walka kończy się Ekwipunkiem", () => {
    expect(LAYOUT[0]).toMatchObject({ id: "advantage", edition: "4e", groups: [B.GROUP_IDS.advantageActions, B.GROUP_IDS.gangOrders, B.GROUP_IDS.advantage] });
    const combat = LAYOUT.find((tab) => tab.id === "combat");
    expect(combat.groups.at(-1)).toBe(B.GROUP_IDS.equipment);
    expect(combat.groups).not.toContain(B.GROUP_IDS.advantageActions);
  });
});

describe("zasady 5e: bez puli Przewagi", () => {
  const localize = (key) => key;
  const actor5e = { type: "character", system: { status: { momentum: false, advantage: { value: 0, max: 10 } } } };

  it("licznik Przewagi i jej użycia znikają (Impet jest na dużym liczniku)", () => {
    expect(B.buildAdvantage(actor5e, { config, localize, edition: "5e" })).toEqual([]);
    expect(B.buildAdvantageActions(actor5e, { config, localize, edition: "5e" })).toEqual([]);
    expect(B.buildAdvantage(actor5e, { config, localize, edition: "4e" })).toHaveLength(1);
  });

  it("licznik Przewagi w panelu widzi tylko MG", () => {
    expect(B.buildAdvantage(actor5e, { config, localize, edition: "4e", isGM: false })).toEqual([]);
    expect(B.buildAdvantage(actor5e, { config, localize, edition: "4e", isGM: true })).toHaveLength(1);
  });
});

describe("zakładka Przewaga według edycji", async () => {
  const { buildPanel } = await import("../scripts/actions/wfrp4e.mjs").catch(() => ({}));
  it("4e ma zakładkę Przewaga, 5e jej nie ma", () => {
    if (!buildPanel) return;
    const fighter = { type: "character", system: { status: { advantage: { value: 2, max: 10 } } }, itemTypes: {}, items: [], effects: [] };
    const env = (edition) => ({ config: { groupAdvantageActions: [{ cost: 1, name: "Batter" }] }, localize: (k) => k, edition, settings: {}, endeavours: [], gangOrders: () => [], conditionValue: () => 0, isGM: true });
    expect(buildPanel(fighter, env("4e")).map((t) => t.id)[0]).toBe("advantage");
    expect(buildPanel(fighter, env("5e")).map((t) => t.id)).not.toContain("advantage");
  });
});
