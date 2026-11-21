import { describe, expect, it } from "vitest";
import { gearAdapter, handsFor, widgetFor } from "../scripts/bar/hands.mjs";

/** Atrapa aktora: przedmioty z polem `on` (założone) zmieniane przez setEquipped. */
function makeActor(list) {
  const items = list.map((i) => ({ ...i, img: `${i.id}.webp`, system: { on: i.on, grip: i.grip } }));
  const byType = (type) => items.filter((i) => i.type === type);
  return { items: { get: (id) => items.find((i) => i.id === id) }, itemTypes: { weapon: byType("weapon"), armour: byType("armour") }, list: items };
}
const adapter = () => gearAdapter({
  types: ["weapon", "armour"],
  isEquipped: (item) => Boolean(item.system.on),
  setEquipped: async (item, on) => { item.system.on = on; },
  twoHanded: (item) => item.system.grip === "2H"
});
const equipped = (actor) => actor.list.filter((i) => i.system.on).map((i) => i.id).sort();

describe("widżet Wyposażenie (systemy bez rąk)", () => {
  const fresh = () => makeActor([
    { id: "sword", name: "Sword", type: "weapon", on: true },
    { id: "halberd", name: "Halberd", type: "weapon", on: false, grip: "2H" },
    { id: "mail", name: "Mail", type: "armour", on: true }
  ]);

  it("pole na każdy założony przedmiot i pole „+” na końcu", () => {
    const slots = adapter().slots(fresh());
    expect(slots.map((s) => [s.key, s.role])).toEqual([["mail", "gear"], ["sword", "gear"], ["add", "add"]]);
  });

  it("„+” proponuje tylko nieużywane przedmioty, ze znacznikiem dwuręcznej", () => {
    expect(adapter().options(fresh(), "add").map((o) => [o.id, o.twoHanded])).toEqual([["halberd", true]]);
    expect(adapter().options(fresh(), "sword").map((o) => o.id)).toEqual(["halberd", "sword"]);
    // Zamiana tylko na ten sam rodzaj: w polu pancerza nie ma broni
    expect(adapter().options(fresh(), "mail").map((o) => o.id)).toEqual(["mail"]);
  });

  it("założenie przez „+”, zamiana w polu i odłożenie", async () => {
    const actor = fresh();
    const gear = adapter();
    await gear.hold(actor, "add", "halberd");
    expect(equipped(actor)).toEqual(["halberd", "mail", "sword"]);
    await gear.hold(actor, "sword", "halberd");
    expect(equipped(actor)).toEqual(["halberd", "mail"]);
    await gear.empty(actor, "mail");
    expect(equipped(actor)).toEqual(["halberd"]);
    await gear.empty(actor, "add");
    expect(equipped(actor)).toEqual(["halberd"]);
  });

  it("bez przedmiotów do zakładania widżetu nie ma", () => {
    expect(adapter().supports(makeActor([]))).toBe(false);
  });
});

describe("który widżet dostaje system", () => {
  it("ręce w WFRP i Imperium Maledictum, Wyposażenie w pozostałych", () => {
    expect(handsFor("wfrp4e").mode).toBe("hands");
    expect(handsFor("impmal").mode).toBe("hands");
    for (const id of ["whtow", "wrath-and-glory", "age-of-sigmar-soulbound"]) expect(handsFor(id).mode).toBe("gear");
  });
  it("BN Imperium Maledictum bez rąk w systemie dostaje Wyposażenie", () => {
    const npc = { system: {}, itemTypes: { weapon: [{ id: "w", name: "Stub", system: { equipped: { value: false } } }], protection: [] } };
    expect(widgetFor("impmal", npc).mode).toBe("gear");
    const pc = { system: { hands: { left: {}, right: {} } }, itemTypes: { weapon: [] } };
    expect(widgetFor("impmal", pc).mode).toBe("hands");
  });
});
