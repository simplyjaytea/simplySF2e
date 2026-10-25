# Live pass: features since 2026-10-08

This is a short subset of [docs/qa-checklist.md](qa-checklist.md) for the features added since the last live pass on 2026-10-08. The rows run riskiest first and take about 45 minutes. Full steps for each row are in docs/qa-checklist.md under the same id.

Test record: Foundry version `____` · sf2e version `____` · module version `____` · provider/model `____` · browser `____` · tester `____` · date `____`

## Setup

- Use a scratch world. The checks create actors, items, folders, journals and macros.
- Set up a working AI chat provider and its key in AI Provider Setup before starting. Most rows generate content, so they need it. Jev is optional.
- Keep the browser console (F12) open for the whole pass. Paste any `simplysf2e |` warning or error into Evidence.
- Open a second browser logged in as a non-GM player at the same time as the GM. Step 13e.6 needs it.
- Have an art module that maps sf2e creature packs (separate portrait and token art), for the 13l rows.
- For the no-art row (13l.3), disable the art module and reload the world first. Re-enable it and reload after that row.
- Make a Party actor with three level-4 characters and one level-6 character, for 13d.1 and 13d.2.
- The What's new row (13i.2, 13i.3) needs a newer release installed over an older one whose notes were already dismissed with **Got it**. Keep that row last.

## Rows

