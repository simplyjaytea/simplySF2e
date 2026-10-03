# SimplySF2e

AI generator for Starfinder 2e in Foundry VTT. Describe a creature, NPC, encounter, player character or magic item in plain words; SimplySF2e asks an AI model for a concept, then builds it out of real content from your installed Starfinder 2e compendiums. Ported from [SimplyPF2e](https://github.com/simplyjaytea/simplyPF2e).

> **Alpha.** Nothing in this module has been tested in a live Foundry world yet. Only automated node tests have run. Check every generated actor and item before you use it at the table.

## Requirements

- Foundry VTT v14 (minimum 14.361, verified 14.367).
- The **Starfinder Second Edition** game system (`sf2e`) 1.5.0 or later. Checked against 1.5.1.
- An AI provider that speaks the OpenAI-compatible Chat Completions API. This can be a hosted service (DeepSeek, OpenAI, OpenRouter, or another compatible gateway) or a model running on your own machine (Ollama, LM Studio).
- A GM account. Players cannot open the generator, the Item Forge or provider setup.

## Quick start

### 1. Install and enable

1. In Foundry, open **Add-on Modules → Install Module** and paste this manifest URL:

   ```
   https://github.com/simplyjaytea/simplySF2e/releases/latest/download/module.json
   ```

2. Launch a world that uses the Starfinder Second Edition system.
3. Open **Manage Modules**, tick **SimplySF2e**, and save.

Every merge to `main` publishes the next release. See [Releases](https://github.com/simplyjaytea/simplySF2e/releases) for the current version.

When a GM logs in and no AI connection works yet, the **Welcome to SimplySF2e** window opens. It checks the Starfinder 2e system version, your compendium content and the AI connection, shows whether fast picks are on, and links to the window that fixes each row. It stops opening by itself once the connection works, or when you tick **Don't show this again at login**. Reopen it any time with **Open Welcome** in the module settings or `/sf2e welcome` in chat.

### 2. Connect an AI provider

Open **Configure Settings → SimplySF2e** and click **Configure Provider** (or press **Set Up AI Connection** in the welcome window). This opens the **AI Provider Setup** window.

1. Pick a provider button: **DeepSeek**, **OpenAI**, **OpenRouter**, **Ollama**, **LM Studio**, or **Custom**. The preset buttons fill in the **API Base URL** and, where there is one, a suggested **Model**:

   | Button | API Base URL | Suggested model |
   | --- | --- | --- |
   | DeepSeek | `https://api.deepseek.com/v1` | `deepseek-v4-flash` |
   | OpenAI | `https://api.openai.com/v1` | `gpt-5.6-luna` |
   | OpenRouter | `https://openrouter.ai/api/v1` | (enter one) |
   | Ollama | `http://localhost:11434/v1` | (enter one) |
   | LM Studio | `http://localhost:1234/v1` | (enter one) |
   | Custom | (enter your own) | (enter one) |

   The API Base URL can be the API root (normally ending in `/v1`) or a full `/chat/completions` address.
2. Give the connection a **Connection name** (for example "DeepSeek" or "local GPU").
3. Enter the **Model**. **Load Models** saves the connection and then fills the Model field's suggestions from the provider's model list. You can also type an exact model ID by hand.
4. For a hosted provider, paste your key into **API key (this browser only)**. Leave it blank for a keyless local server.
5. Click **Save & Test** to save and send one small test request, or **Save & Authorize** to save without testing.

**Keys are tied to one exact endpoint.** When you save, the key is authorized only for the API Base URL shown in the window. If you later change the URL without entering a new key, the old key is cleared, so it is never sent to a different service. If the generator ever says "Stored API key is not authorized for the current API Base URL and will not be sent", it shows the endpoint and an **Authorize for this endpoint** button. Click it only if that endpoint is the one you meant.

**Local and keyless providers.** Addresses on `localhost`, `*.local`, or private network ranges (for example `127.x`, `10.x`, `192.168.x`) are treated as local, and no key is required for them. The setup window reminds you of what the local server needs:

- **Ollama:** add your Foundry address to `OLLAMA_ORIGINS`.
- **LM Studio:** enable CORS (Developer → Server Settings, or `lms server start --cors`) and authentication.
- The local server must already be running before you test or generate.
- A Foundry page served over **HTTPS** cannot call a provider on plain **HTTP**. Browsers block that request. Serve the provider over HTTPS, or open Foundry over HTTP on the same trusted network.

**Saved connections (the connection bank).** You can keep several named connections, for example a hosted model and a local one, and switch between them.

- Use the **Saved connections** list at the top of AI Provider Setup to switch. Switching loads that connection's URL, model and key. Save first if you want to keep edits to the current connection.
- **New connection** (the + button) adds a connection and makes it active. A new connection never copies a key from another connection.
- **Delete connection** (the trash button) removes the active connection. You cannot delete the last one.
- When you have more than one saved connection, the generator and Item Forge headers show a drop-down so you can switch without opening setup. The headers also have **Test provider connection** and **Configure AI provider** buttons.

### Fast picks (Jev)

Jev is TypeSafe's fast decision model. It never writes text: it only picks from lists, which is the "choose the right compendium entry" part of a generation. SimplySF2e uses it for equipment and loot, creature feats and abilities, Player Character feats, class and ancestry choices, and Player Character spells. Concepts, descriptions and everything the AI writes still come from your chat model.

- **It is always on when it can run.** No toggle. The generator header has a **Fast picks: Jev** line that reads "on" or "off" and why.
- **What it needs.** Either your active connection is **OpenRouter** (its key is reused), or you save a separate Jev key in **AI Provider Setup → Fast picks (Jev)**. Pick its **Jev source** first: **OpenRouter** (an OpenRouter key) or **TypeSafe AI** (a key from TypeSafe). Any other connection works as before, without Jev.
- **TypeSafe AI from Foundry.** As of October 2026, TypeSafe's API refuses calls made from a browser (CORS), and Foundry modules run in your browser, so a TypeSafe key most likely will not work yet. Use OpenRouter until **Test Jev** passes on TypeSafe. Switching the source clears the saved Jev key, because a key only works on its own service.
- **Test Jev.** The **Test Jev** button saves the Jev source and key, sends Jev one tiny question over the route generation would use, and tells you whether it answered (and how fast) or why not: Jev off, key rejected, TypeSafe blocking the browser, no network, or a timeout.
- **Fallback.** If a Jev request fails, times out (4 s per request), or Jev is unsure or finds no fitting entry, that step runs on your chat model instead. Nothing is guessed and the result looks the same either way. The token report marks such a step "chat model after Jev fell back"; a failed request also logs "using the chat model" in the browser console.
- **Cost.** Jev requests are billed on the account whose key is used: OpenRouter (see its pricing for `typesafe/jev-1.13`) or TypeSafe AI (`jev-1.13.0`). The token report after each run lists each step's tokens. Steps Jev can answer also show their seconds and which model answered, for example "Jev, 0.8 s" or "chat model after Jev fell back, 7.0 s".
- **Privacy.** Jev sees your concept summary and the names of candidate compendium entries, and nothing else. They go to openrouter.ai, which passes them to TypeSafe, or straight to api.typesafe.ai when the Jev source is TypeSafe AI. Your Jev key is stored in your browser only and sent only to its chosen source.

### 3. Other settings

These appear directly in **Configure Settings → SimplySF2e**:

| Setting | Default | What it does |
| --- | --- | --- |
| **Creativity (temperature)** | 0.8 (range 0–2) | Higher gives more surprising concepts. Matching and selection steps always run at temperature 0. |
| **Max response tokens** | 8000 | Upper limit for one AI response. Each step uses its own smaller cap where it can. |
| **Request timeout (seconds)** | 90 | Abort if the provider sends **no data** for this long. Responses stream, so a slow model that keeps sending text is not cut off. |
| **Free Archetype variant rule** | Off | Gives generated player characters the variant's extra archetype feat slot at each even level. Picks that cannot be proven legal are left empty, not guessed. |

The **Compendium Sources** menu (button **Configure Sources**) chooses which compendium packs each category draws from: Bestiary Abilities, Spells, Feats, Equipment, Ancestries, Backgrounds, Classes, Class Features, Heritages and Bestiary Actors. Homebrew and module packs work too. A category left empty uses the SF2e system defaults (`sf2e.classes`, `class-features`, `feats`, `spells`, `equipment`, `ancestries`, `heritages`, `backgrounds`, `bestiary-ability-glossary-srd`, `alien-core-bestiary`). **Reset to defaults** restores them.

### 4. Open the tools

All launchers are GM-only and only appear in an `sf2e` world.

| Where | What opens |
| --- | --- |
| **SimplySF2e** button in the **Actors** sidebar header | The generator (Monster, NPC, Encounters, Player Character, Reskin) |
| **Item Forge** button on its own row just below the **Items** sidebar header | The Item Forge |
| Chat: `/sf2e` or `/simplysf2e` | The generator |
| Chat: `/sf2e itemforge` | The Item Forge |
| Chat: `/sf2e welcome` | The welcome and setup check |
| Chat: `/sf2e [monster\|npc\|character\|encounter] [level] [description]` | The generator, pre-filled. Every part is optional, but they must come in that order, so a description that starts with a number is read as the level. Example: `/sf2e npc 4 street doc who patches up gang runners`. |
| Macro: `game.modules.get("simplysf2e").api.open()` / `.openItemForge()` / `.openWelcome()` | The generator / the Item Forge / the welcome window |

The chat command is not case-sensitive. It only pre-fills the form; nothing is generated until you press a button. A level outside the mode's range is clamped (−1 to 24 for Monster and NPC, 1 to 20 for Encounters and Player Character). Reskin has no chat shortcut.

## Using the generator

The window header shows the active connection and model, a **Compendium Content** line, and a **Fast picks: Jev** line. The Compendium line reads "Ready — N enabled packs", or tells you which categories are missing. The Jev line says whether fast picks are on (see [Fast picks (Jev)](#fast-picks-jev)).

Choose a mode with the buttons at the top: **Monster**, **NPC**, **Encounters**, **Player Character**, **Reskin**.

Every mode except Reskin has three ways to start:

- **Generate Monster / Generate NPC / Generate Encounter / Generate Character** generates **and creates** the result in one step, as long as everything in it matched real compendium content.
- **Preview Plan** generates the same thing but only shows a preview. Nothing is written to the world until you press **Create Actor** (or **Create All Actors** for an encounter). **Discard** throws the preview away.
- The **dice button** ignores your description and rolls a surprise concept at the chosen level. It always stops at the preview.

While a generation runs, a progress bar names each step and has a **Cancel generation** button. After each run the window shows token usage per step. Steps Jev can answer also show how long they took and which model answered.

**Advanced options** (a fold-out under the description) holds:

- **Preset**: a flavor guide for the AI. It offers the six Standard classes (Envoy, Mystic, Operative, Solarian, Soldier, Witchwarper), four Starfinder Archetypes (Corp Enforcer, Free Captain (Pirate), Street Cyberdoc, Bounty Hunter), and your own custom presets. **Manage Presets** lets you create, edit, duplicate, delete, export and import custom presets as JSON. Custom presets are saved in the world.
- **Rarity**: the creature's rarity. In Player Character mode this becomes **Rarity cap**, which excludes ancestries, backgrounds and heritages rarer than the cap.
- **Monster Adjustment**: **Normal**, **Elite (+1 Level)** or **Weak (-1 Level)** (not shown in Player Character or Encounter mode). It applies to single Monster and NPC generation.
- **Treasure amount**: **Stingy**, **Standard** or **Generous**.
- **Allow spellcasting**: untick it to keep spells off the result.
- In Encounters mode: **Party size** (1–8) and **Threat** (**Trivial**, **Low**, **Moderate**, **Severe**, **Extreme**).

### Monster and NPC

Use **Monster** for a creature (a "xenobiology specimen") and **NPC** for a person (a "personnel file"). Describe it under **Describe the creature** or **Describe the NPC**, then set **Level** (−1 to 24).

The AI chooses only descriptive scales such as "high AC" or "low HP". SimplySF2e turns those into numbers using the *Starfinder GM Core* Building Creatures tables. Spells, feats, abilities, equipment and loot are each picked from a short list of real compendium entries. The preview marks each pick:

- a check mark means it matched a real compendium item;
- **Narrative only** marks an ability the AI made up on purpose. It is flavor text with no mechanics, and it is allowed.

If the creature carries loot, **Reroll Loot** generates different loot without changing anything else. The dice next to a spell, feat or published ability swaps just that pick for a different compendium entry of the same kind (a spell keeps its rank and tradition); it costs one small AI call and never repeats a pick the creature already has. **Create Actor** makes the NPC actor, using art from the closest-matching creature in your Bestiary Actors packs. The finished panel reports how much came from the compendium. **Open Sheet** jumps to the new actor.

### Encounters

Set **Party level**, **Party size** and **Threat**, and optionally fill **Describe the encounter theme (optional)**. The AI designs a theme and a set of roles, and SimplySF2e then builds each member through the full creature pipeline. That means one AI round per creature, so encounters take longer and cost more tokens than a single monster.

The preview shows each member's level and role (**Boss**, **Minion**) with **Add one** / **Remove one (0 skips this creature)** counters. It also shows total treasure against the encounter's treasure budget, in credits. **Create All Actors** creates every member inside a new Actors folder named after the encounter. If any member fails, the whole batch and its folder are rolled back.

### Player Character

Fill **Describe the character** and set **Level** (1–20). Character generation is **complete-only**: it supports only the six published Starfinder 2e classes (Envoy, Mystic, Operative, Solarian, Soldier, Witchwarper). If none of them is available in your enabled packs, the generator says so.

SimplySF2e picks a real ancestry, heritage, background and class, plus feats, skills, equipment, starting wealth and (for Mystic and Witchwarper) spells. It puts them on a character actor, and the sf2e system works out AC, HP, saves and proficiencies itself. The preview shows **Skill priorities** and the picks with their match marks.

During creation, the system may open its own **choice dialogs** for options the module could not answer safely. Complete them to continue. Afterwards the generator shows **Character created — review**. It lists:

- the resulting skill proficiencies;
- equipment readiness (for example, an untrained weapon left stowed, or a ranged weapon whose ammunition you still need to load);
- any features that still have no recorded choice.

This report is a snapshot taken at creation time. It does not refresh when you edit the character, and it is not a full rules check.

### Reskin

Reskin gives an existing NPC new fiction without touching its numbers.

1. Choose **Reskin**.
2. Drag an NPC from the Actors sidebar or from a bestiary compendium onto the drop zone. Drop another one to replace it. Only NPC actors are accepted.
3. Describe the new look under **Reskin theme**.
4. Press **Reskin Creature**, or **Preview Plan** to review first.

The AI writes a new name, a read-aloud description and Recall Knowledge text, and may rename strikes and abilities. **Create Reskinned Copy** creates a new actor. Its statistics, rules, traits and items are copied unchanged, and the original creature is not modified.

## Using the Item Forge

Pick an **Item type**, fill **Describe the magic item**, and set **Item level** (1–24) and **Rarity**. Press **Generate** (press it again for a new version). Then press **Create Item**. The item lands in the Items directory, and you drag it onto a character sheet from there. The gear in the Compendium Content row at the top opens Compendium Sources.

| Item type | What you get |
| --- | --- |
| **Wondrous Item** | Passive effects copied from real published equipment of a suitable level and rarity, plus an optional once-per-day activated power. |
| **Augmentation** | An implanted item (tech, biotech, magitech or necrograft), built the same way as a wondrous item. |
| **Solarian Crystal** | A crystal for a solarian, with general passive effects. It does not change solar weapon damage. |
| **Weapon (upgrades)** | A real weapon from your equipment pack at a level-appropriate equipment grade (commercial, tactical, advanced, superior, elite, ultimate, paragon), with real upgrades installed. |
| **Armor (upgrades)** | The same, for a real armor item. |

Notes:

- Passive effects come only from real published items. If none survive the checks, the preview says the item will be flavor-only and suggests regenerating. If some effect kinds have no published source at your chosen level and rarity, the Forge lists them as not offered.
- An activated power is a pre-written script macro named "Activate: *item name*", stored in a **SimplySF2e Item Forge** macro folder and linked from the item's description by an **Activate** link. The item is limited to once per day, and its uses refill when the owner uses the system's Rest for the Night. Deleting the last copy of a forged item also deletes its macro.
- Prices preview in credits. The system recalculates the final price and level of graded weapons and armor itself.
- Only upgrades that install into any weapon or any armor are used. Upgrades restricted to particular weapon or armor traits are skipped.

## Credits and UPB

Generated loot and character wealth use Starfinder currency: **Credits** (as a Credstick item) and **UPB**. Both are copied from the templates bundled with the sf2e system. If the AI talks about gold, silver, copper or platinum, the amount is converted to credits at the system's rate (1 gp = 10 credits; 1 credit = 1 UPB = 1 sp). Treasure budgets and starting wealth are shown in credits.

Treasure per level follows the *Starfinder GM Core* Party Treasure table. Player-character starting wealth reuses the PF2e lump-sum table, converted to credits.

## What you still review by hand

SimplySF2e builds from real content and **fails closed**: when it cannot match something, it stops or leaves it out. It does not guess. That leaves some work for you:

- **Blocked creation.** Every required pick (feat, spell, ancestry, background, class, heritage) must match a real compendium entry. If any does not, creation stops with "Generation is incomplete; resolve required compendium content before creation", followed by the unmatched items. Nothing is created. Generate again, or check Compendium Sources. Abilities marked **Narrative only** do not block creation.
- **Skipped gear.** Equipment and loot are optional. An item with no published match is left off: the preview shows it struck through with a warning icon, the completion card counts it under "Skipped gear", and the console logs `skipped equipment "<name>": no published compendium match`. Skipped loot's value is made up in credits, so treasure stays on budget.
- **Choice dialogs.** The module answers the simpler system choices itself (for example, an option the concept already settles). Choices it cannot answer safely are left to the system's own prompts during or after creation.
- **Skills.** Skills use your concept's preferences first, then key-ability defaults. The review panel flags anything it could not settle safely: unclear grant timing, overlapping feat grants, native rules that change ranks, missing class data, or leftover training and increases. Duplicate feat grants are not reassigned automatically. This is not full prerequisite validation and not a level-by-level replay.
- **Feat prerequisites.** Ordinary prerequisites are checked conservatively. Free Archetype slot placement is checked, but the full archetype prerequisite chain is not.
- **Spells.** Review empty slots, signature spells and subclass or feat spell bonuses on casters after creation.
- **Upgrade slots.** The number of upgrade slots on forged weapons and armor (1 for weapons and 0 for armor when the item text names none) is a module default. No published source has been cited for it, and this is on hold.
- **Not built yet:** multiclass dedications, upgrade prerequisite checks, shields and ammunition in the Item Forge, and custom art.
- **Elite/Weak**, equipment grades, Reskin and every other feature are **untested in a live world**. This is Alpha.

## Troubleshooting

When a run fails, the red error box in the Generator or Item Forge has a **Copy bug report** button. It copies the error, the step that failed, your form values, the module settings and the module, system, Foundry and browser versions, ready to paste to the module author. It never includes an API key: it only says whether one is set, shows just the host of the endpoint, and masks anything key-shaped in the error text. It does include your description text. If the browser blocks the clipboard (a plain-http world opened from another machine), a window opens with the report selected so you can copy it by hand.

| Symptom | What to do |
| --- | --- |
| "SimplySF2e requires the Starfinder Second Edition (sf2e) game system." | The world uses another system. The module only runs in `sf2e` worlds, and its buttons are hidden elsewhere. |
| No buttons, or "Only a GM can use SimplySF2e generation and provider setup." | Log in as a GM. |
| "Required compendium content is unavailable: …" | A required category has no pack. Open **Configure compendium sources** (gear button) and pick a pack, or **Reset to defaults**. Make sure the sf2e system's packs are present. |
| "No usable NPC actor was available in the enabled Bestiary Actor sources." | Set a Bestiary Actors pack in Compendium Sources. Creature creation borrows art and structure from it. |
| "No API key is configured for this remote provider." | Add a key in AI Provider Setup, or switch to a local Ollama or LM Studio connection. |
| "Stored API key is not authorized for the current API Base URL and will not be sent." | The URL changed after the key was saved. Check the endpoint shown, then click **Authorize for this endpoint**, or re-enter the key and **Save & Authorize**. |
| "No model identifier is configured." | Enter a model in AI Provider Setup, or use **Load Models**. |
| An error from the provider with a status code (for example 401, 404, 429, 5xx) | 401/403: check the key and authorize it for this endpoint. 404: check the API Base URL and the exact model ID. 429: wait, or check your account's quota and billing. 5xx: the provider is having trouble, so retry shortly. |
| "Could not reach the AI provider: …" | Wrong URL, the server is not running, or (for local servers) CORS is not enabled. See the Ollama and LM Studio notes above. |
| "This Foundry page uses HTTPS, but the configured AI provider uses HTTP." | Browsers block this. Serve the provider over HTTPS, or open Foundry over HTTP on a trusted local network. |
| "The AI provider sent no data for N seconds and the request was aborted." | Check the model name and the provider's status. For a local model, make sure it is loaded and the server is not busy. Then retry, or raise **Request timeout (seconds)**. |
| "The AI ran out of tokens before finishing its answer" | Try a model with more efficient structured output, or shorten the description. Raise **Max response tokens** only if it is below the step's own cap. |
| "The AI returned reasoning but no JSON…", "not valid JSON", or "incomplete" | Generate again. If it keeps happening, switch to a stronger model, or one that puts its answer in the normal content field. An empty response is already retried once automatically. |

## Privacy

- **What is sent.** Each generation sends your description, the generator's own instructions, and lists of candidate compendium entries (spells, feats, equipment, abilities and so on, mostly by name with the details the AI needs to choose between them) to the provider of the active connection. A Reskin also sends the dropped creature's name, level, rarity, traits, blurb and the names of its strikes and abilities. Nothing else in the world is sent. A hosted provider's own data policy applies to what it receives. A local Ollama or LM Studio server keeps everything on your machine.
- **Where keys live.** API keys and the saved-connections list are stored in **client** scope, meaning in your own browser only. They are not synced to the world or to other users, and the normal settings screen never displays them. Each key is sent, as a bearer token, only to the exact endpoint it was authorized for. Because keys are per browser, a second GM, or you on another computer, must enter the key again.
- **What is shared with the world.** The active **API Base URL** and **Model** are **world** settings, so every client in the world can read them. Switching connections updates them for the world. Temperature, max tokens, timeout, Free Archetype, compendium sources and custom presets are also world settings.

## Status

**Alpha.** Identity `simplysf2e`, targeting system `sf2e` 1.5.0 or later, checked against 1.5.1 (Foundry 14.361+, verified 14.367). Live Foundry QA is still outstanding.

- Building Creatures and Treasure-by-Level numbers are cited against *Starfinder GM Core* pp. 116–128.
- Character generation covers all six published classes. Level 1 class paths (including Operative's specialization skill feat and Sniper's bonus feat) are settled before creation. Solarian has no level 1 path choice.
- Mystic and Witchwarper use cited SF2e spell-slot tables (3 base slots per rank, 5 cantrips, 10th-rank spell at level 19).
- Item Forge weapons and armor use SF2e equipment grades and installed upgrades. Grade names follow published `sf2e.equipment` names. Grade and upgrade assembly is unverified live.
- Forged items' daily uses refill when the owner uses Rest for the Night.

## Links

- Repository: https://github.com/simplyjaytea/simplySF2e
- Foundry: v14 (compat minimum 14.361)
- Game system: [`sf2e`](https://foundryvtt.com/packages/sf2e) 1.5.0 or later, checked against 1.5.1 (Starfinder Second Edition)
