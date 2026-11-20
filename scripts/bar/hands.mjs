/**
 * Ręce postaci w systemach, które mają zasady rąk:
 *  - WFRP: liczba rąk to punkty wyposażenia postaci (zwykle 2), broń dwuręczna zajmuje dwa,
 *    broń w drugiej ręce dostaje karę (nakłada ją system),
 *  - Imperium Maledictum: lewa i prawa ręka z ręką wiodącą; ręka bywa niesprawna (urazy).
 * Systemy bez wpisu nie pokazują rąk.
 */
import { planWfrpEquip, wfrpSlots } from "./hands-data.mjs";

const byName = (a, b) => String(a.name).localeCompare(String(b.name));
const option = (item, twoHanded) => ({ id: item.id, name: item.name, img: item.img, twoHanded: Boolean(twoHanded), equipped: Boolean(item.system?.isEquipped) });

const WFRP_FULL = ["character", "npc", "creature"];
const wfrpTwoHanded = (weapon) => Boolean(weapon.system?.twohanded?.value);

const HANDS = {
  wfrp4e: {
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

export const handsFor = (systemId) => HANDS[systemId] ?? null;
