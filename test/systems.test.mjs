import { describe, expect, it } from "vitest";
import * as IM from "../scripts/actions/im-builders.mjs";
import * as WNG from "../scripts/actions/wng-builders.mjs";
import * as SB from "../scripts/actions/sb-builders.mjs";
import { finishPanel, readPanelValue, panelValue, testContext } from "../scripts/actions/system-panel.mjs";

const localize = (key) => key;

describe("wspólny szkielet paneli", () => {
  it("wartość przycisku i jej odczyt", () => {
    expect(panelValue("skill", "melee", "spec1")).toBe("skill|melee|spec1");
    expect(panelValue("dodge")).toBe("dodge");
    expect(readPanelValue("skill|melee", { skill: "skill" })).toEqual({ type: "skill", id: "melee", extra: "" });
    expect(readPanelValue("nope|x", { skill: "skill" })).toBeNull();
  });
  it("puste grupy i zakładki znikają, akcje dostają podpowiedź", () => {
    const tabs = finishPanel([
      { id: "a", groups: [{ label: "G", actions: [{ name: "X", value: "x", tooltip: { hint: "Klik" } }] }, { label: "Pusta", actions: [] }] },
      { id: "b", groups: [{ label: "Pusta", actions: [] }] }
    ], (key) => key);
    expect(tabs.map((t) => [t.id, t.label, t.groups.length])).toEqual([["a", "Tabs.a", 1]]);
    expect(tabs[0].groups[0].actions[0].tooltip).toContain("Klik");
  });
  it("Alt i Shift w oknie rzutu", () => {
    expect(testContext({ alt: true }, { skipDialogByDefault: false })).toEqual({ skipDialog: true });
    expect(testContext({ shift: true }, { blindOnShift: true })).toEqual({ skipDialog: false, fields: { rollMode: "blindroll" } });
  });
});

describe("Imperium Maledictum", () => {
  const env = { localize, config: { characteristics: { ws: "Weapon Skill", bs: "Ballistic Skill" }, characteristicAbbrev: { ws: "WS" }, skills: { melee: "Melee", ranged: "Ranged" }, ranges: { short: "Short" } }, statusEffects: [{ id: "prone", name: "Prone" }, { id: "dead", name: "Dead" }] };
  const actor = {
    system: {
      skills: { melee: { characteristic: "ws", total: 20, specialisations: [{ id: "s1", name: "Melee (One-handed)", system: { total: 30 } }] }, ranged: { characteristic: "bs", total: 25 } },
      combat: { initiative: 4 },
      fate: { value: 1, max: 3 }
    },
    hasCondition: (key) => (key === "prone" ? { isMajor: true } : null),
    itemTypes: {
      weapon: [
        { id: "w1", name: "Chainsword", system: { equipped: { value: true }, isMelee: true, damage: { value: 6 }, mag: { value: 1, current: 0 } } },
        { id: "w2", name: "Laspistol", system: { equipped: { value: true }, isRanged: true, damage: { value: 6 }, range: "short", mag: { value: 15, current: 3 } } }
      ]
    }
  };
  it("umiejętności według cech, specjalizacja pod umiejętnością", () => {
    expect(IM.buildSkillGroups(actor, env).map((g) => [g.label, g.actions.map((a) => `${a.name}:${a.detail}:${a.value}`)])).toEqual([
      ["Weapon Skill", ["Melee:20:skill|melee", "Melee (One-handed):30:skill|melee|s1"]],
      ["Ballistic Skill", ["Ranged:25:skill|ranged"]]
    ]);
  });
  it("broń biała bez magazynka, dystansowa z magazynkiem i przeładowaniem", () => {
    const c = IM.buildCombat(actor, env);
    expect(c.melee[0].detail).toBe("6");
    expect(c.ranged[0].detail).toBe("3/15");
    expect(c.reload.map((r) => r.value)).toEqual(["reload|w2"]);
  });
  it("stan poważny i Przeznaczenie", () => {
    const s = IM.buildStatus(actor, env);
    expect(s.conditions.map((c) => [c.name, c.detail, c.cssClass])).toEqual([["Prone", "WHB_IM.Major", "toggle active"]]);
    expect(s.fate[0].detail).toBe("1/3");
  });
});

describe("Wrath & Glory", () => {
  const env = { localize, config: { attributes: { strength: "Strength", initiative: "Initiative" }, skills: { athletics: "Athletics", weaponSkill: "Weapon Skill" } }, statusEffects: [] };
  const actor = {
    system: {
      attributes: { strength: { total: 3, rating: 3 }, initiative: { total: 2, rating: 2 } },
      skills: { athletics: { attribute: "strength", total: 5, rating: 2 }, weaponSkill: { attribute: "initiative", total: 4, rating: 2 } },
      combat: { determination: { total: 4 }, resolve: { total: 2 }, conviction: { total: 3 } },
      resources: { wrath: 2, faith: { current: 1, total: 2 } },
      corruption: { current: 1 }
    },
    itemTypes: { weapon: [{ id: "b", name: "Boltgun", system: { equipped: true, isRanged: true, damage: { formatted: 10, ED: 1, AP: -1 }, salvo: 2, needsReload: true } }] }
  };
  it("umiejętności według atrybutu", () => {
    expect(WNG.buildSkillGroups(actor, env).map((g) => [g.label, g.actions.map((a) => `${a.name}:${a.detail}`)])).toEqual([["Strength", ["Athletics:5"]], ["Initiative", ["Weapon Skill:4"]]]);
  });
  it("broń wymagająca przeładowania jest przygaszona, testy obronne z wartościami", () => {
    const c = WNG.buildCombat(actor, env);
    expect(c.ranged[0]).toMatchObject({ detail: "10", cssClass: "unaffordable" });
    expect(c.tests.map((t) => t.detail ?? "")).toEqual(["4", "2", "3", ""]);
  });
  it("Gniew, Wiara i Spaczenie", () => {
    expect(WNG.buildStatus(actor, env).resources.map((r) => [r.value, r.detail])).toEqual([["wrath", "2"], ["faith", "1/2"], ["generic|corruption", "1"]]);
  });
});

describe("Soulbound", () => {
  const env = { localize, config: { attributes: { body: "Body", mind: "Mind" }, skills: { might: "Might", lore: "Lore" } }, statusEffects: [] };
  const actor = {
    system: {
      attributes: { body: { value: 3 }, mind: { value: 2 } },
      skills: { might: { attribute: "body", training: 2, focus: 1 }, lore: { attribute: "mind", training: 0, focus: 0 } },
      combat: { mettle: { value: 1, max: 2 }, initiative: { total: 5 }, melee: { ability: "Good (4)" } }
    },
    itemTypes: { weapon: [{ id: "w", name: "Sword", system: { equipped: true, damage: "1 + S", traits: [{ name: "Cleave" }] } }] }
  };
  it("pula kości = atrybut + wyszkolenie, skupienie osobno", () => {
    expect(SB.buildSkillGroups(actor, env).map((g) => g.actions.map((a) => `${a.name}:${a.detail}`))).toEqual([["Might:5+1"], ["Lore:2"]]);
  });
  it("broń z obrażeniami i cechami, Hart", () => {
    const c = SB.buildCombat(actor, env);
    expect(c.melee[0]).toMatchObject({ detail: "1 + S" });
    expect(c.melee[0].tooltip.details.find((d) => d.label.endsWith("Traits")).value).toBe("Cleave");
    expect(c.other.map((o) => o.detail)).toEqual(["5", "1/2"]);
  });
});
