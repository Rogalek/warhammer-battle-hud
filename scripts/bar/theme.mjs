/**
 * Wariant kolorystyki HUD-a i ramek – wybór gracza (ustawienie „hudTheme”).
 *  - "sheet": jak karta postaci systemu (tło, przyciski, nagłówki, czcionki),
 *  - "dark":  ciemny, klasyczny wariant z 0.8.0,
 *  - "auto":  domyślny wariant systemu (WFRP ciemny, pozostałe jak karta).
 * Wariant to klasa whb-theme-<wariant> na <body>; kolory w stylach zależą od niej i od whb-system-<id>.
 */
import { MODULE_ID } from "./constants.mjs";

/** Domyślny wariant systemów, które nie mają wyglądu karty jako domyślnego. */
const SYSTEM_DEFAULT = { wfrp4e: "dark" };

/** Wariant do użycia dla wyboru gracza i systemu. */
export const resolveTheme = (choice, systemId) => (choice === "sheet" || choice === "dark" ? choice : SYSTEM_DEFAULT[systemId] ?? "sheet");

export function applyTheme(systemId = globalThis.game?.system?.id) {
  let choice = "auto";
  try {
    choice = game.settings.get(MODULE_ID, "hudTheme");
  } catch {
    // Ustawienie jeszcze nie zarejestrowane – domyślny wariant systemu
  }
  const theme = resolveTheme(choice, systemId);
  document.body.classList.toggle("whb-theme-sheet", theme === "sheet");
  document.body.classList.toggle("whb-theme-dark", theme === "dark");
  return theme;
}
