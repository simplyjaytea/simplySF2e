# 1.0 release-candidate pass

This pass **supersedes [docs/live-pass.md](live-pass.md) for the 1.0 release candidate.** Every row is an id from [docs/qa-checklist.md](qa-checklist.md). The Do and Expect columns are short summaries; when a step is unclear, run the full steps under the same id. Rows are grouped by the P1–P9 capabilities in [docs/roadmap-1.0.md](roadmap-1.0.md) §1. Inside each group they run riskiest first, except that a row which uses an item or character made by an earlier row comes after that row. The pass has 90 rows.

Test record: Foundry version `____` · sf2e version `____` · module version `____` · provider/model `____` · browser `____` · tester `____` · date `____`

## Gate before the pass

- `bash tools/release-check.sh` passes on the release-candidate commit. This is not a QA row.

## Setup

- Use a scratch world on sf2e 1.6.x, logged in as GM. The checks create actors, items, folders, journals and macros.
- Set up a working AI provider before starting, and record it in the test record. The roadmap's reference model is DeepSeek.
- Keep the browser console (F12) open for the whole pass. Paste every `simplysf2e |` warning or error into Evidence. Only documented fail-closed warnings may appear.
- Row 12t.1 needs a fresh browser profile. Do it early, then use that profile for the rest of P1.
- Use one prompt at level 5 for 3.1, 12x.3 and 3.3–3.6, so the Normal baseline and the Elite and Weak NPCs compare.
- Run 2.4 at Level 1, 5 and 12.
- Run the class table in row 7 with **Free Archetype variant rule** off. Rows 7e.1–7e.6 need it on.
- Row 7a.8 says level 19. The roadmap's P4 bar needs one level 20 caster, so create the caster at level 20.
- After 4.7, use Compendium Sources → **Reset to defaults** (4.8) before creating the encounter rows.
- After 12.2, restore the working provider.
- Row 12x.5 applies only when a row is marked. If none is marked, record N/A and the creatures you checked.
- Run 13i.2 and 13i.3 last. They need a newer release installed over an older one whose notes were already dismissed with **Got it**.

## P1. Install, provider and welcome

| Order | QA id | Do | Expect | Result | Evidence |
|---|---|---|---|---|---|
| 1 | 0.1 | Enable SimplySF2e in Manage Modules, save, reload the world. | Reloads with no red error notifications and no `simplysf2e` console errors. | | |
| 2 | 0.10 | Compendium Sources → **Configure Sources**. Read every category before changing anything. | Each category lists its packs; the sf2e defaults are marked "default". | | |
| 3 | 0.11 | Compendium Sources → **Reset to defaults**, confirm, **Save**. | "Compendium sources reset to the SF2e system pack defaults." then "Compendium sources saved." | | |
| 4 | 12t.1 | In a fresh browser profile, log in as GM. | Welcome to SimplySF2e opens by itself; the readiness rows show as 12t.1 describes. | | |
| 5 | 0.6 | Provider Setup → **Load Models**, pick a model, name the connection. | "Loaded N available model IDs." | | |
| 6 | 0.7 | Provider Setup → **Save & Test**. | "Connected to {provider} with model {model} ({total} tokens)." | | |
| 7 | 12t.2 | Save and authorize the working connection; the welcome refreshes. | The main button becomes **Open Generator**; pressing it opens the Generator and closes the welcome. | | |
| 8 | 0.8 | Open the Generator's provider row. | Green check, "Provider configuration is ready", and the model ID. | | |
| 9 | 12t.5 | Untick every Spells pack, save, press **Check Again** in the welcome. Then restore the packs. | Compendium Content warns and names Spells; the gear opens Sources. | | |
| 10 | 0.12 | Reopen the Generator with the packs restored. | Compendium Content reads "Ready — N enabled packs". | | |

## P2. NPC generation and stat check

