# U3 copy worksheet (plan §2 row U3)

Docs only. Nothing in `lang/en.json`, templates, scripts or CSS is changed by this file. Each row is a proposal for JT or the copy worker to apply in U3.

Base: `next` (`lang/en.json` as on the U3-PREP branch). U2 branches read for current text:

- U2-GEN: changes `Generator.NoApiKey` and `Generator.ApiKeyNotAuthorized` (both excluded from this sweep by instruction) and adds `ShellConsistency` and `Generator.ReskinBasedOn`. None of the keys below.
- U2-SHOPS: changes `Treasure.Each` to "about {each} credits per character, party of {count}". `Treasure.Each` is not in the U3 audit list, so no row here; noted for the copy worker.
- U2-SETUP: no `lang/en.json` change. No `(U2-x)` tag is needed for any row below.

Conventions used in the proposals:

- Sentence case. Uppercase stays a CSS effect on HUD labels only (`text-transform`), never in the string.
- Plurals: the repo has no plural keys. The existing pattern is count-first wording with the noun after the number, e.g. `"Showing {shown} of {total} packs"` (`lang/en.json` Sources block), `"Earlier changes ({count})"` (WhatsNew), `"To review ({count})"` (Sheet). Proposals follow it.
- Strings that carry a number, cost or safety statement are not shortened: `Treasure.Dropped` keeps its count and its "left out" fact; `ProviderSetup.Privacy` is not in scope.
- "layout: re-shoot <fixture>" marks any proposal that lengthens text in a row, a button or a chip. Fixture names are from `tools/ui-preview/fixtures/`.
- "(new key)" marks a key that does not exist yet. The rule is no new keys unless a hard-coded template string must move. Rows that would need one are flagged in their note and listed in the least-sure section.

---

