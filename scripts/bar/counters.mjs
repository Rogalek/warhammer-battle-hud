/**
 * Duży licznik z przodu HUD-a: zasób, który w danym systemie rozstrzyga o walce.
 *  - WFRP: Przewaga postaci (zmienia właściciel postaci),
 *  - Imperium Maledictum: Przewaga Taktyczna drużyny (ustawienie świata, zmienia MG – jak w trackerze walki),
 *  - Wrath & Glory: Chwała drużyny (licznik systemu; gracze zmieniają ją, gdy MG na to pozwala),
 *  - Soulbound: Ogień Duszy drużyny (jak wyżej).
 * Systemy bez wpisu nie mają licznika.
 */
import { advantageOf, momentumOf } from "./hud-data.mjs";
import { is5e } from "../actions/edition.mjs";

const COUNTERS = {
  wfrp4e: {
    label: "WHAMMO.Advantage",
    hint: "WHAMMO.AdvantageHint",
    read: (actor) => advantageOf(actor),
    canEdit: (actor) => actor.isOwner,
    change: (actor, delta) => actor.modifyAdvantage(delta)
  },
  impmal: {
    label: "WHAMMO.Superiority",
    hint: "WHAMMO.SuperiorityHint",
    readOnlyHint: "WHAMMO.SuperiorityReadOnly",
    read: () => {
      const resources = game.impmal?.resources;
      return resources ? { value: Number(resources.get("superiority")) || 0, max: 0 } : null;
    },
    canEdit: () => game.user.isGM,
    change: (_actor, delta) => game.impmal.resources.set("superiority", Math.max(0, (Number(game.impmal.resources.get("superiority")) || 0) + delta)),
    hooks: ["impmal:superiorityChanged"]
  },
  "wrath-and-glory": {
    label: "WHAMMO.Glory",
    hint: "WHAMMO.GloryHint",
    readOnlyHint: "WHAMMO.GloryReadOnly",
    read: () => ({ value: Number(game.settings.get("wrath-and-glory", "glory")) || 0, max: Number(game.settings.get("wrath-and-glory", "gloryMax")) || 0 }),
    // Jak licznik systemu: gracze zmieniają Chwałę ręcznie tylko wtedy, gdy MG na to pozwala
    canEdit: () => game.user.isGM || game.settings.get("wrath-and-glory", "playerCounterEdit"),
    change: (_actor, delta) => game.wng.RuinGloryCounter.changeCounter(delta, "glory"),
    hooks: ["updateSetting"]
  },
  "age-of-sigmar-soulbound": {
    label: "WHAMMO.Soulfire",
    hint: "WHAMMO.SoulfireHint",
    readOnlyHint: "WHAMMO.SoulfireReadOnly",
    read: () => ({ value: Number(game.settings.get("age-of-sigmar-soulbound", "soulfire")) || 0, max: 0 }),
    canEdit: () => game.user.isGM || game.settings.get("age-of-sigmar-soulbound", "playerCounterEdit"),
    change: (_actor, delta) => game.counter.constructor.changeCounter(delta, "soulfire"),
    hooks: ["updateSetting"]
  }
};

/**
 * WFRP z zasadami 5e nie ma puli Przewagi: karta postaci pokazuje Impet (tak/nie).
 * Klik przełącza go, prawy klik zdejmuje; resztę (zdobycie po wygranym teście wręcz albo szarży,
 * utrata po obrażeniach, przegranym teście, stanie, końcu walki) liczy sam system.
 */
const MOMENTUM = {
  label: "WHAMMO.Momentum",
  hint: "WHAMMO.MomentumHint",
  toggle: true,
  read: (actor) => momentumOf(actor),
  canEdit: (actor) => actor.isOwner,
  change: (actor, delta) => actor.update({ "system.status.momentum": delta > 0 ? !actor.system.status.momentum : false })
};

export const counterFor = (systemId) => (systemId === "wfrp4e" && is5e() ? MOMENTUM : COUNTERS[systemId] ?? null);
