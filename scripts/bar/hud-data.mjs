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

/** Skala bez maksimum: przy tylu punktach Przewaga uchodzi za wysoką. */
const DEFAULT_SCALE = 10;

/** Poziom Przewagi do wyróżnienia licznika: none, low, high, max. */
export function advantageLevel(value, max) {
  if (!(value > 0)) return "none";
  if (max > 0 && value >= max) return "max";
  return value / (max > 0 ? max : DEFAULT_SCALE) >= 0.5 ? "high" : "low";
}

/** Przewaga postaci (WFRP 4e) albo `null`, gdy postać jej nie ma lub system nie pozwala jej zmieniać. */
export function advantageOf(actor) {
  const data = actor?.system?.status?.advantage;
  if (!data || typeof actor.modifyAdvantage !== "function") return null;
  const value = Number(data.value) || 0;
  const max = Number(data.max) || 0;
  return { value, max, level: advantageLevel(value, max) };
}
