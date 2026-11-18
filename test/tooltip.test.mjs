import { describe, expect, it } from "vitest";
import * as B from "../scripts/actions/builders.mjs";
import { escapeHtml, tooltipHtml } from "../scripts/actions/tooltip.mjs";

const env = {
  localize: (key) => `L(${key})`,
  config: { characteristics: { ws: "CHAR.WS" }, weaponGroups: { basic: "GROUP.Basic" }, weaponReaches: { average: "REACH.Average" }, locations: { body: "LOC.Body" } }
};

describe("podpowiedzi", () => {
  it("escapuje teksty z dokumentów", () => {
    expect(escapeHtml(`<img src=x onerror="a">&'`)).toBe("&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;");
    expect(tooltipHtml({ name: "<b>Miecz</b>", text: "opis" })).toContain("&lt;b&gt;Miecz&lt;/b&gt;");
  });

  it("pomija puste statystyki, a bez treści nie ma podpowiedzi", () => {
    expect(tooltipHtml({ name: "Unik", details: [{ label: "Rozwinięcia", value: undefined }] })).toBeUndefined();
    const html = tooltipHtml({ name: "Unik", details: [{ label: "Wartość", value: 40 }, { label: "Cecha", value: "" }], hint: "Klik: test" });
    expect(html).toBe('<strong class="whb-tip-name">Unik</strong><dl class="whb-tip-details"><dt>Wartość</dt><dd>40</dd></dl><p class="whb-tip-hint">Klik: test</p>');
  });

  it("broń: obrażenia, grupa, długość, zalety i umiejętność", () => {
    const weapon = {
      id: "w1", name: "Miecz", type: "weapon",
      system: {
        isEquipped: true, Damage: 6, weaponGroup: { value: "basic" }, reach: { value: "average" },
        properties: { qualities: { fine: { display: "Dobrej jakości" } }, flaws: {} },
        skillToUse: { name: "Broń Biała (Podstawowa)", system: { total: { value: 53 } } },
        description: { value: "<p>Zwykły&nbsp;miecz</p>" }
      }
    };
    const [sword] = B.buildWeapons({ type: "character", itemTypes: { weapon: [weapon] } }, env).melee;
    expect(sword.tooltip).toBe("Zwykły miecz");
    expect(sword.details.filter((d) => d.value)).toEqual([
      { label: "L(WFRP4E_HUD.Tip.Damage)", value: 6 },
      { label: "L(WFRP4E_HUD.Tip.Group)", value: "L(GROUP.Basic)" },
      { label: "L(WFRP4E_HUD.Tip.Reach)", value: "L(REACH.Average)" },
      { label: "L(WFRP4E_HUD.Tip.Skill)", value: "Broń Biała (Podstawowa) (53)" },
      { label: "L(WFRP4E_HUD.Tip.Qualities)", value: "Dobrej jakości" }
    ]);
  });

  it("pancerz: PZ tylko na chronionych lokacjach", () => {
    const armour = { id: "a1", name: "Kaftan", type: "armour", system: { isEquipped: true, AP: { body: 1, head: 0 } } };
    const [jerkin] = B.buildArmour({ type: "character", itemTypes: { armour: [armour] } }, env);
    expect(jerkin.details[0]).toEqual({ label: "L(WFRP4E_HUD.Tip.AP)", value: "L(LOC.Body) 1" });
  });

  it("umiejętność: cecha, rozwinięcia i wartość", () => {
    const skill = { id: "s1", name: "Unik", type: "skill", system: { characteristic: { value: "ws" }, advances: { value: 5 }, total: { value: 40 }, advanced: { value: "bsc" } } };
    const { basic: [dodge] } = B.buildSkills({ itemTypes: { skill: [skill] } }, env);
    expect(dodge.details).toEqual([
      { label: "L(WFRP4E_HUD.Tip.Characteristic)", value: "L(CHAR.WS)" },
      { label: "L(WFRP4E_HUD.Tip.Advances)", value: 5 },
      { label: "L(WFRP4E_HUD.Tip.Total)", value: 40 }
    ]);
  });
});

describe("czyszczenie opisów", () => {
  it("rozwija odnośniki i rzuty, a sam odnośnik do podręcznika pomija", () => {
    const skill = (value) => ({ name: "Atletyka", system: { description: { value } } });
    expect(B.plainDescription(skill("<p>@UUID[Compendium.wfrp4e-core.journals.x.JournalEntryPage.y]{Atletyka}</p>"))).toBe("");
    expect(B.plainDescription(skill("<p>Tracisz [[/r 1d10]] Żywotności, patrz @UUID[a.b]{Płonięcie} i @Condition[prone].</p>"))).toBe("Tracisz 1d10 Żywotności, patrz Płonięcie i prone.");
  });
});
