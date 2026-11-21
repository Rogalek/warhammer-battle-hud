/**
 * Pasek walki: licznik Przewagi, panel akcji postaci oraz amunicja, przeładowanie i szybka zmiana broni.
 * Pokazuje zaznaczoną postać, a bez zaznaczenia postać przypisaną do gracza.
 * HUD przesuwa się po przytrzymaniu myszy w dowolnym miejscu; podwójny klik na uchwycie wraca na miejsce nad paskiem makr.
 */
import { MODULE_ID, t, log } from "./constants.mjs";
import { getSetting, hasSetting, setSetting } from "./settings.mjs";
import { ammoState } from "./ammo-data.mjs";
import { advantageLevel, clampAnchor, clampTop, isAnchor, panelDirection } from "./hud-data.mjs";
import { counterFor } from "./counters.mjs";
import { widgetFor } from "./hands.mjs";
import { groupSlots, handsUsed } from "./hands-data.mjs";
import { tooltipHtml } from "../actions/tooltip.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Tyle pikseli ruchu odróżnia przeciąganie od kliknięcia. */
const DRAG_THRESHOLD = 5;

/** Kliknięcie w pasek przewijania panelu ma przewijać, nie przesuwać HUD-a. */
function onScrollbar(event) {
  const el = event.target;
  if (!(el instanceof HTMLElement)) return false;
  const rect = el.getBoundingClientRect();
  return (el.scrollHeight > el.clientHeight && event.clientX > rect.left + el.clientLeft + el.clientWidth)
    || (el.scrollWidth > el.clientWidth && event.clientY > rect.top + el.clientTop + el.clientHeight);
}

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
      gainAdvantage: BattleBar.#onGainAdvantage,
      toggleHand: BattleBar.#onToggleHand,
      holdWeapon: BattleBar.#onHoldWeapon,
      emptyHand: BattleBar.#onEmptyHand
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
      level: data.level ?? advantageLevel(data.value, data.max),
      toggle: Boolean(counter.toggle),
      state: counter.toggle ? game.i18n.localize(data.active ? "WHAMMO.MomentumOn" : "WHAMMO.MomentumOff") : data.value,
      editable,
      label: game.i18n.localize(counter.label),
      hint: game.i18n.localize(editable || !counter.readOnlyHint ? counter.hint : counter.readOnlyHint)
    };
  }

  /** Czy HUD pokazuje ręce tej postaci (system z zasadami rąk, postać z bronią, którą gracz może zmieniać). */
  static showsHands(actor) {
    const hands = widgetFor(game.system.id, actor);
    return Boolean(actor?.isOwner && hands && hasSetting("showHands") && getSetting("showHands") && hands.hasItems(actor));
  }

  /** Pokazuje, odświeża albo chowa pasek zależnie od bieżącej postaci. */
  static refresh() {
    this.#instance ??= new this();
    const actor = this.actor;
    const ammo = this.adapter && getSetting("showBar") && actor && this.adapter.allWeapons(actor).length > 0;
    const visible = ammo || (actor && this.actions && getSetting("showActions")) || this.advantage(actor) || this.showsHands(actor);
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
  /** Ręka, dla której otwarto wybór broni. */
  openHand = null;
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
    Object.assign(context, this.#actionContext(actor), { advantage: this.#advantageContext(actor), hands: this.#handsContext(actor) });
    if (!adapter || !getSetting("showBar")) return Object.assign(context, { weapons: [] });
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
      })
      // Pozostałą broń i pancerz zakłada się w grupie Ekwipunek zakładki Walka (we wszystkich systemach)
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

  /**
   * Widżet obok licznika: Ręce (systemy z zasadami rąk – slot na rękę, broń dwuręczna zajmuje dwa)
   * albo Wyposażenie (pozostałe systemy – pole na każdy założony przedmiot i pole „+”).
   */
  #handsContext(actor) {
    if (!this.constructor.showsHands(actor)) return null;
    const hands = widgetFor(game.system.id, actor);
    if (hands.mode === "gear") return this.#gearContext(actor, hands);
    const slots = hands.slots(actor);
    if (!slots.length) return null;
    const options = hands.options(actor);
    const anyUseless = slots.some((slot) => slot.useless);
    const label = (key) => game.i18n.localize(`WHAMMO.Hands.${key}`);
    const groups = groupSlots(slots);
    if (!groups.some((group) => group.key === this.openHand)) this.openHand = null;
    return {
      count: `${handsUsed(slots)}/${slots.filter((slot) => !slot.over).length}`,
      label: label("Label"),
      slots: groups.map((group) => {
        const role = group.span > 1 ? label("Both") : label(group.over ? "Over" : { main: "Main", off: "Off", extra: "Extra" }[group.role]);
        const open = this.openHand === group.key && !group.useless;
        return {
          key: group.key,
          span: group.span,
          role: group.role,
          item: group.item,
          useless: group.useless,
          over: group.over,
          icon: group.useless ? "fa-solid fa-hand-dots" : "fa-regular fa-hand",
          emptyLabel: label("EmptyIt"),
          open,
          tooltip: tooltipHtml({
            name: role,
            details: [
              { label: label("Holds"), value: group.item?.name ?? label("Empty") },
              { label: label("TwoHanded"), value: group.item?.twoHanded ? game.i18n.localize("Yes") : undefined }
            ],
            text: group.useless ? label("Useless") : group.role === "off" && group.span === 1 ? game.i18n.localize(hands.offhandHint) : "",
            hint: group.useless ? "" : label("Hint")
          }),
          options: open ? options.map((o) => ({ ...o, current: o.id === group.item?.id, disabled: o.twoHanded && anyUseless })) : []
        };
      })
    };
  }

  /** Wyposażenie: każdy założony przedmiot to pole (klik – zamiana albo odłożenie), ostatnie pole „+” zakłada kolejny. */
  #gearContext(actor, hands) {
    const slots = hands.slots(actor);
    if (!slots.some((slot) => slot.key === this.openHand)) this.openHand = null;
    const label = (key) => game.i18n.localize(`WHAMMO.Gear.${key}`);
    return {
      count: String(slots.filter((slot) => slot.item).length),
      label: label("Label"),
      slots: slots.map((slot) => {
        const open = this.openHand === slot.key;
        return {
          key: slot.key,
          span: 1,
          role: slot.role,
          item: slot.item,
          icon: "fa-solid fa-plus",
          emptyLabel: label("PutAway"),
          open,
          tooltip: tooltipHtml({
            name: slot.item ? slot.item.name : label("Add"),
            details: [{ label: game.i18n.localize("WHAMMO.Hands.TwoHanded"), value: slot.item?.twoHanded ? game.i18n.localize("Yes") : undefined }],
            hint: label(slot.item ? "Hint" : "AddHint")
          }),
          options: open ? hands.options(actor, slot.key).map((o) => ({ ...o, current: o.id === slot.item?.id })) : []
        };
      })
    };
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
      const hand = event.target.closest(".whb-hand[data-hand]");
      if (hand) {
        event.preventDefault();
        return this.#emptyHand(hand.dataset.hand);
      }
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

  /** Kierunek rozwijania panelu dla zapisanego (albo podanego) położenia. */
  #direction(saved = getSetting("hudPosition")) {
    return panelDirection(getSetting("panelDirection"), saved, window.innerHeight);
  }

  /**
   * Ustawia HUD w zapisanym miejscu, a bez zapisu – nad paskiem makr.
   * Pasek makr bywa jedno- lub dwurzędowy, więc wysokość liczymy z jego rzeczywistego położenia.
   * Panel rozwijany w górę trzyma dolną krawędź HUD-a, a rozwijany w dół – górną, więc otwarcie zakładki
   * nie przesuwa paska ani licznika.
   */
  #place(saved = getSetting("hudPosition"), direction = this.#direction(saved)) {
    const { style, offsetWidth, offsetHeight } = this.element;
    const vh = window.innerHeight;
    this.element.classList.toggle("whb-down", direction === "down");
    if (!isAnchor(saved)) {
      const top = document.getElementById("hotbar")?.getBoundingClientRect().top;
      Object.assign(style, { left: "", top: "", bottom: top > 0 ? `${vh - top + 8}px` : "" });
      return;
    }
    const { x, bottom } = clampAnchor(saved, offsetWidth, offsetHeight, window.innerWidth, vh);
    if (direction !== "down") {
      Object.assign(style, { left: `${x}px`, top: "", bottom: `${bottom}px` });
      return;
    }
    // Starsze zapisy nie mają górnej krawędzi: liczymy ją raz (przy zwiniętym panelu) i zapisujemy
    let top = saved.top;
    if (!Number.isFinite(top)) {
      top = Math.round(vh - saved.bottom - offsetHeight);
      setSetting("hudPosition", { ...saved, top });
    }
    // `auto`, nie pusty napis: inaczej wraca domyślne `bottom` z arkusza i HUD rozciąga się na cały ekran
    Object.assign(style, { left: `${x}px`, top: `${clampTop(top, offsetHeight, vh)}px`, bottom: "auto" });
  }

  /**
   * HUD przesuwa się, gdy przytrzymamy przycisk myszy gdziekolwiek na nim i pociągniemy.
   * Na przyciskach przeciąganie rusza dopiero po kilku pikselach, więc zwykłe kliknięcie dalej działa,
   * a kliknięcie kończące przeciąganie jest tłumione. Położenie zapisujemy po puszczeniu.
   */
  #onDragStart(event) {
    if (event.button !== 0 || event.target.closest("input, select, textarea, [contenteditable]") || onScrollbar(event)) return;
    const onGrip = Boolean(event.target.closest(".whb-grip"));
    if (onGrip) event.preventDefault();
    const { element } = this;
    const start = { x: event.clientX, y: event.clientY };
    const box = element.getBoundingClientRect();
    const grab = { x: event.clientX - (box.left + box.width / 2), y: box.bottom - event.clientY, top: event.clientY - box.top };
    // Kierunek panelu nie zmienia się w trakcie przeciągania, dopiero po puszczeniu
    const direction = this.#direction();
    let moved = false;
    const move = (e) => {
      if (!moved) {
        if (!onGrip && Math.hypot(e.clientX - start.x, e.clientY - start.y) < DRAG_THRESHOLD) return;
        moved = true;
        element.classList.add("dragging");
        window.getSelection()?.removeAllRanges();
        game.tooltip?.deactivate?.();
      }
      this.#place({ x: e.clientX - grab.x, bottom: window.innerHeight - (e.clientY + grab.y), top: e.clientY - grab.top }, direction);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      element.classList.remove("dragging");
      if (!moved) return;
      // Puszczenie myszy nad przyciskiem nie może go wcisnąć
      const swallow = (e) => {
        e.stopPropagation();
        e.preventDefault();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
      const { left, width, bottom, top } = element.getBoundingClientRect();
      const saved = { x: Math.round(left + width / 2), bottom: Math.round(window.innerHeight - bottom), top: Math.round(top) };
      setSetting("hudPosition", saved);
      // Po puszczeniu w innej części ekranu panel może zmienić kierunek
      if (this.#direction(saved) !== direction) this.#place(saved);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
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

  static #onToggleHand(_event, target) {
    const key = target.closest("[data-hand]")?.dataset.hand;
    this.openHand = this.openHand === key ? null : key;
    this.render();
  }

  static #onHoldWeapon(_event, target) {
    const key = target.closest("[data-hand]")?.dataset.hand;
    this.openHand = null;
    return this.#withHands(async (actor, hands) => {
      const result = await hands.hold(actor, key, target.dataset.weapon);
      if (result?.error) ui.notifications.warn(t(`Hands.${result.error}`));
    });
  }

  static #onEmptyHand(_event, target) {
    this.openHand = null;
    return this.#emptyHand(target.closest("[data-hand]")?.dataset.hand);
  }

  #emptyHand(key) {
    if (key === undefined) return;
    return this.#withHands((actor, hands) => hands.empty(actor, key));
  }

  /** Zmiana rąk zawsze dla aktualnej postaci; błędy reguł systemu (limit, niesprawna ręka) system już pokazał. */
  async #withHands(action) {
    const actor = this.constructor.actor;
    const hands = widgetFor(game.system.id, actor);
    if (!actor || !hands) return;
    try {
      await action(actor, hands);
    } catch (err) {
      log.error("hands", err);
      if (!(err instanceof Error && err.message)) ui.notifications.error(typeof err === "string" ? err : t("Failed"));
    } finally {
      if (this.rendered) this.render();
    }
  }

  static #onToggleEquip(_event, target) {
    return this.#withWeapon(target, (actor, weapon) => this.adapter.toggleEquip(actor, weapon));
  }
}
