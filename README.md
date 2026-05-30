# Rawgrim: The Toll of Survival

Rawgrim: The Toll of Survival is an unofficial Foundry Virtual Tabletop module for dnd5e campaigns that want harsher survival, dangerous magic, and GM-facing attrition tools.

The module is built around four connected pressures:

- Food and water matter during rests.
- Spellcasting builds Resonance Points.
- Arcane overload can leave lasting corruption marks.
- Catalysts, equipment, and prosthetics can degrade under pressure.

This module is designed for grim survival campaigns. It is not affiliated with Foundry Gaming, Wizards of the Coast, or any official Dungeons & Dragons product.

## Compatibility

- Foundry VTT: minimum 14, verified 14.361
- System: dnd5e
- Required module: libWrapper

## Features

### Rest and Survival

- Intercepts short rest and long rest.
- Tracks ration and water spending.
- Supports normal and gritty rest variants.
- Supports gold funding for long-rest supplies.
- Applies exhaustion penalties when supplies are not enough.

Gritty long-rest supply thresholds:

| Supplies | Result |
| --- | --- |
| 7 days | Safe |
| 5-6 days | Exhaustion 1 |
| 3-4 days | Exhaustion 2 |
| 0-2 days | Exhaustion 3 |

### Arcane Resonance

- Adds Resonance Points when an actor casts leveled spells.
- Uses configurable spell-level multiplier.
- Sends GM-only overload prompts when RP reaches the actor threshold.
- Supports GM control checks, manual Backlash, and manual Contain.
- Prevents duplicate pending overload prompts for the same actor.
- Supports player-facing cantrip strain prompts.

### Material Catalyst

- Optional catalyst requirement for spellcasting.
- Supports global enforcement or per-actor control.
- Tracks catalyst usage die: d8 to d6 to d4 to expended.
- Lets actor owners roll catalyst usage when prompted.

### The Marks

- Tracks corruption stage and mark count.
- Stages: Early, Intermediate, Advanced.
- Backlash failure advances The Marks.
- Stage transition can overload installed prosthetics.

### Equipment Integrity

- Tracks Durability Die for weapons and armor.
- Supports degradation from d10 to d8 to d6 to d4 to damaged.
- Creates player/GM roll prompts.
- Supports GM repair workflow.
- Tracks overloaded prosthetics and Ignis calibration days.

### GM Dashboard

- Adds a GM dashboard scene control.
- Sorts actor cards by urgency.
- Summarizes pending overload, damage, injury, and other danger states.
- Provides quick actions for RP, cantrip strain, catalyst, marks, injuries, equipment integrity, and Ignis calibration.
- Keeps manual overrides collapsed until needed.

## Installation

### Foundry Package Browser

Once this module is approved in the Foundry package listing, install it from:

Foundry Setup -> Add-on Modules -> Install Module

Search for:

Rawgrim: The Toll of Survival

### Manifest URL

Until the package is listed, install it manually with the release manifest URL:

```text
https://github.com/YOUR_GITHUB_USERNAME/rawgrim-toll-of-survival/releases/latest/download/module.json
```

Replace `YOUR_GITHUB_USERNAME` with the final GitHub account or organization name.

### Manual Installation

1. Download `rawgrim-toll-of-survival.zip` from the latest release.
2. Extract it into your Foundry user data folder:

```text
Data/modules/rawgrim-toll-of-survival
```

3. Restart Foundry or refresh the Setup screen.
4. Enable the module inside your world.

## Settings

Open:

Game Settings -> Configure Settings -> Module Settings

Available settings:

| Setting | Default | Purpose |
| --- | --- | --- |
| Global Catalyst Enforcement | false | Requires catalysts for all leveled spellcasting. |
| Resonance Multiplier | 2 | Multiplies spell level into Resonance Points. |
| Sustenance Rest Variant | Gritty Realism | Controls 1-day or 7-day long rest supply scale. |
| Base Ration Cost | 0.5 gp | Used for gold-funded rests. |
| Base Water Cost | 0.2 gp | Used for gold-funded rests. |

## Release Checklist

Before publishing a new version:

1. Update `version` in `module.json`.
2. Update the `download` URL in `module.json` to the matching tag.
3. Update `CHANGELOG.md`.
4. Create a ZIP where `module.json` is at the root of the archive.
5. Attach both `module.json` and `rawgrim-toll-of-survival.zip` to the GitHub release.
6. Test installation from the release manifest URL.

## Legal

This project is an unofficial module for Foundry Virtual Tabletop.

Foundry Virtual Tabletop is a trademark of Foundry Gaming, LLC. Dungeons & Dragons and dnd5e-related trademarks belong to their respective owners. This module does not include paid rulebook content, adventure text, artwork, or official game content.

## License

Released under the MIT License. See `LICENSE`.
