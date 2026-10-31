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

- A `responses` entry may be `{ "sse": [<chunk objects or raw data: strings>] }` instead of a non-stream payload; the stub serves it as a real `text/event-stream` body. Streaming needs its own coverage because real providers stream (`stream: true`) and only the SSE reader exercises delta accumulation, the final-chunk `message.content` fallback, late usage and in-stream errors. Set `expect.streamed: true` so a fixture that silently falls back to JSON fails.
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
| `stream-creature-concept` | A full concept delivered as SSE deltas produces the same parsed concept as the non-stream fixture. |
| `stream-message-fallback` | A stream whose only answer is `message.content` on the final chunk is accepted via the fallback at `ai.mjs:1853`. |
| `negative-stream-truncated` | A stream ending `finish_reason: length` fails closed as `Truncated` after exactly one retry. |
| `negative-stream-error` | A mid-stream provider `error` record surfaces `ProviderError` and is not retried. |

Each negative fixture exists so that deleting the single validator check it targets turns the suite red; a payload that trips several checks at once would hide that.

## Recording real fixtures

`record.mjs` turns one real provider reply into a fixture, so the suite can carry recorded traffic instead of hand-authored stand-ins:

```
$env:SIMPLY_BASE_URL = "https://openrouter.ai/api/v1"
$env:SIMPLY_MODEL    = "<model id>"
$env:SIMPLY_API_KEY  = "<key>"

node tools/golden-replay/record.mjs --task creatureConcept --id live-creature-commander `
  --args '{"prompt":"a vesk siege marshal","level":5,"rarity":"common","allowSpellcasting":false,"intent":"monster"}' `
  --note "recorded from <model> on <date>"
```

It runs the real production function once, captures both streamed (SSE) and non-streamed replies, and writes a fixture with `expect: { ok: true, requestCount: 1 }`. The API key is never written to the file. Use `--out` to choose the path.

Recordable tasks are the ones with a direct production entry point and no must-be-issued candidates (`RECORDABLE` in `record.mjs`). Selector tasks need candidate arrays that only the live compendium can produce, so they are not recordable this way.

## What this cannot prove

Fixtures are **hand-authored stand-ins shaped like provider output**, not recorded live traffic. There is no live model call, so the suite cannot detect provider drift, latency, cost, or a model that stops obeying the schema. It proves the module's parsing, validation, grounding, normalization and fail-closed behavior for the payloads shown — nothing about a real provider.

Recording real fixtures per model and task is still outstanding. When that is added, keep the fixture shape above and set a `note` that names the model, the date, and the exact prompt.
