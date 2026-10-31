# Provider/model matrix

Measures **pass rate per task per model** against a live endpoint. This is the instrument for the "model and provider drift" risk: rerun it before a stable release and compare the table.

**Manual tool.** It needs a real API key, it is never run in CI, and `tools/` never ships in the release zip.

## Run it

```
$env:MATRIX_API_KEY = "<key>"
node tools/model-matrix/matrix.mjs --config tools/model-matrix/config.example.json
```

Options: `--task <id>` (one task), `--runs N` (repeat each task; use 3+ for a stability read), `--out <dir>` (default `out`).

The key is read from the environment variable **named in the config** (`apiKeyEnv`). It is never written to a report, a log, or an error. With the variable unset the tool prints one line and exits non-zero before any request.

## Config

```json
{
  "baseUrl": "https://openrouter.ai/api/v1",
  "apiKeyEnv": "MATRIX_API_KEY",
  "models": [{ "id": "deepseek/deepseek-chat" }, { "id": "openai/gpt-5-mini" }],
  "tasks": ["creatureConcept", "pcConcept", "magicItemConcept", "encounterDesign"],
  "runs": 1,
  "pricePerMTok": { "deepseek/deepseek-chat": { "input": 0.28, "output": 0.42 } }
}
```

`pricePerMTok` is USD per million tokens and is optional; without an entry the cost column reads `n/a` rather than guessing.

## Tasks

`tasks.mjs` holds one fixed, realistic argument set per task, using the real production signature: `creatureConcept`, `pcConcept`, `spellFocus`, `magicItemConcept`, `encounterDesign`, `shopConcept`, `treasureConcept`. A task id the module does not know stops the run before any request.

`scripts/model-matrix.test.mjs` calls every entry against a stubbed provider and fails on a `TypeError`, so a signature drift shows up as a test failure instead of a phantom "this model is bad" row.

## Reading the report

`out/MATRIX.md` has one table per task and one row per model:

| model | runs | pass | fail | fail keys | median ms | avg tokens | est. cost/run |
|---|---|---|---|---|---|---|---|

- **Pass** means the production function returned without throwing. It validates its own reply shape, so a pass is a real success, not "the HTTP call worked".
- **Fail keys** are `SIMPLYSF2E.Errors.*` keys. Any other provider text is reported as `redacted`, so a key or an account detail cannot reach the file.
- **est. cost/run** prices the provider's own prompt and completion counts separately; it is an estimate, not a bill.

`out/matrix.json` holds every raw run (model, task, run index, ok, error key, crash flag, ms, usage).

## What this cannot prove

- One run per model per task is a point sample, not a distribution. Use `--runs 3` before drawing a conclusion.
- It measures the fixed prompt in `tasks.mjs`, not every prompt shape; a model can pass here and still fail a specific GM request.
- It covers concept and design tasks. Selector tasks need candidate arrays that only a live compendium can produce, so they are measured indirectly (a model that cannot follow the concept schema will also fail selection).
- No Foundry: nothing is created, no Rule Element runs, no sheet is checked.
