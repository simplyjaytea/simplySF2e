# SimplySF2e live QA checklist

Run this in a real Foundry v14 world (14.361 or later; the module verifies 14.369) with the `sf2e` system 1.6.x and the module enabled. Nothing here is self-checkable by node tests. Labels are the UI text from `lang/en.json`.

How to use: work the sections in order (Section 0 first). For every step fill **Result** with `PASS`, `FAIL` or `N/A`, and **Evidence** with a screenshot filename, a copied value, or a console line. Keep the browser console (F12) open throughout and paste any `simplysf2e |` warning or error into Evidence. Use a scratch world: the checks create actors, items, folders and macros. When something fails, note it in the Failure log at the end and continue.

For a quick pass over only the features added since 2026-10-08, use [live-pass.md](live-pass.md).

Test record: Foundry version `____` · sf2e version `____` · module version `____` · provider/model `____` · browser `____` · tester `____` · date `____`

Conventions: "Generator" = the **SimplySF2e — Generator** window. "Forge" = the **SimplySF2e — Item Forge** window. Both are GM-only.

## 0. Setup

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 0.1 | Log in as GM to a world using the Starfinder Second Edition (`sf2e`) system. In Manage Modules enable SimplySF2e and save. | World reloads with no red error notifications and no `simplysf2e` errors in the console. | Console, notification stack | | |
| 0.2 | Open the **Actors** sidebar tab. | A **SimplySF2e** button (dragon icon) is in the directory header. | Actors directory header | | |
| 0.3 | Open the **Items** sidebar tab. | An **Item Forge** button (hammer icon) is in a row just below the directory header actions. | Items directory | | |
| 0.4 | Log in as a non-GM player. Look at both directories; type `/sf2e` in chat. | No buttons for the player. The command shows the warning "Only a GM can use SimplySF2e generation and provider setup." and opens nothing. | Player's Actors/Items tabs, chat | | |
| 0.5 | As GM: Game Settings → Configure Settings → Module Settings → SimplySF2e → **AI Provider Setup** → **Configure Provider**. | **AI Provider Setup** window opens with Saved connections, Endpoint and API key sections. | Settings dialog | | |
| 0.6 | Choose a provider (hosted: enter its key; local Ollama/LM Studio: leave the key blank). Click **Load models**, pick a model, name the connection. | "Loaded N available model IDs." The Model field accepts the chosen ID. | Provider Setup | | |
| 0.7 | Click **Save & test**. | Success message "Connected to {provider} with model {model} ({total} tokens)." and no failure message. | Notification, Provider Setup | | |
| 0.8 | Open the Generator. Look at the provider row. | Green check, "Provider configuration is ready", and the model ID. The Forge shows the same row. | Generator header | | |
| 0.9 | (Optional) In Provider Setup add a second connection, **Save without testing**, switch to it with the Active connection selector in the Generator, then switch back. | Switching loads that connection's URL/model; the key is not shown in plain text. | Generator connection switch | | |
| 0.10 | Module Settings → SimplySF2e → **Compendium Sources** → **Configure Sources**. Before changing anything, read each category. | Every category (Bestiary Abilities, Spells, Feats, Equipment, Ancestries, Backgrounds, Classes, Class Features, Heritages, Bestiary Actors) lists packs, with the sf2e defaults marked "default" (`sf2e.classes`, `class-features`, `feats`, `spells`, `equipment`, `ancestries`, `heritages`, `backgrounds`, `bestiary-ability-glossary-srd`, and the seven creature packs: `alien-core-bestiary`, `guilt-of-the-grave-world-bestiary`, `secrets-of-the-swarm-bestiary`, `standalone-adventure-bestiary`, `starfinder-society-bestiary`, `rulebook-bestiaries`, `tales-from-the-vast-bestiary`). | Sources window | | |
| 0.11 | Click **Reset to defaults**, confirm the dialog, then **Save**. | "Compendium sources reset to the SF2e system pack defaults." then "Compendium sources saved." | Notifications | | |
| 0.12 | Reopen the Generator. | Compendium Content row reads "Ready: N enabled packs"; no "Required compendium content is unavailable" message. | Generator | | |
| 0.13 | Provider Setup → **Fast picks (Jev)** card: type an OpenRouter key and click **Save Jev key**. | "Jev key saved." The field is empty with the placeholder "A Jev key is saved — leave blank to keep it"; the key is not shown in plain text. A TypeSafe-direct key warning is visible. | Provider Setup | | |
| 0.14 | Reopen Provider Setup; click **Save Jev key** with the field empty, then tick **Clear the saved Jev key** and click it again. | Empty click changes nothing. Clear shows "Jev key cleared." and the placeholder returns to "Optional: OpenRouter key". | Provider Setup | | |
| 0.15 | Type a Jev key, leave the Model field empty, press **Save without testing**. | The chat save errors (model required) but reopening Provider Setup shows the Jev key is saved. | Provider Setup | | |

## 1. Presets and Manage presets

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 1.1 | Generator → Preset dropdown. | Groups: "Standard classes" (Envoy, Mechanic, Mystic, Operative, Solarian, Soldier, Technomancer, Witchwarper), "Starfinder Archetypes" (Corp Enforcer, Free Captain (Pirate), Street Cyberdoc, Bounty Hunter), "Custom presets". | Preset dropdown | | |
| 1.2 | Click the save-preset button, name it "QA Test", add guidance text, **Save preset**. | "Preset "QA Test" saved." It appears under Custom presets and is selected. | Dropdown, notification | | |
| 1.3 | Duplicate it, then open **Manage presets**. | "QA Test (copy)" exists. **Manage Custom Presets** lists both with edit and export buttons. | Manage window | | |
| 1.4 | **Export All**, delete both presets, then **Import** the exported JSON. | "Presets imported: 2 added, 0 skipped." Both are back. | Manage window | | |
| 1.5 | Delete "QA Test" and the copy (confirm dialog). | "Preset … deleted." Gone from the dropdown; Manage window shows "No custom presets yet." | Notification | | |
| 1.6 | Generator → Preset dropdown → open the **Standard classes** group. | Lists Envoy, Mechanic, Mystic, Operative, Solarian, Soldier, Technomancer and Witchwarper. Mechanic and Technomancer select like the other standard presets. | Preset dropdown | | |

## 2. NPC generation at GM Core levels

Reference ranges: *Starfinder GM Core* Chapter 2 "Building Games", pp. 116-128 (Building Creatures tables, mirrored in `scripts/tables.mjs`). Read each NPC's real numbers off its sheet and compare to the table row for that level. "Roughly within range" means between the table's low and extreme values for that level.

Repeat 2.1-2.7 for **Level 1**, **Level 5** and **Level 12**. Use the same prompt each time, e.g. `a disciplined corporate security captain`.

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 2.1 | Generator → mode **NPC** (or **Monster**). Set Level (Increase/Decrease level buttons). Enter the prompt. Leave Monster Adjustment = Normal. Click **Create NPC** (**Create monster** in Monster mode). | Progress bar advances monotonically through concept, spells/abilities/equipment steps as applicable. A preview appears; nothing is created yet. | Generator preview | | |
| 2.2 | Read the preview: level, AC, HP, Perception, Fort/Ref/Will, strikes. | Level equals the requested level. The "N/M compendium matches" line is shown; unmatched entries show the "will be skipped" warning icon. | Preview | | |
| 2.3 | Click **Create actor**. | Notification "Created actor "{name}"." and the completion panel (Content grounding counts). **Open sheet** works. | Notification, completion panel | | |
| 2.4 | On the sheet, AC, HP, saves, Perception. | Roughly within the GM Core ranges for that level. Record: AC `__`, HP `__`, Fort/Ref/Will `__`, Perception `__`. | NPC sheet header and Main tab | | |
| 2.5 | Strikes: attack bonus and damage. | Attack bonus within the Strike Attack Bonus row for the level; average damage within the Strike Damage row. | Strikes section | | |
| 2.6 | Spell DC / attack (if the NPC casts). | Within the Spell DC / Spell Attack row for the level. Spells are real `sf2e.spells` entries. | Spells tab | | |
| 2.7 | Inventory. | Every item is a real compendium item; skipped gear is absent. | Inventory tab | | |
| 2.8 | Generator → mode **NPC**. Enter a prompt that invites a grab or swallow ability (e.g. "a tentacled swamp horror that constricts and swallows prey whole, with a stench"). Generate at level 7, size Large, then Create actor. Open the F12 console. | No ability on the sheet or in the preview has `(0)` damage, a blank DC, a 0-foot distance or a 0 aura radius. Any ability the module could not fill is absent, and the console names it: `simplysf2e \| dropped "<name>": its blank values cannot be filled for this creature (level 7, size lg)`. | Preview, Actions tab, console | | |
| 2.9 | Same prompt as 2.8 at level 7, size Large. Read the glossary abilities on the sheet. | Filled values, as the cited tables give them: Constrict `@Damage[(4d6)[bludgeoning]]`, DC 25 (high); Greater Constrict DC 25 (high); Engulf `@Damage[(4d6)[bludgeoning]] damage`, DC 22 (moderate), escape DC 22, Rupture 15; Swallow Whole "Medium", `(4d6)`, Rupture 15; Trample "Medium or smaller", the strike name is one of the creature's own melee Strikes (the highest-damage one), DC 25 (high); Frightful Presence 90 feet, DC 22 (moderate), Aura radius 90; Stench 30 feet, DC 22 (moderate), Aura radius 30 (the Aura rule radius matches the distance). A DC scale chosen by the AI (high or moderate) changes only the DC. The filled numbers use the creature's base level: Elite, Weak and re-level do not change ability text, as with published abilities. A Reskin that renames a melee Strike leaves Trample's text naming the old Strike. | Sheet, Actions tab, chat card | | |
| 2.10 | Generator → mode **NPC**, level 7. Prompt: "a dragon that exhales a searing cone of flame and must catch its breath". Generate, then Create actor. Read the breath item. | A 2-action item named by the AI with a 30-foot cone, damage `8d6` fire, "DC 25 Reflex basic" (save line), and "It can't use <name> again for 1d4 rounds". Click the recharge roll in chat: it rolls 1d4 and the item can be used again after it. | Preview, Actions tab, chat | | |
| 2.11 | Same level 7 NPC, prompt: "a serpent that spits an acid line down a corridor". Create actor. | An at-will 2-action item with a 30-foot line, damage `4d6` acid, "DC 25 Reflex basic", and no recharge sentence. | Preview, Actions tab | | |
| 2.12 | Generator → mode **NPC**, level 8. Prompt: "a fungal swamp hulk whose spores sicken everything that comes near it". Generate, then Create actor. Read the aura item and place the token on the canvas. | A passive 30-foot aura visible on the canvas around the token (Aura radius 30 on the sheet). The ability text has a clickable `@Check[fortitude\|dc:23]` (DC 23 is SPELL_DC moderate at level 8) and reads "On a failure, it becomes sickened 2". The module applies nothing: the GM clicks the check and applies the condition. | Canvas, Actions tab, chat | | |
| 2.13 | Same level 8 creature, prompt: "a glowing reactor core that burns everything within ten feet each turn". Create actor. Place the token on the canvas. | A passive 10-foot aura visible on the canvas around the token. The ability text has a clickable `@Damage[4d6[fire]]` link (4d6 is the unlimited column at level 6, level 8 minus 2) and a clickable `@Check[fortitude\|dc:23\|basic]`. The module applies no damage: the GM rolls and applies it. | Canvas, Actions tab, chat | | |
| 2.14 | Generator → mode **NPC**, level 14, rarity Unique, Treasure amount Generous, any prompt that gives it loot. Create the actor and open its inventory. | The Credstick in its inventory brings the loot value to about the Credits budget chip in the preview (175,200 for a single level 14 creature, about 17,520 gp), not 10,000 gp. | Preview, NPC inventory | | |
| 2.15 | Generate and Create a monster or NPC. | After Create only Open sheet is highlighted as the primary button; Generate another is secondary. | Generator | | |
| 2.16 | Clear the Level field and press Generate. | Level 1 is used, not 0. | Generator | | |

| Level | Result | Evidence |
|-------|--------|----------|
| 1 | | |
| 5 | | |
| 12 | | |

## 3. Elite and Weak adjustment (applied exactly once)

Use one prompt at level 5. The goal is to prove the adjustment is applied once (by the system from the stored adjustment), not twice.

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 3.1 | Generate and create a **Normal** NPC at level 5. Note AC, HP, saves, Perception, strike bonus, first strike damage, one skill, and spell DC if any. | Baseline recorded: `____` | Sheet | | |
| 3.2 | Advanced options → **Monster Adjustment** = **Elite (+1 Level)**. Generate the same prompt; check the preview, then create it. | Preview already shows the adjusted numbers. The created actor shows level 6. | Preview, sheet | | |
| 3.3 | Compare Elite to Normal. | Exactly +2 to AC, saves, Perception, attack bonuses, skills, spell DC. First damage instance +2. HP higher by exactly 20 (level 5-19 row). Not +4, not +40. | Sheet | | |
| 3.4 | Check the sheet's adjustment state. | The sheet reads as Elite (`system.attributes.adjustment` = elite). Only one adjustment is active. | Sheet header | | |
| 3.5 | Create a **Weak (-1 Level)** version. | Level 4. | Sheet | | |
| 3.6 | Compare Weak to Normal. | Exactly -2 to AC, saves, Perception, attacks, skills, spell DC. First damage -2. HP lower by exactly 15 (the 3-5 row of the weak HP adjustment, keyed to the base level 5). | Sheet | | |
| 3.7 | Create an Elite at **level 1** and a Weak at **level 2**. | Elite at level 1: level 2, HP +10. Weak at level 2: level 1, HP -10. | Sheet | | |
| 3.8 | Generate a **Weak** creature at level -1 (or any low-level creature with a negative save, Perception or strike bonus); read the preview and, in Encounter mode, the member statline. | Negative modifiers read `-1`, never `+-1`; zero reads `+0`. "AC", "HP", "DC" and "Per" still appear. | Preview | | |

## 4. Encounter

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 4.1 | Generator → mode **Encounter**. Party level 3, Party size 4, Threat **Moderate**. Optionally enter a theme. Click **Create encounter**. | Progress shows "Encounter design" then "Member i/N" steps. A plan appears with roles (Boss, Minion, etc.) and per-member counts. | Generator preview | | |
| 4.2 | Read the XP readout and treasure readout. | Total XP at or near the Moderate budget for the party (80 XP at party size 4); within-budget styling when under. Treasure in credits with thousands separators. | Preview | | |
| 4.3 | Use "Add one" / "Remove one" on a member. | XP readout updates; "Remove one" at 0 skips that creature. | Preview | | |
| 4.4 | Preview with Threat Trivial, Severe, Extreme and with party size 5. | Member counts and XP scale with threat and party size. Record XP: `__ / __ / __ / __`. | Preview | | |
| 4.5 | Return to Moderate, party 4. Click **Create all actors**. | Notification "Created N actors in folder "{encounter name}"." A new Actor folder with that name exists. | Actors directory | | |
| 4.6 | Count actors in the folder. | Count equals the sum of member counts in the plan. Duplicates are named "Name 1", "Name 2". Each has bestiary-borrowed art and a plausible level. | Actor folder | | |
| 4.7 | Rollback: Compendium Sources → Bestiary Actors, uncheck every pack, Save. Generate an encounter preview and click **Create all actors**. | Creation fails with "No usable NPC actor was available in the enabled Bestiary Actor sources…". No folder from this attempt remains and no stray actors remain (all-or-nothing). | Actors directory, console | | |
| 4.8 | Restore defaults (Compendium Sources → **Reset to defaults** → Save). | Sources ready again. | Sources window | | |
| 4.9 | Generate an encounter preview, then press "Remove one" on every member until each count is 0. Try to click **Create all actors**. | The button is disabled. No folder is created and no "Created 0 actors" notice appears. Raising any member back to 1 enables it again. | Encounter preview, Actors sidebar | | |
| 4.10 | Encounter mode, press **Generate** (not Preview). | The folder and every member actor are created in one go, with no extra click on Create all actors. | Encounter preview, Actors sidebar | | |

