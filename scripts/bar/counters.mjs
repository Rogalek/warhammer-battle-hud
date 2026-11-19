/**
 * Duży licznik z przodu HUD-a: zasób, który w danym systemie rozstrzyga o walce.
 *  - WFRP: Przewaga postaci (zmienia właściciel postaci),
 *  - Imperium Maledictum: Przewaga Taktyczna drużyny (ustawienie świata, zmienia MG – jak w trackerze walki),
 *  - Wrath & Glory: Chwała drużyny (licznik systemu; gracze zmieniają ją, gdy MG na to pozwala).
 * Systemy bez wpisu nie mają licznika.
 */
import { advantageOf } from "./hud-data.mjs";

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
  }
};

export const counterFor = (systemId) => COUNTERS[systemId] ?? null;
