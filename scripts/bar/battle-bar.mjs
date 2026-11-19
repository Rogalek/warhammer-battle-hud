/**
 * Pasek walki: licznik Przewagi, panel akcji postaci oraz amunicja, przeładowanie i szybka zmiana broni.
 * Pokazuje zaznaczoną postać, a bez zaznaczenia postać przypisaną do gracza.
 * HUD przesuwa się za uchwyt; podwójny klik na uchwycie wraca na miejsce nad paskiem makr.
 */
import { MODULE_ID, t, log } from "./constants.mjs";
import { getSetting, hasSetting, setSetting } from "./settings.mjs";
import { ammoState } from "./ammo-data.mjs";
import { advantageLevel, clampAnchor, isAnchor } from "./hud-data.mjs";
import { counterFor } from "./counters.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class BattleBar extends HandlebarsApplicationMixin(ApplicationV2) {
  /** Adapter amunicji; `null` w systemach, które jej nie śledzą. */
  static adapter = null;
  /** Panel akcji aktywnego systemu (ustawiany w "ready"). */
  static actions = null;
  static #instance = null;

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-bar`,
    classes: [MODULE_ID],
    window: { frame: false, positioned: false },
    actions: {
      toggleList: BattleBar.#onToggleList,
      chooseAmmo: BattleBar.#onChooseAmmo,
      reload: BattleBar.#onReload,
      toggleEquip: BattleBar.#onToggleEquip,
      openTab: BattleBar.#onOpenTab,
      runAction: BattleBar.#onRunAction,
      gainAdvantage: BattleBar.#onGainAdvantage
    }
  };

  static PARTS = { bar: { template: `modules/${MODULE_ID}/templates/battle-bar.hbs` } };

  /** Postać, którą pasek pokazuje: zaznaczony token, a bez niego postać przypisana do gracza. */
  static get actor() {
    const selected = canvas.tokens?.controlled.find((token) => token.actor?.isOwner);
    return selected?.actor ?? game.user.character ?? null;
  }

  /** Licznik systemu (Przewaga, Przewaga Taktyczna…) albo `null` (brak licznika, wyłączony, brak postaci). */
  static advantage(actor) {
    const counter = counterFor(game.system.id);
    if (!actor || !counter || !hasSetting("showAdvantage") || !getSetting("showAdvantage")) return null;
    const data = counter.read(actor);
    if (!data) return null;
    const editable = Boolean(counter.canEdit(actor));
    return {
      ...data,
      level: advantageLevel(data.value, data.max),
      editable,
      label: game.i18n.localize(counter.label),
      hint: game.i18n.localize(editable || !counter.readOnlyHint ? counter.hint : counter.readOnlyHint)
    };
  }

  /** Pokazuje, odświeża albo chowa pasek zależnie od bieżącej postaci. */
  static refresh() {
    this.#instance ??= new this();
    const actor = this.actor;
    const ammo = this.adapter && getSetting("showBar") && actor && this.adapter.allWeapons(actor).length > 0;
    const visible = ammo || (actor && this.actions && getSetting("showActions")) || this.advantage(actor);
    if (visible) this.#instance.render({ force: true });
    else if (this.#instance.rendered) this.#instance.close();
  }

  /** Przywraca HUD na domyślne miejsce nad paskiem makr. */
  static async resetPosition() {
    await setSetting("hudPosition", {});
    if (this.#instance?.rendered) this.#instance.#place();
  }

  /** Lista broni, dla której otwarto wybór amunicji. */
  openList = null;
  /** Zakładka panelu akcji, która jest rozwinięta. */
  openTab = null;
  /** Ostatnio pokazana Przewaga („uuid:wartość”) – zmiana wartości uruchamia animację licznika. */
  #shownAdvantage = null;

  get adapter() {
    return this.constructor.adapter;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const { adapter } = this;
    const actor = this.constructor.actor;
    if (!actor) return context;
    Object.assign(context, this.#actionContext(actor), { advantage: this.#advantageContext(actor) });
    if (!adapter || !getSetting("showBar")) return Object.assign(context, { weapons: [], gear: [] });
    const low = getSetting("lowAmmo");
    const onlyEquipped = getSetting("onlyEquipped");
    const all = adapter.allWeapons(actor);
    const ranged = all.filter((w) => adapter.isRanged(w) && (!onlyEquipped || adapter.isEquipped(w)));
    const entry = (item) => ({ id: item.id, name: item.name, img: item.img, count: adapter.count(item) });

    return Object.assign(context, {
      weapons: ranged.map((weapon) => {
        const ammo = adapter.current(weapon);
        const list = adapter.choices(weapon);
        return {
          id: weapon.id,
          name: weapon.name,
          img: weapon.img,
          equipped: adapter.isEquipped(weapon),
          ammo: ammo ? { ...entry(ammo), state: ammoState(adapter.count(ammo), low) } : null,
          load: adapter.load(weapon),
          open: this.openList === weapon.id,
          options: list.map((item) => ({ ...entry(item), current: item.id === ammo?.id }))
        };
      }),
      gear: getSetting("showGear") ? all.filter((w) => !ranged.includes(w)).map((w) => ({ id: w.id, name: w.name, img: w.img, equipped: adapter.isEquipped(w) })) : []
    });
  }

  /** Licznik animuje się tylko wtedy, gdy zmieniła się Przewaga tej samej postaci, a nie przy zmianie zaznaczenia. */
  #advantageContext(actor) {
    const advantage = this.constructor.advantage(actor);
    if (!advantage) {
      this.#shownAdvantage = null;
      return null;
    }
    const key = `${actor.uuid}:${advantage.value}`;
    const changed = Boolean(this.#shownAdvantage?.startsWith(`${actor.uuid}:`)) && this.#shownAdvantage !== key;
    this.#shownAdvantage = key;
    return { ...advantage, changed };
  }

  #actionContext(actor) {
    const { actions } = this.constructor;
    if (!actions || !getSetting("showActions")) return { actionTabs: [], actionPanel: null };
    const tabs = actions.tabs(actor);
    if (!tabs.some((tab) => tab.id === this.openTab)) this.openTab = null;
    return {
      actionTabs: tabs.map((tab) => ({ ...tab, active: tab.id === this.openTab })),
      actionPanel: this.openTab ? actions.groups(actor, this.openTab) : null,
      // Zakładka może prosić o układ w kolumnach (np. umiejętności The Old World: 8 cech po 2)
      actionColumns: tabs.find((tab) => tab.id === this.openTab)?.columns ?? null
    };
  }

  /** Prawy klik na akcji: arkusz przedmiotu, zdjęcie stanu, uszkodzenie sprzętu z Ctrl; na Przewadze: −1. */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    const root = this.element;
    root.addEventListener("contextmenu", (event) => {
      if (event.target.closest(".whb-advantage")) {
        event.preventDefault();
        return this.#changeAdvantage(-1);
      }
      const button = event.target.closest(".whb-action");
      if (!button) return;
      event.preventDefault();
      this.#perform(button, event, true);
    });
    root.addEventListener("pointerdown", (event) => this.#onDragStart(event));
    root.addEventListener("dblclick", (event) => {
      if (event.target.closest(".whb-grip")) this.constructor.resetPosition();
    });
    window.addEventListener("resize", foundry.utils.debounce(() => this.rendered && this.#place(), 100));
  }

  #perform(button, event, right) {
    const actor = this.constructor.actor;
    if (!actor) return ui.notifications.warn(t("NoActor"));
    const mods = { right, shift: event.shiftKey, alt: event.altKey, ctrl: event.ctrlKey };
    return this.constructor.actions.perform(actor, button.dataset.value, mods);
  }

  async #changeAdvantage(delta) {
    const actor = this.constructor.actor;
    if (!actor) return ui.notifications.warn(t("NoActor"));
    const counter = counterFor(game.system.id);
    if (!counter?.canEdit(actor)) return;
    try {
      await counter.change(actor, delta);
    } catch (err) {
      log.error(actor.name, err);
      ui.notifications.error(typeof err === "string" ? err : t("Failed"));
    }
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#place();
  }

  /**
   * Ustawia HUD w zapisanym miejscu, a bez zapisu – nad paskiem makr.
   * Pasek makr bywa jedno- lub dwurzędowy, więc wysokość liczymy z jego rzeczywistego położenia.
   */
  #place(saved = getSetting("hudPosition")) {
    const { style, offsetWidth, offsetHeight } = this.element;
    if (!isAnchor(saved)) {
      const top = document.getElementById("hotbar")?.getBoundingClientRect().top;
      Object.assign(style, { left: "", bottom: top > 0 ? `${window.innerHeight - top + 8}px` : "" });
      return;
    }
    const { x, bottom } = clampAnchor(saved, offsetWidth, offsetHeight, window.innerWidth, window.innerHeight);
    Object.assign(style, { left: `${x}px`, bottom: `${bottom}px` });
  }

  /** HUD przesuwa się za uchwyt; położenie zapisujemy po puszczeniu, i tylko gdy faktycznie się ruszył. */
  #onDragStart(event) {
    if (!event.target.closest(".whb-grip") || event.button !== 0) return;
    event.preventDefault();
    const { element } = this;
    const box = element.getBoundingClientRect();
    const grab = { x: event.clientX - (box.left + box.width / 2), y: box.bottom - event.clientY };
    let moved = false;
    const move = (e) => {
      moved = true;
      this.#place({ x: e.clientX - grab.x, bottom: window.innerHeight - (e.clientY + grab.y) });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      element.classList.remove("dragging");
      if (!moved) return;
      const { left, width, bottom } = element.getBoundingClientRect();
      setSetting("hudPosition", { x: Math.round(left + width / 2), bottom: Math.round(window.innerHeight - bottom) });
    };
    element.classList.add("dragging");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  /** Pozycje z paska dotyczą zawsze aktualnej postaci, a błędy systemu nie mogą zostawiać kliknięcia bez odpowiedzi. */
  async #withWeapon(target, action) {
    const actor = this.constructor.actor;
    const weapon = actor?.items.get(target.closest("[data-weapon]")?.dataset.weapon);
    if (!weapon) return;
    try {
      await action(actor, weapon);
    } catch (err) {
      log.error(weapon.name, err);
      ui.notifications.error(typeof err === "string" ? err : t("Failed"));
    }
  }

  static #onToggleList(_event, target) {
    const id = target.closest("[data-weapon]")?.dataset.weapon;
    this.openList = this.openList === id ? null : id;
    this.render();
  }

  static #onChooseAmmo(_event, target) {
    this.openList = null;
    return this.#withWeapon(target, async (actor, weapon) => {
      const ammo = actor.items.get(target.dataset.ammo);
      if (ammo) await this.adapter.setAmmo(weapon, ammo);
    });
  }

  static #onOpenTab(_event, target) {
    this.openTab = this.openTab === target.dataset.tab ? null : target.dataset.tab;
    this.render();
  }

  static #onRunAction(event, target) {
    return this.#perform(target, event, false);
  }

  static #onGainAdvantage() {
    return this.#changeAdvantage(1);
  }

  static #onReload(_event, target) {
    return this.#withWeapon(target, (actor, weapon) => this.adapter.reload(actor, weapon));
  }

  static #onToggleEquip(_event, target) {
    return this.#withWeapon(target, (actor, weapon) => this.adapter.toggleEquip(actor, weapon));
  }
}
