# SimplySF2e live QA checklist

Run this in a real Foundry v14 world (14.367 or later) with the `sf2e` system 1.5.x and the module enabled. Nothing here is self-checkable by node tests. Labels are the UI text from `lang/en.json`.

How to use: work the sections in order (Section 0 first). For every step fill **Result** with `PASS`, `FAIL` or `N/A`, and **Evidence** with a screenshot filename, a copied value, or a console line. Keep the browser console (F12) open throughout and paste any `simplysf2e |` warning or error into Evidence. Use a scratch world: the checks create actors, items, folders and macros. When something fails, note it in the Failure log at the end and continue.

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
| 0.6 | Choose a provider (hosted: enter its key; local Ollama/LM Studio: leave the key blank). Click **Load Models**, pick a model, name the connection. | "Loaded N available model IDs." The Model field accepts the chosen ID. | Provider Setup | | |
| 0.7 | Click **Save & Test**. | Success message "Connected to {provider} with model {model} ({total} tokens)." and no failure message. | Notification, Provider Setup | | |
| 0.8 | Open the Generator. Look at the provider row. | Green check, "Provider configuration is ready", and the model ID. The Forge shows the same row. | Generator header | | |
| 0.9 | (Optional) In Provider Setup add a second connection, **Save & Authorize**, switch to it with the Active connection selector in the Generator, then switch back. | Switching loads that connection's URL/model; the key is not shown in plain text. | Generator connection switch | | |
| 0.10 | Module Settings → SimplySF2e → **Compendium Sources** → **Configure Sources**. Before changing anything, read each category. | Every category (Bestiary Abilities, Spells, Feats, Equipment, Ancestries, Backgrounds, Classes, Class Features, Heritages, Bestiary Actors) lists packs, with the sf2e defaults marked "default" (`sf2e.classes`, `class-features`, `feats`, `spells`, `equipment`, `ancestries`, `heritages`, `backgrounds`, `bestiary-ability-glossary-srd`, `alien-core-bestiary`). | Sources window | | |
| 0.11 | Click **Reset to defaults**, confirm the dialog, then **Save**. | "Compendium sources reset to the SF2e system pack defaults." then "Compendium sources saved." | Notifications | | |
| 0.12 | Reopen the Generator. | Compendium Content row reads "Ready — N enabled packs"; no "Required compendium content is unavailable" message. | Generator | | |
| 0.13 | Provider Setup → **Fast picks (Jev)** card: type an OpenRouter key and click **Save Jev key**. | "Jev key saved." The field is empty with the placeholder "A Jev key is saved — leave blank to keep it"; the key is not shown in plain text. A TypeSafe-direct key warning is visible. | Provider Setup | | |
| 0.14 | Reopen Provider Setup; click **Save Jev key** with the field empty, then tick **Clear the saved Jev key** and click it again. | Empty click changes nothing. Clear shows "Jev key cleared." and the placeholder returns to "Optional: OpenRouter key". | Provider Setup | | |
| 0.15 | Type a Jev key, leave the Model field empty, press **Save & Authorize**. | The chat save errors (model required) but reopening Provider Setup shows the Jev key is saved. | Provider Setup | | |

## 1. Presets and Manage Presets

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 1.1 | Generator → Preset dropdown. | Groups: "Standard classes" (Envoy, Mystic, Operative, Solarian, Soldier, Witchwarper), "Starfinder Archetypes" (Corp Enforcer, Free Captain (Pirate), Street Cyberdoc, Bounty Hunter), "Custom presets". | Preset dropdown | | |
| 1.2 | Click the save-preset button, name it "QA Test", add guidance text, **Save Preset**. | "Preset "QA Test" saved." It appears under Custom presets and is selected. | Dropdown, notification | | |
| 1.3 | Duplicate it, then open **Manage Presets**. | "QA Test (copy)" exists. **Manage Custom Presets** lists both with edit and export buttons. | Manage window | | |
| 1.4 | **Export All**, delete both presets, then **Import** the exported JSON. | "Presets imported: 2 added, 0 skipped." Both are back. | Manage window | | |
| 1.5 | Delete "QA Test" and the copy (confirm dialog). | "Preset … deleted." Gone from the dropdown; Manage window shows "No custom presets yet." | Notification | | |

