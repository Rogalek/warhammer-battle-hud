/**
 * Wykonanie akcji HUD w systemie WFRP4e.
 *
 * Testy idą przez API aktora (`setupSkill`, `setupWeapon`, ...). System sam wybiera klasy
 * testów i dialogów dla aktywnej edycji (EditionManager 4e/5e), więc HUD nie musi ich znać.
 */
import { ACTION_TYPES as T } from "./encoding.mjs";
import { t, log } from "./constants.mjs";

/** Kontekst testu dla systemu: pominięcie dialogu i wymuszony tryb rzutu. */
function testContext({ skipDialog, rollMode }) {
  const context = {};
  if (skipDialog) context.skipDialog = true;
  if (rollMode) context.fields = { rollMode };
  return context;
}

/** Uruchamia test zwrócony przez metodę `setup*` aktora (dialog → test → rzut). */
async function runTest(setupPromise) {
  const test = await setupPromise;
  if (test && typeof test.roll === "function") await test.roll();
  return test;
}

/** Test dla akcji typu rzutu. */
async function roll(actor, action, intent) {
  const context = testContext(intent);
  if (action.type === T.characteristic) return runTest(actor.setupCharacteristic(action.id, context));

  // W 5e splata się według Wiatru, nie czaru
  if (action.type === T.channelWind) return runTest(actor.setupChannelling(action.id, context));

  const item = actor.items.get(action.id);
  if (!item) return ui.notifications.warn(t("Notify.ItemMissing"));

  switch (action.type) {
    case T.skill: return runTest(actor.setupSkill(item, context));
    case T.weapon: return runTest(actor.setupWeapon(item, context));
    case T.spell: return runTest(actor.setupCast(item, context));
    case T.channel: return runTest(actor.setupChannell(item, context));
    case T.prayer: return runTest(actor.setupPrayer(item, context));
    case T.trait: return runTest(actor.setupTrait(item, context));
    // Test rozszerzony sam wykonuje rzut po dialogu
    case T.extended: return actor.setupExtendedTest(item, context);
  }
}

/** Uszkodzenie (+1) albo naprawa (−1) broni lub pancerza. */
async function damageGear(actor, action, amount) {
  const item = actor.items.get(action.id);
  if (!item?.system?.damageItem) return;
  if (item.type === "armour") {
    // Pancerz: tylko lokacje, które mają PZ; uszkadzamy/naprawiamy wszystkie naraz
    const locations = Object.entries(item.system.AP ?? {}).filter(([, ap]) => ap > 0).map(([loc]) => loc);
    return item.system.damageItem(amount, locations);
  }
  return item.system.damageItem(amount);
}

async function toggleCondition(actor, key, increase) {
  if (increase) return actor.addCondition(key);
  if (actor.hasCondition(key)) return actor.removeCondition(key);
}

async function runManualScript(actor, action) {
  const effect = await fromUuid(action.id);
  const script = effect?.manualScripts?.find((s) => String(s.index) === String(action.extra));
  if (!script) return ui.notifications.warn(t("Notify.EffectMissing"));
  return script.execute({ actor });
}

async function openSheet(actor, action) {
  if (action.type === T.effect) {
    const effect = await fromUuid(action.id);
    return (effect?.parent ?? effect)?.sheet?.render(true);
  }
  return actor.items.get(action.id)?.sheet?.render(true);
}

async function postToChat(actor, action) {
  const item = actor.items.get(action.id);
  if (!item) return;
  if (typeof item.postItem === "function") return item.postItem();
  return item.sheet?.render(true);
}

/**
 * Użycie Przewagi z konfiguracji systemu – tak jak przycisk w zakładce Walka karty postaci:
 * odjęcie kosztu, opis na czacie i test cechy, jeśli akcja go ma.
 */
async function useAdvantageAction(actor, action) {
  const entry = game.wfrp4e?.config?.groupAdvantageActions?.[Number(action.id)];
  if (!entry) return;
  const cost = Number(entry.cost) || 0;
  const path = "system.status.advantage.value";
  const current = Number(foundry.utils.getProperty(actor, path)) || 0;
  if (cost > current) return ui.notifications.warn(t("Notify.NotEnoughAdvantage", { cost, current }));
  if (typeof actor.spend === "function") {
    if (!(await actor.spend(path, cost))) return ui.notifications.warn(t("Notify.NotEnoughAdvantage", { cost, current }));
  } else await actor.update({ [path]: current - cost });

  const content = await foundry.applications.ux.TextEditor.enrichHTML(`<p><strong>${entry.name}</strong>: ${entry.description ?? ""}</p><p>${entry.effect ?? ""}</p>`);
  await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `${t("Advantage")} (−${cost})`
  });
  if (entry.test?.type === "characteristic") await runTest(actor.setupCharacteristic(entry.test.value, { appendTitle: ` - ${entry.name}` }));
}