| Order | QA id | Do | Expect | Result | Evidence |
|---|---|---|---|---|---|
| 11 | 3.1 | Generate and create a **Normal** NPC at level 5. Record AC, HP, saves, Perception, strike bonus, first strike damage, one skill, and spell DC if any. | Baseline recorded. | | |
| 12 | 2.7 | Open the Inventory tab of the NPC from row 11. | Every item is a real compendium item; skipped gear is absent. | | |
| 13 | 12x.3 | Create an Elite and then a Weak NPC with the same prompt at level 5. | Both stat checks pass; expected numbers include the +2/-2 and the HP change. | | |
| 14 | 3.3 | Compare the Elite to the Normal NPC from row 11. | Exactly +2 to AC, saves, Perception, attacks, skills and spell DC; first damage +2; HP +20. Not +4, not +40. | | |
| 15 | 3.4 | Read the sheet's adjustment state on the Elite. | Reads as Elite; only one adjustment is active. | | |
| 16 | 3.6 | Compare the Weak (-1 Level) NPC to the Normal one. | Level 4; exactly -2 to AC, saves, Perception, attacks, skills and spell DC; first damage -2; HP -15. | | |
| 17 | 12x.1 | Generate and create a level 4 Monster with no adjustment. | Stat check has a green edge; every number matches the preview and sits in the GM Core range. | | |
| 18 | 12x.2 | Compare AC, HP, Perception, saves and strike bonuses on the sheet with the stat check list. | Every number in the list is the number on the sheet. | | |
| 19 | 12x.5 | If any row is marked, note the creature and row. | The row is bold with a warning sign, the panel edge is orange, and the GM whisper lists only flagged rows. The actor is unchanged. | | |
| 20 | 2.4 | Read AC, HP, saves and Perception on the sheet at L1, L5 and L12. | Roughly within the GM Core ranges for each level. | | |
| 21 | 12s.1 | Generate a level 3 "corporate security guard with a laser pistol". | The Laser Pistol is in the inventory; its strike deals fire damage with the weapon's traits and range. | | |

## P3. Encounter

| Order | QA id | Do | Expect | Result | Evidence |
|---|---|---|---|---|---|
| 22 | 4.7 | Untick every Bestiary Actor pack, save, generate an encounter preview, click **Create All Actors**. | Fails with "No usable NPC actor was available in the enabled Bestiary Actor sources…". No folder or stray actors remain. | | |
| 23 | 13k.2 | Start a Severe encounter and press **Cancel** while creatures are building. | Every creature stops; no preview and no actors. | | |
| 24 | 13k.1 | Generate a Severe encounter for a party of 5 with **Preview Plan**. | Creatures finish in overlapping waves; the run is noticeably faster than before. | | |
| 25 | 13k.3 | Create the encounter from row 24. | Every member is created in the encounter folder with its own stats and gear. | | |
| 26 | 4.5 | Encounter, Moderate, party 4 → **Create All Actors**. | "Created N actors in folder "{encounter name}"." and the folder exists. | | |
| 27 | 4.6 | Count the actors in the folder from row 26. | Count equals the sum of the plan's member counts; duplicates are numbered "Name 1", "Name 2". | | |
| 28 | 4.2 | Generate a Moderate encounter for party 4 and read the XP and treasure readouts. | XP at or near the Moderate budget (80 at party size 4); treasure in credits. | | |
| 29 | 4.1 | Encounters mode, party level 3, party size 4, Moderate → **Generate Encounter**. | Progress shows "Encounter design", then "Member i/N"; a plan with roles and counts appears. | | |

## P4. Player Characters (all eight classes, L1–L20, Free Archetype off and on)

