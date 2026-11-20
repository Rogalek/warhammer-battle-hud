/**
 * Układ panelu akcji: zakładki i grupy – bez zależności od Foundry.
 */
import { GROUP_IDS as G } from "./builders.mjs";

/** Grupy: id → klucz tłumaczenia nazwy. */
export const GROUPS = {
  [G.characteristics]: "WFRP4E_HUD.Groups.Characteristics",
  [G.skillsBasic]: "WFRP4E_HUD.Groups.BasicSkills",
  [G.skillsAdvanced]: "WFRP4E_HUD.Groups.AdvancedSkills",
  [G.weaponsMelee]: "WFRP4E_HUD.Groups.Melee",
  [G.weaponsRanged]: "WFRP4E_HUD.Groups.Ranged",
  [G.armour]: "WFRP4E_HUD.Groups.Armour",
  [G.traits]: "WFRP4E_HUD.Groups.Traits",
  [G.petty]: "WFRP4E_HUD.Groups.Petty",
  [G.spells]: "WFRP4E_HUD.Groups.Spells",
  [G.channelling]: "WFRP4E_HUD.Groups.Channelling",
  [G.blessings]: "WFRP4E_HUD.Groups.Blessings",
  [G.miracles]: "WFRP4E_HUD.Groups.Miracles",
  [G.talents]: "WFRP4E_HUD.Groups.Talents",
  [G.extended]: "WFRP4E_HUD.Groups.ExtendedTests",
  [G.effects]: "WFRP4E_HUD.Groups.Effects",
  [G.conditions]: "WFRP4E_HUD.Groups.Conditions",
  [G.advantage]: "WFRP4E_HUD.Groups.Advantage",
  [G.advantageActions]: "WFRP4E_HUD.Groups.AdvantageActions",
  [G.momentum]: "WFRP4E_HUD.Groups.Momentum",
  [G.gangOrders]: "WFRP4E_HUD.Groups.GangOrders",
  [G.downtime]: "WFRP4E_HUD.Groups.Downtime",
  [G.channelledReset]: "WFRP4E_HUD.Groups.ChannelledReset"
};

/** Zakładki: id → klucz tłumaczenia i grupy w kolejności. */
export const LAYOUT = [
  // Przewaga pierwsza: to, co można za nią teraz zrobić, jest w walce najważniejsze
  // W zasadach 5e zamiast Przewagi jest Impet (nazwa zakładki z `name5e`)
  { id: "advantage", name: "WFRP4E_HUD.Tabs.Advantage", name5e: "WFRP4E_HUD.Tabs.Momentum", groups: [G.momentum, G.advantageActions, G.gangOrders, G.advantage] },
  { id: "characteristics", name: "WFRP4E_HUD.Tabs.Characteristics", groups: [G.characteristics] },
  { id: "skills", name: "WFRP4E_HUD.Tabs.Skills", groups: [G.skillsBasic, G.skillsAdvanced] },
  { id: "combat", name: "WFRP4E_HUD.Tabs.Combat", groups: [G.weaponsMelee, G.weaponsRanged, G.armour, G.traits] },
  { id: "magic", name: "WFRP4E_HUD.Tabs.Magic", groups: [G.channelledReset, G.petty, G.spells, G.channelling] },
  { id: "religion", name: "WFRP4E_HUD.Tabs.Religion", groups: [G.blessings, G.miracles] },
  { id: "talents", name: "WFRP4E_HUD.Tabs.Talents", groups: [G.talents, G.extended, G.effects] },
  { id: "conditions", name: "WFRP4E_HUD.Tabs.Conditions", groups: [G.conditions] },
  { id: "downtime", name: "WFRP4E_HUD.Tabs.Downtime", groups: [G.downtime] }
];
