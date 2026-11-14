# Token bench

How many tokens one generation sends and receives, per AI call. It runs the **production** prompt builders (`scripts/ai.mjs`) and the real creature chain (`scripts/creature-pipeline.mjs`) against the cached sf2e packs, with `fetch` replaced by a scripted provider. Nothing is sent anywhere, no key is needed, and no production file is changed.

```
node tools/class-bench/fetch.mjs                 # once: fills the pack cache this bench reads
node tools/token-bench/measure.mjs               # a table per scenario
node tools/token-bench/measure.mjs --json out.json
node tools/token-bench/measure.mjs --scripts /path/to/other/checkout/scripts   # compare another version
node tools/token-bench/measure.mjs --verbose     # print every prompt and reply
```

- **Tokenizer.** Without options the module's own `estimateTokens()` is used (about 4 characters per token). For real counts install `gpt-tokenizer` anywhere outside the repo and run with `TOKENIZER=<path>/node_modules/gpt-tokenizer/esm/main.js` (o200k). Counts for other model families differ by a few percent; the comparison between two versions holds.
- **Replies are scripted** (`replies.mjs`): the same content every run, shaped to the schema the prompt shows. A prompt that asks for one-line JSON gets one-line JSON; a prompt that makes a key optional gets a reply without it. So the reply column compares two prompt versions. It does not measure a live model, which may ignore the one-line request.
- **Scenarios** (`SCENARIOS` in `measure.mjs`): a level 3 beast, a level 7 caster NPC with gear and loot, a severe encounter for four level 5 characters, the first three calls of a level 5 character, a level 6 shop, a level 6 treasure hoard. The character's feat, choice, spell and gear calls and the Item Forge are not covered (their orchestration is private to the app classes).

## 2026-11-14: before and after the token-cost pass

`gpt-tokenizer` o200k, sf2e 1.7.0 packs (`52dfeee`). "Before" is `main` at `f91b000`.

| Scenario | Calls | Prompt tokens | Reply tokens | Total |
| --- | --- | --- | --- | --- |
| Monster, level 3 | 2 → 2 | 3,675 → 3,528 (-4%) | 928 → 518 (-44%) | 4,603 → 4,046 (-12%) |
| NPC caster, level 7 | 7 → 6 | 8,947 → 7,893 (-12%) | 2,128 → 1,085 (-49%) | 11,075 → 8,978 (-19%) |
| Encounter, 3 creatures | 12 → 11 | 14,911 → 13,525 (-9%) | 3,324 → 1,722 (-48%) | 18,235 → 15,247 (-16%) |
| Character, first 3 calls | 3 → 3 | 7,331 → 4,167 (-43%) | 904 → 546 (-40%) | 8,235 → 4,713 (-43%) |
| Shop, level 6 | 2 → 2 | 1,147 → 1,108 (-3%) | 296 → 218 (-26%) | 1,443 → 1,326 (-8%) |
| Treasure, level 6 | 2 → 2 | 1,171 → 1,109 (-5%) | 185 → 131 (-29%) | 1,356 → 1,240 (-9%) |

Reply tokens usually cost three to five times as much as prompt tokens, so the cost falls further than the total: about 30% for the caster NPC at a 4:1 price ratio.

**If a model ignores the one-line request**, the reply savings shrink to what the leaner schema alone gives: reply tokens -16% to -18% for creatures and characters, 0% for shop and treasure; totals -7% (monster), -13% (caster NPC), -11% (encounter), -41% (character), -5% (shop), -7% (treasure).

What changed, largest first:

1. **Heritages follow the first-draft ancestry** (`heritagesForDraftAncestry`): the ancestry and class request sent all 342 heritages; it now sends the drafted ancestry's own plus the versatile ones. 4,896 → 1,735 prompt tokens.
2. **One-line JSON** (`COMPACT_JSON_NOTE`, appended in `requestJSON`): indentation was about half of a concept reply.
3. **No dead fields in the concept**: draft gear is a list of names, loot has no draft price, and empty keys inside senses, strikes and abilities are left out. Production resolves gear and loot only from issued candidates, so the draft price was never read.
4. **Spell themes ride on the concept** (`spellcasting.keywords`): the separate spell focus request runs only when a draft carries none.
5. **Catalogs**: `E12 Laser Pistol` in place of `E12 | Laser Pistol (L3)`, with the item level written once per line (`weapon L3: ...`).
6. **Shorter GM-priority rule** on the grounding steps, which repeat it in every request of a run.

Not changed, on purpose: the candidate ceilings (120 items, 96 spells, 96 abilities), which decide how much real choice the model gets; the description sent to the grounding steps; any model, temperature or token cap.
