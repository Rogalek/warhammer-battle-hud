/**
 * Ręce postaci w systemach, które mają zasady rąk:
 *  - WFRP: liczba rąk to punkty wyposażenia postaci (zwykle 2), broń dwuręczna zajmuje dwa,
 *    broń w drugiej ręce dostaje karę (nakłada ją system),
 *  - Imperium Maledictum: lewa i prawa ręka z ręką wiodącą; ręka bywa niesprawna (urazy).
 * Systemy, w których przedmioty się zakłada, ale nie ma zasad rąk (The Old World, Wrath & Glory, Soulbound),
 * dostają ten sam widżet w trybie „Wyposażenie”: pole na każdy założony przedmiot i pole „+”.
 * Systemy bez wpisu nie pokazują widżetu.
 */
import { planWfrpEquip, wfrpSlots } from "./hands-data.mjs";

const byName = (a, b) => String(a.name).localeCompare(String(b.name));
const option = (item, twoHanded) => ({ id: item.id, name: item.name, img: item.img, twoHanded: Boolean(twoHanded), equipped: Boolean(item.system?.isEquipped) });

const WFRP_FULL = ["character", "npc", "creature"];
const wfrpTwoHanded = (weapon) => Boolean(weapon.system?.twohanded?.value);

/**
 * Widżet „Wyposażenie” dla systemów bez rąk: założona broń i pancerz jako pola, ostatnie pole „+” zakłada kolejny.
 * @param {string[]} types                  typy przedmiotów do zakładania
 * @param {(item) => boolean} isEquipped
 * @param {(item, on: boolean) => Promise} setEquipped
 * @param {(item) => boolean} [twoHanded]  znacznik „2” (np. chwyt 2H w The Old World)
 */
export function gearAdapter({ types, isEquipped, setEquipped, twoHanded = () => false }) {
  const all = (actor) => types.flatMap((type) => [...(actor?.itemTypes?.[type] ?? [])]).sort(byName);
  const view = (item) => ({ id: item.id, name: item.name, img: item.img, twoHanded: Boolean(twoHanded(item)) });
  return {
    mode: "gear",
    supports: (actor) => all(actor).length > 0,
    hasItems: (actor) => all(actor).length > 0,
    slots: (actor) => [...all(actor).filter(isEquipped).map((item) => ({ key: item.id, role: "gear", item: view(item) })), { key: "add", role: "add", item: null }],
    /** Pole przedmiotu: zamiana na nieużywany przedmiot (albo pozostawienie); pole „+”: przedmioty do założenia. */
    options: (actor, key) => all(actor)
      .filter((item) => !isEquipped(item) || item.id === key)
      .map((item) => ({ ...view(item), equipped: isEquipped(item) })),
    async hold(actor, key, itemId) {
      if (key !== "add" && key !== itemId) {
        const current = actor.items.get(key);
        if (current && isEquipped(current)) await setEquipped(current, false);
      }
      const item = actor.items.get(itemId);
      if (item && !isEquipped(item)) await setEquipped(item, true);
    },
    async empty(actor, key) {
      const item = key === "add" ? null : actor.items.get(key);
      if (item && isEquipped(item)) await setEquipped(item, false);
    }
  };
}