## 5. Reskin

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 5.1 | Generator → mode **Reskin**. | "Reskin an existing creature" panel with "Drag an NPC here from the Actors sidebar or a bestiary compendium." | Generator | | |
| 5.2 | Click **Reskin and create** with nothing dropped. | Warning "Drop an NPC onto the Reskin panel first." | Notification | | |
| 5.3 | Drag a world NPC (with strikes, abilities and at least one rule/effect) from the Actors sidebar onto the panel. | Panel shows the creature name and "Creature {level}". | Drop panel | | |
| 5.4 | Drag a **character** onto the panel. | Rejected: "Only NPC creatures can be reskinned." | Notification | | |
| 5.5 | Re-drop the NPC. Enter a theme (e.g. "a void-touched pirate enforcer who boards ships through airlocks"). Click **Reskin and create**. | Preview shows new description, "Read aloud", "Recall Knowledge", and "Renamed strikes and abilities" (or "No strikes or abilities were renamed."). Line shown: "Statistics, rules, traits, and items are copied unchanged. The original creature is not modified." | Preview | | |
| 5.6 | Click **Create reskinned copy**. | A new actor appears; the original is untouched. | Actors directory | | |
| 5.7 | Compare original and copy: level, AC, HP, saves, Perception, skills, speeds, IWR, traits, item count. | All identical. | Both sheets | | |
| 5.8 | Compare items (Actions, Inventory, Spells). | Same item set. Only renamed strikes/abilities have new names; prose is new. | Both sheets | | |
| 5.9 | On a renamed strike with attack effects, open its item Rules tab and make the attack. | Same rules, damage and traits as the original; the item's slug is pinned to the original slug. Effects still apply. | Item sheet, chat | | |
| 5.10 | Repeat 5.3-5.8 dragging a creature straight from a **bestiary compendium** (e.g. `sf2e.alien-core-bestiary`). | Same behavior; copy lands in the world, compendium untouched. | Compendium, Actors | | |
| 5.11 | Check the copy's description for injected HTML. | Any `<` or `&` from the AI shows as text, not live markup. | Sheet description | | |
| 5.12 | Generate a creature whose concept includes Trample and a named melee Strike (the module fills Trample from its strongest melee Strike). Reskin it with a theme that renames that Strike, then create the copy. | The copy's Trample text names the new Strike. The original's Trample is unchanged. The `@Check[...]` in the Trample text still rolls. | Both sheets | | |
| 5.13 | Reskin a level 10 creature whose highest ability modifier is the Extreme value for level 10, then re-level the copy to 0. | Every ability modifier on the copy drops; none keeps its level 10 number. | Copy's sheet | | |
| 5.14 | Reskin a module-built creature that has Trample, a melee Strike and a stronger ranged Strike, then change its level. | Trample's text still names the melee Strike, never the ranged one. | Copy's sheet | | |

## 6. Item Forge

Open the Forge from the Items tab **Item Forge** button. Pick the **Item type**, set Item level and Rarity, enter a prompt, click **Generate**, read the preview, then **Create Item**.

### 6a. Wondrous Item with 1/day activation

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 6a.1 | Item type **Wondrous Item**, level 5, Common or Uncommon. Prompt: "a visor that shields the mind and lets the wearer see in the dark; once per day it fires a burst of light dealing fire damage". **Generate**. | Preview shows Usage, Bulk, Price, an Effects list (e.g. "+N item bonus to …") and an Activation section. Price is in **credits**. If "No usable passive effects survived validation" appears, regenerate once and note it. | Forge preview | | |
| 6a.2 | **Create Item**. | "Created item "{name}". Drag it from the Items directory onto a character sheet." | Notification | | |
| 6a.3 | Open the item sheet, Description tab. | Escaped description, mechanical summary and a clickable **Activate** link at the bottom. | Item sheet | | |
| 6a.4 | Price and level on the sheet. | Price in credits; level near requested; rarity as requested. | Item sheet | | |
| 6a.5 | Rules tab. | Passive effects are cloned from published items; no empty or null values. | Item sheet Rules | | |
| 6a.6 | Macro directory. | A folder **SimplySF2e Item Forge** exists containing macro "Activate: {item name}". | Macros | | |
| 6a.7 | Drag the item onto a PC; carry/equip and **invest** it. Assign the PC to the GM user (or select its token). Target a token. Click the **Activate** link. | Damage (or heal/condition) card posts to chat. Damage uses the native damage-roll card (`DamageRoll`); a save prompt appears if the activation defines a save and a target. | Chat | | |
| 6a.8 | Console: `actor.items.getName("{name}").getFlag("simplysf2e","forge")`. | `uses` is `{ value: 0, max: 1, per: "day" }` after one activation. | Console | | |
| 6a.9 | Click Activate again. | Chat: "{item} has no activations remaining. It recharges during daily preparations." No effect. | Chat | | |
| 6a.10 | Un-invest and click Activate. | Warning "invest and equip this item before activating it." No charge consumed. | Notification | | |
| 6a.11 | Rest for the Night. | See Section 9. | | | |
| 6a.12 | Delete the item from the actor, then from the world Items directory. | The "Activate: …" macro is deleted only once the last copy is gone; the folder remains. | Macros | | |
| 6a.13 | Repeat 6a.1-6a.7 with a heal and a condition activation if the AI offers them. | Heal card or condition applied to the target; charge decrements once. | Chat | | |

### 6b. Augmentation

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 6b.1 | Item type **Augmentation**, level 4. Prompt: "implanted tech that boosts reflexes". **Generate**. | Preview shows Usage "implanted" and a credit price. | Forge preview | | |
| 6b.2 | **Create Item**; open the sheet. | Equipment item with usage **implanted**, a single augmentation category, price in credits. | Item sheet details | | |
| 6b.3 | Drag onto a character. | Appears in inventory; passive rules (if any) listed in the Rules tab. | Character inventory | | |

### 6c. Solarian Crystal

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 6c.1 | Item type **Solarian Crystal**, level 3. Prompt: "a crystal that hardens the wielder's resolve". **Generate**, **Create Item**. | Crystal item with general passive effects (not solar weapon damage), priced in credits. | Forge, item sheet | | |
| 6c.2 | Open the item. | Usage "other"; description and rules present. | Item sheet | | |

