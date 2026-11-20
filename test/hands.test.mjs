import { describe, expect, it } from "vitest";
import { groupSlots, handsUsed, planWfrpEquip, wfrpSlots } from "../scripts/bar/hands-data.mjs";

const sword = { id: "sword", name: "Sword", twoHanded: false, offhand: false };
const dagger = { id: "dagger", name: "Dagger", twoHanded: false, offhand: true };
const shield = { id: "shield", name: "Shield", twoHanded: false, offhand: false };
const halberd = { id: "halberd", name: "Halberd", twoHanded: true, offhand: false };
const ids = (slots) => slots.map((s) => s.item?.id ?? null);

describe("ręce WFRP – układ", () => {
  it("pusta postać ma tyle pustych rąk, ile punktów wyposażenia", () => {
    const slots = wfrpSlots(2, []);
    expect(slots.map((s) => s.role)).toEqual(["main", "off"]);
    expect(ids(slots)).toEqual([null, null]);
    expect(handsUsed(slots)).toBe(0);
  });

  it("broń w drugiej ręce trafia do slotu drugiej ręki", () => {
    expect(ids(wfrpSlots(2, [dagger, sword]))).toEqual(["sword", "dagger"]);
    expect(ids(wfrpSlots(2, [dagger]))).toEqual([null, "dagger"]);
  });

  it("broń dwuręczna zajmuje obie ręce i łączy się w jeden przycisk", () => {
    const slots = wfrpSlots(2, [halberd]);
    expect(ids(slots)).toEqual(["halberd", "halberd"]);
    const groups = groupSlots(slots);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ span: 2, keys: ["0", "1"], role: "main" });
  });

  it("trzecia ręka (np. z mutacji) mieści kolejną broń", () => {
    const slots = wfrpSlots(3, [halberd, shield]);
    expect(ids(slots)).toEqual(["halberd", "halberd", "shield"]);
    expect(slots[2].role).toBe("extra");
  });

  it("broń ponad liczbę rąk jest oznaczona", () => {
    const slots = wfrpSlots(2, [sword, shield, dagger]);
    expect(slots).toHaveLength(3);
    expect(slots[2].over).toBe(true);
    expect(handsUsed(slots)).toBe(2);
  });
});

describe("ręce WFRP – zmiana broni", () => {
  it("broń do pustej ręki: zakłada bez zdejmowania", () => {
    const slots = wfrpSlots(2, [sword]);
    expect(planWfrpEquip(slots, 1, { id: "shield", twoHanded: false, equipped: false })).toEqual({ unequip: [], equip: true, offhand: true });
  });

  it("broń do zajętej ręki: odkłada to, co w niej było", () => {
    const slots = wfrpSlots(2, [sword, dagger]);
    expect(planWfrpEquip(slots, 0, { id: "axe", twoHanded: false, equipped: false })).toEqual({ unequip: ["sword"], equip: true, offhand: false });
  });

  it("dwuręczna broń odkłada obie bronie", () => {
    const slots = wfrpSlots(2, [sword, dagger]);
    const plan = planWfrpEquip(slots, 1, { id: "halberd", twoHanded: true, equipped: false });
    expect(plan.unequip.sort()).toEqual(["dagger", "sword"]);
    expect(plan).toMatchObject({ equip: true, offhand: false });
  });

  it("jednoręczna w miejsce dwuręcznej zwalnia obie ręce", () => {
    const slots = wfrpSlots(2, [halberd]);
    expect(planWfrpEquip(slots, 1, { id: "dagger", twoHanded: false, equipped: false })).toEqual({ unequip: ["halberd"], equip: true, offhand: true });
  });

  it("przełożenie założonej broni do drugiej ręki zmienia tylko rękę", () => {
    const slots = wfrpSlots(2, [sword]);
    expect(planWfrpEquip(slots, 1, { id: "sword", twoHanded: false, equipped: true })).toEqual({ unequip: [], equip: false, offhand: true });
  });

  it("broń ponad limit zostaje odłożona, gdy brakuje rąk", () => {
    const slots = wfrpSlots(2, [sword, shield, dagger]);
    const plan = planWfrpEquip(slots, 0, { id: "axe", twoHanded: false, equipped: false });
    expect(plan.unequip).toContain("sword");
    expect(plan.unequip.length).toBeGreaterThanOrEqual(2);
  });

  it("jedna ręka nie uniesie broni dwuręcznej", () => {
    expect(planWfrpEquip(wfrpSlots(1, []), 0, { id: "halberd", twoHanded: true, equipped: false })).toEqual({ error: "NoHands" });
  });
});
