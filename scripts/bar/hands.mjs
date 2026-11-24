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
import { MODULE_ID } from "./constants.mjs";
import { equippableGrimoires, setTowEquipped, towIsEquipped } from "../grimoire-equipment.mjs";

const byName = (a, b) => String(a.name).localeCompare(String(b.name));
const option = (item, twoHanded) => ({ id: item.id, name: item.name, img: item.img, twoHanded: Boolean(twoHanded), equipped: Boolean(item.system?.isEquipped) });

const WFRP_FULL = ["character", "npc", "creature"];
const wfrpHeldItems = (actor) => [
  ...(actor?.itemTypes?.weapon ?? []),
  ...equippableGrimoires(actor).filter((item) => item.system?.equipPoints > 0)
];
const wfrpTwoHanded = (item) => item.type === "trapping" ? item.system.equipPoints === 2 : Boolean(item.system?.twohanded?.value);
const wfrpOffhand = (item) => Boolean(item.type === "trapping" ? item.flags?.[MODULE_ID]?.offhand : item.system?.offhand?.value);

async function setWfrpOffhand(item, offhand) {
  if (wfrpOffhand(item) === offhand) return;
  // Trappings have no system offhand field. Weapons still use the system field for attack penalties.
  const path = item.type === "trapping" ? `flags.${MODULE_ID}.offhand` : "system.offhand.value";
  await item.update({ [path]: offhand });
}

/**
 * Widżet „Wyposażenie” dla systemów bez rąk: założona broń i pancerz jako pola, ostatnie pole „+” zakłada kolejny.
 * @param {string[]} types                  typy przedmiotów do zakładania
 * @param {(item) => boolean} isEquipped
 * @param {(item, on: boolean) => Promise} setEquipped
 * @param {(item) => boolean} [twoHanded]  znacznik „2” (np. chwyt 2H w The Old World)
 * @param {(actor) => Array} [extraItems] dodatkowe przedmioty obsługiwane przez adapter
 */
export function gearAdapter({ types, isEquipped, setEquipped, twoHanded = () => false, extraItems = () => [] }) {
  const all = (actor) => [...types.flatMap((type) => [...(actor?.itemTypes?.[type] ?? [])]), ...extraItems(actor)].sort(byName);
  const view = (item) => ({ id: item.id, name: item.name, img: item.img, twoHanded: Boolean(twoHanded(item)) });
  return {
    mode: "gear",
    supports: (actor) => all(actor).length > 0,
    hasItems: (actor) => all(actor).length > 0,
    slots: (actor) => [...all(actor).filter(isEquipped).map((item) => ({ key: item.id, role: "gear", item: view(item) })), { key: "add", role: "add", item: null }],
    /** Pole przedmiotu: zamiana na nieużywany przedmiot tego samego rodzaju (broń na broń, pancerz na pancerz); pole „+”: wszystko do założenia. */
    options(actor, key) {
      const type = key === "add" ? null : actor.items.get(key)?.type;
      return all(actor)
        .filter((item) => (!isEquipped(item) || item.id === key) && (!type || item.type === type))
        .map((item) => ({ ...view(item), equipped: isEquipped(item) }));
    },
    async hold(actor, key, itemId) {
      const item = all(actor).find((candidate) => candidate.id === itemId);
      if (!item) return;
      if (key !== "add" && key !== itemId) {
        const current = actor.items.get(key);
        if (current && isEquipped(current)) await setEquipped(current, false);
      }
      if (!isEquipped(item)) await setEquipped(item, true);
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
    hasItems: (actor) => wfrpHeldItems(actor).length > 0,
    offhandHint: "WHAMMO.Hands.OffhandHintWfrp",
    supports: (actor) => WFRP_FULL.includes(actor?.type) && Number.isFinite(actor.system?.settings?.equipPoints),
    slots(actor) {
      const equipped = wfrpHeldItems(actor)
        .filter((item) => item.system?.isEquipped)
        .map((item) => ({ ...option(item, wfrpTwoHanded(item)), offhand: wfrpOffhand(item) }));
      return wfrpSlots(actor.system.settings.equipPoints, equipped);
    },
    options: (actor) => wfrpHeldItems(actor).sort(byName).map((item) => option(item, wfrpTwoHanded(item))),
    async hold(actor, key, itemId) {
      const item = wfrpHeldItems(actor).find((candidate) => candidate.id === itemId);
      if (!item) return;
      const slots = this.slots(actor);
      const plan = planWfrpEquip(slots, Number(key), option(item, wfrpTwoHanded(item)));
      if (plan.error) return plan;
      const removed = [];
      let ready = false;
      try {
        // Najpierw zwalniamy ręce, żeby system pozwolił założyć nowy przedmiot.
        for (const id of plan.unequip) {
          const held = actor.items.get(id);
          if (!held?.system.isEquipped) continue;
          const offhand = wfrpOffhand(held);
          await held.system.toggleEquip();
          if (held.system.isEquipped) return;
          removed.push({ item: held, offhand });
        }
        if (plan.equip && !item.system.isEquipped) await item.system.toggleEquip();
        if (!item.system.isEquipped) return;
        ready = true;
        await setWfrpOffhand(item, plan.offhand);
        return plan;
      } finally {
        if (!ready) {
          for (const previous of removed) {
            if (!previous.item.system.isEquipped) await previous.item.system.toggleEquip();
            if (previous.item.system.isEquipped) await setWfrpOffhand(previous.item, previous.offhand);
          }
        }
      }
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
      // Wszędzie ta sama kolejność: ręka wiodąca pierwsza (po lewej), druga ręka za nią – jak w WFRP
      return [handed, handed === "left" ? "right" : "left"].map((key) => {
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
  isEquipped: towIsEquipped,
  setEquipped: setTowEquipped,
  extraItems: equippableGrimoires,
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
