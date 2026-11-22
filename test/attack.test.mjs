import { describe, expect, it } from "vitest";
import { attackFor } from "../scripts/bar/attack.mjs";

const item = (type, system, extra = {}) => ({ id: "i1", uuid: "Actor.a.Item.i1", type, system, ...extra });

describe("pasek ataku pod bronią – ta sama akcja co przycisk w panelu", () => {
  it("WFRP: wręcz, dystans i nienaładowana broń z Przeładowaniem", () => {
    expect(attackFor("wfrp4e", item("weapon", { isRanged: false }))).toEqual({ value: "weapon|i1", kind: "melee", ready: true });
    expect(attackFor("wfrp4e", item("weapon", { isRanged: true, loading: true, loaded: { value: false } }))).toEqual({ value: "weapon|i1", kind: "ranged", ready: false });
    expect(attackFor("wfrp4e", item("armour", {}))).toBeNull();
  });
  it("The Old World: broń po UUID, tarcza z testem obrony, zwykły pancerz bez paska", () => {
    expect(attackFor("whtow", item("weapon", { isRanged: true, requiresLoading: true, isLoaded: false }))).toEqual({ value: "weapon|Actor.a.Item.i1", kind: "ranged", ready: false });
    expect(attackFor("whtow", item("armour", { shield: true }))).toEqual({ value: "shield|Actor.a.Item.i1", kind: "shield", ready: true });
    expect(attackFor("whtow", item("armour", { shield: false }))).toBeNull();
  });
  it("Imperium Maledictum: pusty magazynek; broń biała zawsze gotowa", () => {
    expect(attackFor("impmal", item("weapon", { isRanged: true, mag: { value: 15, current: 0 } })).ready).toBe(false);
    expect(attackFor("impmal", item("weapon", { isRanged: false, mag: { value: 1, current: 0 } })).ready).toBe(true);
    expect(attackFor("impmal", item("protection", {}))).toBeNull();
  });
  it("Wrath & Glory i Soulbound", () => {
    expect(attackFor("wrath-and-glory", item("weapon", { isRanged: true, needsReload: true }))).toEqual({ value: "weapon|i1", kind: "ranged", ready: false });
    expect(attackFor("age-of-sigmar-soulbound", item("weapon", { isRanged: false }))).toEqual({ value: "weapon|i1", kind: "melee", ready: true });
    expect(attackFor("age-of-sigmar-soulbound", item("armour", {}))).toBeNull();
  });
  it("brak przedmiotu albo nieznany system: bez paska", () => {
    expect(attackFor("wfrp4e", null)).toBeNull();
    expect(attackFor("other", item("weapon", {}))).toBeNull();
  });
});
