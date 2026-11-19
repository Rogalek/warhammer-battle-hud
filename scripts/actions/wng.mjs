/**
 * Panel akcji Wrath & Glory – zakładki z wng-builders.mjs, wykonanie przez API systemu
 * (te same metody, których używa karta postaci).
 */
import * as B from "./wng-builders.mjs";
import { finishPanel, systemActions, testContext } from "./system-panel.mjs";

const WNG = B.WNG;
const ITEM_BACKED = new Set([WNG.weapon, WNG.armour, WNG.power, WNG.ability, WNG.sheet]);

const env = () => ({ config: game.wng?.config ?? {}, localize: (key) => game.i18n.localize(key), statusEffects: CONFIG.statusEffects });
const label = (key) => game.i18n.localize(`WHB_WNG.${key}`);
const group = (key, actions) => ({ label: label(`Groups.${key}`), actions });

export function wngPanel(actor, e = env()) {
  const combat = B.buildCombat(actor, e);
  const abilities = B.buildAbilities(actor, e);
  const status = B.buildStatus(actor, e);
  return finishPanel([
    { id: "combat", groups: [group("Melee", combat.melee), group("Ranged", combat.ranged), group("Tests", combat.tests), group("Armour", combat.armour)] },
    { id: "attributes", groups: [group("Attributes", B.buildAttributes(actor, e))] },
    { id: "skills", columns: 4, groups: B.buildSkillGroups(actor, e) },
    { id: "powers", groups: [group("Powers", B.buildPowers(actor, e))] },
    { id: "abilities", groups: [group("Abilities", abilities.abilities), group("Talents", abilities.talents), group("Keywords", abilities.keywords)] },
    { id: "status", groups: [group("Resources", status.resources), group("Conditions", status.conditions), group("Injuries", status.injuries)] }
  ], label);
}

async function perform(actor, { type, id }, mods, settings) {
  if (mods.right && ITEM_BACKED.has(type)) return actor.items.get(id)?.sheet?.render({ force: true });
  const context = testContext(mods, settings);
  switch (type) {
    case WNG.attribute: return actor.setupAttributeTest(id, context);
    case WNG.skill: return actor.setupSkillTest(id, context);
    case WNG.generic: return actor.setupGenericTest(id, context);
    case WNG.weapon: return actor.setupWeaponTest(id, context);
    case WNG.power: return actor.setupPowerTest(id, context);
    case WNG.ability: return actor.setupAbilityRoll(id, context);
    case WNG.initiative: return actor.rollInitiative({ createCombatants: true });
    case WNG.armour:
    case WNG.sheet: return actor.items.get(id)?.sheet?.render({ force: true });
    case WNG.condition:
      if (mods.right || actor.hasCondition(id)) return actor.removeCondition(id);
      return actor.addCondition(id);
    case WNG.wrath:
      return actor.update({ "system.resources.wrath": Math.max(0, (actor.system.resources.wrath ?? 0) + (mods.right ? -1 : 1)) });
    case WNG.faith: {
      const { current = 0, total = 0 } = actor.system.resources.faith ?? {};
      return actor.update({ "system.resources.faith.current": Math.max(0, Math.min(total, current + (mods.right ? -1 : 1))) });
    }
  }
}

export const wngActions = (getSetting) => systemActions(getSetting, { panel: wngPanel, types: WNG, perform, name: "Wrath & Glory" });