| Order | QA id | Do | Expect | Result | Evidence |
|---|---|---|---|---|---|
| 30 | 7e.6 | Free Archetype on. Multiclass picker: Mystic, level 6. Prompt "a mystic who also trained as an operative". Generate, then read the archetype feats at levels 2 to 6. | Only the Mystic dedication appears. No second dedication appears before two Mystic archetype feats are placed. | | |
| 31 | 7e.5 | Free Archetype on. Soldier, picker Mystic, created at level 4, 6 and 8. Read the Spellcasting tab after each. | Separate Mystic archetype entry with 2 cantrips; rank 1 slot at level 4, rank 2 at level 6, rank 3 at level 8. Record slots per rank. Repeat once with Witchwarper or Technomancer. | | |
| 32 | 7c.4 | Create a level 5 Technomancer. Count the prepared entry's spell database. | 10 cantrips; 5 first-rank arcane spells plus the programming language's cache spell; two spells per spell rank after 1st. Record the counts. | | |
| 33 | 7d.1 | Level 1 **Living Hologram** PC. Generate, then Create Actor. | No native size prompt; the module answers the size choice; the sheet shows the chosen creature size. | | |
| 34 | 7d.2 | Level 1 **SRO** PC (SRO Frame). Same steps. | As 7d.1. | | |
| 35 | 7 (class table) | Create each of the eight classes at L1 and L5 with Free Archetype off. Mark PASS/FAIL in the class table. | All 16 class and level combinations PASS. | | |
| 36 | 7.2 | Watch for native Foundry prompts during each Create Actor in row 35. | No unexpected prompts. Record every documented prompt. | | |
| 37 | 7.6 | Feats tab of each character from row 35. | Class, ancestry, skill and general slots for the level are filled, or the review reports the gap. No duplicates. | | |
| 38 | 7e.2 | Free Archetype on. Soldier, level 5, picker Mystic. Generate, then Create Actor. | The Mystic Dedication fills the level-2 archetype slot; preview and sheet agree. | | |
| 39 | 7e.3 | Same character as row 38. Read the archetype feats at level 4 and later. | Where a legal follow-up exists, later archetype slots take Mystic archetype feats. | | |
| 40 | 7e.4 | Free Archetype on, picker empty. Prompt "a soldier who dabbles in mysticism", level 5. Generate, then Create Actor. | The AI picks a dedication from the prompt and it fills the level-2 archetype slot. | | |
| 41 | 7e.1 | Open the Generator in Player Character mode with **Free Archetype variant rule** off, then turn it on and reopen. | The Multiclass picker appears only when the setting is on. | | |
| 42 | 7c.3 | Create a level 5 Mechanic with default settings; open the skill review. | No "Some feat prerequisites were planned with skill ranks…" warning. | | |
| 43 | 7c.1 | Create a level 5 Technomancer. | Prepared arcane entry with 5 cantrips and rank 1-3 slots; focus entry with the programming language's magic hack; focus pool 1. | | |
| 44 | 7c.2 | Create a level 1 Mechanic that picks the Drone exocortex. | GM whisper: set up the drone companion by hand; no whisper for Mechanics without it. | | |
| 45 | 7a.8 | Create a **level 20** Mystic or Witchwarper. | A 10th-rank slot exists; spells and slots match the class. | | |
| 46 | 7a.5 | Focus pool on a Mystic or Witchwarper. | Max focus points equals the non-cantrip focus spells, capped at 3. Hand-editing the max does not stick. | | |
| 47 | 7a.2 | Spellcasting tab of a Mystic or Witchwarper at L1 and L5. | 3 slots per unlocked rank and 5 cantrips. | | |
| 48 | 7a.3 | Read the spell entries of the characters in row 47. | Real `sf2e.spells` of the right tradition; none above the castable rank; not empty. | | |
| 49 | 7.9 | Feats and Actions tabs of a level 1 Operative and a level 1 Solarian. | Operative specialization and Sniper choices made with no native prompt; Solarian has Solar Manifestations. | | |
| 50 | 7.4 | Character tab → Features of a character from this group. | One class, ancestry, heritage and background; features arrived via grants, none duplicated. | | |
| 51 | 1.6 | Generator → Preset dropdown → **Standard classes**. | Lists Envoy, Mechanic, Mystic, Operative, Solarian, Soldier, Technomancer and Witchwarper. | | |

## P5. Reskin and re-level

