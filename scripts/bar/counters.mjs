/**
 * Duży licznik z przodu HUD-a: zasób, który w danym systemie rozstrzyga o walce.
 *  - WFRP: Przewaga postaci (zmienia właściciel postaci),
 *  - Imperium Maledictum: Przewaga Taktyczna drużyny (ustawienie świata, zmienia MG – jak w trackerze walki).
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
  }
};

export const counterFor = (systemId) => COUNTERS[systemId] ?? null;
