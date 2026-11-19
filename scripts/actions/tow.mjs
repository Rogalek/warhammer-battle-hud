/**
 * Panel akcji Warhammer: The Old World – zakładki z tow-builders.mjs, wykonanie przez API systemu whtow
 * (te same metody, których używa karta postaci).
 */
import * as B from "./tow-builders.mjs";
import { finishPanel, systemActions, testContext } from "./system-panel.mjs";

const TOW = B.TOW;

/** Typy, które prawym klikiem otwierają kartę przedmiotu. */
const ITEM_BACKED = new Set([TOW.weapon, TOW.ability, TOW.shield, TOW.armour, TOW.spell, TOW.use, TOW.wound]);

const env = () => ({
  config: game.oldworld?.config ?? {},
  localize: (key) => game.i18n.localize(key),
  isGM: game.user.isGM
});

const label = (key) => game.i18n.localize(`WHB_TOW.${key}`);
const group = (key, actions) => ({ label: label(`Groups.${key}`), actions });

/** Zakładki z grupami; puste grupy i zakładki znikają. */
export function towPanel(actor, e = env()) {
  const combat = B.buildCombat(actor, e);
  const magic = B.buildMagic(actor, e);
  const usable = B.buildUsable(actor, e);
  const status = B.buildStatus(actor, e);
  const tabs = [
    { id: "combat", groups: [group("Actions", B.buildCombatActions(e)), group("Melee", combat.melee), group("Ranged", combat.ranged), group("Reload", combat.reload), group("Attacks", combat.attacks), group("Armour", combat.armour)] },
    { id: "skills", columns: 4, groups: B.buildSkillGroups(actor, e) },
    { id: "magic", groups: [group("Casting", magic.lores), group("Spells", magic.spells), group("Miscasts", magic.miscasts)] },
    { id: "religion", groups: [group("Blessing", B.buildBlessing(actor, e))] },
    { id: "talents", groups: [group("Talents", usable.talents), group("Abilities", usable.abilities), group("Lores", usable.lores)] },
    { id: "status", groups: [group("Fate", status.fate), group("Conditions", status.conditions), group("Wounds", status.wounds)] }
  ];
  return finishPanel(tabs, label);
}

async function openSheet(uuid) {
  const doc = await fromUuid(uuid);
  return doc?.sheet?.render({ force: true });
}

async function disposeMiscast(actor) {
  const speaker = { alias: (actor.getActiveTokens()[0] ?? actor.prototypeToken).name };
  const flavor = game.i18n.localize("TOW.Chat.DisposingMiscasts");
  const miscasts = actor.system.magic.miscasts;
  // Jak na karcie: w walce Odpoczynek zdejmuje jedną kość, poza walką znikają wszystkie
  if (actor.inCombat) {
    await actor.update({ "system.magic.miscasts": miscasts - 1 });
    return ChatMessage.create({ content: game.i18n.localize("TOW.Chat.DisposingMiscastsCombat"), flavor, speaker });
  }
  await actor.update({ "system.magic.miscasts": 0 });
  return ChatMessage.create({ content: game.i18n.format("TOW.Chat.DisposingMiscastsNonCombat", { miscasts }), flavor, speaker });
}

async function perform(actor, { type, id, extra }, mods, settings) {
  if (mods.right && ITEM_BACKED.has(type) && type !== TOW.wound) return openSheet(id);
  const context = testContext(mods, settings);
  switch (type) {
    case TOW.action: return actor.system.doAction(id, extra || undefined);
    case TOW.skill: return actor.setupSkillTest(id, context);
    case TOW.weapon: return actor.setupWeaponTest(id, context);
    case TOW.ability: return actor.setupAbilityTest(id, context);
    case TOW.shield: return actor.setupSkillTest("defence", { ...context, item: id });
    case TOW.armour: return openSheet(id);
    case TOW.castLore: return actor.setupCastingTest({ lore: id }, context);
    case TOW.spell: return actor.setupCastingTest({ lore: extra, spell: id }, context);
    case TOW.reload: {
      const weapon = await fromUuid(id);
      const { current = 0, value = 0 } = weapon?.system?.reload ?? {};
      const next = Math.max(0, Math.min(value, current + (mods.right ? -1 : 1)));
      return weapon?.update({ "system.reload.current": next });
    }
    case TOW.miscastDispose: return disposeMiscast(actor);
    case TOW.miscastRoll: {
      await game.oldworld.tables.rollTable("miscast", `${actor.system.magic.miscasts}d10`);
      return actor.update({ "system.magic.miscasts": 0 });
    }
    case TOW.blessing:
      if (id === "regainMiracle") return actor.system.blessed.document?.update({ "system.miracles.used": false });
      return actor.useBlessing(id, { index: extra === "" ? undefined : extra });
    case TOW.use: return actor.useItem(id);
    case TOW.condition:
      if (mods.right || actor.hasCondition(id)) return actor.removeCondition(id);
      return actor.addCondition(id);
    case TOW.fate: {
      const { current = 0, max = 0 } = actor.system.fate ?? {};
      return actor.update({ "system.fate.current": Math.max(0, Math.min(max, current + (mods.right ? -1 : 1))) });
    }
    case TOW.fateRefresh: {
      const max = actor.system.fate?.max ?? 0;
      await actor.update({ "system.fate.current": max });
      return ChatMessage.create({ content: game.i18n.format("WHB_TOW.FateRestored", { max }), speaker: { alias: actor.name }, flavor: game.i18n.localize("WHB_TOW.Fate") });
    }
    case TOW.wound: {
      if (mods.right) return openSheet(id);
      const wound = await fromUuid(id);
      return wound?.update({ "system.treated": !wound.system.treated });
    }
  }
}

export const towActions = (getSetting) => systemActions(getSetting, { panel: towPanel, types: TOW, perform, name: "The Old World" });
