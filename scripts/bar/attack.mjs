/**
 * Pasek ataku pod bronią w widżecie Ręce / Wyposażenie – czysta logika, bez zależności od Foundry.
 *
 * Dla przedmiotu zwraca to samo, co przycisk broni w panelu akcji danego systemu: wartość akcji
 * („typ|id”), rodzaj (wręcz, dystans, tarcza) i czy broń jest gotowa (naładowana). Kliknięcie paska
 * idzie więc tą samą ścieżką co panel (Alt pomija okno, Shift – tajny rzut, prawy klik otwiera broń).
 * `null` – przedmiot bez ataku (pancerz).
 */

const weapon = (item, value, ranged, ready = true) => ({ value, kind: ranged ? "ranged" : "melee", ready: Boolean(ready) });

const ATTACK = {
  wfrp4e: (item) => {
    if (item.type !== "weapon") return null;
    const s = item.system ?? {};
    // Broń z cechą Przeładowanie bez naboju czeka na przeładowanie (jak w panelu)
    return weapon(item, `weapon|${item.id}`, s.isRanged, !(s.loading && !s.loaded?.value));
  },
  whtow: (item) => {
    const s = item.system ?? {};
    // Tarcza ma własny test (Obrona z tarczą), jak w panelu
    if (item.type === "armour") return s.shield ? { value: `shield|${item.uuid}`, kind: "shield", ready: true } : null;
    if (item.type !== "weapon") return null;
    return weapon(item, `weapon|${item.uuid}`, s.isRanged, !(s.requiresLoading && !s.isLoaded));
  },
  impmal: (item) => {
    if (item.type !== "weapon") return null;
    const s = item.system ?? {};
    const mag = s.isRanged && s.mag?.value > 0 ? s.mag : null;
    return weapon(item, `weapon|${item.id}`, s.isRanged, !mag || mag.current > 0);
  },
  "wrath-and-glory": (item) => {
    if (item.type !== "weapon") return null;
    const s = item.system ?? {};
    return weapon(item, `weapon|${item.id}`, s.isRanged, !s.needsReload);
  },
  "age-of-sigmar-soulbound": (item) => (item.type === "weapon" ? weapon(item, `weapon|${item.id}`, item.system?.isRanged) : null)
};

/** Atak przedmiotu w danym systemie albo `null`. */
export function attackFor(systemId, item) {
  if (!item) return null;
  return ATTACK[systemId]?.(item) ?? null;
}

/** Ikona Font Awesome dla rodzaju ataku. */
export const ATTACK_ICONS = { melee: "fa-solid fa-sword", ranged: "fa-solid fa-crosshairs", shield: "fa-solid fa-shield-halved" };