| Order | QA id | Do | Expect | Result | Evidence |
|---|---|---|---|---|---|
| 1 | 5.3, 5.5, 5.6, 5.7, 5.8 | Drag a world NPC (with strikes, abilities and at least one rule/effect) from the Actors sidebar onto the panel. Re-drop the NPC, enter a theme (e.g. "a void-touched pirate enforcer who boards ships through airlocks") and click **Reskin Creature**. Click **Create Reskinned Copy**. Compare both sheets. | Panel shows the creature name and "Creature {level}". Preview shows new description, "Read aloud", "Recall Knowledge", and "Renamed strikes and abilities" (or "No strikes or abilities were renamed."). Line shown: "Statistics, rules, traits, and items are copied unchanged. The original creature is not modified." A new actor appears; the original is untouched. Level, AC, HP, saves, Perception, skills, speeds, IWR, traits and item count are all identical. Same item set. | | |
| 2 | 5.9 | **Highest risk.** On a renamed strike with attack effects, open its item Rules tab and make the attack. | Same rules, damage and traits as the original. The item's slug is pinned to the original slug. Effects still apply. | | |
| 3 | 5.10 | Repeat row 1 dragging a creature straight from a **bestiary compendium** (e.g. `sf2e.alien-core-bestiary`). | Same behavior; copy lands in the world, compendium untouched. | | |
| 4 | 13l.1, 13l.2 | With the art module on, generate and create a creature. Open the new actor's Prototype Token. | The portrait is the borrowed creature's portrait; the token uses its token art and scale, not the portrait. The token name is the new creature's name, not the bestiary creature it borrowed from. | | |
| 5 | 13l.4 | Create an encounter with a member count of 3. | Each copy has the same correct art; actor and Prototype Token names are both numbered ("Name 1", "Name 2", "Name 3"). | | |
| 6 | 13l.3 | Disable the art module and reload the world. Repeat the art row (13l.1) with no art module. Re-enable the art module and reload afterwards. | Portrait and token keep the default sf2e NPC icon; nothing errors. | | |
| 7 | 13j.1, 13j.2, 13j.3, 13j.4 | In Reskin mode, drop a level 3 bestiary NPC (New level shows 3). Press + until it shows 7. Write a theme, press **Preview Plan**, then **Create Reskinned Copy**. On the new sheet, roll a strike and open a spell. | No table is shown before + is pressed. Then a table lists AC, Max HP, Perception, saves, each strike and its damage, and Spell DC for casters, with the scale and the level 3 and level 7 values. The preview header says Creature 7 and the note says the copy moved to level 7. The new sheet shows level 7 and the numbers from the table; the original is unchanged. The attack bonus and damage match the table; spells keep their original ranks. | | |
| 8 | 13e.1, 13e.2 | As GM, right-click an NPC in the Actors sidebar. Pick it with the Generator closed. Then pick it again with the Generator open in Monster mode and some prompt text typed. | The menu has "Reskin with SimplySF2e". A character or loot actor does not show it. The Generator opens (or switches) to Reskin with that NPC loaded. Switching back to Monster still shows the typed text. | | |
| 9 | 13e.4, 13e.6 | As GM, type `/sf2e npc 3 vesk dock foreman` in chat. Then, as the player in the second browser, type `/sf2e npc 3 test`. | GM: the Generator opens in NPC mode at level 3 with that prompt and starts a preview at once. Nothing is created until you press Create. Player: "GM only" warning; nothing runs and no AI request is sent. | | |
| 10 | 13d.1, 13d.2 | Open the Generator in Encounters. Press **Use my party**. | Beside Party level: "Use my party" and "<party name>: 4 characters, level 5". After pressing: Party level becomes 5, Party size 4 (Advanced options), and a toast names the party. | | |
| 11 | 13h.3, 13h.5 | In the Treasure window, set Party level 4, One encounter, Common, and theme "Abandoned corporate lab on an ice moon". Generate hoard, then Reroll, then switch to Whole level and Generate. Press **Create hoard**. | One encounter shows Budget 680 credits and Whole level 8,500. Items are level 4 or lower and common, one of each, and item prices plus the Credits row add up to the budget. Party size changes only the "each" line, not the budget. Reroll gives a different hoard. Create hoard opens a loot actor in Loot mode in SimplySF2e > Treasure, holding the remaining items (each linked to its compendium entry, quantity 1) and a Credstick worth the Credits row. The description shows the theme prose. | | |
| 12 | 13f.1, 13f.4 | Create a monster, an NPC, a character, a reskin and a shop. Create the monster in Monster mode and the NPC in NPC mode. You may reuse actors made in earlier rows. | Actors sidebar: SimplySF2e > Creatures (monster, reskin), NPCs, Characters, Shops, each in its folder. A toast says a player handout was added. Journal > SimplySF2e has an entry with the portrait, blurb and read-aloud text, and no tactics or stats. A monster made in Monster mode gets no handout. | | |
| 13 | 13a.1 | Generate a monster, NPC, encounter and player character, then make the Generator short enough that each preview scrolls. Scroll from the top to the bottom. | No button row stays stuck to the bottom edge while you scroll; Create Actor and Discard (and Reroll Loot, Create All Actors or Create Reskinned Copy where shown) appear only at the end of the preview. | | |
| 14 | 13b.1, 13b.3 | Open AI Provider Setup with Jev source OpenRouter, then switch it to TypeSafe AI. Enter `http://proxy.example.com/x` (plain http, not this computer) in the TypeSafe endpoint field and press **Save Jev key**. Switch back to OpenRouter. | A "TypeSafe endpoint" field appears under Jev source, blank with api.typesafe.ai as its placeholder, plus its hint. The plain-http address gives an error toast: the endpoint must be https or http on localhost. Nothing is saved; the key placeholder is unchanged. Switching back to OpenRouter hides the field. | | |
| 15 | 13g.1 | In the Generator choose Encounters, level 7, Rare, Party size 5, Severe; type a prompt. Reload the page and reopen. | Mode, level, rarity, party size and threat come back; the prompt box is empty. | | |
| 16 | 13k.1, 13k.2 | Start a Severe encounter for a party of 5 with **Preview Plan** and watch the progress list. Press **Cancel** while creatures are building. | Every creature stops; no preview and no actors. | | |
| 17 | 13c.1, 13c.3 | In AI Provider Setup, set the API Base URL to `http://api.example.com/v1`, type any key and press **Save & Test**. Watch the Network tab in F12. Switch back to an https provider (or Ollama on `http://localhost:11434/v1`) and generate a monster. | Warning toast: "This AI address uses plain http, so the API key would travel unencrypted and will not be sent…". DevTools Network shows no request carrying an Authorization header. Works as before. | | |
| 18 | 13i.2, 13i.3 | Install the update that adds a release note, then log in as the GM. Press **Got it**, then reload. | What's new opens once, titled "What's new in SimplySF2e" with the module version, and lists only the new notes plus a "Something broke?" block. Got it closes the window, and after a reload it does not open again. | | |

If a row fails, note it in the Failure log below and continue.

When every row passes, update README.md "Live checks" and PLAYBOOK.md section 1 (or ask the coding agent to).

## Failure log

One row per failure, so each cluster can become one fix PR.

| Step | Observed | Expected | Console / screenshot |
|------|----------|----------|----------------------|
| | | | |