/** Rozkaz szajki z modułu Underworld – otwiera jego dialog (Dowodzenie, Przewaga albo rozkaz wprost). */
async function issueGangOrder(actor, action) {
  if (typeof game.underworld?.issueOrder !== "function") return;
  return game.underworld.issueOrder(actor, action.id);
}

/**
 * Dochód jak przycisk na karcie: ścieżka kariery (5e) albo bieżąca kariera – test Zarobkowania
 * z umiejętności kariery, a system sam przelicza zarobek według Statusu.
 */
async function rollIncome(actor) {
  if (actor.itemTypes.careerPath?.length) return actor.system.career.rollIncome();
  const career = actor.itemTypes.career?.find((c) => c.system.current?.value);
  if (!career) return ui.notifications.warn(t("Notify.NoCareer"));
  if (career.system.requiredTrappingStatus?.length && career.system.requiredTrappingStatus.some((trapping) => !trapping.owned)) {
    return ui.notifications.error("SHEET.RequiredTrappingsError", { localize: true });
  }
  const skills = (career.system.incomeSkill ?? [])
    .map((index) => career.system.skills[index])
    .map((name) => actor.itemTypes.skill.find((skill) => skill.name === name))
    .filter(Boolean);
  if (!skills.length) return ui.notifications.error("SHEET.SkillMissingWarning", { localize: true });
  const skill = skills[0];
  return runTest(actor.setupSkill(skill, {
    title: `${skill.name} - ${game.i18n.localize("Income")}`,
    income: actor.system.details.status,
    career: career.toObject()
  }));
}

/** Odpoczynek jak na karcie: test Odporności (albo Wytrzymałości bez tej umiejętności) z odzyskiwaniem Żywotności. */
async function rest(actor) {
  const skill = actor.itemTags?.skill?.find((s) => s.name === game.i18n.localize("NAME.Endurance"))
    ?? actor.itemTypes.skill.find((s) => s.name === game.i18n.localize("NAME.Endurance"));
  const options = { rest: true, tb: actor.characteristics.t.bonus, skipTargets: true };
  return runTest(skill ? actor.setupSkill(skill, options) : actor.setupCharacteristic("t", options));
}

/** Przedsięwzięcie: strona dziennika z przyciskiem „Perform Endeavour” systemu. */
async function openEndeavour(_actor, action) {
  return (await fromUuid(action.id))?.sheet?.render({ force: true });
}

/** Zebrane splatanie przepada (np. po rozproszeniu): zaklęcia 4e albo Wiatr 5e. */
async function resetChannelling(actor) {
  const spells = actor.itemTypes.spell.filter((s) => Number(s.system.cn?.SL) > 0);
  if (spells.length) await actor.updateEmbeddedDocuments("Item", spells.map((s) => ({ _id: s.id, "system.cn.SL": 0 })));
  if (Number(actor.system.status?.channelling?.value) > 0) await actor.update({ "system.status.channelling.value": 0, "system.status.channelling.wind": "" });
}

/**
 * Wykonuje akcję dla jednego aktora.
 * @param {Actor} actor
 * @param {{type: string, id: string, extra: string}} action  zdekodowana akcja
 * @param {import("./intent.mjs").Intent} intent
 */
export async function performAction(actor, action, intent) {
  try {
    switch (intent.intent) {
      case "roll": return await roll(actor, action, intent);
      case "sheet": return await openSheet(actor, action);
      case "post": return await postToChat(actor, action);
      case "damage": return await damageGear(actor, action, 1);
      case "repair": return await damageGear(actor, action, -1);
      case "run": return await runManualScript(actor, action);
      case "use": {
        const use = { [T.gangOrder]: issueGangOrder, [T.income]: rollIncome, [T.rest]: rest, [T.endeavour]: openEndeavour, [T.channelReset]: resetChannelling }[action.type];
        return await (use ?? useAdvantageAction)(actor, action);
      }
      case "increase":
      case "decrease": {
        const up = intent.intent === "increase";
        if (action.type === T.advantage) return await actor.modifyAdvantage(up ? 1 : -1);
        // Impet: klik przełącza, prawy klik zawsze go zdejmuje
        if (action.type === T.momentum) return await actor.update({ "system.status.momentum": up ? !actor.system.status.momentum : false });
        return await toggleCondition(actor, action.id, up);
      }
    }
  } catch (err) {
    log.error(`Akcja ${action.type}/${action.id} nie powiodła się`, err);
    ui.notifications.error(t("Notify.ActionFailed"));
  }
}
