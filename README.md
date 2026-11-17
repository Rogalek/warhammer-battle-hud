# Warhammer Battle HUD (`warhammer-battle-hud`)

**English** | [Polski](README.pl.md)

Everything a character needs in a fight, on one screen and with no other modules required: party frames, an action panel and an ammunition bar. It detects the active Warhammer system.

Requires **Foundry VTT v14** and one of: **WFRP 4e / 5e** (`wfrp4e` 10.0+), **The Old World** (`whtow`), **Imperium Maledictum** (`impmal`), **Wrath & Glory** (`wrath-and-glory`), **Soulbound** (`age-of-sigmar-soulbound`).

Don't enable it together with other modules that add party frames, track ammunition or add an action HUD: they would do the same job twice and get in each other's way.

## 📥 Installation

Paste into *Manifest URL* under **Add-on Modules → Install Module**:

```
https://github.com/TomasWarchol/warhammer-battle-hud/releases/latest/download/module.json
```

## 🧭 Floating HUD

The HUD (Advantage, action panel and ammunition) floats over the scene. Drag it by the handle on its left; the position is saved to your user account, so it follows you to any computer. **Double-click** the handle to put it back above the hotbar.

## ⚡ Advantage (WFRP)

A large counter at the front of the HUD shows the character's Advantage and glows brighter as it grows, up to the maximum. **Click**: +1, **right-click**: −1. The party frames highlight it too. It can be hidden in the settings.

The first tab of the action panel, **Advantage**, lists what the character can spend Advantage on right now, each with its cost (⚡1, ⚡2): the system's Advantage actions (with Up in Arms: Batter, Trick, Additional Effort, Flee from Harm, Additional Action) and, with **Underworld Crew** (`wfrp4e-underworld`), the tactical orders the Chief's retinue can carry out. Actions the character cannot afford yet are dimmed. Clicking an Advantage action spends the cost, posts it to chat and rolls its test, just like the button on the character sheet; clicking a crew order opens Underworld's order dialog.

## ⚔️ Action panel

Tabs above the hotbar for the selected token, or your assigned character. In WFRP: characteristics, skills, combat, magic, religion, talents, conditions and Advantage. In the other systems: the system's tests with the character's values.

* **Left click**: roll, add a condition or Advantage, post a talent to chat.
* **Right click**: open the item, remove a condition or Advantage.
* **Shift**: Blind GM roll. **Alt**: skip the roll dialog. **Ctrl + left / right** on weapons and armour: repair / damage.

## 🏹 Ammunition

In systems that track ammunition (WFRP, Imperium Maledictum, Wrath & Glory): choose the ammunition, reload, and equip weapons or shields with one click. The count turns amber when low and red when gone.

## 🖼️ Party frames

Portrait, health, the system's resources and conditions for each character. **Click** targets the token, **double-click** goes to it, **right-click** opens the sheet. The header switches between Party, Combat and Selected tokens, collapses the frames and moves them when dragged.

## 🎯 Token HUD

Four quick tests with their values on the token's HUD. Each part can be switched off in the settings.

## 🌐 Languages

English and Polish are built in. To add another language:

```bash
npm run lang:add -- de "Deutsch"
```

## 📄 License

MIT – see [LICENSE](LICENSE).

Unofficial fan content, not affiliated with or endorsed by Games Workshop or Cubicle 7. Warhammer and all related names are trademarks of Games Workshop Limited. The module ships no rulebook text or artwork; it works with the content you already own.