| Order | QA id | Do | Expect | Result | Evidence |
|---|---|---|---|---|---|
| 52 | 5.3 | Drag a world NPC with strikes and abilities onto the Reskin panel. | Panel shows the creature name and "Creature {level}". | | |
| 53 | 5.5 | Enter a theme (e.g. "a void-touched pirate enforcer who boards ships through airlocks") and click **Reskin Creature**. | Preview shows new description, "Read aloud", "Recall Knowledge" and the renamed-strikes line. | | |
| 54 | 5.7 | Click **Create Reskinned Copy**, then compare original and copy: level, AC, HP, saves, Perception, skills, speeds, IWR, traits, item count. | A new actor appears and the original is untouched; all compared values are identical. | | |
| 55 | 5.9 | On a renamed strike from the copy in row 54 with attack effects, open its Rules tab and make the attack. | Same rules, damage and traits as the original; the slug is the original slug; effects still apply. | | |
| 56 | 5.10 | Repeat rows 52–54 dragging a creature from `sf2e.alien-core-bestiary`. | Same behavior; the copy lands in the world; the compendium is untouched. | | |
| 57 | 5.8 | Compare items on both sheets (Actions, Inventory, Spells). | Same item set; only renamed strikes and abilities differ by name. | | |
| 58 | 13j.2 | Drop a level 3 bestiary NPC and press + until it shows 7. | A table lists AC, Max HP, Perception, saves, strikes and damage, and Spell DC for casters, with level 3 and 7 values. | | |
| 59 | 13j.3 | Write a theme, **Preview Plan**, then **Create Reskinned Copy** at level 7. | Preview header says Creature 7; the new sheet shows level 7 and the table's numbers; the original is unchanged. | | |
| 60 | 13j.4 | On the new sheet from row 59, roll a strike and open a spell. | Attack bonus and damage match the table; spells keep their original ranks. | | |
| 61 | 13j.5 | Set the level back to the original and create a copy. | The copy keeps every number of the original. | | |

## P6. Item Forge

| Order | QA id | Do | Expect | Result | Evidence |
|---|---|---|---|---|---|
| 62 | 6d.7 | Item type Weapon (upgrades), level 8. Generate a projectile weapon and a laser weapon. Create the projectile one. | Projectile preview lists an Impact Enhancer or Arcane Adapter when one fits; laser lists neither. The upgrade is installed on the created weapon. | | |
| 63 | 6d.3 | Open the upgrades area of the weapon from row 62. | Legacy runes are zero or empty; the previewed upgrade appears installed (`system.subitems`). | | |
| 64 | 6d.2 | Open the sheet of the weapon from row 62. | `system.grade` equals the previewed grade; no invented "+1 striking" prefix. | | |
| 65 | 6d.5 | Embed the weapon from row 62 on a character and make a Strike. | Native attack and damage; no console errors. | | |
| 66 | 6a.1 | Item type Wondrous Item, level 5. Prompt: "a visor that shields the mind and lets the wearer see in the dark; once per day it fires a burst of light dealing fire damage". Generate. | Preview shows Usage, Bulk, Price in credits, Effects and an Activation section. | | |
| 67 | 6a.2 | **Create Item**. | "Created item "{name}"." and a draggable item in the Items directory. | | |
| 68 | 6a.7 | Drag the item from row 67 onto a PC, invest it, target a token, click **Activate**. | Damage or heal card posts to chat; a save prompt appears if the activation has one. | | |
| 69 | 6a.8 | Read the item's `forge` flag after one activation. | `uses` is `{ value: 0, max: 1, per: "day" }`. | | |
| 70 | 6a.9 | Click Activate again. | Chat: "{item} has no activations remaining. It recharges during daily preparations." | | |
| 71 | 9.3 | Rest for the Night on the character from row 68. Re-read the flag. | `uses.value` is 1. | | |
| 72 | 9.4 | Activate the item again. | Works as in row 68. | | |
| 73 | 6e.1 | Item type Armor (upgrades), level 8. Generate. | Equipment Grade shown; no upgrade listed; price in credits. | | |

## P7. Shop and Treasure

| Order | QA id | Do | Expect | Result | Evidence |
|---|---|---|---|---|---|
| 74 | 12z.2 | Describe a weapons dealer, Shop level 3, Standard, Common → **Generate shop**. | Up to 16 rows, all level 3 or lower and common; credits match compendium prices. | | |
| 75 | 12z.3 | Remove two rows with ×, then **Create merchant**. | Loot actor opens in Merchant mode with the remaining items, quantities and compendium prices. | | |
| 76 | 12z.4 | Drag the merchant from row 75 onto a scene and have a player buy an item. | The native merchant buy flow works and deducts the player's credits. | | |
| 77 | 13h.3 | Treasure window: Party level 4, One encounter, Common, theme "Abandoned corporate lab on an ice moon". Generate, Reroll, switch to Whole level and Generate. | Budget 680 credits and Whole level 8,500; items add up to the budget; party size changes only the "each" line. | | |
| 78 | 13h.5 | Press **Create hoard** on the hoard from row 77. | Loot actor opens in Loot mode with the remaining items linked to compendium entries, and a Credstick worth the Credits row. | | |
| 79 | 12z.6 | Press **Stop** mid-run, then close the window mid-run. | Nothing is created; the cancelled notice appears. | | |

