import { describe, expect, it } from "vitest";
import { equipmentActions, gearForUse } from "../scripts/actions/system-panel.mjs";
import * as B from "../scripts/actions/builders.mjs";
import * as IM from "../scripts/actions/im-builders.mjs";
import * as WNG from "../scripts/actions/wng-builders.mjs";
import * as SB from "../scripts/actions/sb-builders.mjs";
import { resolveIntent } from "../scripts/actions/intent.mjs";

const env = { localize: (key) => key, config: {}, onlyEquipped: true };

describe("wspólna reguła broni w Walce", () => {
  const sword = { name: "Sword", on: true };
  const axe = { name: "Axe", on: false };
  const on = (item) => item.on;
  it("postać gracza: tylko założone (bez zastępowania całą bronią)", () => {
    expect(gearForUse({ type: "character" }, [sword, axe], on).map((i) => i.name)).toEqual(["Sword"]);
    expect(gearForUse({ type: "character" }, [axe], on)).toEqual([]);
  });
  it("BN-y i stwory: wszystko; ustawienie wyłączone: wszystko", () => {
    expect(gearForUse({ type: "npc" }, [sword, axe], on)).toHaveLength(2);
    expect(gearForUse({ type: "character" }, [sword, axe], on, { onlyEquipped: false })).toHaveLength(2);
  });
  it("typy postaci graczy zależą od systemu", () => {
    expect(gearForUse({ type: "agent" }, [sword, axe], on, { pcTypes: ["agent"] })).toHaveLength(1);
  });
});

describe("Ekwipunek w każdym systemie", () => {
  const item = (type, name, system) => ({ id: name, uuid: `Actor.a.Item.${name}`, name, type, img: "i.webp", system });
  it("wspólny kształt przełącznika", () => {
    const [a] = equipmentActions([{ name: "Sword", img: "s" }], { isEquipped: () => true, value: () => "equip|s", detail: () => 3, hint: "h" });
    expect(a).toMatchObject({ name: "Sword", value: "equip|s", detail: "3", cssClass: "toggle active", tooltip: { hint: "h" } });
  });
  it("Imperium Maledictum, Wrath & Glory, Soulbound", () => {
    const im = IM.buildEquipment({ itemTypes: { weapon: [item("weapon", "Las", { equipped: { value: true }, damage: { value: 4 } })], protection: [item("protection", "Flak", { equipped: { value: false }, armour: 2 })] } }, env);
    expect(im.map((a) => [a.value, a.cssClass, a.detail])).toEqual([["equip|Las", "toggle active", "4"], ["equip|Flak", "toggle", "2"]]);
    const wng = WNG.buildEquipment({ itemTypes: { weapon: [item("weapon", "Bolter", { equipped: false, damage: { formatted: "10" } })], armour: [] } }, env);
    expect(wng.map((a) => [a.value, a.cssClass])).toEqual([["equip|Bolter", "toggle"]]);
    const sb = SB.buildEquipment({ itemTypes: { weapon: [], armour: [item("armour", "Plate", { equipped: true, benefit: 2 })] } }, env);
    expect(sb.map((a) => [a.value, a.cssClass, a.detail])).toEqual([["equip|Plate", "toggle active", "2"]]);
  });
  it("WFRP: przełącznik z klikiem i prawym klikiem jak w pozostałych systemach", () => {
    const actions = B.buildEquipment({ itemTypes: { weapon: [item("weapon", "Miecz", { isEquipped: false, Damage: "+4" })], armour: [item("armour", "Kolczuga", { isEquipped: true })] } }, env);
    expect(actions.map((a) => [a.encodedValue, a.cssClass])).toEqual([["equip|Kolczuga", "toggle active"], ["equip|Miecz", "toggle"]]);
    expect(resolveIntent("equip", {})).toEqual({ intent: "use" });
    expect(resolveIntent("equip", { right: true })).toEqual({ intent: "sheet" });
  });
});

describe("WFRP: umiejętności w kolumnach według cech", () => {
  it("grupa na cechę z jej wartością, cechy bez umiejętności pominięte", () => {
    const skill = (name, ch, total) => ({ id: name, name, type: "skill", system: { characteristic: { value: ch }, total: { value: total } } });
    const actor = { system: { characteristics: { ws: { value: 41 }, ag: { value: 35 }, int: { value: 30 } } }, itemTypes: { skill: [skill("Unik", "ag", 45), skill("Walka Wręcz (Podstawowa)", "ws", 46), skill("Atletyka", "ag", 40)] } };
    const groups = B.buildSkillGroups(actor, { ...env, config: { characteristics: { ws: "WW", ag: "Zr", int: "Int" } } });
    expect(groups.map((g) => [g.label, g.actions.map((a) => `${a.name}:${a.info1.text}`)])).toEqual([["WW (41)", ["Walka Wręcz (Podstawowa):46"]], ["Zr (35)", ["Atletyka:40", "Unik:45"]]]);
  });
});
