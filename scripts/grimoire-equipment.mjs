/** Optional integration with WFRP4e Grimoires. */
export function equippableGrimoires(actor) {
  const module = globalThis.game?.modules?.get("wfrp4e-grimoires");
  const api = module?.active && module.api;
  if (!api) return [];
  // Older releases expose ordinary grimoires through isGrimoire/read.
  return (actor?.itemTypes?.trapping ?? []).filter((item) => api.isEquippableGrimoire
    ? api.isEquippableGrimoire(item)
    : api.isGrimoire(item) && !api.read(item)?.kind);
}

/** The Old World treats non-equippable trappings as always equipped in its getter. */
export const towIsEquipped = (item) => Boolean(item.type === "trapping" ? item.system?.equipped?.value : item.system?.isEquipped);

export function setTowEquipped(item, equipped) {
  const changes = { "system.equipped.value": equipped };
  if (item.type === "trapping" && !item.system.equippable) changes["system.equippable"] = true;
  return item.update(changes);
}
