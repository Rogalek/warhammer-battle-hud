/**
 * Podpowiedzi panelu akcji – bez zależności od Foundry.
 * Foundry pokazuje `data-tooltip-html` po własnym czyszczeniu HTML; tu dodatkowo escapujemy każdy tekst,
 * bo nazwy i opisy pochodzą z dokumentów, które mogą edytować gracze.
 */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

/**
 * Składa podpowiedź: nazwa, statystyki ({ label, value }), opis i ściąga sterowania.
 * Zwraca `undefined`, gdy poza nazwą nie ma nic do pokazania.
 */
export function tooltipHtml({ name, details = [], text = "", hint = "" }) {
  const rows = details.filter((d) => d && d.value !== undefined && d.value !== null && d.value !== "");
  if (!rows.length && !text && !hint) return undefined;
  const parts = [`<strong class="whb-tip-name">${escapeHtml(name)}</strong>`];
  if (rows.length) parts.push(`<dl class="whb-tip-details">${rows.map((d) => `<dt>${escapeHtml(d.label)}</dt><dd>${escapeHtml(d.value)}</dd>`).join("")}</dl>`);
  if (text) parts.push(`<p class="whb-tip-text">${escapeHtml(text)}</p>`);
  if (hint) parts.push(`<p class="whb-tip-hint">${escapeHtml(hint)}</p>`);
  return parts.join("");
}
