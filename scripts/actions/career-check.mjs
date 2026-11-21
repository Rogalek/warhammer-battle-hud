/**
 * Czy postać może zmienić profesję albo wejść na wyższy poziom – czysta logika, bez zależności od Foundry.
 *
 * 4e: poziom kariery jest ukończony, gdy cechy kariery mają co najmniej 5 × poziom rozwinięć,
 *     8 umiejętności kariery (albo wszystkie, gdy jest ich mniej) ma tyle samo, a postać zna
 *     co najmniej 1 talent kariery. Umiejętności i talenty dopasowujemy po nazwie, jak system.
 * 5e: system liczy postępy na ścieżce kariery; poziom jest ukończony, gdy jest ich tyle, ile wymaga
 *     (8 + 2 × poziom).
 */

/** Ile umiejętności kariery musi mieć wymagane rozwinięcia. */
export const SKILLS_NEEDED = 8;

const lower = (name) => String(name ?? "").trim().toLowerCase();

/**
 * @param {object} input
 * @param {number} input.level                poziom kariery (1–4)
 * @param {{key, label, advances}[]} input.characteristics  cechy kariery z rozwinięciami postaci
 * @param {string[]} input.careerSkills       umiejętności kariery (nazwy)
 * @param {{name, advances}[]} input.skills   umiejętności postaci
 * @param {string[]} input.careerTalents      talenty kariery (nazwy)
 * @param {string[]} input.talents            talenty postaci (nazwy)
 */
export function careerCheck4e({ level, characteristics = [], careerSkills = [], skills = [], careerTalents = [], talents = [] }) {
  const needed = Math.max(1, Number(level) || 1) * 5;

  const chars = characteristics.map((c) => ({ ...c, advances: Number(c.advances) || 0, ok: (Number(c.advances) || 0) >= needed }));

  const owned = new Map(skills.map((s) => [lower(s.name), Number(s.advances) || 0]));
  const careerSkillRows = [...new Set(careerSkills.map((n) => String(n).trim()).filter(Boolean))].map((name) => {
    const advances = owned.get(lower(name));
    return { name, owned: advances !== undefined, advances: advances ?? 0, ok: (advances ?? 0) >= needed };
  });
  const skillsRequired = Math.min(SKILLS_NEEDED, careerSkillRows.length);
  const skillsDone = careerSkillRows.filter((s) => s.ok).length;

  const known = new Set(talents.map(lower));
  const talentsOwned = careerTalents.filter((t) => known.has(lower(t)));

  const parts = {
    characteristics: chars.every((c) => c.ok),
    skills: skillsDone >= skillsRequired,
    talent: careerTalents.length === 0 || talentsOwned.length > 0
  };
  return {
    edition: "4e",
    needed,
    characteristics: chars,
    skills: { rows: careerSkillRows, done: skillsDone, required: skillsRequired },
    talents: { owned: talentsOwned, all: careerTalents },
    parts,
    complete: parts.characteristics && parts.skills && parts.talent
  };
}

/**
 * @param {object} input
 * @param {number} input.level      poziom na ścieżce kariery
 * @param {number} input.done       zdobyte postępy na tym poziomie
 * @param {number} input.needed     wymagane postępy
 * @param {string} [input.next]     nazwa następnego poziomu (jeśli jest)
 */
export function careerCheck5e({ level, done = 0, needed = 0, next }) {
  return {
    edition: "5e",
    level,
    done: Number(done) || 0,
    needed: Number(needed) || 0,
    missing: Math.max(0, (Number(needed) || 0) - (Number(done) || 0)),
    next: next || null,
    complete: (Number(done) || 0) >= (Number(needed) || 0)
  };
}

/**
 * Koszt w PD: wyższy poziom tej samej kariery i zmiana profesji (4e: 100 za ukończoną, 200 za nieukończoną,
 * +100 za inną klasę; 5e: wyższy poziom 100, zmiana 100 w tej samej klasie albo 200 w innej).
 */
export function careerCosts(report) {
  if (report.edition === "5e") return { nextLevel: 100, sameClass: 100, otherClass: 200 };
  const change = report.complete ? 100 : 200;
  return { nextLevel: 100, sameClass: change, otherClass: change + 100 };
}
