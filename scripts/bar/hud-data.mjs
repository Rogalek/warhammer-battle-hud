/**
 * Pływający HUD – czysta logika, bez zależności od Foundry.
 */

/**
 * Zapisane położenie HUD-a: środek w poziomie (`x`) i odległość od dołu ekranu (`bottom`).
 * Dzięki temu panel akcji dalej rozwija się w górę, a HUD rośnie symetrycznie na boki.
 */
export const isAnchor = (saved) => Number.isFinite(saved?.x) && Number.isFinite(saved?.bottom);

/** Położenie przesunięte tak, by HUD nie wyszedł poza ekran (np. po zmianie rozmiaru okna). */
export function clampAnchor({ x, bottom }, width, height, viewportWidth, viewportHeight) {
  const half = Math.min(width, viewportWidth) / 2;
  return {
    x: Math.round(Math.max(half, Math.min(x, viewportWidth - half))),
    bottom: Math.round(Math.max(0, Math.min(bottom, Math.max(0, viewportHeight - height))))
  };
}

/** Górna krawędź HUD-a przesunięta tak, by nie wyszedł poza ekran. */
export const clampTop = (top, height, viewportHeight) => Math.round(Math.max(0, Math.min(top, Math.max(0, viewportHeight - height))));

/**
 * Kierunek rozwijania panelu: "up" albo "down".
 * Ustawienie "auto" otwiera panel w dół, gdy przesunięty HUD stoi w górnej części ekranu
 * (górna krawędź w górnych 40% ekranu; starsze zapisy bez `top` – dolna krawędź powyżej połowy).
 * HUD w domyślnym miejscu nad paskiem makr zawsze otwiera się w górę.
 */
export function panelDirection(setting, saved, viewportHeight) {
  if (!isAnchor(saved)) return "up";
  if (setting === "up" || setting === "down") return setting;
  if (Number.isFinite(saved.top)) return saved.top < viewportHeight * 0.4 ? "down" : "up";
  return saved.bottom > viewportHeight * 0.5 ? "down" : "up";
}

/** Skala bez maksimum: przy tylu punktach Przewaga uchodzi za wysoką. */
const DEFAULT_SCALE = 10;

/** Poziom Przewagi do wyróżnienia licznika: none, low, high, max. */
export function advantageLevel(value, max) {
  if (!(value > 0)) return "none";
  if (max > 0 && value >= max) return "max";
  return value / (max > 0 ? max : DEFAULT_SCALE) >= 0.5 ? "high" : "low";
}

/** Impet postaci (WFRP z zasadami 5e) albo `null`, gdy postać go nie ma. */
export function momentumOf(actor) {
  const status = actor?.system?.status;
  if (!status || !("momentum" in status)) return null;
  const active = Boolean(status.momentum);
  return { value: active ? 1 : 0, max: 0, active, level: active ? "high" : "none" };
}

/** Przewaga postaci (WFRP 4e) albo `null`, gdy postać jej nie ma lub system nie pozwala jej zmieniać. */
export function advantageOf(actor) {
  const data = actor?.system?.status?.advantage;
  if (!data || typeof actor.modifyAdvantage !== "function") return null;
  const value = Number(data.value) || 0;
  const max = Number(data.max) || 0;
  return { value, max, level: advantageLevel(value, max) };
}
