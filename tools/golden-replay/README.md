# Golden replay suite

Offline harness that replays recorded-shaped provider payloads through the **production** AI pipelines. It reports; it changes no production file. No API key, no network, no Foundry.

```
node scripts/golden-replay.test.mjs
```

The test is discovered by the normal CI loop (`scripts/*.test.mjs`), so it gates every pull request without a workflow change. Runtime is a few seconds.

## How it works

- `env.mjs` installs a stub `game` (settings + i18n) and replaces `globalThis.fetch` with a scripted queue of provider payloads. Every call is captured; an unscripted call fails the run.
- `replay.mjs` maps a fixture's `task` to the real export in `scripts/ai.mjs` and calls it with the fixture's `args`. For selector tasks it passes `jevConfig: null`, because the Jev fast pick is a second network path and must never run in a replay.
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
    "lengths": { "strikes": 2 },
    "nothingPicked": false,
    "bodyContains": ["text that must appear in the request body"],
    "errorKey": "Errors.BadStructure"
  }
}
```

`ok: false` means production must fail closed; pair it with `errorKey`. A retryable failure is retried once by `requestJSON`, so expect `requestCount: 2` for those.

## Current coverage

| Fixture | Proves |
| --- | --- |
| `creature-concept` | Full concept passes the shape validator and normalizer; scale words and object shapes survive. |
| `ability-selection` | Bestiary actions resolve only from the issued catalog; an unissued id is dropped. |
| `creature-feat-selection` | Feats are capped at the draft wishlist, resolved by id, and de-duplicated. |
| `equipment-selection` | Equipment resolves by id, quantity is clamped, an unissued id is dropped. |
| `magic-item-concept` | Item concept passes with enum-only `bulk`/`usage` and no invented numbers. |
| `encounter-design` | Exactly one brief per fixed slot, in slot order. |
| `negative-truncated` | A length-truncated reply fails closed after exactly one retry. |
| `negative-missing-key` | A valid-JSON reply with missing keys fails the shape check, never reaching Create. |
| `negative-forged-candidates` | A reply naming only unissued ids resolves to nothing: no pick is invented. |

## What this cannot prove

Fixtures are **hand-authored stand-ins shaped like provider output**, not recorded live traffic. There is no live model call, so the suite cannot detect provider drift, latency, cost, or a model that stops obeying the schema. It proves the module's parsing, validation, grounding and fail-closed behavior for the payloads shown — nothing about a real provider.

Recording real fixtures per model and task is still outstanding. When that is added, keep the fixture shape above and set a `note` that names the model and date.
