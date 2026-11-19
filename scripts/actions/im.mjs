/**
 * Panel akcji Imperium Maledictum – zakładki z im-builders.mjs, wykonanie przez API systemu impmal
 * (te same metody, których używa karta postaci).
 */
import * as B from "./im-builders.mjs";
import { tooltipHtml } from "./tooltip.mjs";
import { t, log } from "./constants.mjs";

const IM = B.IM;

/** Typy, które prawym klikiem otwierają kartę przedmiotu. */
const ITEM_BACKED = new Set([IM.weapon, IM.trait, IM.protection, IM.power, IM.use, IM.sheet, IM.reload]);

const env = () => ({
  config: game.impmal?.config ?? {},
  localize: (key) => game.i18n.localize(key),
  statusEffects: CONFIG.statusEffects
});

const label = (key) => game.i18n.localize(`WHB_IM.${key}`);
const group = (key, actions) => ({ label: label(`Groups.${key}`), actions });

/** Zakładki z grupami; puste grupy i zakładki znikają. */
export function imPanel(actor, e = env()) {
  const combat = B.buildCombat(actor, e);
  const psychic = B.buildPsychic(actor, e);
  const talents = B.buildTalents(actor, e);
  const status = B.buildStatus(actor, e);
  const tabs = [
    { id: "combat", groups: [group("Actions", B.buildActions(e)), group("Melee", combat.melee), group("Ranged", combat.ranged), group("Reload", combat.reload), group("Defence", combat.defence), group("Traits", combat.traits), group("Protection", combat.protection)] },
    { id: "characteristics", groups: [group("Characteristics", B.buildCharacteristics(actor, e))] },
    { id: "skills", columns: 4, groups: B.buildSkillGroups(actor, e) },
    { id: "psychic", groups: [group("Powers", psychic.powers), group("Warp", psychic.warp)] },
    { id: "talents", groups: [group("Talents", talents.talents), group("Traits", talents.traits), group("Corruption", talents.corruption)] },
    { id: "status", groups: [group("Fate", status.fate), group("Conditions", status.conditions), group("Injuries", status.injuries)] }
  ];
  const view = (action) => ({
    name: action.name,
    img: action.img,
    value: action.value,
    detail: action.detail ?? "",
    cssClass: action.cssClass ?? "",
    tooltip: tooltipHtml({ name: action.name, ...action.tooltip })
  });
  return tabs
    .map((tab) => ({ id: tab.id, columns: tab.columns, label: label(`Tabs.${tab.id}`), groups: tab.groups.filter((g) => g.actions.length).map((g) => ({ ...g, actions: g.actions.map(view) })) }))
    .filter((tab) => tab.groups.length);
}

/** Okno rzutu: Alt pomija je (albo pokazuje, gdy pomijanie jest domyślne), Shift daje tajny rzut MG. */
function testContext(mods, settings) {
  const context = { skipDialog: mods.alt !== Boolean(settings.skipDialogByDefault) };
  if (mods.shift && settings.blindOnShift) context.fields = { rollMode: "blindroll" };
  return context;
}

async function perform(actor, { type, id, extra }, mods, settings) {
  if (mods.right && ITEM_BACKED.has(type)) return actor.items.get(id)?.sheet?.render({ force: true });
  const context = testContext(mods, settings);
  switch (type) {
    case IM.action: return actor.system.useAction(id);
    case IM.characteristic: return actor.setupCharacteristicTest(id, context);
    case IM.skill: return actor.setupSkillTest({ key: id, itemId: extra || undefined }, context);
    case IM.weapon: return actor.setupWeaponTest(id, context);
    case IM.trait: return actor.setupTraitTest(id, context);
    case IM.power: return actor.setupPowerTest(id, context);
    case IM.dodge: return actor.setupSkillTest({ key: "reflexes", name: game.i18n.localize("IMPMAL.Dodge") }, context);
    case IM.initiative: return actor.rollInitiative({ createCombatants: true });
    case IM.warp: return actor.setupSkillTest({ key: "psychic" }, { ...context, warp: actor.system.warp.state });
    case IM.purge: return actor.purge();
    case IM.reload: {
      const weapon = actor.items.get(id);
      // Jak na karcie: system zwraca aktualizację magazynka albo rzuca komunikat (np. brak amunicji)
      try {
        return await weapon?.update(weapon.system.reload());
      } catch (err) {
        return ui.notifications.error(typeof err === "string" ? err : t("Notify.ActionFailed"));
      }
    }
    case IM.protection:
    case IM.sheet: return actor.items.get(id)?.sheet?.render({ force: true });
    case IM.use: return actor.useItem({ id, uuid: actor.items.get(id)?.uuid });
    case IM.condition:
      if (mods.right) return actor.removeCondition(id);
      return actor.addCondition(id);
    case IM.fate: {
      const { value = 0, max = 0 } = actor.system.fate ?? {};
      return actor.update({ "system.fate.value": Math.max(0, Math.min(max, value + (mods.right ? -1 : 1))) });
    }
  }
}

export function imActions(getSetting) {
  const settings = () => ({ blindOnShift: getSetting("blindOnShift"), skipDialogByDefault: getSetting("skipDialogByDefault") });
  return {
    tabs: (actor) => imPanel(actor).map(({ id, label: name, columns }) => ({ id, label: name, columns })),
    groups: (actor, tabId) => imPanel(actor).find((tab) => tab.id === tabId)?.groups ?? [],
    async perform(actor, value, mods) {
      const action = B.readImValue(value);
      if (!action) return;
      try {
        await perform(actor, action, mods, settings());
      } catch (err) {
        log.error(`Imperium Maledictum: ${value}`, err);
        ui.notifications.error(t("Notify.ActionFailed"));
      }
    }
  };
}