## P8. Safety: fail-closed messages, cancel, keys, escaping

| Order | QA id | Do | Expect | Result | Evidence |
|---|---|---|---|---|---|
| 80 | 13c.1 | Provider Setup: Base URL `http://api.example.com/v1`, any key, **Save & Test**. Watch Network in F12. | Plain-http warning toast; no request carries an Authorization header. | | |
| 81 | 13c.4 | Reskin a creature whose AI blurb contains "&" (e.g. "Salt & rust"). Open the copy. | The sheet shows "&", not "&amp;". | | |
| 82 | 5.11 | Check the description of a Reskin copy from P5 for injected HTML. | Any `<` or `&` from the AI shows as text, not markup. | | |
| 83 | 12f.1 | Forge a 1/day self-buff whose name contains `&` or `<`, then activate it. | Preview, description and chat show the name escaped, never as markup. | | |
| 84 | 12u.1 | Make a Generator run fail (a model name the provider lacks), then **Copy bug report**. | "Bug report copied"; the clipboard holds the error, failed step and form values. | | |
| 85 | 12u.2 | Search the copied bug report from row 84 for your API key and Jev key. | Neither appears; the report says "API key set: yes". | | |
| 86 | 12.1 | Start a generation, click **Cancel generation** midway. | "Generation cancelled." No actor created; the UI is usable. | | |
| 87 | 12.2 | Enter a wrong key or model in Provider Setup and **Save & Test**. | "Provider connection test failed: …" with a hint. Restore the working provider afterwards. | | |

## P9. Docs match the UI; release notes

| Order | QA id | Do | Expect | Result | Evidence |
|---|---|---|---|---|---|
| 88 | 13i.2 | Install the update with the new release note, log in as GM. | What's new opens once, titled "What's new in SimplySF2e", with the module version and only the new notes. | | |
| 89 | 13i.3 | Press **Got it**, then reload. | The window closes and does not open again. | | |
| 90 | 13i.6 | On a world where the GM already used SimplySF2e, update and log in as GM. | What's new opens once and lists the notes from this update. | | |

P9 also needs a live-log entry for this build (roadmap P9). `docs/live-log.md` does not exist yet; until it does, this file's Result and Evidence columns are the record.

## Not in this pass

These ids stay in [docs/qa-checklist.md](qa-checklist.md) for the full pass. The 90-row cap leaves them out, so the roadmap bars below are not fully covered here:

- P1: 0.2–0.5, 0.9, 0.13–0.15, 12t.3, 12t.4, 12t.6.
- P2: 2.1, 2.2, 2.3, 2.5, 2.6, 3.2, 3.5, 3.7, 3.8, 12s.2, 12s.3, 12x.4, 12x.6.
- P3: 4.3, 4.4, 4.8, 13d.1–13d.4 (party button).
- P4: 7.1, 7.3, 7.5, 7.7, 7.8, 7a.1, 7a.4, 7a.6, 7a.7, 7b.1, 7b.2, 8.1–8.5.
- P5: 5.1, 5.2, 5.4, 5.6 (run as part of row 54), 13j.1.
- P6: 6a.3–6a.6, 6a.10–6a.13, 6b, 6c, 6d.1, 6d.4, 6d.6, 6e.2, 6e.3, 9.1, 9.2, 9.5, 9.6.
- P7: 12z.1, 12z.5, 13h.1, 13h.2, 13h.4.
- P8: 12.3–12.5, 12u.3–12u.5, 13c.2, 13c.3, 13a.x, 13b.x, 12k.x.
- P9: 13i.1, 13i.4, 13i.5.

Any of these may be run before a release that changes its area, using the full qa-checklist.

## Failure log

One row per failure, so each cluster can become one fix PR.

| Step | Observed | Expected | Console / screenshot |
|------|----------|----------|----------------------|
| | | | |
