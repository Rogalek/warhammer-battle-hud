/**
 * Warhammer 40,000: Imperium Maledictum (system "impmal"): magazynki; broń zakłada się do rąk.
 */
export default {
  id: "impmal",
  quantityPath: "system.quantity",

  count: (item) => item.system.quantity ?? 0,
  allWeapons: (actor) => actor.itemTypes.weapon ?? [],
  isRanged: (weapon) => Boolean(weapon.system.isRanged) && !weapon.system.selfAmmo,
  isEquipped: (weapon) => Boolean(weapon.system.isEquipped),
  // Bez wybranej ręki wiodącej system nie wie, do której ręki włożyć broń – wtedy prawa
  toggleEquip: (actor, weapon) => (weapon.system.isEquipped ? weapon.system.unequip() : weapon.system.equip(actor.system.handed || "right")),

  current: (weapon) => weapon.system.ammo?.document ?? null,
  choices: (weapon) => weapon.system.ammoList ?? [],
  setAmmo: (weapon, ammo) => weapon.update({ "system.ammo.id": ammo.id }),

  load(weapon) {
    const { current, value } = weapon.system.mag ?? {};
    return value ? { text: `${current} / ${value}`, needsReload: current <= 0 } : null;
  },

  reload: (_actor, weapon) => weapon.update(weapon.system.reload(Boolean(weapon.system.ammo?.document)))
};
