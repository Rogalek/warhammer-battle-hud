import { afterEach, describe, expect, it, vi } from "vitest";
import { gearAdapter, handsFor, widgetFor } from "../scripts/bar/hands.mjs";
import { buildEquipment as wfrpEquipment } from "../scripts/actions/builders.mjs";
import { towActions } from "../scripts/actions/tow.mjs";
import { buildEquipment as towEquipment } from "../scripts/actions/tow-builders.mjs";
import { wfrpActions } from "../scripts/actions/wfrp4e.mjs";

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

describe("kolejność rąk: ręka wiodąca zawsze pierwsza", () => {
  const actor = (handed) => ({ system: { handed, hands: { left: { document: null }, right: { document: null } } }, itemTypes: { weapon: [] } });
  it("Imperium Maledictum: wiodąca pierwsza, niezależnie od strony", () => {
    expect(handsFor("impmal").slots(actor("right")).map((s) => [s.key, s.role])).toEqual([["right", "main"], ["left", "off"]]);
    expect(handsFor("impmal").slots(actor("left")).map((s) => [s.key, s.role])).toEqual([["left", "main"], ["right", "off"]]);
    expect(handsFor("impmal").slots(actor("")).map((s) => s.role)).toEqual(["main", "off"]);
  });
  it("WFRP: slot 0 to ręka wiodąca, slot 1 druga", () => {
    const wfrp = { type: "character", system: { settings: { equipPoints: 2 } }, itemTypes: { weapon: [] } };
    expect(handsFor("wfrp4e").slots(wfrp).map((s) => s.role)).toEqual(["main", "off"]);
  });
});

describe("Magiczny Grymuar w HUD", () => {
  afterEach(() => vi.unstubAllGlobals());

  function setup(documents, api = { isEquippableGrimoire: (item) => item.kind === "grimoire" }) {
    vi.stubGlobal("game", { modules: new Map([["wfrp4e-grimoires", { active: true, api }]]) });
    return {
      type: "character",
      system: { settings: { equipPoints: 2 } },
      itemTypes: {
        weapon: documents.filter((item) => item.type === "weapon"),
        trapping: documents.filter((item) => item.type === "trapping")
      },
      items: new Map(documents.map((item) => [item.id, item]))
    };
  }

  function document(id, { type = "trapping", kind = "grimoire", hands = 2, equipped = false, refused = false } = {}) {
    const item = { id, uuid: `Actor.mage.Item.${id}`, name: id, type, kind, flags: {} };
    item.system = {
      equipPoints: hands, isEquipped: equipped,
      async toggleEquip() { if (!refused) this.isEquipped = !this.isEquipped; }
    };
    item.update = async (changes) => {
      if ("flags.warhammer-battle-hud.offhand" in changes) item.flags["warhammer-battle-hud"] = { offhand: changes["flags.warhammer-battle-hud.offhand"] };
      if ("system.offhand.value" in changes) item.system.offhand = { value: changes["system.offhand.value"] };
      if ("system.equippable" in changes) item.system.equippable = changes["system.equippable"];
      if ("system.equipped.value" in changes) item.system.equipped = { value: changes["system.equipped.value"] };
    };
    return item;
  }

  it("WFRP: dwuręczną księgę można wymienić z bronią i odłożyć", async () => {
    const sword = document("sword", { type: "weapon", equipped: true });
    const book = document("book");
    const actor = setup([sword, book]);
    const hands = widgetFor("wfrp4e", actor);
    expect(wfrpEquipment(actor).map((item) => item.encodedValue)).toContain("equip|book");
    await hands.hold(actor, "0", "book");
    expect(sword.system.isEquipped).toBe(false);
    expect(hands.slots(actor).map((slot) => slot.item?.id)).toEqual(["book", "book"]);
    await hands.hold(actor, "1", "sword");
    expect(book.system.isEquipped).toBe(false);
    expect(hands.slots(actor)[1].item?.id).toBe("sword");
    await hands.empty(actor, "1");
    expect(sword.system.isEquipped).toBe(false);
  });

  it("WFRP: księga jednoręczna pamięta drugą rękę, a księga bez rąk jest tylko w Ekwipunku", async () => {
    const sword = document("sword", { type: "weapon", equipped: true });
    const book = document("book", { hands: 1 });
    const free = document("free", { hands: 0 });
    const recipe = document("recipe", { kind: "alchemy" });
    const actor = setup([sword, book, free, recipe]);
    const hands = widgetFor("wfrp4e", actor);
    await hands.hold(actor, "1", "book");
    expect(hands.slots(actor).map((slot) => slot.item?.id)).toEqual(["sword", "book"]);
    expect(hands.options(actor).map((item) => item.id)).toEqual(["book", "sword"]);
    expect(wfrpEquipment(actor).map((item) => item.name)).toEqual(["book", "free", "sword"]);
  });

  it("WFRP: odzyskuje poprzednie wyposażenie, gdy system odrzuci założenie książki", async () => {
    const sword = document("sword", { type: "weapon", equipped: true });
    const book = document("book", { refused: true });
    const actor = setup([sword, book]);
    await widgetFor("wfrp4e", actor).hold(actor, "0", "book");
    expect(sword.system.isEquipped).toBe(true);
    expect(book.system.isEquipped).toBe(false);
  });

  it("WFRP: przełącznik Ekwipunku działa również dla księgi, która nie zajmuje rąk", async () => {
    const book = document("book", { hands: 0 });
    const actor = setup([book]);
    const [action] = wfrpEquipment(actor);
    const actions = wfrpActions(() => false);
    await actions.perform(actor, action.encodedValue, {});
    expect(wfrpEquipment(actor)[0].cssClass).toBe("toggle active");
    await actions.perform(actor, action.encodedValue, {});
    expect(wfrpEquipment(actor)[0].cssClass).toBe("toggle");
  });

  it("The Old World: starszą księgę można założyć w widżecie i odłożyć akcją Ekwipunku", async () => {
    const book = document("book", { equipped: true });
    const scroll = document("scroll", { kind: "scroll" });
    const actor = setup([book, scroll], { isGrimoire: (item) => item.kind === "grimoire", read: () => ({ kind: null }) });
    const gear = widgetFor("whtow", actor);
    const env = { localize: (key) => key };
    expect(gear.options(actor, "add").map((item) => item.id)).toEqual(["book"]);
    expect(towEquipment(actor, env).map((item) => item.cssClass)).toEqual(["toggle"]);
    await gear.hold(actor, "add", "book");
    expect(book.system.equippable).toBe(true);
    expect(gear.slots(actor).map((slot) => slot.key)).toEqual(["book", "add"]);
    const [action] = towEquipment(actor, env);
    expect(action.cssClass).toBe("toggle active");
    vi.stubGlobal("fromUuid", async () => book);
    await towActions(() => false).perform(actor, action.value, {});
    expect(gear.slots(actor).map((slot) => slot.key)).toEqual(["add"]);
  });
});
