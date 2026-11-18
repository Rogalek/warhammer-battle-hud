import { describe, expect, it } from "vitest";
import * as B from "../scripts/actions/tow-builders.mjs";

const env = {
  localize: (key) => key,
  config: {
    characteristics: { ws: "Weapon Skill", bs: "Ballistic Skill" },
    skills: { melee: "Melee", defence: "Defence", shooting: "Shooting" },
    range: { 0: "Close", 1: "Short", 4: "Extreme" },
    actions: { aim: { label: "Aim" }, manoeuvre: { label: "Manoeuvre", subActions: { run: { label: "Run" }, moveQuietly: { label: "Move Quietly", test: { skill: "shooting" } } } } },
    conditions: { prone: { name: "Prone", img: "prone.webp", description: "<p>Down</p>" } },
    woundHealing: { 1: "Catch your breath" },
    magicLore: { elementalism: "Elementalism" },
    target: { self: "Self" },
    duration: {}
  }
};

const item = (type, name, system = {}) => ({ uuid: `Actor.a.Item.${name}`, name, type, img: `${type}.webp`, system });
const actor = {
  system: {
    skills: { melee: { characteristic: "ws", value: 3, advances: 1 }, defence: { characteristic: "ws", value: 2 }, shooting: { characteristic: "bs", value: 2 } },
    characteristics: { ws: { value: 3 }, bs: { value: 2 } },
    magic: { level: 2, miscasts: 3, lores: { none: { spells: [] }, elementalism: { label: "Elementalism", progress: 2, spells: [{}] } } },
    fate: { current: 1, max: 3 },
    blessed: { level: 3, document: { system: { favour: { description: "<p>Fav</p>" }, prayers: { list: [{ name: "Pray" }] }, miracles: { used: true } } } }
  },
  hasCondition: (key) => key === "prone",
  itemTypes: {
    weapon: [
      item("weapon", "Sword", { isEquipped: true, isMelee: true, damage: { value: 3 }, range: { melee: 1 }, skill: "melee", grip: "1H" }),
      item("weapon", "Crossbow", { isEquipped: true, isRanged: true, damage: { value: 4 }, range: { min: 1, max: 4 }, requiresLoading: true, isLoaded: false, reload: { current: 0, value: 2 } }),
      item("weapon", "Spare Axe", { isEquipped: false, isMelee: true })
    ],
    armour: [item("armour", "Buckler", { isEquipped: true, shield: true, resilience: "1" }), item("armour", "Mail", { isEquipped: true, resilience: "2" })],
    ability: [item("ability", "Bite", { isAttack: true, damage: { value: 2 }, attack: { dice: 3 } }), item("ability", "Keen Nose", { isAttack: false })],
    spell: [item("spell", "Fireball", { cv: 3, progress: 1, lore: "elementalism", target: { value: "self" } })],
    talent: [item("talent", "Strike", { test: { skill: "melee" } })],
    lore: [],
    wound: [item("wound", "Cut", { healing: 1, treated: false })]
  }
};

describe("The Old World: panel akcji", () => {
  it("wartość przycisku tam i z powrotem", () => {
    expect(B.towValue(B.TOW.spell, "Actor.a.Item.x", "elementalism")).toBe("spell|Actor.a.Item.x|elementalism");
    expect(B.readTowValue("action|manoeuvre|run")).toEqual({ type: "action", id: "manoeuvre", extra: "run" });
    expect(B.readTowValue("nonsense|x")).toBeNull();
  });

  it("akcje walki z wariantami manewru", () => {
    const actions = B.buildCombatActions(env);
    expect(actions.map((a) => [a.name, a.value])).toEqual([["Aim", "action|aim"], ["Manoeuvre: Run", "action|manoeuvre|run"], ["Manoeuvre: Move Quietly", "action|manoeuvre|moveQuietly"]]);
    expect(actions[2].tooltip.details[0].value).toBe("Shooting");
  });

  it("umiejętności według cech, z kośćmi", () => {
    const groups = B.buildSkillGroups(actor, env);
    expect(groups.map((g) => [g.label, g.actions.map((a) => `${a.name}:${a.detail}`)])).toEqual([["Weapon Skill", ["Melee:3", "Defence:2"]], ["Ballistic Skill", ["Shooting:2"]]]);
  });

  it("walka: tylko założona broń, przeładowanie nienaładowanej, zdolności ataku, tarcza osobno", () => {
    const c = B.buildCombat(actor, env);
    expect(c.melee.map((w) => w.name)).toEqual(["Sword"]);
    expect(c.ranged[0]).toMatchObject({ name: "Crossbow", cssClass: "unaffordable" });
    expect(c.ranged[0].tooltip.details.find((d) => d.label.endsWith("Range")).value).toBe("Short – Extreme");
    expect(c.reload).toMatchObject([{ value: "reload|Actor.a.Item.Crossbow", detail: "0/2" }]);
    expect(c.attacks.map((a) => a.name)).toEqual(["Bite"]);
    expect(c.armour.map((a) => a.value)).toEqual(["shield|Actor.a.Item.Buckler", "armour|Actor.a.Item.Mail"]);
  });

  it("magia: tradycja, zaklęcie z postępem, Miscasty ponad poziom", () => {
    const m = B.buildMagic(actor, env);
    expect(m.lores).toMatchObject([{ value: "castLore|elementalism", detail: "2" }]);
    expect(m.spells).toMatchObject([{ value: "spell|Actor.a.Item.Fireball|elementalism", detail: "1/3" }]);
    expect(m.miscasts.map((a) => [a.value, a.detail, a.cssClass ?? ""])).toEqual([["miscastDispose", "3/2", ""], ["miscastRoll", "3d10", "untreated"]]);
  });

  it("błogosławieństwo: Łaska, modlitwy i zużyty cud do odzyskania", () => {
    expect(B.buildBlessing(actor, env).map((a) => a.value)).toEqual(["blessing|favour", "blessing|prayer|0", "blessing|regainMiracle"]);
    expect(B.buildBlessing({ system: { blessed: { level: 0 } } }, env)).toEqual([]);
  });

  it("talenty i zdolności bez ataku do użycia; Los, stany i rany", () => {
    const u = B.buildUsable(actor, env);
    expect([...u.talents, ...u.abilities].map((a) => a.value)).toEqual(["use|Actor.a.Item.Strike", "use|Actor.a.Item.Keen Nose"]);
    const s = B.buildStatus(actor, env);
    expect(s.fate.map((a) => a.detail ?? "")).toEqual(["1/3", ""]);
    expect(s.conditions[0]).toMatchObject({ name: "Prone", cssClass: "toggle active" });
    expect(s.wounds[0]).toMatchObject({ value: "wound|Actor.a.Item.Cut", cssClass: "untreated" });
  });
});
