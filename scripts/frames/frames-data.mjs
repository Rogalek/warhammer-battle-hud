/**
 * Ramki drużyny – czysta logika, bez zależności od Foundry.
 */

export const MODES = ["party", "combat", "selected"];

/** Kolejny tryb listy, po ostatnim wraca pierwszy. */
export const nextMode = (mode) => MODES[(MODES.indexOf(mode) + 1) % MODES.length];

const unique = (actors) => [...new Map(actors.filter(Boolean).map((a) => [a.uuid, a])).values()];

/**
 * Które postacie pokazać.
 * party: postacie graczy, którzy są teraz zalogowani – przypisana postać gracza, a bez przypisania
 *   postacie, których jest właścicielem. Gracze offline znikają z ramek (można ich dodać ręcznie).
 * combat: walczący (gracze widzą tylko postacie graczy). selected: zaznaczone tokeny.
 */
export function pickActors({ mode, users = [], actors = [], combatants = [], controlled = [], partyTypes, isGM, owns = defaultOwns }) {
  if (mode === "combat") return unique(isGM ? combatants : combatants.filter((a) => a?.hasPlayerOwner));
  if (mode === "selected") return unique(controlled);
  const party = (a) => a && partyTypes.includes(a.type);
  return unique(users.filter((u) => !u.isGM && u.active).flatMap((user) => {
    if (party(user.character)) return [user.character];
    return actors.filter((a) => party(a) && a.hasPlayerOwner && owns(a, user));
  }));
}

/** Czy gracz jest właścicielem postaci (w Foundry: uprawnienie OWNER). */
const defaultOwns = (actor, user) => Boolean(actor.testUserPermission?.(user, "OWNER"));

/** Wypełnienie paska w procentach, od 0 do 100. */
export function percent(value, max) {
  if (!(max > 0)) return 0;
  return Math.round(Math.min(100, Math.max(0, (Number(value) / max) * 100)));
}

/**
 * Kolor paska. `health` to wartość malejąca (mało znaczy źle), `damage` rosnąca (dużo znaczy źle), `resource` jest neutralny.
 */
export function tone(kind, pct) {
  if (kind === "resource") return "resource";
  const remaining = kind === "damage" ? 100 - pct : pct;
  if (remaining <= 25) return "critical";
  return remaining <= 50 ? "hurt" : "healthy";
}

/** Zapisana pozycja, przesunięta tak, by ramki nie uciekły poza ekran. */
export function clampPosition({ left, top }, width, height, viewportWidth, viewportHeight) {
  return {
    left: Math.max(0, Math.min(left, Math.max(0, viewportWidth - width))),
    top: Math.max(0, Math.min(top, Math.max(0, viewportHeight - height)))
  };
}

/**
 * Postacie, które gracz może wybrać do ramek. W trybie drużyny także postacie graczy bez przypisania,
 * żeby dało się je dodać; w pozostałych trybach – to, co tryb i tak pokazuje.
 */
export function candidateActors({ mode, users = [], actors = [], partyTypes, ...rest }) {
  const shown = pickActors({ mode, users, actors, partyTypes, ...rest });
  if (mode !== "party") return shown;
  return unique([...shown, ...actors.filter((a) => a.hasPlayerOwner && partyTypes.includes(a.type))]);
}

/**
 * Wybór gracza (uuid → true/false) nakłada się na domyślną listę trybu:
 * bez wyboru postać jest widoczna, jeśli tryb ją pokazuje.
 */
export function applyChoice(defaults, candidates, choice = {}) {
  const shown = new Set(defaults.map((a) => a.uuid));
  return candidates.filter((a) => choice[a.uuid] ?? shown.has(a.uuid));
}