## S6. Casing: sentence case (audit `docs/ui-audit-2026-11-08.md` S6; A8, B24, C9)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `Generator.CompendiumContent` | Compendium Content | Compendium content | Generator readiness row (`generator.hbs:46` area); Forge, Shop, Treasure readiness rows (U2-SHOPS) | layout: re-shoot generator-monster-preview (same width, no change expected) |
| `ItemForge.CreateItem` | Create Item | Create item | `itemforge.hbs` primary button | none |
| `Presets.New` | New Preset | New preset | Manage Presets header and empty-state text (`manage-presets.hbs`; F5 row refers to it) | keep F5 wording in step with this key |
| `Presets.ExportAll` | Export All | Export all | Manage Presets footer | none |
| `Presets.ManageTitle` | Manage Custom Presets | Manage custom presets | Manage Presets window title | none |
| `Generator.Title` | SimplySF2e — Generator | SimplySF2e Generator | window title | unify with the other titles (audit #24); drops the em dash |
| `ItemForge.Title` | SimplySF2e — Item Forge | SimplySF2e Item Forge | window title | unify with Shop and Treasure (audit #24) |
| `Shop.Title` | SimplySF2e Shop | SimplySF2e Shop | window title | already the target form; no change |
| `Treasure.Title` | SimplySF2e Treasure | SimplySF2e Treasure | window title | already the target form; no change |

## S7. Plurals (audit S7; A19, B25)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `Shop.Dropped` | {count} pick(s) were not on the offered list and were left out. | Picks left out: {count}. They were not on the offered list. | Shop preview note (`shop.hbs:166`) | count-first pattern; keeps the count |
| `Treasure.Dropped` | {count} pick(s) were not offered, had no price, or did not fit the budget, and were left out. | Picks left out: {count}. They were not offered, had no price, or did not fit the budget. | Treasure preview note (`treasure.hbs:179`) | count-first pattern; keeps the count and all three reasons |

## S14. Busy fallback (audit S14; A18, B34)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `Generator.Busy` | Consulting the forge... | Waiting for the AI provider… | progress card fallback (`_progress.hbs:31`), used by Generator, Forge, Shop, Treasure | status, not flavour; the fallback shows only when no step message exists |

## G8. Mode names (audit G8)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `Mode.Character` | Player Character | Character | Generator mode tile (`generator.hbs:110`); recent rows (`generator-app.mjs:2434`) | layout: re-shoot generator-monster-preview (tile wraps today; shorter text removes the wrap) |
| `Mode.Encounter` | Encounters | Encounter | Generator mode tile (`generator.hbs:106`); recent rows | matches the singular used in the mode hint; none for layout |

## G9. Mode hints and tooltips say what the control does (audit G9)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `Mode.MonsterHint` | Xenobiology specimen | One creature with stats and abilities | Monster tile tooltip (`generator.hbs:96`) | least sure: confirm the mode's output before shipping |
| `Mode.NpcHint` | Personnel file | One named NPC with a personality | NPC tile tooltip (`generator.hbs:100`) | least sure (same as above) |
| `Mode.EncounterHint` | Tactical ops engagement | A group of creatures sized to the party | Encounters tile tooltip (`generator.hbs:104`) | none |
| `Mode.CharacterHint` | Spacefarer operative | One playable character | Character tile tooltip (`generator.hbs:108`) | none |
| `Mode.ReskinHint` | New fiction, same stat block | Copy an existing creature with new names and fiction | Reskin tile tooltip (`generator.hbs:112`) | none |
| `Generator.RandomTooltip` | Random creature: ignores the description and invents something at this level. Every click rolls a new surprise. | Random creature: ignores the description and invents one at this level. | Random button tooltip (`generator-app.mjs:300-304` picks it) | drops the filler sentence |

## G12. Readiness text (audit G12)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `Generator.SourcesReady` | Ready — {packCount} enabled packs | {packCount} enabled packs | readiness detail row (`generator.hbs:46`) | "Ready" already shows in the summary line; `1 enabled packs` is awkward, accepted by the repo's count-first pattern |

## F2. Next steps and wrong references (audit `docs/archive/ui-audit-2026-11-08/forge-shop-treasure.md` F2)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `ItemForge.NoEffects` | No usable passive effects survived validation — the item will be created as flavor-only. Press Generate again for a mechanical version. | No usable passive effects survived validation, so the item will be flavour-only. Press Generate another version for a mechanical one. | Forge preview warning (`itemforge.hbs:168`) | names the visible button (preview state label) |
| `Shop.AllRemoved` | Every item was removed. Generate again to restock. | Every item was removed. Press Generate another shop to restock. | Shop warning (`shop.hbs:163`) | names the visible button |
| `Shop.NoStock` | The AI picked nothing from the offered items. Generate again. | The AI picked nothing from the offered items. Press Generate another shop. | Shop error (thrown in `shop-app.mjs:269`, shown in `#error`) | names the visible button |
| `Treasure.NoItems` | Nothing fit the budget. Generate again. | Nothing fit the budget. Press Generate another hoard. | Treasure error (`treasure-app.mjs:312, 356, 359`) | names the visible button; also used for the credstick case |

## F3. Wrong references (audit F3)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `Shop.NoCandidates` | No equipment of this level, type and rarity was found in your compendiums. Try a higher level or rarity. | No equipment at this level and rarity was found in your compendiums. Raise Rarest stock or Shop level, or enable more packs in Compendium Sources. | Shop error (`shop-app.mjs:233`) | drops "type" (no type control); names the two controls and the packs fix |
| `Treasure.NoCandidates` | No equipment of this level and rarity was found in your compendiums. Try a higher level or rarity. | No equipment at this party level and rarity was found in your compendiums. Raise Rarest item, or enable more packs in Compendium Sources. | Treasure error (`treasure-app.mjs:260`) | does not tell the GM to change the party level, because that also changes the budget |

## F4. Next step for unavailable kinds (audit F4)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `ItemForge.KindsUnavailable` | No supported published passive effects match this level and rarity for: {kinds}. These effect kinds are not offered. | No supported published passive effects match this level and rarity for: {kinds}. These effect kinds are not offered. Raise the item level or rarity to offer them. | Forge unavailable note (`itemforge-app.mjs:125`) | keeps `{kinds}`; no number changes; layout: re-shoot itemforge-wondrous-no-effects |

## F5. Manage Presets empty state (audit F5)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `Presets.ManageEmpty` | No custom presets yet. Press New Preset to create one, or Import to load a file. | No custom presets yet. Press New preset to create one, or Import to paste exported preset JSON. | Manage Presets empty state (`manage-presets.hbs:25`) | the Import dialog asks for pasted JSON (`Presets.ImportHint`); the button name follows the S6 casing change |

## F11. Placeholders get "e.g." and per-kind text (audit F11)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `Shop.PromptPlaceholder` | A cramped weapons stall on Absalom Station run by a retired soldier who only sells what she has field-tested. | e.g. A cramped weapons stall on Absalom Station run by a retired soldier who only sells what she has field-tested. | Shop prompt textarea (`shop.hbs:52`) | layout: re-shoot shop-empty (placeholder wraps) |
| `Treasure.PromptPlaceholder` | Abandoned corporate lab on an ice moon | e.g. Abandoned corporate lab on an ice moon | Treasure prompt textarea (`treasure.hbs:101`) | layout: re-shoot treasure-empty |
| `ItemForge.Kind*Placeholder` (new keys, one per kind) | one placeholder for all kinds: "e.g. A scorched visor…" | Weapon: e.g. A pistol with a scorch mark and a cracked grip. Armor: e.g. Scarred plating with a salvaged shield module. Augmentation: e.g. A cybernetic hand with a built-in scanner. Crystal: e.g. A solar crystal that hums near hot metal. | Forge prompt (`itemforge.hbs:65`) | needs new keys and a `placeholder` field per `kinds[]` entry (U5 wiring, `docs/ui-contract.md` entry). Violates the no-new-keys rule as written: flagged for JT |

## F13. Row tooltips in Manage Presets (audit F13)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `Presets.DuplicateRowTooltip` (new key) | the selected preset (shared `Presets.DuplicateTooltip`) | Duplicate this preset | Manage Presets row button (`manage-presets.hbs:11`) | new key; violates the no-new-keys rule as written: flagged for JT |
| `Presets.DeleteRowTooltip` (new key) | the selected preset (shared `Presets.DeleteTooltip`) | Delete this preset | Manage Presets row button (`manage-presets.hbs:17`) | new key; flagged for JT |

## W3. Provider notes (audit W3)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `Welcome.LiveCheckPending` | Live check pending | Not yet tested | Google provider note (`welcome.hbs:15`; `welcome-app.mjs:121`) | the muted style is CSS (U4 or U5); copy only here |
| `Welcome.Recommended` | Recommended | Recommended | provider note (`welcome.hbs:15`) | unchanged label |
| `Welcome.RecommendedWhy` (new key) | none (tooltip missing) | Recommended: one key covers the most models in the setup list. | tooltip on the Recommended note | new key, and the claim is unverified: least sure, see below |

## W5. Connection error (audit W5)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `Welcome.ErrorTitle` | We couldn't connect | Connection failed | error block title (`welcome.hbs:80`) | the auth hint that points away from Welcome is wiring (U5), not copy |

## W6. Setup-window buttons and fast picks (audit W6)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `Welcome.FastPicks` | (existing key; value not re-read in this pass) | Fast picks | heading above the Jev hint and the Set Up buttons (`welcome.hbs:92-94`) | the buttons sit under their own heading, not under "Optional fast picks"; confirm the existing value before applying |

See "Hard-coded strings to move" for the two literal labels in the same block.

## W8. Numbered legends (audit W8)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `Welcome.ChooseProvider` | 1. Choose a provider | Provider | Welcome legend (`welcome.hbs:9`) | reused by W10 as the visible group label |
| `Welcome.ConnectLegend` | 2. Connect | Connection | Welcome legend (`welcome.hbs:31`) | the numbers were a wizard cue; least sure whether the order is still clear without them |

## W10. Visible group label for provider presets (audit W10)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `Welcome.ChooseProvider` | 1. Choose a provider (legend only) | Provider (visible label, linked with `aria-labelledby`) | the six preset buttons (`welcome.hbs:9-15`) | same key as W8; render it visibly; layout: re-shoot welcome-fresh |

## W11. Save buttons explained (audit W11)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `ProviderSetup.FooterHint` (new key) | none | Save & Test saves the connection, runs a test and closes. Save & Authorize saves the connection and allows the stored key for this endpoint. | footer of AI Provider Setup (`provider-setup.hbs:152` area) | new key; the two sentences must be checked against both handlers before use (least sure below) |

## W12. Saved-key line (audit W12)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `ProviderSetup.JevKeySaved` | A Jev key is saved — leave blank to keep it | A Jev key is saved. Leave the field blank to keep it. | visible hint under the Jev key field (new `.spf-hint`, from the placeholder text) | layout: re-shoot provider-setup-fresh (hint line added) |
| `ProviderSetup.ApiKeySaved` | A key is saved — leave blank to keep it | A key is saved. Leave the field blank to keep it. | visible hint under the API key field | layout: re-shoot provider-setup-fresh |

## W16. Sources with no packs (audit W16)

| key | current text | proposed text | shown in | note |
|---|---|---|---|---|
| `Sources.NonePacksFound` | No compendium packs with matching content were found in this world. | No compendium packs with matching content were found in this world. Install an SF2e or homebrew compendium pack, then reopen this window. | empty state (`sources.hbs:5`) | next step added; layout: re-shoot sources-no-packs |

The audit also asks the intro to stop saying "Choose the packs…" in this state, and to disable Reset when `noPacks` is true. Both are template or wiring changes, not copy (see U5), so not listed here.

---

## Hard-coded strings to move

| template:line | current text | proposed key | proposed value | note |
|---|---|---|---|---|
| `welcome.hbs:91` | LM Studio (button label) | `Welcome.LmStudio` (new key) | LM Studio | product name; keep as is if JT prefers brand names untranslated |
| `welcome.hbs:94` | Jev · TypeSafe (fast-picks hint) | `Welcome.JevTypeSafe` (new key) | Jev · TypeSafe | the middle dot stays; W6 moves it under its own heading |

---

## Least sure (for the coordinator to decide)

1. **G9 mode hints** (`Mode.MonsterHint`, `Mode.NpcHint`): the proposed descriptions state what each mode produces, which I took from the mode names and the generator's modes, not from running them. Check against the real output before shipping.
2. **W3 `Welcome.RecommendedWhy`**: the proposed claim ("covers the most models in the setup list") is not verified against the provider list. It is a new key and a factual claim; drop it if it cannot be checked.
3. **W11 `ProviderSetup.FooterHint`**: the two sentences are my reading of `#onSaveAndTest` (saves, tests, closes) and of the Save & Authorize button. The Save & Authorize handler was not read in this pass. Also, the Save & Test button key was not found under the name I expected, so check which key that button uses.
4. **F11 and F13 new keys** (`ItemForge.Kind*Placeholder`, `Presets.DuplicateRowTooltip`, `Presets.DeleteRowTooltip`): these break the no-new-keys rule. They need JT's OK, or they move to U5 with a `docs/ui-contract.md` entry.
5. **W8 numbered legends**: dropping "1." and "2." removes the order cue. "Provider" then "Connection" may read as parallel choices, not steps. JT may prefer to keep the numbers and fix only the casing.

---

## Count table

| measure | count |
|---|---|
| audit items covered (S6, S7, S14, G8, G9, G12, F2, F3, F4, F5, F11, F13, W3, W5, W6, W8, W10, W11, W12, W16) | 20 |
| existing keys with a proposed change | 37 |
| new keys proposed | 10 |
| hard-coded strings to move | 2 |
| layout re-shoots (distinct fixtures) | 8 |

Existing keys changed, by item: S6 7 (Shop.Title and Treasure.Title already have the target form and are not counted), S7 2, S14 1, G8 2, G9 6, G12 1, F2 4, F3 2, F4 1, F5 1, F11 2, F13 0, W3 1 (Welcome.Recommended stays as is), W5 1, W6 1 (Welcome.FastPicks, value to confirm), W8 2 (Welcome.ChooseProvider is also used by W10 and counted once, under W8), W10 0, W11 0, W12 2, W16 1. Total 37.

New keys: ItemForge.Kind*Placeholder (Weapon, Armor, Augmentation, Crystal: 4), Presets.DuplicateRowTooltip and Presets.DeleteRowTooltip (2), Welcome.RecommendedWhy (1), ProviderSetup.FooterHint (1), Welcome.LmStudio and Welcome.JevTypeSafe (2). Total 10. Each new key needs JT's OK under the no-new-keys rule (see least sure, item 4).

Layout re-shoots (distinct fixtures): generator-monster-preview, itemforge-wondrous-no-effects, shop-empty, treasure-empty, welcome-fresh, welcome-advanced, provider-setup-fresh, sources-no-packs.