const HANDS = {
  wfrp4e: {
    mode: "hands",
    hasItems: (actor) => Boolean(actor.itemTypes.weapon?.length),
    offhandHint: "WHAMMO.Hands.OffhandHintWfrp",
    supports: (actor) => WFRP_FULL.includes(actor?.type) && Number.isFinite(actor.system?.settings?.equipPoints),
    slots(actor) {
      const equipped = (actor.itemTypes.weapon ?? [])
        .filter((w) => w.system?.isEquipped)
        .map((w) => ({ id: w.id, name: w.name, img: w.img, twoHanded: wfrpTwoHanded(w), offhand: Boolean(w.system?.offhand?.value) }));
      return wfrpSlots(actor.system.settings.equipPoints, equipped);
    },
    options: (actor) => [...(actor.itemTypes.weapon ?? [])].sort(byName).map((w) => option(w, wfrpTwoHanded(w))),
    async hold(actor, key, weaponId) {
      const weapon = actor.items.get(weaponId);
      if (!weapon) return;
      const slots = this.slots(actor);
      const plan = planWfrpEquip(slots, Number(key), { id: weapon.id, twoHanded: wfrpTwoHanded(weapon), equipped: weapon.system.isEquipped });
      if (plan.error) return plan;
      // Najpierw odkładamy, żeby system (limit punktów wyposażenia) pozwolił założyć nową broń
      for (const id of plan.unequip) {
        const item = actor.items.get(id);
        if (item?.system.isEquipped) await item.system.toggleEquip();
      }
      if (plan.equip) await weapon.system.toggleEquip();
      // Założenie zeruje „drugą rękę”, więc ustawiamy ją osobno
      if (Boolean(weapon.system.offhand?.value) !== plan.offhand) await weapon.update({ "system.offhand.value": plan.offhand });
      return plan;
    },
    async empty(actor, key) {
      const id = this.slots(actor).find((s) => s.key === key)?.item?.id;
      const item = id && actor.items.get(id);
      if (item?.system.isEquipped) await item.system.toggleEquip();
    }
  },

  impmal: {
    mode: "hands",
    hasItems: (actor) => Boolean(actor.itemTypes.weapon?.length),
    offhandHint: "WHAMMO.Hands.OffhandHintIm",
    // Tylko postaci graczy mają ręce; BN-y zakładają broń bez nich
    supports: (actor) => Boolean(actor?.system?.hands?.left && actor.system.hands.right),
    slots(actor) {
      const { hands } = actor.system;
      // Postać bez wybranej ręki wiodącej: system przyjmuje prawą
      const handed = actor.system.handed || "right";
      return ["left", "right"].map((key) => {
        const doc = hands[key].document;
        return {
          key,
          role: key === handed ? "main" : "off",
          useless: Boolean(hands[key].useless),
          item: doc ? { id: doc.id, name: doc.name, img: doc.img, twoHanded: Boolean(doc.system?.traits?.has?.("twohanded")) } : null
        };
      });
    },
    options: (actor) => [...(actor.itemTypes.weapon ?? [])].sort(byName).map((w) => option(w, w.system?.traits?.has?.("twohanded"))),
    async hold(actor, key, weaponId) {
      const weapon = actor.items.get(weaponId);
      if (!weapon) return;
      // Broń przekładana z drugiej ręki: najpierw ją odkładamy, potem system kładzie ją we wskazanej
      if (weapon.system.isEquipped) await weapon.system.unequip();
      return weapon.system.equip(key);
    },
    async empty(actor, key) {
      return actor.system.hands[key]?.document?.system.unequip();
    }
  }
};

HANDS.whtow = gearAdapter({
  types: ["weapon", "armour"],
  isEquipped: (item) => Boolean(item.system?.isEquipped),
  setEquipped: (item, on) => item.update({ "system.equipped.value": on }),
  twoHanded: (item) => item.system?.grip === "2H"
});

HANDS["wrath-and-glory"] = gearAdapter({
  types: ["weapon", "armour"],
  isEquipped: (item) => Boolean(item.system?.equipped),
  setEquipped: (item, on) => item.update({ "system.equipped": on })
});

HANDS["age-of-sigmar-soulbound"] = gearAdapter({
  types: ["weapon", "armour"],
  isEquipped: (item) => Boolean(item.system?.equipped),
  setEquipped: (item, on) => item.update({ "system.equipped": on }),
  twoHanded: (item) => Boolean(item.system?.traitList?.twohanded)
});

// BN-y Imperium Maledictum nie mają rąk w systemie – zakładają przedmioty jak w trybie Wyposażenie
HANDS.impmal.fallback = gearAdapter({
  types: ["weapon", "protection"],
  isEquipped: (item) => Boolean(item.system?.equipped?.value),
  setEquipped: (item, on) => item.update({ "system.equipped.value": on })
});

export const handsFor = (systemId) => HANDS[systemId] ?? null;

/** Widżet dla tej postaci: ręce, gdy system je dla niej prowadzi, a w przeciwnym razie Wyposażenie (jeśli jest). */
export function widgetFor(systemId, actor) {
  const hands = handsFor(systemId);
  if (!hands) return null;
  if (hands.supports(actor)) return hands;
  return hands.fallback?.supports(actor) ? hands.fallback : null;
}
