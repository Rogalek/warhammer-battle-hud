/**
 * Ustawienia paska. Co widać, wybiera każdy gracz u siebie; próg amunicji ustala MG dla całego świata.
 * Położenie HUD-a należy do gracza (scope "user").
 */
import { MODULE_ID, I18N } from "./constants.mjs";

export function registerSettings(hasAmmo, onChange, hasAdvantage = false) {
  const definitions = {
    ...(hasAdvantage ? { showAdvantage: { scope: "client", type: Boolean, default: true } } : {}),
    showActions: { scope: "client", type: Boolean, default: true },
    actionsOnlyEquipped: { scope: "client", type: Boolean, default: true },
    blindOnShift: { scope: "client", type: Boolean, default: true },
    skipDialogByDefault: { scope: "client", type: Boolean, default: false },
    showUnrollableTraits: { scope: "client", type: Boolean, default: false },
    showTokenTests: { scope: "client", type: Boolean, default: true, requiresReload: true },
    ...(hasAmmo ? {
      showBar: { scope: "client", type: Boolean, default: true },
      onlyEquipped: { scope: "client", type: Boolean, default: true },
      showGear: { scope: "client", type: Boolean, default: true },
      lowAmmo: { scope: "world", type: Number, default: 3 }
    } : {})
  };
  for (const [key, data] of Object.entries(definitions)) {
    const name = key.charAt(0).toUpperCase() + key.slice(1);
    game.settings.register(MODULE_ID, key, { name: `${I18N}.Settings.${name}Name`, hint: `${I18N}.Settings.${name}Hint`, config: true, onChange, ...data });
  }
  // Położenie przeciągniętego HUD-a – zapisane przy koncie gracza, więc działa na każdym jego komputerze
  game.settings.register(MODULE_ID, "hudPosition", { scope: "user", config: false, type: Object, default: {} });
}

export const getSetting = (key) => game.settings.get(MODULE_ID, key);
/** Ustawienia zależne od systemu (np. Przewaga) istnieją tylko tam, gdzie mają sens. */
export const hasSetting = (key) => game.settings.settings.has(`${MODULE_ID}.${key}`);
export const setSetting = (key, value) => game.settings.set(MODULE_ID, key, value);
