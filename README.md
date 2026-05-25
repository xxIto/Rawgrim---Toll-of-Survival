# Rawgrim: The Toll of Survival

An official tactical extension for the **DnD5e** system on Foundry Virtual Tabletop, engineered specifically for grimdark settings, hardcore survival campaigns, and the unforgiving rules of the *Rawgrim Saga*. 

*The Toll of Survival* strips away the effortless luxury of magical recovery and heroic resilience. It introduces an interconnected web of anatomical decay, logistical starvation, and arcane feedback. Every spell cast fractures the weaver's soul; every hour spent marching through corrupted miasma demands biological tribute. If the flesh is not sustained, it decays. If the spirit is overtaxed, the machine shatters.

---

## Core Systems & Features

### 1. The Sustenance Ledger & Dynamic Starvation
The standard resting mechanics are replaced with a strict, resource-gated transaction terminal. When characters initiate a rest under the **Gritty Realism** variant (8-Hour Short Rest, 7-Day Long Rest Vigil), the module intercepts the prompt and forces an inventory accounting ledger.

* **Rigid Resource Demands:** Short Rests strictly demand **1 Ration** and **1 Water (Pint)**. Long Rests require **7 Rations** and **7 Water (Pints)**.
* **The Hunger Penalties:** Failing to meet resource thresholds inflicts devastating biological consequences.
    * *Short Rest Deficit:* Inflicts **+1 Exhaustion Level** and interrupts standard hit dice deployment.
    * *Long Rest Deficit (Partial - 3 to 6 portions):* Limits recovery and forces the flesh into **Exhaustion Level 2**.
    * *Severe Deprivation (Under 3 portions):* Completely nullifies spell slot and hit point rejuvenation, condemning the character to **Exhaustion Level 3**.
* **Wadah Protection Logic:** The system intelligently excludes item containers like *Waterskins* from being consumed as raw quantity units, instead scanning and docking the explicit commodity item **Water (Pint)**.
* **Downtime Lifestyle Funding:** When resting within settlements, players can substitute physical rations for currency via a downtime dropdown selection, shifting costs dynamically based on the narrative narrative chosen:

| Lifestyle Tier | Financial Cost Multiplier | Narrative Condition |
| :--- | :--- | :--- |
| **Cheap Narrative** | 0.5x Base Cost | Simple broth, polluted waters, raw desperation. |
| **Standard Lifestyle** | 1.0x Base Cost | Clean tavern fare, secure lodging, reliable supplies. |
| **Luxury Narrative** | 2.0x Base Cost | High-faction banquets, pristine distillates, total comfort. |

### 2. Soul Resonance & Arcane Backlash
Magic in Rawgrim is not a free commodity—it is a violent manipulation of ambient pressure that threatens the physical integrity of the caster's mortal vessel.

* **Resonance Point Accumulation (RP):** Casting a spell of 1st-level or higher generates **Resonance Points** scaled by your configured multiplier (**Spell Level** × **Multiplier**).
* **The Breaking Threshold:** As a character gains levels, their capacity to contain internal feedback tightens:
    * *Levels 1–2:* 20 RP Threshold
    * *Levels 3–4:* 19 RP Threshold
    * *Levels 5–6:* 18 RP Threshold
    * *Levels 7–8:* 17 RP Threshold
    * *Level 9+:* 16 RP Threshold
* **The Arcane Overload Prompt:** Exceeding the threshold forces an immediate **Arcane Overload Prompt** into the chat log. The Game Master can manually enforce a catastrophe, absolve the caster by divine decree, or force a contained **d20 Breakdown Check** against the current RP score.

### 3. Anatomical Corruption & Prosthetic Overload
Accumulating failures during Arcane Overloads leaves permanent, corruptive scars upon the mortal body, tracked as **The Marks**.

* **Mechanical Breakdown:** When a character's total number of failed backlashes advances into a new corruption stage (*Early*, *Intermediate*, *Advanced*), their body releases a violent surge of kinetic feedback.
* **The Shatter Overlay:** Any installed iron prosthetics, specialized mechanisms, or prosthetic limbs in their inventory are instantly rendered **[OVERLOADED]**. Their active attunements are broken, equipment configurations unlinked, and all underlying magical passive effects disabled until mechanical recalibration is performed.