## 2. NPC generation at GM Core levels

Reference ranges: *Starfinder GM Core* Chapter 2 "Building Games", pp. 116-128 (Building Creatures tables, mirrored in `scripts/tables.mjs`). Read each NPC's real numbers off its sheet and compare to the table row for that level. "Roughly within range" means between the table's low and extreme values for that level.

Repeat 2.1-2.7 for **Level 1**, **Level 5** and **Level 12**. Use the same prompt each time, e.g. `a disciplined corporate security captain`.

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 2.1 | Generator → mode **NPC** (or **Monster**). Set Level (Increase/Decrease level buttons). Enter the prompt. Leave Monster Adjustment = Normal. Click **Generate NPC** (**Generate Monster** in Monster mode). | Progress bar advances monotonically through concept, spells/abilities/equipment steps as applicable. A preview appears; nothing is created yet. | Generator preview | | |
| 2.2 | Read the preview: level, AC, HP, Perception, Fort/Ref/Will, strikes. | Level equals the requested level. The "N/M compendium matches" line is shown; unmatched entries show the "will be skipped" warning icon. | Preview | | |
| 2.3 | Click **Create Actor**. | Notification "Created actor "{name}"." and the completion panel (Content grounding counts). **Open Sheet** works. | Notification, completion panel | | |
| 2.4 | On the sheet, AC, HP, saves, Perception. | Roughly within the GM Core ranges for that level. Record: AC `__`, HP `__`, Fort/Ref/Will `__`, Perception `__`. | NPC sheet header and Main tab | | |
| 2.5 | Strikes: attack bonus and damage. | Attack bonus within the Strike Attack Bonus row for the level; average damage within the Strike Damage row. | Strikes section | | |
| 2.6 | Spell DC / attack (if the NPC casts). | Within the Spell DC / Spell Attack row for the level. Spells are real `sf2e.spells` entries. | Spells tab | | |
| 2.7 | Inventory. | Every item is a real compendium item; skipped gear is absent. | Inventory tab | | |

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
| 4.1 | Generator → mode **Encounters**. Party level 3, Party size 4, Threat **Moderate**. Optionally enter a theme. Click **Generate Encounter**. | Progress shows "Encounter design" then "Member i/N" steps. A plan appears with roles (Boss, Minion, etc.) and per-member counts. | Generator preview | | |
| 4.2 | Read the XP readout and treasure readout. | Total XP at or near the Moderate budget for the party (80 XP at party size 4); within-budget styling when under. Treasure in credits with thousands separators. | Preview | | |
| 4.3 | Use "Add one" / "Remove one" on a member. | XP readout updates; "Remove one" at 0 skips that creature. | Preview | | |
| 4.4 | Preview with Threat Trivial, Severe, Extreme and with party size 5. | Member counts and XP scale with threat and party size. Record XP: `__ / __ / __ / __`. | Preview | | |
| 4.5 | Return to Moderate, party 4. Click **Create All Actors**. | Notification "Created N actors in folder "{encounter name}"." A new Actor folder with that name exists. | Actors directory | | |
| 4.6 | Count actors in the folder. | Count equals the sum of member counts in the plan. Duplicates are named "Name 1", "Name 2". Each has bestiary-borrowed art and a plausible level. | Actor folder | | |
| 4.7 | Rollback: Compendium Sources → Bestiary Actors, uncheck every pack, Save. Generate an encounter preview and click **Create All Actors**. | Creation fails with "No usable NPC actor was available in the enabled Bestiary Actor sources…". No folder from this attempt remains and no stray actors remain (all-or-nothing). | Actors directory, console | | |
| 4.8 | Restore defaults (Compendium Sources → **Reset to defaults** → Save). | Sources ready again. | Sources window | | |

