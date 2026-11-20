/**
 * Ustawienia. Wygląd i położenie są osobiste; to, co gracze widzą o innych, ustala MG.
 * Wybór widocznych postaci należy do gracza (scope "user"), więc działa na każdym jego komputerze.
 */
import { MODULE_ID, I18N } from "./constants.mjs";

export function registerSettings(onChange) {
  const visible = {
    // Ramki są domyślnie ukryte; włącza się je przyciskiem w narzędziach tokenów albo w ustawieniach
    showFrames: { scope: "client", type: Boolean, default: false },
    skin: { scope: "client", type: String, default: "system", choices: { system: `${I18N}.Skin.system`, parchment: `${I18N}.Skin.parchment`, imperium: `${I18N}.Skin.imperium` } },
    playersSeeAll: { scope: "world", type: Boolean, default: true }
  };
  for (const [key, data] of Object.entries(visible)) {
    const name = key.charAt(0).toUpperCase() + key.slice(1);
    game.settings.register(MODULE_ID, key, { name: `${I18N}.Settings.${name}Name`, hint: `${I18N}.Settings.${name}Hint`, config: true, onChange, ...data });
  }
  // Wartości zmieniane bezpośrednio na ramkach
  game.settings.register(MODULE_ID, "mode", { scope: "client", config: false, type: String, default: "party" });
  game.settings.register(MODULE_ID, "collapsed", { scope: "client", config: false, type: Boolean, default: false });
  game.settings.register(MODULE_ID, "position", { scope: "client", config: false, type: Object, default: {} });
  // Postacie dodane albo ukryte przez gracza: uuid → true/false
  game.settings.register(MODULE_ID, "actorChoice", { scope: "user", config: false, type: Object, default: {}, onChange });

  // Skrót bez domyślnego klawisza: gracz przypisuje go sam w Konfiguracji sterowania
  game.keybindings.register(MODULE_ID, "toggleFrames", {
    name: `${I18N}.Toggle`,
    editable: [],
    onDown: () => {
      toggleFrames();
      return true;
    }
  });
}

export const getSetting = (key) => game.settings.get(MODULE_ID, key);
export const setSetting = (key, value) => game.settings.set(MODULE_ID, key, value);

/** Pokazuje albo chowa ramki; przycisk w narzędziach tokenów śledzi ten stan. */
export async function toggleFrames(show = !getSetting("showFrames")) {
  await setSetting("showFrames", show);
  // Bez reset kontrolki nie pytają hooka getSceneControlButtons o nowy stan przełącznika
  ui.controls?.render({ reset: true });
}
