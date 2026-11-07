# Provider/model matrix

Measures **pass rate per task per model** against a live endpoint. This is the instrument for the "model and provider drift" risk: rerun it before a stable release and compare the table.

**Manual tool.** It needs a real API key, it is never run in CI, and `tools/` never ships in the release zip.

## Run it (hosted)

```bash
export MATRIX_API_KEY="<key>"
node tools/model-matrix/matrix.mjs --config tools/model-matrix/config.example.json
```

Options: `--task <id>` (one task), `--runs N` (repeat each task; use 3+ for a stability read), `--out <dir>` (default `out`).

The key is read from the environment variable **named in the config** (`apiKeyEnv`). It is never written to a report, a log, or an error. With the variable unset the tool prints one line and exits non-zero before any request.

## Run it against a local Ollama (`--local`)

`--local` runs the configured tasks against **every installed model** the local server lists (`GET <url>/models`). No API key is needed, and none is ever sent to the local server. Local models are free, so the cost column reads `n/a`; no price is invented. The `models` list in the config is ignored in local mode; the installed models replace it.

Run it on the machine where Ollama runs (Node 22+ and a clone of the repo):

```bash
node tools/model-matrix/matrix.mjs --config tools/model-matrix/config.example.json --local
```

The default URL is `http://localhost:11434/v1`. Use `--local-url <url>` for another address.

To run it from the VPS, reach your Ollama through an SSH tunnel. Run this on your own machine (replace `<vps-address>`):

```bash
ssh -R 11434:localhost:11434 root@<vps-address>
```

That makes your local Ollama reachable on the VPS at `http://localhost:11434`. Then, on the VPS:

```bash
node tools/model-matrix/matrix.mjs --config tools/model-matrix/config.example.json --local --local-url http://localhost:11434/v1
```

The matrix is not a browser, so Ollama needs no `OLLAMA_ORIGINS` setting for it. If the server cannot be reached, lists no models, or answers an error, the tool prints one line and exits non-zero. Models you have not pulled are not tested.

## Config

```json
{
  "baseUrl": "https://openrouter.ai/api/v1",
  "apiKeyEnv": "MATRIX_API_KEY",
  "models": [
    { "id": "deepseek/deepseek-v4.1-flash" },
    { "id": "openai/gpt-5.4-mini" },
    { "id": "anthropic/claude-haiku-5.5" }
  ],
  "tasks": ["creatureConcept", "pcConcept", "magicItemConcept", "encounterDesign"],
  "runs": 1,
  "pricePerMTok": {
    "deepseek/deepseek-v4.1-flash": { "input": 0.05, "output": 0.57 },
    "openai/gpt-5.4-mini": { "input": 0.75, "output": 4.50 },
    "anthropic/claude-haiku-5.5": { "input": 0.10, "output": 0.50 }
  }
}
```

`pricePerMTok` is USD per million tokens and is optional; without an entry the cost column reads `n/a` rather than guessing. The prices above are OpenRouter's prices on 2026-11-07. **Prices change:** check them again before you compare cost. The config JSON has no comments, so this note lives here.

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
- **crash** in the fail-keys column means the harness or a production function threw a non-AI error — that is a bug to fix, not a model result, and the tool exits non-zero.

`out/matrix.json` holds every raw run (model, task, run index, ok, error key, crash flag, ms, usage).

## What this cannot prove

- One run per model per task is a point sample, not a distribution. Use `--runs 3` before drawing a conclusion.
- It measures the fixed prompt in `tasks.mjs`, not every prompt shape; a model can pass here and still fail a specific GM request.
- It covers concept and design tasks. Selector tasks need candidate arrays that only a live compendium can produce, so they are measured indirectly (a model that cannot follow the concept schema will also fail selection).
- No Foundry: nothing is created, no Rule Element runs, no sheet is checked.