## 5. Reskin

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 5.1 | Generator → mode **Reskin**. | "Reskin an existing creature" panel with "Drag an NPC here from the Actors sidebar or a bestiary compendium." | Generator | | |
| 5.2 | Click **Reskin Creature** with nothing dropped. | Warning "Drop an NPC onto the Reskin panel first." | Notification | | |
| 5.3 | Drag a world NPC (with strikes, abilities and at least one rule/effect) from the Actors sidebar onto the panel. | Panel shows the creature name and "Creature {level}". | Drop panel | | |
| 5.4 | Drag a **character** onto the panel. | Rejected: "Only NPC creatures can be reskinned." | Notification | | |
| 5.5 | Re-drop the NPC. Enter a theme (e.g. "a void-touched pirate enforcer who boards ships through airlocks"). Click **Reskin Creature**. | Preview shows new description, "Read aloud", "Recall Knowledge", and "Renamed strikes and abilities" (or "No strikes or abilities were renamed."). Line shown: "Statistics, rules, traits, and items are copied unchanged. The original creature is not modified." | Preview | | |
| 5.6 | Click **Create Reskinned Copy**. | A new actor appears; the original is untouched. | Actors directory | | |
| 5.7 | Compare original and copy: level, AC, HP, saves, Perception, skills, speeds, IWR, traits, item count. | All identical. | Both sheets | | |
| 5.8 | Compare items (Actions, Inventory, Spells). | Same item set. Only renamed strikes/abilities have new names; prose is new. | Both sheets | | |
| 5.9 | On a renamed strike with attack effects, open its item Rules tab and make the attack. | Same rules, damage and traits as the original; the item's slug is pinned to the original slug. Effects still apply. | Item sheet, chat | | |
| 5.10 | Repeat 5.3-5.8 dragging a creature straight from a **bestiary compendium** (e.g. `sf2e.alien-core-bestiary`). | Same behavior; copy lands in the world, compendium untouched. | Compendium, Actors | | |
| 5.11 | Check the copy's description for injected HTML. | Any `<` or `&` from the AI shows as text, not live markup. | Sheet description | | |

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
| 6d.1 | Item type **Weapon (upgrades)**, level 8. Prompt: "a rifle that sears with flame". **Generate**. | "Grade & Upgrades" section shows **Equipment Grade:** (commercial, tactical, advanced, superior, elite, ultimate or paragon) and an upgrade if one fits; price in credits; the base is a real `sf2e.equipment` weapon. | Forge preview | | |
| 6d.2 | **Create Item**; open the sheet. | `system.grade` equals the previewed grade. Name has no invented "+1 striking" prefix. | Item sheet | | |
| 6d.3 | Check upgrades. | Legacy potency/striking/property runes are zero or empty. A previewed upgrade appears **installed** on the weapon as an embedded upgrade module (`system.subitems`). | Item sheet upgrades area | | |
| 6d.4 | Price. | In credits; compare to the preview estimate (the sheet's prepared value is authoritative; record both). | Item sheet | | |
| 6d.5 | Embed on a character and make a Strike. | Strike appears with native attack/damage; no console errors. | Strikes, chat | | |
| 6d.6 | Repeat at levels 3, 13 and 18. | Grade rises with level; still priced in credits. If nothing fits, a clear message appears (e.g. "No … items were found in this world's compendiums…"). | Forge | | |

### 6e. Armor with grade (no upgrade)

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 6e.1 | Item type **Armor (upgrades)**, level 8. Prompt: "light armor that shrugs off kinetic hits". **Generate**. | **Equipment Grade:** shown; **no upgrade listed** (armor upgrade slot counts are uncited and on hiatus); price in credits. | Forge preview | | |
| 6e.2 | **Create Item**; open the sheet. | `system.grade` set; no installed subitems; legacy runes zeroed; the base's analog/tech classification preserved. | Item sheet | | |
| 6e.3 | Embed on a character and equip. | AC reflects the armor; no errors. | Character sheet | | |

## 7. Player Characters (all six classes)

Run each class at **level 1** and at one higher level (use **5**; record the level used). Mode **Player Character**. Pick the class preset (Envoy, Mystic, Operative, Solarian, Soldier, Witchwarper) or name the class in the prompt, set Level, click **Generate Character**. Leave the Free Archetype setting off.

| Class | L1 PASS/FAIL | L5 PASS/FAIL | Notes / evidence |
|-------|--------------|--------------|------------------|
| Envoy | | | |
| Mystic | | | |
| Operative | | | |
| Solarian | | | |
| Soldier | | | |
| Witchwarper | | | |

Per class and level:

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 7.1 | Generate Character; read the preview. | Ancestry, Heritage, Background, Class, Feats, Equipment populated; "Skill priorities" and "Resulting skill proficiencies" shown. | Preview | | |
| 7.2 | Click **Create Actor**. Watch for native Foundry prompts. | No unexpected prompts. Only documented ones may appear: SF2e choice dialogs the module could not answer ("Some character choices could not be selected automatically. Complete any SF2e choice dialogs to continue."). Record every prompt: `____` | Dialogs | | |
| 7.3 | Completion / review panel. | "Character created — review" if any features had no recorded choice. Record the listed items: `____` | Generator | | |
| 7.4 | Open the character; check embedded items. | Exactly one class, ancestry, heritage and background, all real items. Features arrived via grants, not duplicated. | Character tab, Features | | |
| 7.5 | Level, HP, AC, saves, Perception. | Level matches; system-computed stats are non-zero, no NaN. | Sheet header | | |
| 7.6 | Feats tab. | Class, ancestry, skill and general slots for the level are filled, or the review reports the gap. No duplicates. | Feats tab | | |
| 7.7 | Skills. | Trained skills match class base + Int + background; increases only at legal levels for the class. | Skills section | | |
| 7.8 | Equipment. | Gear priced in credits; armor/weapon readied only if trained, else a Loadout note (e.g. "An untrained armor item was left stowed."). | Inventory | | |
| 7.9 | Class path items: Operative specialization skill feat and Sniper bonus feat chosen without a native prompt; Solarian has Solar Manifestations. | Cited L1 choices closed before creation; none blank. | Feats, Actions | | |

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

Use NPCs of level 8 or higher with Advanced options → **Treasure amount** = **Generous** and a prompt that invites consumables and money, e.g. "a spell-slinging cultist carrying spell gems and a stash of credits". Use **Reroll Loot** on the preview to try again.

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 10.1 | Generate an NPC with spell-gem loot and create it. | Loot includes consumables named like "Spell Gem of Fireball (Rank 3)". | Inventory | | |
| 10.2 | Open a spell gem. | Built from a real "Spell Gem (Nth-Rank Spell)" template with the spell linked and the chosen rank. | Item sheet | | |
| 10.3 | Check the link. | No broken `@UUID` link; the spell opens. | Item sheet | | |
| 10.4 | Look for money. | A **Credstick** (credits) and/or **UPB** appear; no classic coin stacks. | Inventory | | |
| 10.5 | Prompt "carries 50 gp". | Converted at 1 gp = 10 credits (500 credits). | Inventory | | |
| 10.6 | Treasure readout in the preview. | Credits with thousands separators; over-budget styling like the XP readout. | Preview | | |
| 10.7 | **Reroll Loot** on a preview. | Loot changes, creature does not. | Preview | | |
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
| 11.10 | `/sf2e character 1 gruff vesk soldier` | Player Character mode, level 1, prompt prefilled. | Fields | | |
| 11.11 | `/sf2e 6 something` | Opens with level 6 and the prompt; mode unchanged. | Fields | | |
| 11.12 | Run `/sf2e` while the Generator is already open. | The same window comes forward; no duplicate. | Window | | |
| 11.13 | Console: `game.modules.get("simplysf2e").api.open()` and `.openItemForge()`. | Windows open. | Console | | |

## 12. Errors and cancellation

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 12.1 | Start a generation, click **Cancel generation** midway. | "Generation cancelled." No actor created; UI usable. | Notification | | |
| 12.2 | Enter a wrong key or model in Provider Setup and **Save & Test**. | "Provider connection test failed: …" with a hint. | Notification | | |
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
| 12f.3 | Open Manage Presets with no presets, then with some. | Empty text points to New Preset / Import; each row button reads aloud as "Edit preset <name>" etc. | Presets | | |
| 12f.4 | Item Forge Level and Rarity row. | Labels share one line and the fields sit together. | Item Forge | | |
| 12f.5 | Provider Setup: set Base URL to `ftp://x`, press Save & Authorize. | Error toast "Could not save provider settings: ..."; window stays open with your edits. A valid save still closes the window. | Provider Setup | | |
| 12f.6 | With a screen reader (or the accessibility tree), tab through Provider Setup, Item Forge, Sources and Manage Presets. | Decorative icons are not announced; buttons read by their text. | All four | | |

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

## 12i. U6 Manage Presets delete cue

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12i.1 | Open Manage Presets with several presets. | The trash button is red-tinted and spaced apart from Edit, Duplicate and Export; hover or Tab to it turns the fill red. Clicking still asks for confirmation. | Manage Presets | | |

## 12j. U6 Provider Setup flow

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12j.1 | Open Provider Setup, type in the Connection name or Model field and press Enter. | Runs **Save & Test** (the highlighted primary), not Save & Authorize. | Provider Setup | | |
| 12j.2 | Click through DeepSeek, OpenAI, OpenRouter, then Ollama, LM Studio, Custom. | The Ollama / LM Studio CORS paragraph is hidden for the three hosted providers and shown for the other three. | Provider Setup | | |
| 12j.3 | Look at the bottom button that used to say Cancel. | It reads **Close** and just closes the window; Load Models and connection changes have already saved. | Provider Setup | | |

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

## 12m. U6 Narrow windows

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12m.1 | Set the Generator to about 460 px wide. | The five modes sit on one row, icon above label; "Player Character" wraps to two lines inside its own segment and no label breaks mid-word. | Generator | | |
| 12m.2 | Encounter and Character modes at the same width. | The Generate button label stays on one line; Preview Plan drops to a second line if there is no room. | Generator | | |
| 12m.3 | Item Forge at about 460 px. | Kind tiles sit two per row, so Generate and the preview are higher up. | Item Forge | | |
| 12m.4 | Shrink the Generator under about 400 px. | Modes wrap into a grid again without overflow. | Generator | | |

## 12n. Jev indicator and token report (J6)

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12n.1 | Open the Generator on an OpenRouter connection. | Third status-bar row "Fast picks: Jev" reads "on (OpenRouter connection)" with a green edge. | Generator | | |
| 12n.2 | Switch to a non-OpenRouter connection with no Jev key. | Row reads "off (needs an OpenRouter connection or a Jev key)" with a neutral edge, not a warning. Its gear opens AI Provider Setup. | Generator | | |
| 12n.3 | On that connection, save a Jev key in Provider Setup, reopen. | Row reads "on (separate Jev key)". | Generator | | |
| 12n.4 | Generate a monster with Jev on, then the same prompt with Jev off (12n.2). | Equipment, Loot and feat step lines end with "Jev, N.N s" (Jev on) or "chat model, N.N s" (Jev off). Concept, Design, ABC and Reskin lines carry no timing. Record the Equipment and Loot times for both runs. | Preview | | |
| 12n.5 | Block `openrouter.ai/api/v1/systemone` in DevTools and generate. | Affected steps read "chat model after Jev fell back, N.N s"; console shows "using the chat model". | Preview | | |
| 12n.6 | Narrow the window to about 360 px. | The Jev row wraps cleanly; no horizontal scroll. | Generator | | |

## 12p. Skipped gear

| # | Do | Expect | Where | Pass | Notes |
| --- | --- | --- | --- | --- | --- |
| 12p.1 | Generate a monster whose prompt names gear the sf2e packs lack (e.g. "a goblin scavenger with a rusted dagger"). | Generation finishes. Any gear with no published match shows struck through with the warning icon in Equipment or Loot; no "Generation is incomplete" error. | Preview | | |
| 12p.2 | Create it. | The actor has only real compendium items. The completion card shows "Skipped gear with no published match: N" when anything was skipped. Console shows `skipped equipment "<name>"`. | Inventory, chat card, console | | |
| 12p.3 | Reroll loot on a preview, then generate a PC. | Neither fails on unmatched loot or equipment; skipped items show the same way. | Preview | | |

## 13. Firefox (if available)

| # | Step | Expected | Where to look | Result | Evidence |
|---|------|----------|---------------|--------|----------|
| 13.1 | Open the world in Firefox. | Loads; no `simplysf2e` console errors. | Console | | |
| 13.2 | Open the Generator and the Forge. | Both render with the module styling; resizing causes no horizontal scroll. | Windows | | |
| 13.3 | Save & Test and one NPC generation. | Succeeds as in Chrome. (Local provider: confirm CORS allows Firefox's origin.) | Notification | | |

## Failure log

One row per failure, so each cluster can become one fix PR.

| Step | Observed | Expected | Console / screenshot |
|------|----------|----------|----------------------|
| | | | |
