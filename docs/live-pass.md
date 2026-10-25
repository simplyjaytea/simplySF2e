# Live pass: features since 2026-10-08

This is a short subset of [docs/qa-checklist.md](qa-checklist.md) for the features added since the last live pass on 2026-10-08. The rows run riskiest first and take about 30 minutes. Full steps for each row are in docs/qa-checklist.md under the same id.

Test record: Foundry version `____` · sf2e version `____` · module version `____` · provider/model `____` · browser `____` · tester `____` · date `____`

## Setup

- Use a scratch world. The checks create actors, items, folders, journals and macros.
- Keep the browser console (F12) open for the whole pass. Paste any `simplysf2e |` warning or error into Evidence.
- Have an art module that maps sf2e creature packs (separate portrait and token art), for row 4.
- Make a Party actor with three level-4 characters and one level-6 character, for row 10.
- Have a non-GM player login, for row 9.
- Have a module update ready that adds a release note, for row 15.

## Rows

| Order | QA id | Do | Expect | Result | Evidence |
|---|---|---|---|---|---|
| 1 | 5.3, 5.5, 5.6, 5.7 | Drag a world NPC (with strikes, abilities and at least one rule/effect) from the Actors sidebar onto the Reskin panel. Re-drop the NPC, enter a theme (e.g. "a void-touched pirate enforcer who boards ships through airlocks") and click **Reskin Creature**. Click **Create Reskinned Copy**. Compare both sheets. | Panel shows the creature name and "Creature {level}". Preview shows new description, "Read aloud", "Recall Knowledge", and "Renamed strikes and abilities" (or "No strikes or abilities were renamed."). Line shown: "Statistics, rules, traits, and items are copied unchanged. The original creature is not modified." A new actor appears; the original is untouched. Level, AC, HP, saves, Perception, skills, speeds, IWR, traits and item count are all identical. | | |
| 2 | 5.9 | **Highest risk.** On a renamed strike with attack effects, open its item Rules tab and make the attack. | Same rules, damage and traits as the original. The item's slug is pinned to the original slug. Effects still apply. | | |
| 3 | 5.10 | Repeat 5.3-5.8 with a creature dragged straight from a **bestiary compendium** (e.g. `sf2e.alien-core-bestiary`). | Same behavior; copy lands in the world, compendium untouched. | | |
| 4 | 13l.1, 13l.2 | With the art module on, generate and create a creature. Open the new actor's Prototype Token. | The portrait is the borrowed creature's portrait; the token uses its token art and scale, not the portrait. The token name is the new creature's name, not the bestiary creature it borrowed from. | | |
| 5 | 13l.3 | Repeat row 4 with no art module. | Portrait and token keep the default sf2e NPC icon; nothing errors. | | |
| 6 | 13l.4 | Create an encounter with a member count of 3. | Each copy has the same correct art; actor and Prototype Token names are both numbered ("Name 1", "Name 2", "Name 3"). | | |
| 7 | 13j.2, 13j.3, 13j.4 | In Reskin mode, drop a level 3 bestiary NPC (New level shows 3). Press + until it shows 7. Write a theme, press **Preview Plan**, then **Create Reskinned Copy**. On the new sheet, roll a strike and open a spell. | A table lists AC, Max HP, Perception, saves, each strike and its damage, and Spell DC for casters, with the scale and the level 3 and level 7 values. The preview header says Creature 7 and the note says the copy moved to level 7. The new sheet shows level 7 and the numbers from the table; the original is unchanged. The attack bonus and damage match the table; spells keep their original ranks. | | |
| 8 | 13e.1, 13e.2 | As GM, right-click an NPC in the Actors sidebar. Pick it with the Generator closed. Then pick it again with the Generator open in Monster mode and some prompt text typed. | The menu has "Reskin with SimplySF2e". A character or loot actor does not show it. The Generator opens (or switches) to Reskin with that NPC loaded. Switching back to Monster still shows the typed text. | | |
| 9 | 13e.4, 13e.6 | As GM, type `/sf2e npc 3 vesk dock foreman` in chat. Then, as a player, type `/sf2e npc 3 test`. | GM: the Generator opens in NPC mode at level 3 with that prompt and starts a preview at once. Nothing is created until you press Create. Player: "GM only" warning; nothing runs and no AI request is sent. | | |
| 10 | 13d.1, 13d.2 | Open the Generator in Encounters. Press **Use my party**. | Beside Party level: "Use my party" and "<party name>: 4 characters, level 5". After pressing: Party level becomes 5, Party size 4 (Advanced options), and a toast names the party. | | |
| 11 | 13h.3, 13h.5 | In the Treasure window, set Party level 4, One encounter, Common, and theme "Abandoned corporate lab on an ice moon". Generate hoard, then Reroll, then switch to Whole level and Generate. Press **Create hoard**. | One encounter shows Budget 680 credits and Whole level 8,500. Items are level 4 or lower and common, one of each, and item prices plus the Credits row add up to the budget. Party size changes only the "each" line, not the budget. Reroll gives a different hoard. Create hoard opens a loot actor in Loot mode in SimplySF2e > Treasure, holding the remaining items (each linked to its compendium entry, quantity 1) and a Credstick worth the Credits row. The description shows the theme prose. | | |
| 12 | 13f.1, 13f.4 | Create a monster, an NPC, a character, a reskin and a shop. Make the NPC in NPC mode and the monster in Monster mode. | Actors sidebar: SimplySF2e > Creatures (monster, reskin), NPCs, Characters, Shops, each in its folder. A toast says a player handout was added. Journal > SimplySF2e has an entry with the portrait, blurb and read-aloud text, and no tactics or stats. A monster made in Monster mode gets no handout. | | |
| 13 | 13c.1 | In AI Provider Setup, set the API Base URL to `http://api.example.com/v1`, type any key and press **Save & Test**. Watch the Network tab in F12. | Warning toast: "This AI address uses plain http, so the API key would travel unencrypted and will not be sent…". DevTools Network shows no request carrying an Authorization header. | | |
| 14 | 13k.2 | Start a Severe encounter for a party of 5 with **Preview Plan**. Press **Cancel** while creatures are building. | Every creature stops; no preview and no actors. | | |
| 15 | 13i.2, 13i.3 | Install the update that adds a release note, then log in as the GM. Press **Got it**, then reload. | What's new opens once, titled "What's new in SimplySF2e" with the module version, and lists only the new notes plus a "Something broke?" block. Got it closes the window, and after a reload it does not open again. | | |

If a row fails, note it in the Failure log below and continue.

When every row passes, tell the coordinator so README.md "Live checks" and PLAYBOOK.md section 1 can be updated.

## Failure log

One row per failure, so each cluster can become one fix PR.

| Step | Observed | Expected | Console / screenshot |
|------|----------|----------|----------------------|
| | | | |
