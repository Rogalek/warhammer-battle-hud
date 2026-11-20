/**
 * Ręce postaci – czysta logika, bez zależności od Foundry.
 *
 * Ręka to slot: `{ key, role, item, useless?, over? }`.
 *  - `role`: "main" (ręka wiodąca), "off" (druga ręka), "extra" (kolejne ręce, np. z mutacji),
 *  - `item`: `{ id, name, img, twoHanded }` albo `null` (pusta ręka),
 *  - `over`: broń założona ponad liczbę rąk (np. przy wyłączonym limicie w ustawieniach systemu).
 * Broń dwuręczna zajmuje dwa sąsiednie sloty.
 */

const roleOf = (index) => (index === 0 ? "main" : index === 1 ? "off" : "extra");
const pointsOf = (item) => (item?.twoHanded ? 2 : 1);

/**
 * WFRP: system pamięta tylko, czy broń jest założona, dwuręczna i czy jest w drugiej ręce.
 * Z tego układamy ręce: dwuręczna w pierwszej wolnej parze, druga ręka w slocie 1, reszta od slotu 0.
 * @param {number} capacity  liczba rąk (punkty wyposażenia postaci)
 * @param {{id, name, img, twoHanded, offhand}[]} equipped  założona broń
 */
export function wfrpSlots(capacity, equipped) {
  const slots = Array.from({ length: Math.max(0, Number(capacity) || 0) }, (_, i) => ({ key: String(i), role: roleOf(i), item: null }));
  const free = (i) => i < slots.length && !slots[i].item;
  const grow = () => slots.push({ key: String(slots.length), role: roleOf(slots.length), item: null, over: true });
  const put = (i, item) => {
    while (slots.length <= i) grow();
    slots[i].item = item;
  };
  const view = ({ id, name, img, twoHanded }) => ({ id, name, img, twoHanded: Boolean(twoHanded) });

  for (const weapon of equipped.filter((w) => w.twoHanded)) {
    let i = 0;
    while (i < slots.length && !(free(i) && free(i + 1))) i++;
    const start = free(i) && free(i + 1) ? i : slots.length;
    put(start, view(weapon));
    put(start + 1, view(weapon));
  }
  const firstFree = (preferred) => {
    if (free(preferred)) return preferred;
    const i = slots.findIndex((s, index) => !s.item && index !== 1);
    if (i >= 0) return i;
    const any = slots.findIndex((s) => !s.item);
    return any >= 0 ? any : slots.length;
  };
  for (const weapon of equipped.filter((w) => !w.twoHanded && w.offhand)) put(free(1) ? 1 : firstFree(1), view(weapon));
  for (const weapon of equipped.filter((w) => !w.twoHanded && !w.offhand)) put(firstFree(0), view(weapon));
  return slots;
}

/** Sąsiednie sloty z tą samą bronią (dwuręczna) łączymy w jeden przycisk o szerokości `span`. */
export function groupSlots(slots) {
  const groups = [];
  for (const slot of slots) {
    const last = groups.at(-1);
    if (last && slot.item && last.item?.id === slot.item.id) {
      last.keys.push(slot.key);
      last.span++;
      continue;
    }
    groups.push({ ...slot, keys: [slot.key], span: 1 });
  }
  return groups;
}

/**
 * Co zrobić, żeby broń trafiła do wskazanej ręki w WFRP: kogo zdjąć, czy założyć i czy to druga ręka.
 * Broń z tej ręki (albo z pary rąk dla dwuręcznej) odkładamy; jeśli dalej brakuje rąk, odkładamy też broń
 * z ostatnich slotów.
 * @returns {{unequip: string[], equip: boolean, offhand: boolean} | {error: string}}
 */
export function planWfrpEquip(slots, index, weapon) {
  const capacity = slots.filter((s) => !s.over).length;
  const need = pointsOf(weapon);
  if (need > capacity) return { error: "NoHands" };
  const targets = need === 2 ? (index + 1 < capacity ? [index, index + 1] : [index - 1, index]) : [index];

  const unequip = new Set(targets.map((i) => slots[i]?.item?.id).filter((id) => id && id !== weapon.id));
  const held = new Map(slots.filter((s) => s.item).map((s) => [s.item.id, s.item]));
  const used = () => [...held.values()].filter((item) => item.id !== weapon.id && !unequip.has(item.id)).reduce((sum, item) => sum + pointsOf(item), 0);
  for (let i = slots.length - 1; i >= 0 && used() + need > capacity; i--) {
    const id = slots[i].item?.id;
    if (id && id !== weapon.id) unequip.add(id);
  }
  return { unequip: [...unequip], equip: !weapon.equipped, offhand: need === 1 && slots[index]?.role === "off" };
}

/** Ile rąk zajmuje założona broń (do podpisu „1/2”). */
export const handsUsed = (slots) => slots.filter((s) => s.item && !s.over).length;