### 4. Catalyst Gatekeeping (The Laws of Scarcity)
Arcane energies refuse to manifest without a physical medium to anchor them. 

* **Global Enforcement:** When enabled, all spellcasters must possess an active item named **Material Catalyst** in their inventory to cast spells of 1st-level or higher. If absent, a cinematic screen warning covers the display and blocks the slot deployment completely.
* **The Usage Die:** Material Catalysts utilize an adaptive attrition step die (`d8` → `d6` → `d4` → *Expended*). Rolling a `1` or `2` during a spell cast degrades the catalyst, eventually crumbling it to ash.

---

## Installation Guide

### Prerequisites
This module strictly requires the following external framework to handle upstream method interceptions safely:
* **libWrapper** (Available for free via the Foundry VTT Package Browser).

### Manifest Installation
1. Log into your Foundry VTT Setup configuration screen.
2. Navigate to the **Add-on Modules** tab and click **Install Module**.
3. Paste the following manifest URL into the text field at the bottom:
   `https://your-repository-link/rawgrim-toll-of-survival/module.json`
4. Click **Install** and wait for the transmission to complete.

### Manual Installation
1. Extract the compressed module archive into your server's application directory:
   `FoundryVTT/Data/modules/rawgrim-toll-of-survival`
2. Relaunch the host server or refresh the World configuration page.

---

## Configuration Settings

Navigate to `Game Settings` → `Configure Settings` → `Module Settings` to customize the mechanical difficulty of your world:

| Setting Name | Configuration Type | Default Value | Functional Explanation |
| :--- | :--- | :--- | :--- |
| **Global Catalyst Enforcement** | `Boolean` | `false` | If enabled, forces all casting tokens to require a physical Material Catalyst item. |
| **Resonance Multiplier** | `Number (1-5)` | `2` | The mathematical value multiplied by the spell level to calculate incoming Resonance Points. |
| **Sustenance Rest Variant** | `Dropdown` | `Gritty Realism` | Toggles between standard pacing and scaled 7-day logistical consumption parameters. |
| **Base Ration Cost (GP)** | `Number` | `0.5` | The base financial value of one day's food portion for downtime calculations. |
| **Base Water Cost (GP)** | `Number` | `0.2` | The base financial value of one day's water supply for downtime calculations. |

---

## Usage Instructions

### Engaging the Ledger (Players)
1. Click the standard **Short Rest** or **Long Rest** button on your character sheet.
2. The custom *Sustenance Ledger* window will open, displaying your exact physical stock of food and water.
3. Use the **+** and **-** flat controls to commit resources to your rest session.
4. **Observe the Color Indicators:**
    * **Red:** Zero allocation. Committing will trigger an immediate exhaustion collapse.
    * **Yellow:** Partial preservation. You are conserving supplies but will face state penalties upon waking.
    * **Green:** Full biological satisfaction. Rejuvenation parameters are stable.
5. Confirm the rest. The system will calculate updates, apply structural item reductions in a single atomic database batch, and execute standard recovery adjustments.

### The Regulation Desk (Game Masters)
Select any player-controlled Token on the active scene map and open the **Token HUD** (Right-Click). Click the custom **Skull Icon** on the left control column to open the **Regulation Desk**:

* **Requires Catalyst Toggle:** Manually exempt specific characters (such as innate monstrous casters or unique factions) from global catalyst check mandates.
* **Resonance Counter (RP):** Manually adjust, increment, or purge accumulated Resonance Points following narrative milestones or environmental cleansing circles.
* **The Marks Tracker:** Track and manipulate total failed backlashes to force or delay stage transitions.
* **Recalibrate Mechanism:** Click this success terminal to instantly repair all **[OVERLOADED]** prosthetics in the target character's inventory, returning item names to normal and restoring their functional passive statuses.

---

> ### 📜 World Auditor Decree
> *The Toll of Survival is not a module designed to facilitate power fantasy. It is an impartial executioner of systemic attrition. Ensure your players understand that in the Rawgrim Saga, iron rusts, gold burns, and the flesh always remembers what it owes to the soil.*