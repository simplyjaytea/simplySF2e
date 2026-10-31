# Golden Replay Suite

Offline harness that runs production AI pipelines against hand-authored provider payloads.

Run: `node scripts/golden-replay.test.mjs`

Add a fixture: drop a JSON file in `fixtures/` matching the documented shape; it is auto-discovered.

## What this cannot prove
Fixtures are hand-authored stand-ins, not recorded live traffic. There is no live model call, so it cannot detect provider drift, latency, or cost. Recording real fixtures is still outstanding.