### 6d. Weapon with grade and upgrade

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 6d.1 | Item type **Weapon (upgrades)**, level 8. Prompt: "a rifle that sears with flame". **Generate**. | The statline reads "Price … credits" then "Grade" with one label (commercial, tactical or advanced at level 8). The **Upgrades** section lists an upgrade if one fits. The base is a real `sf2e.equipment` weapon. | Forge preview | | |
| 6d.2 | **Create Item**; open the sheet. | `system.grade` equals the previewed grade. Name has no invented "+1 striking" prefix. | Item sheet | | |
| 6d.3 | Check upgrades. | Legacy potency/striking/property runes are zero or empty. A previewed upgrade appears **installed** on the weapon as an embedded upgrade module (`system.subitems`). | Item sheet upgrades area | | |
| 6d.4 | Price. | In credits; compare to the preview estimate (the sheet's prepared value is authoritative; record both). | Item sheet | | |
| 6d.5 | Embed on a character and make a Strike. | Strike appears with native attack/damage; no console errors. | Strikes, chat | | |
| 6d.6 | Repeat at levels 3, 13 and 18. | Grade rises with level; still priced in credits. If nothing fits, a clear message appears (e.g. "No … items were found in this world's compendiums…"). | Forge | | |
| 6d.7 | Item type **Weapon (upgrades)**, level 8. **Generate** a projectile weapon (prompt: "a heavy projectile rifle"), then a laser weapon (prompt: "a laser rifle") at the same level. **Create Item** on the projectile one. | Projectile preview's **Upgrades** section lists an **Impact Enhancer** or **Arcane Adapter** upgrade when one fits. The laser preview lists neither. On the created projectile weapon the upgrade is installed (`system.subitems`). | Forge preview, item sheet | | |

### 6e. Armor with grade (no upgrade)

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 6e.1 | Item type **Armor (upgrades)**, level 8. Prompt: "light armor that shrugs off kinetic hits". **Generate**. | Statline shows "Price … credits" then **Grade** with one label (commercial, tactical, advanced, superior, elite, ultimate or paragon); **no upgrade listed** under Upgrades (armor upgrade slot counts are uncited and on hiatus). | Forge preview | | |
| 6e.2 | **Create Item**; open the sheet. | `system.grade` set; no installed subitems; legacy runes zeroed; the base's analog/tech classification preserved. | Item sheet | | |
| 6e.3 | Embed on a character and equip. | AC reflects the armor; no errors. | Character sheet | | |

## 7. Player Characters (all eight classes)

Run each class at **level 1** and at one higher level (use **5**; record the level used). Mode **Character**. Pick the class preset (Envoy, Mystic, Operative, Solarian, Soldier, Witchwarper) or name the class in the prompt (Mechanic and Technomancer have no preset), set Level, click **Create character**. Leave the Free Archetype setting off.

| Class | L1 PASS/FAIL | L5 PASS/FAIL | Notes / evidence |
|-------|--------------|--------------|------------------|
| Envoy | | | |
| Mechanic | | | |
| Mystic | | | |
| Operative | | | |
| Solarian | | | |
| Soldier | | | |
| Technomancer | | | |
| Witchwarper | | | |

Per class and level:

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 7.1 | Generate character; read the preview. | Ancestry, Heritage, Background, Class, Feats, Equipment populated; "Skill priorities" and "Resulting skill proficiencies" shown. | Preview | | |
| 7.2 | Click **Create actor**. Watch for native Foundry prompts. | No unexpected prompts. Only documented ones may appear: SF2e choice dialogs the module could not answer ("Some character choices could not be selected automatically. Complete any SF2e choice dialogs to continue."). Record every prompt: `____` | Dialogs | | |
| 7.3 | Completion / review panel. | "Character created: review" if any features had no recorded choice. Record the listed items: `____` | Generator | | |
| 7.4 | Open the character; check embedded items. | Exactly one class, ancestry, heritage and background, all real items. Features arrived via grants, not duplicated. | Character tab, Features | | |
| 7.5 | Level, HP, AC, saves, Perception. | Level matches; system-computed stats are non-zero, no NaN. | Sheet header | | |
| 7.6 | Feats tab. | Class, ancestry, skill and general slots for the level are filled, or the review reports the gap. No duplicates. | Feats tab | | |
| 7.7 | Skills. | Trained skills match class base + Int + background; increases only at legal levels for the class. | Skills section | | |
| 7.8 | Equipment. | Gear priced in credits; armor/weapon readied only if trained, else a Loadout note (e.g. "An untrained armor item was left stowed."). | Inventory | | |
| 7.9 | Class path items: Operative specialization skill feat and Sniper bonus feat chosen without a native prompt; Solarian has Solar Manifestations. | Cited L1 choices closed before creation; none blank. | Feats, Actions | | |
| 7.10 | Level 18 character, Treasure amount Standard, no named loot picks. Create it, then add up the prices of all inventory items except the Credstick. | Credstick credits plus that sum is about 450,000 credits (45,000 gp), not about 100,000 credits plus the gear. | Character inventory | | |
| 7.11 | Character preview on screen, clear the prompt, press **Create another version**. | Only the "enter a prompt" warning appears. No actor is created and the old preview stays. | Character preview, Actors sidebar | | |
| 7.12 | Level 1 character whose gear costs more than 150 credits (generate, then add up the equipment prices). | The sheet has no Credstick from loot. The browser console shows one warning that the drafted coin was dropped. | Character inventory, console | | |

### 7a. Mystic and Witchwarper spellcasting (both levels)

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 7a.1 | Spellcasting tab. | A spontaneous entry in the class's tradition with embedded spells. | Spellcasting tab | | |
| 7a.2 | Count slots. | 3 base slots per unlocked rank and 5 cantrips (rank 1 at L1; ranks as unlocked at L5). | Spellcasting tab | | |
| 7a.3 | Spell list. | All real `sf2e.spells` of the right tradition; none above the castable rank; not empty. | Spell entries | | |
| 7a.4 | Focus spells. | In a separate focus entry with no slots. Count non-cantrip focus spells: `__`. | Spellcasting tab | | |
| 7a.5 | Focus pool. | Max focus points equals the non-cantrip focus spell count, capped at 3. The sf2e system derives it from the embedded focus spells (no module rule); hand-editing the max does not stick. | Sheet focus pips | | |
| 7a.6 | Cast a focus spell, then Refocus. | Spends one focus point; Refocus restores it. | Chat, sheet | | |
| 7a.7 | Console check. | No focus-pool warning from simplysf2e appears (the module no longer adds a focus-pool rule). | Console | | |
| 7a.8 | (Optional) Create at level 19. | A 10th-rank slot exists. | Spellcasting tab | | |

### 7b. Non-casting classes

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 7b.1 | Envoy, Operative, Soldier, Solarian: Spellcasting tab. | No spellcasting entry unless a class feature grants one. | Spellcasting tab | | |
| 7b.2 | Solarian: Actions. | Solar Manifestations present; no unanswered prompt. | Actions | | |

### 7c. Tech Core classes

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 7c.1 | Create a level 5 Technomancer. | A prepared arcane spellcasting entry with 5 cantrips and rank 1-3 slots; a focus entry holding the magic hack for its programming language (e.g. Viper -> Amplify Vulnerability); focus pool 1. | Spellcasting tab | | |
| 7c.2 | Create a level 1 Mechanic until one picks the Drone exocortex. | After Create, the GM gets a whisper: 'Drone exocortex: set up the drone companion by hand; SimplySF2e does not create companion actors.' Mine or Turret Mechanics get no whisper. | Chat (GM whisper) | | |
| 7c.3 | Create a level 5 Mechanic with default settings and open the skill review in the preview/after Create. | No 'Some feat prerequisites were planned with skill ranks the created character did not get' warning appears. | Preview / skill review | | |
| 7c.4 | Create a level 5 Technomancer. On the Spellcasting tab, count every spell in the prepared entry's spell database (known spells, not only the prepared ones). | Database holds 10 cantrips; 5 first-rank arcane spells plus the programming language's 1st-rank cache spell; and two spells per spell rank after 1st. Record: cantrips `__`, rank 1 `__`, rank 2 `__`, rank 3 `__`. | Spellcasting tab | | |

### 7d. Living Hologram and SRO ancestries (size choice)

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 7d.1 | Level 1 **Living Hologram** PC. Character mode; name the ancestry in the prompt (e.g. "a living hologram courier"). Generate character, then Create actor. | No native size prompt appears. The module answers the size choice. The sheet shows the creature size it chose. | Dialogs, sheet | | |
| 7d.2 | Level 1 **SRO** PC (SRO Frame). Same steps, naming the SRO ancestry in the prompt. | As 7d.1. | Dialogs, sheet | | |

### 7e. Multiclass (Free Archetype on only)

Turn on **Free Archetype variant rule** (Module Settings → SimplySF2e) for 7e.2–7e.6. The Multiclass picker must not appear with it off (7e.1). The picker label and the Basic Spellcasting slot ranks in 7e.5 come from the plan, not from `lang/en.json` or a cited journal page yet. Check them against the build and `journals/archetypes.json` (Basic Spellcasting) before you rely on them.

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 7e.1 | With **Free Archetype variant rule** off, open the Generator in Character mode. Turn the setting on and reopen it. | Off: no **Multiclass** picker. On: a Multiclass picker appears, blank by default. | Generator | | |
| 7e.2 | Free Archetype on. Class Soldier, level 5. Multiclass picker: Mystic. Generate character, then Create actor. | The Mystic Dedication fills the level-2 archetype slot. Preview and sheet agree. | Preview, Feats tab | | |
| 7e.3 | Same character. Read the archetype feats at levels 4 and later. | Where a legal follow-up exists, later archetype slots take Mystic archetype feats (their prerequisites name the Mystic Dedication or an earlier Mystic feat). | Feats tab | | |
| 7e.4 | Free Archetype on. Multiclass picker left empty. Prompt: "a soldier who dabbles in mysticism", level 5. Generate character, then Create actor. | The AI picks a dedication from the prompt. That dedication fills the level-2 archetype slot; the picker stays empty. | Preview, Feats tab | | |
| 7e.5 | Free Archetype on. Soldier with Multiclass picker: Mystic, created at level 4, then again at level 6 and at level 8. After each Create actor, read the Spellcasting tab. | A separate Mystic archetype spellcasting entry appears with 2 cantrips. A rank 1 slot appears at level 4, rank 2 at level 6, rank 3 at level 8 (Player Core p. 174, basic spellcasting). Record slots per rank: `__`. Repeat once with Witchwarper or Technomancer as the picker. | Spellcasting tab | | |
| 7e.6 | Free Archetype on. Multiclass picker: Mystic, level 6. Prompt: "a mystic who also trained as an operative". Generate character, then read the archetype feats at levels 2 to 6. | Only the Mystic dedication appears. No second dedication (for example Operative Dedication) appears before two Mystic archetype feats are placed. | Preview, Feats tab | | |

## 8. Skills: Computers and Piloting

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 8.1 | Open any generated character, Skills section. | **Computers** (Int) and **Piloting** (Dex) are listed. | Character sheet | | |
| 8.2 | Set Computers and Piloting to Trained manually. | Both can be trained and show a modifier. | Skills section | | |
| 8.3 | Generate a character with prompt "a starship pilot and hacker"; create it. | The preview's skill priorities can include Computers/Piloting; the created character shows them trained when picked. | Preview, sheet | | |
| 8.4 | Generate an NPC with prompt "a station hacker pilot". | NPC skills can include Computers/Piloting with modifiers within the GM Core skill range for its level. | NPC sheet | | |
| 8.5 | Roll Computers and Piloting from the sheet. | Roll cards post; no console errors. | Chat | | |

## 9. Rest for the Night (counter reset)

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 9.1 | Use a character with a spent forged item (counter 0 from 6a.8-6a.9). | Flag shows `value: 0, max: 1`. | Console | | |
| 9.2 | Use the sheet's Rest for the Night and confirm. | Rest completes; chat shows the rest card. | Chat | | |
| 9.3 | Re-read the flag. | `uses.value` is 1 (module listens for `pf2e.restForTheNight`, the cited hook name). | Console | | |
| 9.4 | Activate again. | Works as in 6a.7. | Chat | | |
| 9.5 | Rest again with the counter full. | No error. | Console | | |
| 9.6 | As a player who owns the character, rest. | Counter recharges (the owner client handles it). | Console | | |

## 10. Loot: spell gems, credits and UPB

Use NPCs of level 8 or higher with Advanced options → **Treasure amount** = **Generous** and a prompt that invites consumables and money, e.g. "a spell-slinging cultist carrying spell gems and a stash of credits". Use **Reroll loot** on the preview to try again.

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 10.1 | Generate an NPC with spell-gem loot and create it. | Loot includes consumables named like "Spell Gem of Fireball (Rank 3)". | Inventory | | |
| 10.2 | Open a spell gem. | Built from a real "Spell Gem (Nth-Rank Spell)" template with the spell linked and the chosen rank. | Item sheet | | |
| 10.3 | Check the link. | No broken `@UUID` link; the spell opens. | Item sheet | | |
| 10.4 | Look for money. | A **Credstick** (credits) and/or **UPB** appear; no classic coin stacks. | Inventory | | |
| 10.5 | Prompt "carries 50 gp". | Converted at 1 gp = 10 credits (500 credits). | Inventory | | |
| 10.6 | Treasure readout in the preview. | Credits with thousands separators; over-budget styling like the XP readout. | Preview | | |
| 10.7 | **Reroll loot** on a preview. | Loot changes, creature does not. | Preview | | |
| 10.8 | Character mode starting wealth. | Surfaced in credits. | Inventory | | |

## 11. Chat commands

As GM, in the chat box. The command word is case-insensitive.

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 11.1 | `/sf2e` | Generator opens; nothing posts to chat. | Window | | |
| 11.2 | `/simplysf2e` | Same. | Window | | |
| 11.3 | `/SF2E` | Opens. | Window | | |
| 11.4 | `/sf2efoo` | Not handled by the module. | Chat | | |
| 11.5 | `/sf2e itemforge` and `/simplysf2e itemforge` | Item Forge opens. | Window | | |
| 11.6 | `/sf2e npc` | Generator in NPC mode. | Mode selector | | |
| 11.7 | `/sf2e monster 7` | Monster mode, level 7. | Fields | | |
| 11.8 | `/sf2e npc 4 street doc` | NPC mode, level 4, prompt "street doc" prefilled. | Fields | | |
| 11.9 | `/sf2e encounter 3 smugglers` | Encounter mode opens with Party level 3 and the theme box reading "smugglers" (encounter mode reuses the level and prompt fields). | Fields | | |
| 11.10 | `/sf2e character 1 gruff vesk soldier` | Character mode, level 1, prompt prefilled. | Fields | | |
| 11.11 | `/sf2e 6 something` | Opens with level 6 and the prompt; mode unchanged. | Fields | | |
| 11.12 | Run `/sf2e` while the Generator is already open. | The same window comes forward; no duplicate. | Window | | |
| 11.13 | Console: `game.modules.get("simplysf2e").api.open()` and `.openItemForge()`. | Windows open. | Console | | |

## 12. Errors and cancellation

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 12.1 | Start a generation, click **Cancel generation** midway. | "Generation cancelled." No actor created; UI usable. | Notification | | |
| 12.2 | Enter a wrong key or model in Provider Setup and **Save & test**. | "Provider connection test failed: …" with a hint. | Notification | | |
| 12.3 | Restore the working provider and generate once. | Works. | Generator | | |
| 12.4 | Click Generate with an empty prompt (not Random). | "Describe the creature first." (Forge: "Describe the magic item first."). | Notification | | |
| 12.5 | Use the dice (Random) button in each mode. | A random concept is generated. | Preview | | |

## 12b. Jev equipment and loot picks (J2)

Needs an OpenRouter connection (Jev reuses its key). With a non-OpenRouter connection the same steps run on the chat model only.

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 12b.1 | OpenRouter connection, generate a monster with gear and loot. Note how long the equipment and loot steps take (the token report shows each step's seconds and whether Jev or the chat model did it). | Equipment and loot picks are real compendium items. No "Jev request" warning in the console. | Console, preview | | |
| 12b.2 | Repeat on a local or other non-OpenRouter connection. | Same kind of result; compare step time against 12b.1. | Console | | |
| 12b.3 | OpenRouter connection, DevTools Network set to Offline for `openrouter.ai/api/v1/systemone` only (block that URL), then generate. | "using the chat model" warning, and gear and loot still resolve through the chat model. | Console | | |
| 12b.4 | Generate a creature whose loot includes a spell gem and credits. | Spell gem and credits appear exactly as before; credits are not doubled. | Preview | | |

## 12c. Jev creature feat and ability picks (J3)

Needs an OpenRouter connection, as 12b.

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 12c.1 | OpenRouter connection, generate a creature with class feats and glossary abilities (for example a soldier-style guard that grabs). | Feats and abilities resolve to real compendium entries. No "Jev request" warning in the console. | Preview, console | | |
| 12c.2 | Generate a creature with an odd ability no published action matches. | That ability stays labeled narrative-only; creation is not blocked. | Preview | | |
| 12c.3 | Block `openrouter.ai/api/v1/systemone` in DevTools, then generate the 12c.1 creature. | "using the chat model" warning; feats and abilities still resolve. | Console | | |

## 12d. Jev PC feat and choice picks (J4)

Needs an OpenRouter connection, as 12b.

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 12d.1 | OpenRouter connection, generate a level 5+ soldier PC. | Every class/general/skill feat slot is filled with a real feat, no feat repeats across slots, class slots carry the class trait. No "Jev request" warning in the console. | Preview, console | | |
| 12d.2 | Generate a PC whose class or ancestry has a choice (for example a skill choice) and create it. | The choice is pre-answered or prompts natively; nothing breaks. | Sheet | | |
| 12d.3 | Block `openrouter.ai/api/v1/systemone` in DevTools, then generate the 12d.1 PC. | "using the chat model" warning; all feat slots still filled. | Console | | |
| 12d.4 | Generate a PC at level 15+ (many feat slots). | All slots filled; compare step time against a non-OpenRouter connection. | Preview | | |


## 12e. Jev PC spell picks (J5)

Needs an OpenRouter connection, as 12b.

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 12e.1 | OpenRouter connection, generate a level 5+ mystic or witchwarper PC. | Cantrips and each rank are filled to the planned count with real spells of the right tradition; signature spells are marked at signature ranks; no "Jev request" warning in the console. | Preview, console | | |
| 12e.2 | Block `openrouter.ai/api/v1/systemone` in DevTools, then generate the 12e.1 PC. | "using the chat model" warning; spell list still filled. | Console | | |
| 12e.3 | Generate the 12e.1 PC with Jev on, then with a non-OpenRouter connection. | Compare the Spells step time in the token report; record both. This decides whether J5 stays. | Preview | | |
| 12e.4 | Generate a creature (NPC) with spellcasting. | Spells still chosen by the chat model (no Jev spell requests). | Preview, console | | |

## 12f. U5b Item Forge, Sources and Presets fixes

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12f.1 | Forge a wondrous item with a 1/day self-buff whose name has `&` or `<` (type it in the prompt), then activate it. | Preview shows the name literally; the item description and chat line show it escaped, never as markup; the Effect item's name is the plain text. | Preview, chat | | |
| 12f.2 | Open Compendium Sources with a long-id homebrew pack. | Source id wraps beside the title; title keeps readable width. | Sources | | |
| 12f.3 | Open Manage presets with no presets, then with some. | Empty text points to New Preset / Import; each row button reads aloud as "Edit preset <name>" etc. | Presets | | |
| 12f.4 | Item Forge Level and Rarity row. | Labels share one line and the fields sit together. | Item Forge | | |
| 12f.5 | Provider Setup: set Base URL to `ftp://x`, press Save without testing. | Error toast "Could not save provider settings: ..."; window stays open with your edits. A valid save still closes the window. | Provider Setup | | |
| 12f.6 | With a screen reader (or the accessibility tree), tab through Provider Setup, Item Forge, Sources and Manage presets. | Decorative icons are not announced; buttons read by their text. | All four | | |

## 12g. Generator UI fixes (U5a)

Things the preview harness cannot show: real Foundry fonts, tooltips and a screen reader.

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 12g.1 | Tab with the keyboard onto Generate (and onto "Advanced options"). | A cyan ring is drawn all the way around the button (its notched corner squares off while focused); the summary shows the same ring. | Generator | | |
| 12g.2 | Start a generation with a screen reader on. | One announcement per step change (the new step name (for example "Spell selection")); no announcement on every percent tick; Cancel announces "Cancelling". | Progress card | | |
| 12g.3 | Encounter preview: raise members until XP is over budget; set one member to x0. | The over-budget number is light red with a red border; the x0 card shows a "Skipped" tag and stays readable. | Encounter preview | | |
| 12g.4 | Set a Sources category to an empty/uninstalled pack, reopen the Generator. | Compendium row says "...unavailable: Spells, Feats." with names, not ids. | Status strip | | |
| 12g.5 | Reskin mode, nothing dropped. | Empty hint tells you to drop an NPC. | Generator | | |
| 12g.6 | Hover a long connection or model name in the status strip. | Full name appears in a tooltip. | Status strip | | |
| 12g.7 | Create one actor. | Completion card reads `Created actor "Name".` | Generator | | |
| 12g.8 | A "found" check and the not-found glyph (character preview, a spell the pack lacks). | Check is clearly green, not-found glyph is red, in all rows. | Preview | | |

## 12h. U6 Compendium Sources flow

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12h.1 | Tick a pack, then click **Reset to defaults** and choose **No**. | A confirm dialog appears; No changes nothing and keeps your ticks. Yes resets and shows the "reset" notice. | Sources | | |
| 12h.2 | Shrink the Sources window so the list scrolls. | **Save** and **Reset to defaults** stay pinned at the bottom while the categories scroll under them. | Sources | | |
| 12h.3 | With every compendium pack disabled in the world, open Sources. | One "No compendium packs…" message, not one per category, and **Save** is disabled. | Sources | | |

## 12i. U6 Manage presets delete cue

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12i.1 | Open Manage presets with several presets. | The trash button is red-tinted and spaced apart from Edit, Duplicate and Export; hover or Tab to it turns the fill red. Clicking still asks for confirmation. | Manage presets | | |

## 12j. U6 Provider Setup flow

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12j.1 | Open Provider Setup, type in the Connection name or Model field and press Enter. | Runs **Save & test** (the highlighted primary), not Save without testing. | Provider Setup | | |
| 12j.2 | Click through DeepSeek, OpenAI, OpenRouter, then Ollama, LM Studio, Custom. | The Ollama / LM Studio CORS paragraph is hidden for the three hosted providers and shown for the other three. | Provider Setup | | |
| 12j.3 | Look at the bottom button that used to say Cancel. | It reads **Close** and just closes the window; Load models and connection changes have already saved. | Provider Setup | | |

## 12k. U6 Run safety

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12k.1 | Start a Generator run, then click the window X (or press Esc) mid-run and answer **No**. | "Stop generation?" dialog; No keeps the window open and the run continues. | Generator | | |
| 12k.2 | Repeat and answer **Yes**. | The window closes, the run stops (provider dashboard or Network tab shows no further requests) and no actor is created. Reopening the Generator shows a clean form, not a stale progress card. | Generator, Network | | |
| 12k.3 | Same as 12k.1 and 12k.2 in the Item Forge. | Same behavior. | Item Forge | | |
| 12k.4 | Close an idle Generator or Forge window. | No prompt. | Both | | |
| 12k.5 | With a preview showing, click **Discard**. | A confirm dialog; Cancel keeps the preview, Confirm clears it. Check monster, encounter, character and Forge previews. | Both | | |
| 12k.6 | Type a prompt and press Ctrl+Enter (Cmd+Enter on Mac). | Starts Generate exactly as the button does; does nothing while busy. | Both | | |

## 12l. U6 Item Forge consistency

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12l.1 | Forge a wondrous item, then a weapon. | Both previews show price in credits (no gp). | Forge preview | | |
| 12l.2 | Open the Item Forge. | A "Compendium Content" row sits under the provider row with a gear that opens Compendium Sources; Generate stands alone in its row. | Item Forge | | |
| 12l.3 | Generate an item, then look at the primary button. | It still reads **Generate**, not Regenerate; pressing it again makes a new version. | Item Forge | | |
| 12l.4 | Forge a weapon or armor at item level 8, then Generate until the preview grade is Advanced (the AI picks among the offered grades: at level 8 a weapon offers commercial, tactical, advanced; armor the same). Look at the statline and the Upgrades list. | The statline reads "Price … credits" then "Grade Advanced". The Upgrades list has no grade bullet. Grade source: `GRADE_LEVELS` (runes.mjs:70 weapon `advanced: 4`, runes.mjs:74 armor `advanced: 8`); `getGradeTiers` (runes.mjs:300) offers each grade whose level is at most the item level. | Forge preview | | |

## 12m. U6 Narrow windows

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12m.1 | Set the Generator to about 460 px wide. | The five modes sit on one row, icon above label, and no label breaks mid-word or is cut off. | Generator | | |
| 12m.2 | Encounter and Character modes at the same width. | The Generate button label stays on one line; Preview first drops to a second line if there is no room. | Generator | | |
| 12m.3 | Item Forge at about 460 px. | Kind tiles sit two per row, so Generate and the preview are higher up. | Item Forge | | |
| 12m.4 | Shrink the Generator under about 400 px. | The five modes stay on one row with a slightly smaller label; nothing overflows or is cut off. | Generator | | |

## 12n. Jev indicator and token report (J6)

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12n.1 | Open the Generator on an OpenRouter connection. | Third status-bar row "Fast picks: Jev" reads "on (OpenRouter connection)" with a green edge. | Generator | | |
| 12n.2 | Switch to a non-OpenRouter connection with no Jev key. | Row reads "off (needs an OpenRouter connection or a Jev key)" with a neutral edge, not a warning. Its gear opens AI Provider Setup. | Generator | | |
| 12n.3 | On that connection, save a Jev key in Provider Setup, reopen. | Row reads "on (separate Jev key)". | Generator | | |
| 12n.4 | Generate a monster with Jev on, then the same prompt with Jev off (12n.2). | Equipment, Loot and feat step lines end with "Jev, N.N s" (Jev on) or "chat model, N.N s" (Jev off). Concept, Design, ABC and Reskin lines carry no timing. Record the Equipment and Loot times for both runs. | Preview | | |
| 12n.5 | Block `openrouter.ai/api/v1/systemone` in DevTools and generate. | Affected steps read "chat model after Jev fell back, N.N s"; console shows "using the chat model". | Preview | | |
| 12n.6 | Narrow the window to about 360 px. | The Jev row wraps cleanly; no horizontal scroll. | Generator | | |

## 12o. Jev source and Test Jev

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12o.1 | Open AI Provider Setup. | Fast picks (Jev) shows a "Jev source" dropdown (OpenRouter, TypeSafe AI), the key field with "Save Jev key" and "Test Jev", and no CORS warning while OpenRouter is chosen. "Clear the saved Jev key" shows only when a key is saved. | Provider Setup | | |
| 12o.2 | On an OpenRouter chat connection with its key saved and no Jev key, press Test Jev. | Green toast "Jev is working: OpenRouter answered in N.N s." Window stays open. | Toast | | |
| 12o.3 | Choose TypeSafe AI. | The CORS warning appears; the key placeholder reads "Optional: TypeSafe AI key". | Provider Setup | | |
| 12o.4 | With TypeSafe AI chosen, type a TypeSafe key and press Test Jev. | Today: error toast "TypeSafe AI blocks calls from a browser (CORS)…"; console shows a CORS error for api.typesafe.ai. If it passes instead, record that TypeSafe now allows browsers. | Toast, Console | | |
| 12o.5 | Reopen the Generator after 12o.4. | Fast picks row reads "on (TypeSafe AI key)". | Generator | | |
| 12o.6 | In Provider Setup switch the source back to OpenRouter, leave the key blank, press Save Jev key. | Toast "Jev key cleared."; the TypeSafe key is gone (a key never goes to the other service). | Toast | | |
| 12o.7 | Save a wrong OpenRouter Jev key and press Test Jev. | Error toast "OpenRouter rejected the Jev key (HTTP 401)." | Toast | | |
| 12o.8 | On a non-OpenRouter chat connection with no Jev key, press Test Jev. | Error toast "Jev is off: save a Jev key, or save an OpenRouter chat connection with its key." | Toast | | |
| 12o.9 | Narrow the window to about 360 px. | The key field, Save Jev key and Test Jev wrap cleanly; no horizontal scroll. | Provider Setup | | |

## 12p. Skipped gear

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12p.1 | Generate a monster whose prompt names gear the sf2e packs lack (e.g. "a goblin scavenger with a rusted dagger"). | Generation finishes. Any gear with no published match is named on the "Not matched, skipped" line under Equipment or Loot, with the warning icon; no "Generation is incomplete" error. | Preview | | |
| 12p.2 | Create it. | The actor has only real compendium items. The completion card shows "Skipped gear with no published match: N" when anything was skipped. Console shows `skipped equipment "<name>"`. | Inventory, chat card, console | | |
| 12p.3 | Reroll loot on a preview, then generate a PC. | Neither fails on unmatched loot or equipment; skipped items show the same way. | Preview | | |
| 12p.4 | Generate "a scavenger who fights with a rusted dagger" at level 1. | Equipment lists a real knife-group weapon (usually Knife) instead of skipping the dagger. | Preview | | |

## 12q. Spell catalog spread

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12q.1 | Generate an arcane caster NPC at level 10 with a prompt that names no spells (e.g. "a corporate techno-mage"). Repeat once. | Picked spells span the alphabet within each rank (late names such as Wall of Plasma or Summon Robot can appear), not only names starting A to M. Exact picks vary with the AI's spell keywords. | Preview | | |

## 12r. Window scrolling

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12r.1 | Generate a monster, then drag the Generator window's bottom edge up to about a third of the screen. | The window body scrolls with the mouse wheel down to the stat block's end. Create actor, Reroll loot (when the preview has loot) and Discard stay pinned at the window's bottom edge while the preview is in view (changed 2026-11-14, see 19.3). | Generator | | |
| 12r.2 | Do the same with an Item Forge preview, AI Provider Setup, Manage presets (with several presets) and Compendium Sources. | Each window scrolls to its last field. Item Forge pins its preview's button row like the Generator (19.3); Provider Setup and Manage presets keep their button row at the end; Sources keeps Save and Reset pinned. Nothing is cut off. | Each window | | |
| 12r.3 | Shrink the Foundry browser window to a short height (about 600 px) and open each window fresh. | No window runs past the screen with unreachable content; each scrolls inside. In Sources, tabbing through the list never leaves the focused checkbox hidden under the pinned Save/Reset row, and Load models in Provider Setup keeps your scroll place. | Each window | | |
| 12r.4 | With the Foundry browser window short (about 600 px), open Manage presets, then New Preset, then Import. | Both dialogs scroll to their Save/Import button; nothing is cut off. | Preset dialogs | | |
| 12r.5 | Pick a connection or model with a long name, then hover the name, the model id and the last-run cost in both the Generator and the Item Forge status strip. | Each shows its full text in a tooltip when it is cut short with "...". | Generator, Item Forge | | |
| 12r.6 | In each module window, scroll with the mouse wheel while the pointer is over a text box, a dropdown and the Level number box; then click into Level (and Party Size in Encounter mode) and wheel over it. | The window keeps scrolling (a long text box scrolls itself first); Level and Party Size never change from the wheel. | Each window | | |

## 12s. Compendium-first mechanics

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12s.1 | Generate a level 3 "corporate security guard with a laser pistol". | The Laser Pistol is in the inventory, and the Laser Pistol strike deals fire damage with the tech, reload-1 and expend-2 traits and a 40-foot range increment, like the weapon. Attack bonus and damage dice still follow the creature's level. | Preview, Actions tab | | |
| 12s.2 | Generate a "malfunctioning security robot" and open its notes. | Recall Knowledge lists Computers and Crafting checks. A creature whose traits name no table row (for example a time creature) shows only the DC, with no guessed skill. | Notes tab | | |
| 12s.3 | Generate a fast flying beast and a creature with darkvision and scent. | Speeds are values published creatures use (land at most 60 feet, fly 10 to 200 feet). Darkvision has no range; scent shows imprecise with a range of 15, 30, 60 or 120 feet. | Sidebar senses and speeds | | |
| 12s.4 | Generate a spontaneous spellcaster NPC. | Each known spell rank has 3 slots. | Spellcasting tab | | |
| 12s.5 | Forge a wondrous item with a prompt that invites odd traits (e.g. "a humming cosmic charm"). | Only real equipment traits appear on the item; the console names any dropped trait. | Item sheet, F12 console | | |
| 12s.6 | Generate a creature with a bespoke signature ability. | A narrative-only ability reads as flavor. If the AI wrote dice, a DC or Hit Points into it, the ability is left off and the console says so. | Actions tab, F12 console | | |

## 12t. First-run welcome

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12t.1 | In a fresh browser profile (no saved AI key), log in as GM to an sf2e world with SimplySF2e enabled and healthy compendiums. | Welcome opens with OpenRouter selected and Recommended, an empty key and Connect disabled. No readiness warning appears. | Welcome window | | |
| 12t.2 | Paste a key, then press Enter in the key field. | Connect becomes enabled and Enter starts it. The provider, key and Connect controls disable while progress is visible. | Welcome window | | |
| 12t.3 | Connect OpenRouter with an account whose model list contains `deepseek/deepseek-v4.1-flash`. | That default is shown and tested; the connected state names it and offers **Generate a sample monster**. | Welcome window | | |
| 12t.4 | Use a provider/account where the preset default is absent from `/models`. | No other model is picked silently. The provider's returned models appear, the placeholder is selected and Test & connect stays disabled until the GM picks one. | Welcome window | | |
| 12t.5 | Choose Google and connect with a valid key. | Google shows **Live check pending**, uses `https://generativelanguage.googleapis.com/v1beta/openai`, lists models without choosing a default, and tests only the GM's pick. Record whether this endpoint worked live. | Welcome window | | |
| 12t.6 | Choose Ollama with the local server running and more than one installed model. | No key is required, `http://localhost:11434/v1` is shown, Connect lists the installed models without a default, and only the GM's pick is tested. | Welcome window | | |
| 12t.7 | Open Advanced and choose **Anthropic via OpenRouter**. | OpenRouter is selected; after Connect, only `anthropic/*` model IDs are offered and no model is selected automatically. | Welcome window, Advanced | | |
| 12t.8 | Open Advanced and choose **LM Studio**; then open full Provider Setup and Compendium Sources from Advanced. | LM Studio uses its local preset and model-choice flow. Both existing secondary windows still open normally. | Welcome window, Advanced | | |
| 12t.9 | Reject a key (for example with a 401), then correct it and retry. | The error states the cause and next step, the draft key remains, focus returns to the key field, and a successful retry reaches connected or model choice. | Welcome window | | |
| 12t.10 | From a connected state, press **Generate a sample monster**. | The Generator opens in Monster mode at level 1 with “A level 1 space-pirate scout with a laser pistol” and starts a preview. No actor is created until the GM clicks Create. | Welcome window, Generator | | |
| 12t.11 | Run Welcome on sf2e older than 1.6.0, with compendium problems also present. | One top warning banner names the old version and the update fix ("Version X is older than 1.6.0. Update the Starfinder 2e system."). It takes the place of the compendium warning, so only one shows. | Welcome window | | |
| 12t.12 | On a supported system, disable every Spells pack, then press **Check again**. | One top warning names Spells and says to enable a pack in Compendium Sources. Restoring the pack and rechecking hides the warning. | Welcome window, Compendium Sources | | |
| 12t.13 | Complete a working connection and reload; then reopen with `/sf2e welcome` and the module-settings button. | Welcome no longer auto-opens after reload, and both manual routes open it. | Chat, module settings | | |
| 12t.14 | Clear the key again (or use a second browser), tick **Don't show this again at login**, reload. | Welcome stays closed even though the connection does not work. | Welcome window | | |
| 12t.15 | Log in as a player. | No welcome window, and `/sf2e welcome` shows the GM-only warning. | Player client | | |

## 12u. Copy bug report

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12u.1 | Make a Generator run fail (for example, set the model to a name the provider does not have, then Generate a monster). | The red error box shows a Copy bug report button. Clicking it shows "Bug report copied" and the clipboard holds a fenced block with the error, the failed step, the steps finished, the form values, settings and versions. | Generator, paste into a text editor | | |
| 12u.2 | Search the pasted report for your API key and your Jev key (and any other saved connection's key). | Neither key appears; the report says only "API key set: yes" and "Jev key set: yes/no". The endpoint shows only scheme and host. | Pasted report | | |
| 12u.3 | Start a generation and press Cancel. | The error box says the run was cancelled and shows no Copy bug report button. | Generator | | |
| 12u.4 | Make an Item Forge run fail the same way and click Copy bug report. | Same as 12u.1, with "Window: Item Forge" and the forge's kind, level and rarity. | Item Forge | | |
| 12u.5 | Open the world over plain http from another machine (not localhost), make a run fail and click Copy bug report. | The browser blocks the clipboard, so a "Bug report" window opens with the report already selected; Ctrl+C copies it. | Dialog | | |

## 12v. Recent previews

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12v.1 | Generate a monster, then generate a different monster. | A "Recent previews" card appears under the Generate button with the first monster: its name, "Monster · Level N" and the time it was made. The new monster's preview shows below. | Generator | | |
| 12v.2 | Press Open on the listed monster. | The first monster's preview comes back exactly as it was (same stats, picks, token usage), with Create actor working. The second monster now sits in the list. | Generator | | |
| 12v.3 | Make one preview in each other mode (NPC, Encounter, Player Character, Reskin), then Open each from the list. | Each restores into its own mode (the mode tab switches) and its Create button creates that preview. A Reskin entry brings back its dropped creature too. | Generator | | |
| 12v.4 | Create an actor from a restored preview, then look at the list. | The created preview is gone from the list; nothing in the list can create it a second time. | Generator | | |
| 12v.5 | Close the Generator window and open it again from the Actors sidebar. | The preview on screen and the list are both still there. | Generator | | |
| 12v.6 | Press the x on an entry, and Discard a preview on screen. | The x removes only that entry. Discard removes only the preview on screen; the list keeps its entries. | Generator | | |
| 12v.7 | Make seven previews in a row, then reload Foundry (F5). | The list never shows more than five (the oldest drop off). After the reload the list is empty. | Generator | | |
| 12v.8 | Make an NPC preview with a very long name, generate another, then narrow the Generator window to its smallest width. | The window never scrolls sideways. The long name is cut short with "..." and shows in full on hover; Open and the x stay visible on every row. | Generator | | |

## 12w. Reroll one pick

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12w.1 | Generate a level 5 spellcasting monster. Click the dice next to a ranked spell. | The progress bar shows "Pick reroll". Only that spell changes; it keeps its rank, the new spell is from the same tradition, it isn't already on the creature, and it shows the green found check. Everything else in the preview is unchanged. The token report gains a "Pick reroll" line. | Preview, token report | | |
| 12w.2 | Click the dice next to a cantrip. | The cantrip is replaced by a different cantrip, never a ranked spell. | Preview | | |
| 12w.3 | Reroll the same spell several times. | It never swaps back to a spell it already replaced. When nothing else fits, a warning says no other compendium option fits and the spell stays. | Preview, notification | | |
| 12w.4 | Reroll a feat and a published ability (book icon). | Each changes to a different published feat or bestiary action; the ability shows the book icon with its compendium name. Narrative-only abilities have no dice. | Preview | | |
| 12w.5 | Reroll a spell, then Create actor. | The sheet has the new spell (not the old one) at the shown rank, and the feat or ability you rerolled is the new one. | Spellcasting and Actions tabs | | |
| 12w.6 | Start a reroll and close the window or press Stop. | The preview keeps its old pick; only the usual "cancelled" notice appears. | Preview | | |
| 12w.7 | Generate a level 7 large creature with a narrative signature ability. Click the dice next to that ability until the pick is Constrict, then Create actor. | The created Constrict shows `@Damage[(4d6)[bludgeoning]]` and a DC from the slot's scale, with no blank values. If a pick cannot be used for this creature, the preview is unchanged and the console says why. | Generator, Actions tab, F12 console | | |

## 12x. Stat check after Create

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12x.1 | Generate and create a level 4 Monster with no Elite/Weak adjustment. | The finished panel shows **Stat check** with a green edge: "all N numbers match the preview and sit inside the GM Core range for level 4". Expanding it lists AC, Max HP, Perception, Fortitude, Reflex, Will, each strike, and Spell DC for a caster, each with a scale word. No chat whisper. | Finished panel | | |
| 12x.2 | Open the sheet and compare AC, HP, Perception, saves and each strike's attack bonus with the stat check list. | Every number in the list is the number on the sheet. | Actor sheet | | |
| 12x.3 | Generate and create an Elite NPC, then a Weak NPC. | Both checks pass: the expected numbers include the +2/-2 and HP change, and the scale words use the adjusted level. | Finished panel | | |
| 12x.4 | Create an encounter with at least two members. | One collapsible line per created actor (numbered minions included). Lines with problems are open; clean ones are closed. | Finished panel | | |
| 12x.5 | Whenever a row is marked (for example a published ability whose rule adds to AC or a save), note which creature and row. | The affected row is bold with a warning sign ("on the sheet, but the preview said ..."), the panel edge is orange, and the GM gets a whisper in chat listing only the rows that need a look. Nothing on the actor changed. | Finished panel, chat | | |
| 12x.6 | Create a Player Character and a Reskin copy. | No stat check section appears for either. | Finished panel | | |

## 12y. All Starfinder bestiaries

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12y.1 | Settings → Compendium Sources → Configure Sources, press Reset, then open it again. | Bestiary Actors marks seven packs "default": Alien Core, Guilt of the Grave World, Secrets of the Swarm, Standalone Adventures, Starfinder Society, Rulebooks, Tales from the Vast. Iconics and Adventure Pregens are listed but not ticked. | Sources window | | |
| 12y.2 | Generate and create a creature whose type only appears outside Alien Core (e.g. a swarm or a Grave World undead), with an art module enabled that maps sf2e creature packs through Foundry's compendium art mapping (the system's own pf2e-art flag only maps pf2e packs). | The new actor's portrait and token use art from a published creature with the same traits when one has art; creation never fails for lack of a scaffold. | Actors sidebar, token | | |
| 12y.3 | Repeat 12y.2 with no art module enabled. | Creation still works; the actor keeps the default sf2e NPC icon. | Actors sidebar | | |

## 12z. Shop generator

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12z.1 | As GM, look at the Actors sidebar header, then type `/sf2e shop`. | A **Shop** button sits next to the SimplySF2e button; both it and the chat command open the SimplySF2e Shop window. Players see no Shop button. | Actors sidebar, chat | | |
| 12z.2 | Describe a weapons dealer, Shop level 3, Standard, Common. Press Generate shop. | Progress runs Naming the shop, Finding matching items, Choosing the stock, Reading prices. The preview shows a name, keeper, up to 16 rows, all level 3 or lower, all common, mostly weapons/ammo. Credits match each item's compendium price. | Preview | | |
| 12z.3 | Remove two rows with ×, then Create merchant. | A loot actor opens in Merchant mode with the remaining items, quantities as shown (3 for consumables/ammo), prices as in the compendium. Each item links back to its compendium entry. The description shows the blurb, keeper and prose. | Merchant sheet | | |
| 12z.4 | Drag the merchant onto a scene and have a player buy an item. | The native merchant buy flow works and deducts the player's credits. | Scene, player sheet | | |
| 12z.5 | Generate at level 0 with Rarest stock Rare, then Large. | Only level 0 items; uncommon/rare items appear with a rarity tag; up to 24 rows. | Preview | | |
| 12z.6 | Press Stop mid-run, and separately close the window mid-run. | Nothing is created; the usual cancelled notice appears. | Preview, Actors sidebar | | |
| 12z.7 | Shop, category Weapons, level 10; find an ammunition row (for example Flashbang Ammunition) and compare its price with the item's own sheet. | The row price is the sheet's price divided by its "per" count (a 10-round pack priced 5,000 shows 500 each); the stock total uses the same unit price. | Shop | | |

## 12aa. Per-run token budget and run deadline

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12aa.1 | Settings → SimplySF2e → set **Run token budget** to `5`, then generate a monster. | Setup → Concept → … runs; the run then stops with "This run reached its 5-token budget and stopped. Raise the Run token budget setting or start a new run." No actor is created and the preview is discarded. Restore the default (60000) afterwards. | Generator, Settings | | |
| 12aa.2 | With **Run token budget** at 60000, set **Run deadline (minutes)** to `1`, start an encounter with 3+ members and leave it alone. | The run stops with "This run passed its time limit and stopped." before Request timeout (90 s of silence) would fire; no actors are created. Restore `5` afterwards (the default). | Generator, Settings | | |
| 12aa.3 | Restore both defaults and generate one monster, one PC, one Forge item. | Runs behave exactly as before this feature: no budget/deadline message, token report unchanged, and the What's-new note "Per-run token budget" appears once per GM browser after the update. | Generator, Forge | | |
| 12aa.4 | During a PC Create (after the preview, while choice rounds run), watch for a cancel affordance. | No Cancel button is offered during the non-cancellable apply step, and closing the window asks the usual "Stop generation?" question only for a cancellable run. | Generator | | |
| 12aa.5 | Open Module Settings after the update. | **Run deadline (minutes)** shows 5 with the hint "Minutes before a run times out (default 5). Set 0 to turn the limit off."; the What's-new note "Runs stop after 5 minutes" appears once per GM browser. | Module settings, What's new | | |

## 13. Firefox (if available)

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 13.1 | Open the world in Firefox. | Loads; no `simplysf2e` console errors. | Console | | |
| 13.2 | Open the Generator and the Forge. | Both render with the module styling; resizing causes no horizontal scroll. | Windows | | |
| 13.3 | Save & test and one NPC generation. | Succeeds as in Chrome. (Local provider: confirm CORS allows Firefox's origin.) | Notification | | |

## 13a. Buttons scroll with content

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 13a.1 | Generate a monster, NPC, encounter and player character, then make the Generator short enough that each preview scrolls. Scroll from the top to the bottom. | No button row stays stuck to the bottom edge while you scroll; Create actor and Discard (and Reroll loot, Create all actors or Create reskinned copy where shown) appear only at the end of the preview. | Generator | | |
| 13a.2 | Do the same with an Item Forge preview, AI Provider Setup, Manage presets and the Shop window. | Create Item / Discard, Save & test / Save without testing / Close, New Preset, and the Shop's button row sit at the end of the content and scroll with it. | Item Forge, Provider Setup, Presets, Shop | | |
| 13a.3 | Open Compendium Sources in a short window and scroll the category list. | Save and Reset stay pinned at the bottom edge while the list scrolls. | Sources | | |

## 13b. Jev TypeSafe endpoint (CORS proxy)

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 13b.1 | Open AI Provider Setup with Jev source OpenRouter, then switch it to TypeSafe AI. | A "TypeSafe endpoint" field appears under Jev source, blank with api.typesafe.ai as its placeholder, plus its hint. Switching back to OpenRouter hides it. | Provider Setup | | |
| 13b.2 | TypeSafe AI, endpoint blank, a TypeSafe key typed, press Test Jev. | Error toast says TypeSafe blocks browser calls and suggests OpenRouter or your own proxy. | Toast | | |
| 13b.3 | Enter `http://proxy.example.com/x` (plain http, not this computer) and press Save Jev key. | Error toast: the endpoint must be https or http on localhost. Nothing is saved; the key placeholder is unchanged. | Toast | | |
| 13b.4 | With a TypeSafe key saved, enter `https://jev-proxy.invalid/v1/systemone`, leave the key blank, press Save Jev key. | Toast "Jev key cleared." The key is gone because the address changed. | Toast | | |
| 13b.5 | Type a TypeSafe key with the endpoint from 13b.4 and press Test Jev. | Error toast "Could not reach your TypeSafe endpoint https://jev-proxy.invalid/v1/systemone…". DevTools Network shows the request went to that address, not api.typesafe.ai. | Toast, Network | | |
| 13b.6 | Optional, only if you run a CORS proxy that forwards to `https://api.typesafe.ai/v1/systemone`: enter its address and a TypeSafe key, press Test Jev, then generate a monster. | Green toast "Jev is working: TypeSafe AI answered in N.N s." Generator Jev row reads "on (TypeSafe AI key)" and Equipment/Loot steps end with "Jev, N.N s". | Toast, Generator | | |
| 13b.7 | Narrow the window to about 360 px with TypeSafe AI chosen. | Endpoint field, hint and warning wrap cleanly; no horizontal scroll. | Provider Setup | | |

## 13c. AI key never sent over plain http to the internet

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 13c.1 | In AI Provider Setup, set the API Base URL to `http://api.example.com/v1`, type any key and press Save & test. | Warning toast: "This AI address uses plain http, so the API key would travel unencrypted and will not be sent…". DevTools Network shows no request carrying an Authorization header. | Provider Setup, Network | | |
| 13c.2 | Open the Generator, Item Forge and Shop with that connection still active. | Each shows the same plain-http warning, has no Authorize button, and refuses to generate. | Generator, Item Forge, Shop | | |
| 13c.3 | Switch back to an https provider (or Ollama on `http://localhost:11434/v1`) and generate a monster. | Works as before. A keyed gateway on a home-network address such as `http://192.168.1.20:4000/v1` also still works. | Generator | | |
| 13c.4 | Reskin a creature and have the AI write a blurb containing "&" (for example "Salt & rust"). Open the created copy. | The sheet's blurb shows "&", not "&amp;". | NPC sheet | | |

## 13d. Use my party (Encounter mode)

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 13d.1 | Make a Party actor with three level-4 characters and one level-6 character. Open the Generator in Encounters. | Beside Party level: "Use my party" and "<party name>: 4 characters, level 5". | Generator | | |
| 13d.2 | Press Use my party. | Party level becomes 5, Party size 4 (Advanced options), and a toast names the party. | Generator | | |
| 13d.3 | Remove every character from the party and reopen Encounters. | The button is disabled and the note reads "No party with characters found". | Generator | | |
| 13d.4 | Narrow the window to about 460 px. | The button and note drop under the level controls; no horizontal scroll. | Generator | | |

## 13e. Right-click Reskin and the one-step chat command

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 13e.1 | As GM, right-click an NPC in the Actors sidebar. | The menu has "Reskin with SimplySF2e". A character or loot actor does not show it. | Actors sidebar | | |
| 13e.2 | Pick it with the Generator closed, then again with it open in Monster mode and some prompt text typed. | The Generator opens (or switches) to Reskin with that NPC loaded. Switching back to Monster still shows the typed text. | Generator | | |
| 13e.3 | As a player, right-click an actor you own. | No Reskin entry. | Actors sidebar | | |
| 13e.4 | Type `/sf2e npc 3 vesk dock foreman` in chat. | The Generator opens in NPC mode at level 3 with that prompt and starts a preview at once. Nothing is created until you press Create. | Chat, Generator | | |
| 13e.5 | Type `/sf2e npc 3` (no prompt). | The form is filled in; nothing runs. | Generator | | |
| 13e.6 | As a player, type `/sf2e npc 3 test`. | "GM only" warning; nothing runs and no AI request is sent. | Chat, Network | | |

## 13f. Tidy folders and player handouts

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 13f.1 | Create a monster, an NPC, a character, a reskin and a shop. | Actors sidebar: SimplySF2e > Creatures (monster, reskin), NPCs, Characters, Shops, each in its folder. | Actors sidebar | | |
| 13f.2 | Rename the SimplySF2e folder, then create another monster. | It lands in the renamed folder; no second SimplySF2e folder appears. | Actors sidebar | | |
| 13f.3 | Create an encounter. | Its folder sits inside SimplySF2e. | Actors sidebar | | |
| 13f.4 | Create an NPC (NPC mode). | A toast says a player handout was added. Journal > SimplySF2e has an entry with the portrait, blurb and read-aloud text, and no tactics or stats. A monster made in Monster mode gets no handout. | Journal | | |
| 13f.5 | Open the handout and use Show Players. | Players see the page; it was hidden from them before. | Journal, player client | | |

## 13g. Remember Generator settings

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 13g.1 | In the Generator choose Encounters, level 7, Rare, Party size 5, Severe; type a prompt. Reload the page and reopen. | Mode, level, rarity, party size and threat come back; the prompt box is empty. | Generator | | |
| 13g.2 | Log in as the same GM in another browser. | That browser keeps its own settings (per browser, not per world). | Generator | | |

## 13h. Treasure hoard

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 13h.1 | As GM, look at the Actors sidebar header, then type `/sf2e treasure`. | A **Treasure** button sits next to the Shop button; both it and the chat command open the SimplySF2e Treasure window. Players see no Treasure button. | Actors sidebar, chat | | |
| 13h.2 | With a Party actor that has characters, press **Use my party**. | Party level and Party size fill from the party and a notice names it; with no party the button is disabled and the note says none was found. | Treasure window | | |
| 13h.3 | Party level 4, One encounter, Common, theme "Abandoned corporate lab on an ice moon". Generate hoard, then Generate another hoard, then switch to Whole level and Generate. | One encounter shows Budget 680 credits and Whole level 8,500; items are level 4 or lower and common, one of each, and item prices plus the Credits row add up to the budget. Party size changes only the "each" line, not the budget. Generate another hoard gives a different hoard. | Preview | | |
| 13h.4 | Remove one item row with ×. | The row goes and its price is added to the Credits row. | Preview | | |
| 13h.5 | Press Create hoard. | A loot actor opens in Loot mode in SimplySF2e > Treasure, holding the remaining items (each linked to its compendium entry, quantity 1) and a Credstick worth the Credits row. The description shows the theme prose. | Loot sheet, Actors sidebar | | |
| 13h.6 | Party level 20, Whole level, Common. Remove every item row with ×, then press Create hoard. | The loot actor holds exactly one Credstick whose price reads as a plain number of credits, 4,900,000, and the sheet's wealth total shows the same number. | Loot sheet | | |

## 13i. What's new

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 13i.1 | On a fresh browser profile (no saved SimplySF2e client settings), log in as the GM. | The What's new window does not open (the Welcome window covers new installs). | Login | | |
| 13i.2 | Install an update that adds a release note, then log in as the GM. | What's new opens once, titled "What's new in SimplySF2e" with the module version, and lists only the new notes plus a "Something broke?" block. | Login | | |
| 13i.3 | Press **Got it**, then reload. | The window closes and does not open again. | What's new | | |
| 13i.4 | After a new update, press **Don't show for updates**, then reload after another update. | It never opens by itself again; `/sf2e whatsnew`, the settings **What's New** button and `game.modules.get("simplysf2e").api.openWhatsNew()` still open it with the newest notes. | What's new, chat, settings | | |
| 13i.5 | Log in as a player after an update. | No What's new window and no error in the console. | Player client | | |
| 13i.6 | On a world where the GM already used SimplySF2e before this update (AI connection working), update and log in as the GM. | What's new opens once and lists all four notes from this update. | Login | | |

## 13j. Re-level in Reskin mode

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 13j.1 | In Reskin mode drop a level 3 bestiary NPC. | **New level** shows 3 and no table. | Generator | | |
| 13j.2 | Press + until it shows 7. | A table lists AC, Max HP, Perception, saves, each strike and its damage, and Spell DC for casters, with the scale and the level 3 and level 7 values. | Generator | | |
| 13j.3 | Write a theme and press **Preview first**, then **Create reskinned copy**. | The preview header says Creature 7 and the note says the copy moved to level 7. The new actor's sheet shows level 7 and the numbers from the table; the original is unchanged. | Generator, new actor sheet | | |
| 13j.4 | On the new sheet, roll a strike and open a spell. | The attack bonus and damage match the table; spells keep their original ranks. | New actor sheet | | |
| 13j.5 | Set the level back to the original and create a copy. | The copy keeps every number of the original (plain Reskin). | Generator | | |

## 13k. Faster encounters

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 13k.1 | Generate a Severe encounter for a party of 5 with **Preview first** and watch the progress list. | Creatures finish in a few overlapping waves instead of one after another; the run takes noticeably less time than before. | Generator | | |
| 13k.2 | Press Cancel while creatures are building. | Every creature stops; no preview and no actors. | Generator | | |
| 13k.3 | Create the encounter. | Every member is created in the encounter folder, each with its own stats and gear. | Actors sidebar | | |


## 13l. Creature art and token name

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 13l.1 | With an art module that maps sf2e creature packs (separate portrait and token art), generate and create a creature. | The portrait is the borrowed creature's portrait; the token uses its token art and scale, not the portrait. | Actor sheet, token | | |
| 13l.2 | Open the new actor's Prototype Token. | The token name is the new creature's name, not the bestiary creature it borrowed from. | Prototype Token | | |
| 13l.3 | Repeat 13l.1 with no art module. | Portrait and token keep the default sf2e NPC icon; nothing errors. | Actors sidebar | | |
| 13l.4 | Create an encounter with a member count of 3. | Each copy has the same correct art; actor and Prototype Token names are both numbered ("Name 1", "Name 2", "Name 3"). | Encounter folder, Prototype Token | | |

## 13m. Run cost

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 13m.1 | Connect OpenRouter with no manual prices and generate a creature preview. | The token report ends with "Cost: $0.00xx" (4 decimals under $0.01) and the header shows "last: N tokens · $0.00xx". No "≈". | Generator token report, header | | |
| 13m.2 | Connect DeepSeek (or any provider that reports no cost) with both price fields empty and generate. | No cost line in the token report and none in the header; no "$0.00". | Generator | | |
| 13m.3 | In AI Provider Setup enter Input 0.27 and Output 1.10 on that DeepSeek connection, **Save without testing**, generate. | Token report shows "Cost: ≈ $… (from your per-connection prices)"; the number is prompt tokens x 0.27 / 1M plus completion tokens x 1.10 / 1M. | Generator, Provider Setup | | |
| 13m.4 | Type -1 or text in a price field and save. | The save is refused with a field error naming the price; nothing is stored. Empty fields clear the prices. | Provider Setup | | |
| 13m.5 | Switch to the OpenRouter connection and back. | Each connection keeps its own prices. | Provider Setup | | |
| 13m.6 | Use OpenRouter with a run that includes a request the provider gave no cost for (for example Jev on another route), no prices set. | Cost shows "at least" wording; with prices set on the chat connection the unpriced chat requests are priced and shown as mixed. Jev tokens are never priced with chat prices. | Generator | | |
| 13m.7 | Open the bug report after a failure. | Settings list "Manual prices set: yes/no" and no price values. | Bug report | | |

## Failure log

One row per failure, so each cluster can become one fix PR.

| Step | Observed | Expected | Console / screenshot |
|------|----------|----------|----------------------|
| | | | |

## 12ab. Re-level: module-built abilities (T-RELEVEL)

Generate a level 7 NPC with a limited cone breath (name "Frost Breath", cold), a sickening aura (Foul Air, sickened) and a glossary Constrict. Create actor. Then Reskin the actor and re-level the copy to 12 (level field), and to 2.

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 12ab.1 | Re-level the copy to 12. Read the Frost Breath item. | `@Damage[13d6[cold]|options:area-damage]`, `@Check[reflex|dc:32|basic|options:area-effect]`; the recharge sentence says Frost Breath (the name is kept). Cone stays 30 ft. | Actor sheet, Actions tab | | |
| 12ab.2 | Read the Foul Air aura at 12. | 30 feet; `@Check[fortitude|dc:29]`; "On a failure, it becomes sickened 2"; the Aura radius is 30. | Actor sheet, Actions tab | | |
| 12ab.3 | Reskin a generated level 7 creature that has a filled Constrict. Re-level the copy to 12. Read Constrict. | Rebuilt: `@Damage[(5d8)[bludgeoning]]`, `dc:32` (high). The re-level preview lists "Constrict rebuilt for level 12". | Actor sheet, Actions tab | | |
| 12ab.4 | Re-level the same copy to 2. | Frost Breath `3d6`, `dc:18`; Foul Air sickened 1, `dc:15`; Constrict `(2d6)`, `dc:18`. | Actor sheet | | |
| 12ab.5 | Re-level to 12 and read a published ability (no provenance flag). | Its text is unchanged. | Actor sheet | | |
| 12ab.6 | Re-level a copy whose Swallow Whole has become tiny (set size tiny first). | The Swallow Whole text is unchanged, and the re-level preview lists "Swallow Whole kept at the old level: …" with the reason. | Actor sheet | | |
| 12ab.7 | Reskin a generated level 7 creature with a filled Constrict; then **Create** the copy at 12 and open the created actor's Constrict item (Item sheet, flags). | Constrict keeps its source: `flags.simplysf2e.built.source` and `_stats.compendiumSource` both name the sf2e glossary Constrict uuid. The created text is `@Damage[(5d8)[bludgeoning]]`, `dc:32`. | Actor sheet, Item sheet | | |

## 12ac. UI polish (docs/ui-plan.md)

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 12ac.1 | Open Generator encounter preview; expand member card. | Stats shown as grid (AC, HP, Perception, saves, strike, spell DC). | Generator window | | |
| 12ac.2 | Create a character with unresolved choices; review card appears. | "To review" list with short action titles and details. | Generator window | | |
| 12ac.3 | Reskin preview grouped by strike. | Strikes grouped with attack/damage scales. | Generator window | | |
| 12ac.4 | Generator status bar readiness row collapsed/expanded. | Jev off not a warning; toggle persists. | Generator window | | |
| 12ac.5 | Token report block collapsed on render. | <details> collapsed. | Generator/Shop/Treasure | | |
| 12ac.6 | AI Provider Setup cost estimate fold. | Opens on price error; Fast picks opens for typesafe. | Provider Setup | | |
| 12ac.7 | Item Forge kind picker compact. | Short labels on buttons. | Item Forge | | |
| 12ac.8 | Compendium Sources filter and Selected only. | Filter hides rows; no re-render. | Sources | | |
| 12ac.9 | What's new manual view. | Newest release day open, earlier collapsed. | What's new | | |
| 12ac.10 | Shop/Treasure narrow windows. | Tables readable. | Shop/Treasure | | |
| 12ac.11 | Polish nits. | API-key warning order, Welcome note, divider. | Various | | |
| 12ac.12 | Unsaved edits guard. Edit the endpoint of a saved connection, then pick another connection in Saved connections. | Dialog "Unsaved changes" names the endpoint field and the connection. Stay keeps the edit and puts the select back on the current connection. Switch loads the other connection. | Provider Setup | | |
| 12ad.1 | Hard to force on a live world: a shop or hoard create where the actor is written, verification fails, and the rollback delete is refused (for example, the actor is locked by another user's permission change mid-create). | The error names the surviving actor (for example "Merchant \"X\" still exists ... remove it manually") and the preview is cleared; Create again does not make a second actor. | Shop, Treasure | | |

## 12ae. Provider Setup: edits and busy switch (T-BUG-PROV)

| # | Step | Expected | Where to look | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 12ae.1 | Provider Setup: change the Jev source or type a Jev endpoint, then press Load models. | The Jev field keeps the value you set; the model list fills in; nothing was reset. | Provider Setup | | |
| 12ae.2 | Start a Generator run, then in Provider Setup pick another Saved connection. | The switch is refused with "A run is in progress. Wait for it to finish before switching connections."; the select shows the connection still in use. | Provider Setup, Generator | | |
| 12ae.3 | Provider Setup with two saved connections: change the Model field without saving, then press Delete connection. | One dialog: it names the connection and, in a second sentence, the changed field. Delete removes the connection with no second question; Cancel keeps the connection and the unsaved edit. With no unsaved edits the dialog shows only the delete question. | Provider Setup | | |
| 12ae.4 | Provider Setup open on connection A. In the Generator header pick connection B. | Back in Provider Setup the form shows B (or, if you had typed in it, pressing Save shows "The active connection changed in another window..." and B keeps its endpoint, model and key). | Provider Setup | | |
| 12ae.5 | Start a Generator run, then change the connection from the Shop window's header. | The change is refused with "A run is in progress..." and the select returns to the connection in use. | Shop, Generator | | |
| 12ae.6 | A connection with manual prices: press another provider tile so the endpoint changes, then press Save without touching the prices, and reopen Provider Setup (Save closes the window). | The prices are cleared (boxes and summary show none) and cost lines stop using the old rates. | Provider Setup | | |

## 14a. Shell consistency, Generator (U2-GEN)

| # | Step | Expected | Where to look | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 14a.1 | Generator: a monster preview, then look at the footer. | Discard is red and sits at the far end of the row, apart from the primary action. | Generator | | |
| 14a.2 | Generator: Encounter mode, preview an encounter. | Members are plain rows with a rule between them, not boxes inside the preview card. | Generator | | |
| 14a.3 | Generator: Encounter mode at a wide window (720 px), Party level 5, with a party. | The party note sits beside the level stepper, in a wider column, not three narrow lines. | Generator | | |
| 14a.4 | Generator: preview a monster with Module-built, Narrative-only and custom abilities. | The three tags share a neutral outline; each tag sits before the reroll button, as spell and feat rows do. | Generator | | |
| 14a.5 | Generator: preview a monster with immunities, resistances and weaknesses. | Immunities, resistances and weaknesses each take the full width of the stat grid. | Generator | | |
| 14a.6 | Generator: Reskin mode with a source creature; preview the reskin. | The source name reads "Based on <name>"; a read-aloud text is set off with a left rule. | Generator | | |
| 14a.7 | Generator: Reskin mode with a dropped source; check the generate row and the re-level control. | The generate row sits clear of the text area; the re-level label sits inline with its stepper, as Level does in other modes. | Generator | | |
| 14a.8 | Generator with no API key for a remote provider; then with a stored key that is not authorized for the current endpoint. | Both messages name AI Provider Setup and say "endpoint". | Generator | | |
| 14a.9 | Welcome: press Connect with an empty key for a remote provider. | The same no-key message as the Generator, naming AI Provider Setup and no gear. | Welcome | | |
| 14a.10 | Provider Setup: press Save with a stored key that is not authorized for the endpoint. | The same not-authorized message as the Generator, naming AI Provider Setup and no gear. | Provider Setup | | |

## 14b. U2 Forge, Shop and Treasure polish (docs/ui-audit-2026-11-08.md)

| # | Step | Expected | Where to look | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 14b.1 | Open Item Forge, Shop or Treasure with a preview. | Discard is red, at the far end of the footer, apart from Create. | Preview footer | | |
| 14b.2 | Open Shop with Compendium Sources configured. | Compendium and Jev show on one line; expanding it shows the Compendium row with its gear, which opens Compendium Sources. It stays open after a re-render. | Shop, Treasure, Item Forge | | |
| 14b.3 | Turn off every equipment pack in Compendium Sources, then open Treasure. | Compendium shows as a warning, expanded, naming Equipment; its gear opens Compendium Sources. | Treasure | | fixture shop/treasure/itemforge-sources-missing viewed by eye; harness has no string assert |
| 14b.4 | Open Shop at normal width with a stock preview. | The column reads Quantity; at narrow width it reads Qty. | Shop | | |
| 14b.5 | Create a shop with ten or more stock rows. | Rows are compact; the remove buttons are small. Needs the U2-SHELL tokens. | Shop, Treasure | | |
| 14b.6 | Create a hoard. | The budget line is in the body font. The per-character line reads about N credits per character (count). | Treasure | | |
| 14b.7 | Open Item Forge at narrow width. | The five kinds fill two rows: three on top, two below, both spanning the width, with no empty cell. | Item Forge | | |

## 14c. U2 setup windows (audit setup-windows #8, #18, #20, #21, #23)

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 14c.1 | Open AI Provider Setup. Read the connection block at the top. | "Saved connections" is a framed group with a legend. Its select is labelled "Active connection". The privacy line under the API key is a hint line with a shield icon, not a boxed notice. | Provider Setup | | |
| 14c.2 | Open AI Provider Setup with two or more saved connections. Look at the trash (Delete connection) button. | The trash button is red (the shared destructive style) and sits after the + button. With one connection it is disabled. | Provider Setup | | |
| 14c.3 | Open Compendium Sources. Look at the button row under the list. | "Reset to defaults" is red and sits at the far right of the row, after Save. | Compendium Sources | | |
| 14c.4 | Open Compendium Sources in a window narrower than 520 px. Read a pack row. | The package id (monospace) sits on its own line under the pack title, left-aligned. | Compendium Sources | | |
| 14c.5 | Open Compendium Sources and What's new. Read the intro sentence under the title. | The sentence is body colour. Only its icon is cyan. | Compendium Sources, What's new | | |
| 14c.6 | Open Welcome. Look at the "Advanced" row. | It shows a chevron, opens and closes on click, and its right-hand summary stays on the same line. | Welcome | | |

## 14d. U3 copy sweep (docs/archive/ui-audit-2026-11-08/u3-copy-worksheet.md)

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 14d.1 | Open Generator. Read the mode tiles and hover each one. | Tile names read Monster, NPC, Encounter, Character, Reskin. Each tooltip says what that mode builds: one creature, one NPC, a group sized to the party, one playable character, or a copy with new fiction. Random button reads "Random creature: ignores the description and invents one at this level." | Generator | | |
| 14d.2 | Generator, mode Monster, a preview on screen. Press **Create actor**. Read the busy card while the actor is written. | The no-progress fallback line reads "Creating…" (no AI request runs in a Create step). | Generator |  | |
| 14d.3 | Open Item Forge with no preview. Read the empty hint. Generate an item with no usable passive effects. | Empty hint: "Describe an item and press Generate…". The warning says "Press Generate another version for a mechanical one." The window title reads "SimplySF2e Item Forge". The button reads "Create item". | Item Forge | | |
| 14d.4 | Open Shop with no preview. Read the empty hint. Remove every stock row, then read the warning. | Empty hint names Generate shop. The warning reads "Press Generate another shop to restock." Title reads "SimplySF2e Shop". | Shop | | |
| 14d.5 | Open Treasure with no preview. Read the empty hint and the title. The no-candidates error needs a level and rarity with no matching compendium item, which a GM cannot set reliably, so check its wording on the harness fixture `treasure-error` (`tools/ui-preview`). | Empty hint names **Generate hoard**. Title reads "SimplySF2e Treasure". Fixture error reads "No equipment at this party level and rarity was found in your compendiums. Raise Rarest item, or enable more packs in Compendium Sources." | Treasure |  | |
| 14d.6 | Open Manage presets with no custom presets. Read the empty state and the footer. | Empty state: "Press New preset to create one, or Import to paste exported preset JSON." Buttons read "New preset" and "Export all". Title reads "Manage custom presets". | Manage presets | | |
| 14d.7 | Open Welcome. Read the Google note, the Advanced block, then press Connect with a key that is not authorized. | The Google note reads "Not yet tested". The Advanced block has a "Fast picks" heading and the labels "LM Studio" and "Jev · TypeSafe". A failed connect shows the title "Connection failed". | Welcome | | |

## 14e. Theme as a system (U4A, docs/ui-overhaul-plan.md §1)

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 14e.1 | Open the Generator and leave it idle for a few seconds. | Nothing moves. The window frame has no outer glow. The main action (magenta) and the active mode tile glow; with a result on screen its name and its stat readouts carry a soft glow too. | Generator | | |
| 14e.2 | Switch through all five modes. | Only the active mode tile and the line under a preview's name take the mode colour. The status bar, the level and budget chips, the recent preview rows and the Reskin drop zone stay cyan. | Generator | | |
| 14e.3 | Start a Generate run and watch the progress card. | The card has a steady cyan inner glow and does not pulse. The fill has a moving sheen. Only the current step's dot blinks. The window header edge is solid magenta with no glow. | Generator, Item Forge, Shop, Treasure | | |
| 14e.4 | Press Cancel during a run. | While it cancels, the sheen stops and the card loses its glow. | Generator | | |
| 14e.5 | Create a character that ends with a "To review" list. | The amber rail of the "To review" panel pulses slowly. Nothing else on the card moves. | Generator (character review) | | |
| 14e.6 | Create a creature whose stat check reports rows to look at. | The stat check's left rail pulses. A clean stat check does not. | Generator (after Create) | | |
| 14e.7 | Turn on the OS "reduce motion" setting and repeat 14e.3 and 14e.5. | No sheen, no blink, no pulse; the spinner stands still. The progress card keeps its static glow. | Generator | | |
| 14e.8 | Press Tab through a window. | Every control shows a cyan outline with no glow around it, including the mode tiles. | Any module window | | |
| 14e.9 | Read the labels in the Generator, Shop and Provider Setup. | Uppercase: section legends, chips (level, traits, Custom, member roles), table column heads, progress steps, "Token usage", Provider Setup fold titles. Not uppercase: the window title, every button (Generate, Create actor, Preview plan), mode tiles, the preview name, headings such as Abilities or Recent previews, "Advanced options", "Earlier changes". | Generator, Shop, Provider Setup, What's new | | |
| 14e.10 | Open a monster preview and a shop preview. | Trait and category tags are square, navy with a cyan edge and light text; no rounded magenta pills. | Generator, Shop, Item Forge | | |
| 14e.11 | Open Compendium Sources. | Category frames have no glow; their legends are cyan chips with a magenta edge. | Compendium Sources | | |
| 14e.12 | Pick a provider in AI Provider Setup and in Welcome. | The selected tile has a cyan ring and bold label, with no glow. | Provider Setup, Welcome | | |
| 14e.13 | Look at each empty state: Generator and Item Forge before a run, Shop and Treasure before a run, Manage presets with none saved, Sources with no packs, no filter match, or an empty category. | Each is a left-aligned panel with the faint scan-line texture and one short line of text. | Generator, Item Forge, Shop, Treasure, Manage presets, Compendium Sources | | |
| 14e.14 | Open a Shop stock table and a Treasure hoard at normal and narrow width. | Both tables look as before this change: same row height, aligned numbers, remove buttons in one column, Lvl/Qty at narrow width. | Shop, Treasure | | |

## 14g. U5 Item Forge per-kind placeholder

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 14g.1 | Open Item Forge with an empty prompt. Select the Weapon tile, read the prompt placeholder, then select the Crystal tile and read it again. | The placeholder names what to describe for the selected kind (weapon: form, wear, feature; crystal: colour, behaviour, what it powers). It changes with the tile, and the prompt text, level and rarity are kept. | Item Forge | | |

## 14f. U5 setup wiring (docs/ui-overhaul-plan.md U5)

| # | Step | Expected | Where to look | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 14f.1 | Welcome with the Compendium Sources warning (remove an equipment pack, then open Welcome). | The warning names the missing category in a sentence and shows a "Configure compendium sources" button; the button opens Compendium Sources. | Welcome | | |
| 14f.2 | Welcome, with the provider cards in view. | The group is labelled "Choose a provider" (its visible legend); a screen reader announces that name for the group. | Welcome | | |
| 14f.3 | Provider Setup, look under the footer buttons (superseded by 15.16). | No hint line under the footer; the two save buttons are named for what they do. | Provider Setup | | |
| 14f.4 | Provider Setup with a saved API key, and with a saved Jev key. | A visible hint under each field says a key is saved, in addition to the placeholder. | Provider Setup | | |
| 14f.5 | Provider Setup: enter a negative input price and press Save & test. | The input price has a red border and its error message is linked to it; output price unaffected. | Provider Setup | | |

## 14h. U4B progress telemetry and Welcome boot sequence

| # | Step | Expected | Where to look | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 14h.1 | Generator, Monster: generate a level 4 creature and watch the step list until the bar finishes. | Each finished step shows how long it took after its name ("0.8s", "12s", "1m 05s"), small, muted and not in capitals. The current step says "running" and blinks; the steps still to come are dots. The percent and the token line are unchanged. | Generator progress card | | |
| 14h.2 | Same run: watch the time on a step that has just finished. | The time appears the moment the next step starts, without the card flickering or the bar jumping back. A step the run skipped shows no time. | Generator progress card | | |
| 14h.3 | Run Item Forge, Shop and Treasure once each. | The same per-step times and "running" value appear on their progress cards. | Item Forge, Shop, Treasure | | |
| 14h.4 | Open Welcome fresh (Help > Welcome, or a world with no provider). | The legends read "Choose a provider" and "Connect", without numbers. OpenRouter is pressed; Connect is enabled once a key is entered; nothing is dimmed. | Welcome | | |
| 14h.5 | Welcome: pick OpenRouter, then Ollama. | Picking a tile presses it and focuses the key field (OpenRouter) or the address field (Ollama). Connect is the only magenta button. | Welcome | | |
| 14h.6 | Welcome: enter a key and press Connect. | "Checking your connection" lists the three checks one per line; the first says "running" at the end of its line, the other two are dots. No new animation besides the existing spinners. | Welcome | | |
| 14h.7 | Screen reader on the Welcome provider group (supersedes 14f.2). | The group is announced as "Choose a provider". | Welcome | | |

## 15. Review batch R3 (2026-11-10 code and UI review)

| # | Step | Expected | Where to look | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 15.1 | Generator, Character: generate a Ysoki and a G'folian at level 5. | Every ancestry feat on the sheet carries the ratfolk (Ysoki) or gfolian (G'folian) trait. A slot with no legal feat is empty and named in the review panel; no other ancestry's feat appears. | Character sheet feats tab, review panel | | |
| 15.2 | Character: force a heritage miss (prompt names a heritage of another ancestry). | The fallback heritage belongs to the character's own ancestry, not a versatile heritage such as Borai. | Character sheet | | |
| 15.3 | Character: generate a Mystic with each of two different connections, and a Witchwarper, with a prompt that names another tradition ("an occult healer" with a primal connection). | The class spellcasting entry and its spells use the connection's or paradox's tradition (Akashic occult; Elemental, Rhythm primal; Healing, Shadow divine; Analyst, Anomaly arcane; Gap Influenced, Precog occult), not the prompt's. | Spellcasting tab | | |
| 15.4 | Monster: generate a caster with cantrips; reroll a cantrip. | Cantrips sit in the cantrip row, not rank 1. A cantrip-only caster shows no rank-1 slot row. The reroll offers cantrips. | Preview, then the sheet's spell tab | | |
| 15.5 | Monster: a world whose Equipment sources lack the spell gem templates; ask for a spell gem as loot. | The gem is listed as skipped in the preview. Create succeeds. | Preview loot, console | | |
| 15.6 | Reskin a weak high-level NPC (AC far below its level) and re-level it to -1, 0 and 1. | No AC, save, Perception, attack or DC below the lowest GM Core row for the new level; no negative or zero-average damage. | Re-level table, created sheet | | |
| 15.7 | Reskin an Elite source and re-level it. | The copy starts at full health including the Elite hit points. | Created sheet HP | | |
| 15.8 | Reskin a world NPC that is damaged, has a condition and is owned by a player, at the same level. | The copy has full health, no conditions or effects, and only the GM owns it. | Created sheet, ownership dialog | | |
| 15.9 | Encounter: a boss with loot and two minion groups without loot. | The Credits chip target equals the whole encounter budget and the boss carries it. With every group carrying loot the split is even, as before. | Encounter preview header | | |
| 15.10 | Level 23 or 24 creature with a High attack scale. | Strike bonus is +42 (level 23) or +44 (level 24). | Created sheet strikes | | |
| 15.11 | During a Monster run, send `/sf2e npc 5 a bartender`. | A warning says the command was ignored. The finished preview is still a Monster with the original level, and Create files it under Creatures. | Chat, Generator | | |
| 15.12 | Hover a Recent row whose creature name contains `<b>` or `&`. | The tooltip shows the name as plain text. | Generator Recent list | | |
| 15.13 | Compendium Sources: untick a pack, type in the filter, press Enter. | Nothing is saved and the window stays open. Save still saves and closes. | Compendium Sources | | |
| 15.14 | Compendium Sources: look at the window at default size. | One flat list: a heading and "n of m selected" per category, no boxes, no magenta. The count updates when a box is ticked; filter and Selected only work; the footer stays pinned. | Compendium Sources | | |
| 15.15 | Compendium Sources: change Equipment sources, save, then open Item Forge without reloading. | Base items, upgrade candidates and benchmark prices come from the new packs. Editing an item inside a selected world compendium also shows up without a reload. | Item Forge | | |
| 15.16 | AI Provider Setup: look at the footer; press Enter in a field; press each button. | One magenta button, "Save & test", plus "Save without testing" and Close; no sentence under the footer. Enter runs Save & test. Save without testing saves and authorizes the key for the shown endpoint. | AI Provider Setup | | |
| 15.17 | Provider Setup with a saved key: change the API Base URL. | A hint under the URL field says the saved key will be cleared unless a new one is entered; it disappears when the URL is restored. | AI Provider Setup | | |
| 15.18 | Provider Setup: enter price -1, Save & test, correct it to 0.5, press Save without testing. | The first save is refused with the error by the field; the corrected value saves. | Cost estimate fold | | |
| 15.19 | Provider Setup and Welcome: save `https://user:pass@host/v1` and `https://host/v1?api-key=abc`; then `https://host/v1?api-version=1`. | The first two are refused with a message naming the cause (and the parameter name, never the value); nothing is saved. The third saves. | AI Provider Setup, Welcome | | |
| 15.20 | Header connection switch: with three connections, switch twice as fast as possible; then open Provider Setup on each. | Each connection still has its own endpoint, model and key. | Header strip, AI Provider Setup | | |
| 15.21 | Two GM browsers: switch connection in browser A; in browser B switch to another connection and back. | Browser B's connections keep their own endpoints and models (console may warn once that live settings no longer matched). No key is sent to another endpoint. | Both browsers' Provider Setup | | |
| 15.22 | Force an error and press Copy bug report. | The stack lines show `modules/simplysf2e/...` paths with no server address. | Copied report | | |
| 15.23 | Encounter preview: step a member to 0 and back. | The skipped row is muted with a thin dashed rule and the SKIPPED tag; nothing shifts. | Encounter preview | | |
| 15.24 | Monster preview with abilities that have descriptions; Encounter with no party; Reskin re-level at a narrow width. | The reroll die sits on the ability's name line. The no-party note and the re-level hint each take their own line under the control. | Generator | | |
| 15.25 | Any run: watch the progress card. Welcome with no model chosen. | Steps are left-aligned. The disabled Connect button has an intact edge. | Progress card, Welcome | | |
| 15.26 | Shop, Treasure, Item Forge with a preview on screen. | The token count shows once (in the Token usage fold), not also in the header strip. | Tool windows | | |
| 15.27 | Read every button in every window. | Sentence case throughout ("Create monster", "Create all actors", "Load models"). | All windows | | |
| 15.28 | Open What's new (`/sf2e whatsnew`). | Each note is a title with 2 to 5 bullets; "Fixes and a tidier setup" and "Tidier windows" are at the top; older notes sit under Earlier changes. | What's new | | |
| 15.29 | Use a provider or model that rejects `stream_options` or `reasoning_effort` (an older OpenAI-compatible server); generate twice with the network tab open. | The first request negotiates (up to three POSTs); every later request to the same endpoint and model is one POST. A different model starts fresh. | Browser network tab | | |
| 15.30 | Start a Monster run and cancel while text is streaming; then let a run hit the idle timeout (stop the local server mid-stream). | The token line counts the tokens that streamed before the stop (marked as an estimate). A dropped connection shows the network error message, not a raw browser error. | Token usage fold, error box | | |
| 15.31 | Provider answering 429 with `Retry-After: 120`. | The run fails at once with the rate-limit message; no 30-second silent wait. A short Retry-After still retries once. | Error box | | |

## 16. Review batch R4 (2026-11-10 follow-ups)

| # | Step | Expected | Where to look | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 16.1 | Generator with an encounter preview on screen: type a new theme and change Level, then press a member +, a reroll die, Dismiss, Forget recent, and save in Provider Setup opened from the header. | The typed theme and Level stay after each. A mode switch, a preset change, Open recent, Use my party and a chat command still show their own values. | Generator form | | |
| 16.2 | Item Forge, Shop, Treasure: type a new description with a preview on screen, then remove a stock row or press Create and cancel. | The typed text stays. | Tool windows | | |
| 16.3 | Welcome: run the sample monster with remembered Generator settings (a preset, level 7). Close and reopen the Generator. | The preset and level are the GM's own, not the sample's. The sample preview was shown. | Generator form after the sample | | |
| 16.4 | Shop, Treasure, Item Forge (plain and graded weapon): with a preview on screen press Generate another, then Cancel; repeat with the provider unreachable. | The previous preview and its token line are back, with the error above it. Create makes the previous preview. With no previous preview the empty state and the error show. | Tool windows | | |
| 16.5 | Open AI Provider Setup from the Generator, type a key, then open it again from Shop and from the module settings menu. | One window; the typed key is still there; it comes to the front. After Save, the header strip refreshes in both the Generator and Shop. Same for Compendium Sources and for a minimized window. | Provider Setup, header strips | | |
| 16.6 | Character: generate an Operative; note the specialization's own choice; press Create with the provider switched off. | The preview already holds the choice and Create succeeds with no AI call. The sheet shows that choice. | Preview, network tab, sheet | | |
| 16.7 | Character: a background that grants a skill feat; generate at level 4. | That feat is on the sheet once (from the background), not again in a skill or general slot. | Feats tab | | |
| 16.8 | A world whose saved API Base URL has `?api-key=...` from before the update: open Provider Setup. | A warning under the URL field names the parameter (never the value) and says players can read it. Generation still works. Removing the parameter hides the line as you type. | AI Provider Setup | | |
| 16.9 | Provider Setup: change manual prices, press Save & test, and switch connection in another window at once. | The prices are on the connection that was saved. An invalid price saves nothing. | Cost estimate fold on both connections | | |
| 16.10 | Encounter with an uncommon or unique boss. | The Credits target equals the GM Core encounter budget for the party level and Treasure amount; rarity does not raise it. A standalone unique creature still carries more. | Encounter preview header | | |
| 16.11 | Any run. | Step times read "0.8s", "12s", "1m 05s". | Progress card | | |
| 16.12 | Change Equipment sources, save, open Item Forge (Wondrous) without reloading. | The passive-effect choices come from the new packs. | Item Forge | | |
| 16.13 | GitHub: try to push to `main` directly. | Refused: a pull request with a passing `verify` check is required. | GitHub | | |

## 17. UI revamp slice 1: shared status strip (2026-11-14)

No visual change is intended. The status strip of the Generator, Item Forge, Shop and Treasure windows is now one shared template (`templates/_statusbar.hbs`).

| ID | Step | Expected | Where | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| 17.1 | Open the Generator, Item Forge, Shop and Treasure. Press F12 and read the console. | Each window opens with its status strip (connection, model, Compendium and Jev row). No "partial could not be found" error in the console. | All four tool windows | | |
| 17.2 | With two saved connections, switch the connection in the Generator's strip. | The other three open windows show the new connection and model. Typed prompts stay. | All four tool windows | | |
| 17.3 | Press Test connection (signal icon), then the gear. | The test reports the provider, model and tokens. The gear opens Provider Setup. | Any tool window | | |
| 17.4 | Open the Compendium and Jev row in each window. | The Compendium line reads the window's own sentence (the Generator names the pack count). The books button opens Sources. | All four tool windows | | |
| 17.5 | Generate a shop, then look at the strip while the preview is open; do the same in the Generator. | Shop, Treasure and Forge hide "Last run" while the preview's Token usage line is on screen. The Generator keeps showing it. | Shop, Generator | | |
| 17.6 | Remove the API key (or use a world with none) and open each window. | The key warning shows under the strip in all four windows, with the Authorize button where it applied before. | All four tool windows | | |

## 18. UI revamp slice 2: window parts and run state (2026-11-14)

No visual change is intended. Generator, Item Forge, Shop and Treasure render three parts (status, brief, result) inside one body element, and a click re-renders only the part it changed.

| ID | Step | Expected | Where | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| 18.1 | Open each of the four tool windows with the console open (F12). | Each opens and looks as in v0.1.16. No console error about a template part or a root element. | All four tool windows | | |
| 18.2 | Generate an encounter preview. Type a new prompt without generating, then press + and - on a member. | Counts, XP and Credits update. The typed prompt, the cursor and the scroll position stay where they were. | Generator, Encounter | | |
| 18.3 | Open Advanced options and pick a different preset. | The preset's defaults show and Advanced options stays open. | Generator | | |
| 18.4 | With a preview on screen, open Token usage, then reroll loot or one pick. | After the reroll the Token usage fold is still open. | Generator | | |
| 18.5 | Scroll to the bottom of a long creature preview and press a reroll die. | The window does not jump back to the top during or after the reroll. | Generator | | |
| 18.6 | Generate a shop, type in the prompt box, then remove a stock row. Do the same in Treasure. | The row goes; the typed text and focus stay. | Shop, Treasure | | |
| 18.7 | With two connections saved and all four windows open, type an unsent prompt in each, then switch connection in one. | Every window's strip shows the new connection. No prompt text is lost and no form field resets. | All four tool windows | | |
| 18.8 | Switch mode with the keyboard (arrow keys on the mode tiles). | The form changes to the new mode and focus stays on the chosen tile. | Generator | | |
| 18.9 | Start a run and press Cancel; start another and close the window (answer Yes); run once with a wrong API key. | Each time the window ends unlocked: fields enabled, Generate usable, no stuck progress card. | Generator | | |
| 18.10 | One full run in each mode: Monster, NPC, Encounter (one-click Generate creates the actors), Character, Reskin with a re-level. | Each run behaves as in v0.1.16, including the progress card's step list, times and the sheen moving across the bar. | Generator | | |
| 18.11 | Generate and create one item in Item Forge, one shop and one hoard. | Each previews and creates as in v0.1.16. | Item Forge, Shop, Treasure | | |
| 18.12 | Tab through the Generator from the connection select to Create. | Focus order follows the screen: strip, form, preview, buttons. A screen reader announces each progress step once. | Generator | | |

## 19. UI revamp slice 3: console layout, honest labels, first motion (2026-11-14)

The four tool windows open at a fixed height (700 px, resizable) and scroll inside it. The action bar of the card in view stays pinned to the bottom edge. The Generator's main button is renamed to say that it creates in one step. Button names in older rows of this checklist were updated to match.

| ID | Step | Expected | Where | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| 19.1 | Open each of the four tool windows. | Each opens 720 px wide and about 700 px tall (less on a short screen, never off screen). The window can be resized taller, shorter and wider, and the body scrolls inside it. | All four tool windows | | |
| 19.2 | Generate anything, then generate again with a longer or shorter result. | The window frame does not change size or move when the result appears or changes. | All four tool windows | | |
| 19.3 | With a long preview on screen, scroll through it. | Create, Reroll loot and Discard stay pinned at the bottom edge while the card is in view. Text scrolls under the bar without showing through it. Nothing is left under the bar at the very end. | Generator, Item Forge, Shop, Treasure | | |
| 19.4 | Open Advanced options in a short window (drag it to about 400 px tall). | The run row (Create monster, Preview first, the die) stays pinned at the bottom while the form is in view. Every field can still be reached by scrolling. | Generator | | |
| 19.5 | Tab through a long preview from top to bottom. | A focused control is never hidden under the pinned bar. | Generator | | |
| 19.6 | Read the status strip at the default width, then drag the window under 600 px wide. | At 720 px the connection, model, test and setup buttons and the Compendium and Jev marks share one row (a "Last run" line may wrap under the model). Under 600 px the readiness row sits on its own line with the words Ready and On. | All four tool windows | | |
| 19.7 | Click the Compendium and Jev marks in the strip. | The readiness detail opens on its own full row with both gear buttons, and closes again. A missing source still shows as full warning rows, never folded. | All four tool windows | | |
| 19.8 | In Monster mode type a prompt and press **Create monster**. | The actor is created in one step, as "Generate monster" did before. The empty panel's text says so: Create makes the actor in one step, Preview first shows it and creates nothing until confirmed. | Generator | | |
| 19.9 | Press **Preview first** in each mode. | A preview appears and nothing is created until **Create actor**, **Create all actors** or **Create reskinned copy** is pressed. | Generator | | |
| 19.10 | Read the main button in each mode, then with a preview on screen. | Create monster, Create NPC, Create encounter, Create character, Reskin and create; with a preview: Create another version. Item Forge still reads Generate and Generate another version, because it always previews first. | Generator, Item Forge | | |
| 19.11 | Press **Preview first** in Monster mode. | When the preview arrives the form folds to one line: the level and the start of the description, then Edit. The mode tiles and the run row stay visible. | Generator | | |
| 19.12 | Press the folded line, change the prompt, press it again. | The form opens with a short fade and the handle reads Hide form. Folding it again shows the new prompt text on the line. No field loses its value. | Generator | | |
| 19.13 | With the form folded, press **Create another version**. | The run uses the values in the folded form. The form stays folded while the progress card shows. | Generator | | |
| 19.14 | Open the folded form by hand, then run again. | The form stays open during the run and folds when the new result arrives. | Generator | | |
| 19.15 | Discard the preview; switch to a mode with no result; cause an error (wrong key). | In each case the form is open again. | Generator | | |
| 19.16 | Reskin mode: drop an NPC, change its level, press **Preview first**. | The form never folds in Reskin mode: the source, the re-level table and any "kept at the old level" line stay visible above the preview. | Generator | | |
| 19.17 | Drag the Generator wider than about 900 px, with and without a preview. | The status strip spans the top, the form is on the left and the result on the right. The form is always open and the fold line is gone. Dragging it narrow again restores one column and the fold. | Generator | | |
| 19.18 | Do the same in Item Forge, Shop and Treasure. | Same two panes. The shop and hoard tables use the right pane's width. | Item Forge, Shop, Treasure | | |
| 19.19 | Watch a result appear: a preview, then the "created" card after Create. | The card rises a few pixels and fades in once, in about a fifth of a second. Pressing + or - on an encounter member, removing a shop row or rerolling one pick does not replay it. | All four tool windows | | |
| 19.20 | Close the Generator with a preview on screen and open it again. | The stored preview is shown at once, without the rise. | Generator | | |
| 19.21 | Turn on the operating system's reduced motion setting and repeat 19.12 and 19.19. | No rise, no fade, and the fold arrow does not rotate with a transition. Everything else works the same. | Generator | | |
| 19.22 | Compare Create, Discard and the run row with v0.1.16 for click speed. | No click waits for an animation. | All four tool windows | | |

## 20. UI revamp slice 4: result cards (2026-11-14)

The single creature preview leads with one strip of six numbers. Picks the compendium did not match are named on one line under their list instead of being struck through. Section headings in every preview are one size and colour. A rerolled pick flashes once.

| ID | Step | Expected | Where | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| 20.1 | Preview a monster (Preview first). | Under the traits, one row reads AC, HP, Per, Fort, Ref, Will with their values, in the same order and style as an encounter member. Hovering a short label shows its full name. | Generator | | |
| 20.2 | Narrow the window to about 460 px. | The strip folds to two rows of three (AC HP Per / Fort Ref Will). Nothing is cut off and the window does not scroll sideways. | Generator | | |
| 20.3 | Read the lines under the strip. | Senses, Languages and Skills, then Immunities, Resistances and Weaknesses where the creature has any, then Speed and the strikes. Every value shown in v0.1.16 is still there. | Generator | | |
| 20.4 | Preview a monster or character whose prompt names a spell, feat or item the packs lack. | The list shows only matched picks. Under it one line reads "Not matched, skipped" with the warning icon and names each skipped pick (spells with their rank). Nothing is struck through. | Generator | | |
| 20.5 | On that line, press the die beside an unmatched spell or feat (monster or NPC). | The pick is rerolled exactly as before. If the new pick matches, it moves up into the list. | Generator | | |
| 20.6 | Create that creature. | The completion card's counts (Skipped gear, matches) are the same as in v0.1.16 for the same picks. | Generator | | |
| 20.7 | Preview a character with an empty feat slot. | The empty slot stays in the Feats list with its info icon and text; it is not on the "Not matched" line. | Generator | | |
| 20.8 | Look at the reroll dice in a preview without touching them. | Each die is a plain muted icon with no box. Hover or Tab to one and it gets its border and background back; it is still a button and still has its tooltip. | Generator | | |
| 20.9 | Reroll one pick. | When the new pick arrives its row is lit once for under half a second and its die turns half a circle. The rest of the card does not move or replay its rise. | Generator | | |
| 20.10 | Press Reroll loot. | The Loot list is lit once when the new loot arrives. | Generator | | |
| 20.11 | Cancel a reroll, or make one fail (turn the connection off first). | Nothing flashes, then or on the next click. | Generator | | |
| 20.12 | Compare the section headings (Abilities, Spells, Feats, Equipment, Loot, Description) in Generator, Item Forge, Shop and Treasure previews. | One size and colour everywhere, each with the same space above it. | All four tool windows | | |
| 20.13 | Create a creature, and finish a character review. | The card's title has an icon (a check for created, a clipboard for review) beside the words. | Generator | | |
| 20.14 | Turn on reduced motion and repeat 20.9 and 20.10. | No flash and no turn. The reroll works the same. | Generator | | |

## 21. UI revamp slice 5: mode tiles, small windows (2026-11-14)

The Generator's five mode tiles stay on one row at every width and the selection is one marker that slides. Welcome, AI Provider Setup, Manage Presets and What's new keep their button row in view, as Sources already did. Welcome and What's new rise in once when they open.

| ID | Step | Expected | Where | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| 21.1 | Open the Generator at its default width and switch through the five modes. | The selected tile is marked by a bordered, glowing box in that mode's colour, with brighter text and a coloured icon. The other tiles are plain. | Generator | | |
| 21.2 | Switch mode with a click, then with the arrow keys. | The marker slides from the old tile to the new one in about a fifth of a second. The form below is already the new mode's form; nothing waits for the slide. Focus stays on the chosen tile. | Generator | | |
| 21.3 | Narrow the window to about 460 px, then to its minimum. | Five tiles on one row, icon above label. No label is cut off, and the marker still sits exactly on the selected tile. | Generator | | |
| 21.4 | Change anything else in the form (a preset, the level, Advanced options) and run a preview. | The marker does not move or replay its slide. | Generator | | |
| 21.5 | Drag the window wide (two panes) and switch mode. | The marker sits on the selected tile in the left pane and slides as before. | Generator | | |
| 21.6 | Open AI Provider Setup and make the window short, or use a small screen. Scroll the fields. | Save & test, Save without testing and Close stay at the bottom edge while the fields scroll under them. No text shows through the row. | AI Provider Setup | | |
| 21.7 | Do the same in Welcome, Manage Presets and What's new. | Each window's button row stays at the bottom edge. In a window tall enough to show everything, the row sits where it did before. | Welcome, Manage Presets, What's new | | |
| 21.8 | Open Sources. | Save and Reset are pinned exactly as in v0.1.16. | Sources | | |
| 21.9 | Tab through AI Provider Setup from top to bottom in a short window. | The focused field is never hidden under the pinned row. | AI Provider Setup | | |
| 21.10 | Open What's new from the module settings, and open Welcome. | The content rises a few pixels and fades in once. Choosing a provider or testing a connection in Welcome does not replay it. | Welcome, What's new | | |
| 21.11 | Turn on reduced motion and repeat 21.2 and 21.10. | No slide and no rise. Everything else works the same. | Generator, Welcome, What's new | | |

## 22. UI revamp slice 6: interface sounds (2026-11-14)

Four short synthesised cues, off by default, set per browser. They cannot be heard in the test harness, so every row here is a listening check. Nothing is sent to players.

| ID | Step | Expected | Where | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| 22.1 | After updating, use the module as before without touching the settings. | No sound at all. Module settings show **Interface sounds: Off**. | All four tool windows | | |
| 22.2 | In the module settings press **Test sounds**. | No window opens. A notice names the four cues and they play in order, well under a second each: one soft blip (run started), two rising notes (result ready), three rising notes (created), two low falling notes (error). This works while Interface sounds is Off. | Module settings | | |
| 22.3 | Judge the four cues. | Each is short and soft, none clicks or distorts, and "result ready" and "error" are easy to tell apart without looking. Note any cue to retune or drop. | Module settings | | |
| 22.4 | Set Interface sounds to **Normal**, save, and press **Preview first** in the Generator. | The blip when the run starts and the two rising notes when the preview appears. | Generator | | |
| 22.5 | Press **Create actor** on that preview. | The blip, then the three rising notes when the created card appears. | Generator | | |
| 22.6 | Use the one-click **Create monster**, and create a character (which ends on the review card). | One blip at the start and the three rising notes at the end, for both. | Generator | | |
| 22.7 | Make a run fail (turn the connection off first). | The blip, then the two low falling notes when the error box appears. | Generator | | |
| 22.8 | Start a run and press **Cancel**. | The blip at the start and nothing at the end. The next run sounds as normal. | Generator | | |
| 22.9 | Reroll one pick, and press Reroll loot. | A blip and the two rising notes each time. Say if this is too much for a small action. | Generator | | |
| 22.10 | Generate and create in Item Forge, Shop and Treasure. | Rising two notes when the draft appears; three rising notes when Create finishes and the draft clears. | Item Forge, Shop, Treasure | | |
| 22.11 | Change the form, switch mode, press + or - on an encounter member, discard a preview, close and reopen a window with a stored preview. | Silence. Only a run or a create makes a sound. | All four tool windows | | |
| 22.12 | Set Interface sounds to **Quiet** and repeat 22.4. | The same cues, clearly softer. | Generator | | |
| 22.13 | Lower Foundry's **Interface** volume slider (playlists sidebar) to half, then to zero, and repeat 22.4. | The cues get quieter with the slider and are silent at zero. If they do not follow the slider, note it. | Generator | | |
| 22.14 | With sounds on, have a player connected in another browser while you run and create. | The player hears nothing, and the player's module settings do not show Interface sounds or Test sounds. | Player client | | |
| 22.15 | Open the browser console during 22.4 to 22.10. | No errors or warnings from the module about audio. | Console | | |

## 23. UI pop round: flashier motion, stat readouts (2026-11-14)

JT asked for the UI to pop (2026-11-14). Results now arrive with more show, the six stats are readout tiles, and buttons answer the pointer. Everything is started by something happening (a result, a hover, a press), nothing moves while the window is idle, and reduced motion turns all of it off. The harness cannot show motion, so these are all live looks.

| ID | Step | Expected | Where | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| 23.1 | Open each module window. | The content rises and fades in once as the window opens. Later changes inside the window do not replay it. | Any module window | | |
| 23.2 | Press **Preview first** in Monster mode and watch the result arrive. | The card rises in; a line of light runs down it once; a bright streak runs along the rule under the name; the sections follow each other in from top to bottom. It all settles in about half a second. | Generator | | |
| 23.3 | While that plays, press **Create actor** or **Discard** straight away. | The buttons are there and work from the first moment. Nothing waits for the animation. | Generator | | |
| 23.4 | Look at the six stats once the card has settled. | Six tiles, each a small label over a large glowing number, lit along the top edge: AC, HP, Per, Fort, Ref, Will. They landed one after another with a small bounce. Every number matches the created actor's sheet. | Generator | | |
| 23.5 | Narrow the window to about 460 px. | The tiles sit 3 + 3 and no number is cut off. | Generator | | |
| 23.6 | Create an actor, and finish a character (review card). | The card is swept by a green line, its title icon pops and a ring opens out from it once. | Generator | | |
| 23.7 | Preview an encounter; generate a shop and a hoard. | Encounter members come in one after another. The first rows of the stock or hoard table fade in one after another, then the rest together. A table of 20 rows or more still settles within half a second. | Generator, Shop, Treasure | | |
| 23.8 | Reroll one pick, press + or - on an encounter member, remove a shop row. | None of the arrival show replays. Only the rerolled row flashes, as before. | Generator, Shop | | |
| 23.9 | Make a run fail. | The red error box gives one short sideways shake as it appears, and its text is readable throughout. A run you cancel does not shake. | All four tool windows | | |
| 23.10 | Move the pointer onto the main magenta button, then away and back. | A glint of light crosses the button each time the pointer arrives. A disabled main button shows none. | Any module window | | |
| 23.11 | Press and hold any button. | It gives slightly under the pointer and springs back on release. The click still registers normally. | Any module window | | |
| 23.12 | Hover an icon button (the gear, a + or -, a reroll die), and Tab to one. | The icon grows a little; a reroll die also turns a quarter. | Any module window | | |
| 23.13 | Hover the mode tiles, then switch mode. | The icon of an unselected tile lifts under the pointer. On a switch the marker slides and the chosen tile's icon pops. | Generator | | |
| 23.14 | Run a generation and watch the progress bar. | The filled part ends in a bright cap. The sheen and the step blink work as before. | All four tool windows | | |
| 23.15 | Finish a character that has choices to review, and create a creature whose stat check needs attention. | The amber (or orange) rail on the left of the panel pulses as before. The panel's text does not fade with it. | Generator | | |
| 23.16 | Leave each window idle for ten seconds, with and without a result on screen. | Nothing moves. | Any module window | | |
| 23.17 | Turn on reduced motion and repeat 23.1, 23.2, 23.6, 23.9, 23.10, 23.11 and 23.13. | No rise, sweep, streak, stagger, pop, ring, shake, glint, press or lift. Everything appears at once in its final state and works the same. | Any module window | | |
| 23.18 | Use the windows for a few minutes on your normal machine while a scene is running. | No stutter when a result arrives and no dropped frames in the scene. Say so if any effect feels slow or too much, and which. | Any module window | | |
