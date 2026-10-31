# Golden replay suite

Offline harness that replays recorded-shaped provider payloads through the **production** AI pipelines. It reports; it changes no production file. No API key, no network, no Foundry.

```
node scripts/golden-replay.test.mjs
```

The test is discovered by the normal CI loop (`scripts/*.test.mjs`), so it gates every pull request without a workflow change. Runtime is a couple of seconds.

## How it works

- `env.mjs` installs a stub `game` (settings + i18n) and replaces `globalThis.fetch` with a scripted queue of provider payloads. Every call is captured; an unscripted call fails the run.
- `replay.mjs` maps a fixture's `task` to the real export in `scripts/ai.mjs` and calls it with the fixture's `args`. `normalizeConcept` is the exception: it is the real export from `scripts/builder.mjs` and runs on an already-parsed object, so the normalizer is covered too. For selector tasks the runner passes `jevConfig: null`, because the Jev fast pick is a second network path and must never run in a replay.
- `scripts/golden-replay.test.mjs` walks `fixtures/*.json` (no hardcoded list), runs each fixture twice for determinism, and asserts the fixture's `expect` block.

## Fixture format

```json
{
  "id": "unique-scenario-id",
  "task": "creatureConcept",
  "note": "what this scenario proves",
  "args": { "...": "real arguments for the production function" },
  "responses": [
    { "choices": [ { "message": { "content": "{...}" }, "finish_reason": "stop" } ],
      "usage": { "prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2 } }
  ],
  "expect": {
    "ok": true,
    "requestCount": 1,
    "contains": ["text that must appear in the result"],
    "excludes": ["text that must not appear"],
    "equals": { "concept.size": "med" },
    "lengths": { "concept.strikes": 2 },
    "nothingPicked": false,
    "bodyContains": ["text that must appear in the request body"],
    "errorKey": "Errors.BadStructure"
  }
}
```

- `equals` / `lengths` keys are dotted paths into the result.
- `ok: false` means production must fail closed; pair it with `errorKey`. A retryable failure is retried once by `requestJSON`, so expect `requestCount: 2` for those.
- A negative fixture can name a `base` fixture plus `remove: [...]` and/or `patch: {...}`. The loader starts from the base's known-good payload, applies exactly that one change, and repeats it for `responses.length` (default 2). That keeps every negative case a single-variable test.

## Current coverage

| Fixture | Proves |
| --- | --- |
| `creature-concept` | A full concept passes the shape validator with the schema's own shapes (strikes, abilities, equipment, loot) and a Credits loot entry as `lootGuide()` asks. |
| `normalizer-fallbacks` | `normalizeConcept` applies its fallbacks: default name, invalid size/HP/AC scales, nearest published speed, default strike. |
| `ability-selection` | Bestiary actions resolve only from the issued catalog; an unissued id is dropped. |
| `creature-feat-selection` | Feat picks are capped at the draft wishlist length and resolved only from the issued catalog, filtering before the cap. |
| `creature-feat-dedupe` | A repeated id resolves once. |
| `equipment-selection` | Equipment resolves by id, quantity clamps to 1-10 (both ends), an unissued id is dropped. |
| `magic-item-concept` | An item concept passes with an in-enum `bulk` and the offered `usage`. |
| `encounter-design` | Exactly one brief per fixed slot, in slot order, with extra briefs discarded. |
| `negative-truncated` | A length-truncated reply fails closed after exactly one retry. |
| `negative-missing-field` | One missing required key fails the presence check. |
| `negative-traits-not-array` | A scalar where an array is required fails the array check. |
| `negative-scales-not-object` | An array where an object is required fails the object check. |
| `negative-empty-name` | An empty required string fails the non-empty-string check. |
| `negative-bad-bulk` | An out-of-enum `bulk` fails the enum check. |
| `negative-short-brief-list` | A short brief list still yields one brief per slot via the module's slot fallback. |
| `negative-forged-candidates` | A reply naming only unissued ids resolves to nothing: no pick is invented. |

Each negative fixture exists so that deleting the single validator check it targets turns the suite red; a payload that trips several checks at once would hide that.

## What this cannot prove

Fixtures are **hand-authored stand-ins shaped like provider output**, not recorded live traffic. There is no live model call, so the suite cannot detect provider drift, latency, cost, or a model that stops obeying the schema. It proves the module's parsing, validation, grounding, normalization and fail-closed behavior for the payloads shown — nothing about a real provider.

Recording real fixtures per model and task is still outstanding. When that is added, keep the fixture shape above and set a `note` that names the model, the date, and the exact prompt.
