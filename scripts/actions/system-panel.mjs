/**
 * Wspólny szkielet paneli akcji systemów z własnymi budowniczymi (The Old World, Imperium Maledictum,
 * Wrath & Glory, Soulbound): zakładki → grupy → akcje z podpowiedzią, wartość przycisku "typ|id|dodatek".
 */
import { tooltipHtml } from "./tooltip.mjs";
import { t, log } from "./constants.mjs";

/** Wartość przycisku i jej odczyt (UUID i klucze nie zawierają „|”). */
export const panelValue = (type, id = "", extra = "") => [type, id, extra].join("|").replace(/\|+$/, "");
export function readPanelValue(value, types) {
  const [type, id = "", extra = ""] = String(value ?? "").split("|");
  return Object.values(types).includes(type) ? { type, id, extra } : null;
}

/** Zakładki do pokazania: puste grupy i zakładki znikają, każda akcja dostaje gotową podpowiedź HTML. */
export function finishPanel(tabs, label) {
  const view = (action) => ({
    name: action.name,
    img: action.img,
    value: action.value,
    detail: action.detail ?? "",
    cssClass: action.cssClass ?? "",
    tooltip: tooltipHtml({ name: action.name, ...action.tooltip })
  });
  return tabs
    .map((tab) => ({
      id: tab.id,
      columns: tab.columns,
      label: label(`Tabs.${tab.id}`),
      groups: tab.groups.filter((g) => g.actions.length).map((g) => ({ ...g, actions: g.actions.map(view) }))
    }))
    .filter((tab) => tab.groups.length);
}

/** Okno rzutu: Alt pomija je (albo pokazuje, gdy pomijanie jest domyślne), Shift daje tajny rzut MG. */
export function testContext(mods, settings) {
  const context = { skipDialog: mods.alt !== Boolean(settings.skipDialogByDefault) };
  if (mods.shift && settings.blindOnShift) context.fields = { rollMode: "blindroll" };
  return context;
}

/**
 * Obiekt panelu dla BattleBar: { tabs, groups, perform }.
 * @param {(actor) => Array} panel  zakładki z finishPanel
 * @param {object} types            typy akcji systemu
 * @param {(actor, action, mods, settings) => Promise} perform
 * @param {string} name             nazwa systemu do logów
 */
export function systemActions(getSetting, { panel, types, perform, name }) {
  const settings = () => ({ blindOnShift: getSetting("blindOnShift"), skipDialogByDefault: getSetting("skipDialogByDefault") });
  return {
    tabs: (actor) => panel(actor).map(({ id, label, columns }) => ({ id, label, columns })),
    groups: (actor, tabId) => panel(actor).find((tab) => tab.id === tabId)?.groups ?? [],
    async perform(actor, value, mods) {
      const action = readPanelValue(value, types);
      if (!action) return;
      try {
        await perform(actor, action, mods, settings());
      } catch (err) {
        log.error(`${name}: ${value}`, err);
        // Systemy zgłaszają zasady zwykłym Error („Not enough Mettle!”) – jego treść jest dla gracza; błędy kodu (TypeError…) nie
        const rule = typeof err === "string" ? err : err?.constructor === Error ? err.message : "";
        ui.notifications.error(rule || t("Notify.ActionFailed"));
      }
    }
  };
}
