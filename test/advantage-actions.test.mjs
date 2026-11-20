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

  it("zakładka Przewagi jest pierwsza", () => {
    expect(LAYOUT[0]).toMatchObject({ id: "advantage", groups: [B.GROUP_IDS.momentum, B.GROUP_IDS.advantageActions, B.GROUP_IDS.gangOrders, B.GROUP_IDS.advantage], name5e: "WFRP4E_HUD.Tabs.Momentum" });
  });
});

describe("Impet (zasady 5e)", () => {
  const localize = (key) => key;
  const withMomentum = (momentum) => ({ type: "character", system: { status: { momentum, advantage: { value: 0, max: 10 } } } });

  it("w 5e zastępuje Przewagę i jej użycia", () => {
    const env = { config, localize, edition: "5e" };
    expect(B.buildAdvantage(withMomentum(false), env)).toEqual([]);
    expect(B.buildAdvantageActions(withMomentum(false), env)).toEqual([]);
    const [momentum] = B.buildMomentum(withMomentum(true), env);
    expect(momentum).toMatchObject({ encodedValue: "momentum", cssClass: "toggle active", info1: { text: "WFRP4E_HUD.MomentumOn" } });
    expect(B.buildMomentum(withMomentum(false), env)[0].cssClass).toBe("toggle");
  });

  it("w 4e go nie ma", () => {
    expect(B.buildMomentum(withMomentum(true), { config, localize, edition: "4e" })).toEqual([]);
    expect(B.buildAdvantage(withMomentum(false), { config, localize, edition: "4e" })).toHaveLength(1);
  });

  it("klik przełącza, prawy klik zdejmuje", () => {
    expect(resolveIntent("momentum", {})).toEqual({ intent: "increase" });
    expect(resolveIntent("momentum", { right: true })).toEqual({ intent: "decrease" });
  });
});
