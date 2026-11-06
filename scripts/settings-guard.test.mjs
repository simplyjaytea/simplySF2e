// withProviderConnectionGuard is re-entrant: nested calls share one guard that
// lifts only when the outermost call ends, even when an inner call throws.
// Run: node scripts/settings-guard.test.mjs
import assert from "node:assert/strict";
import { withProviderConnectionGuard, isApplyingProviderConnection } from "./settings.mjs";

assert.equal(isApplyingProviderConnection(), false, "idle at start");

await withProviderConnectionGuard(async () => {
  assert.equal(isApplyingProviderConnection(), true, "outer call holds the guard");
  await withProviderConnectionGuard(async () => {
    assert.equal(isApplyingProviderConnection(), true, "nested call holds the guard");
  });
  assert.equal(isApplyingProviderConnection(), true, "guard still held after the nested call ends");
});
assert.equal(isApplyingProviderConnection(), false, "lifted when the outermost call ends");

// An inner throw must not leave the guard stuck on or drop it early.
await assert.rejects(withProviderConnectionGuard(async () => {
  await withProviderConnectionGuard(async () => { throw new Error("inner failed"); }).catch((err) => {
    assert.equal(err.message, "inner failed");
    assert.equal(isApplyingProviderConnection(), true, "outer still holds the guard after an inner failure");
  });
  throw new Error("outer failed");
}), /outer failed/);
assert.equal(isApplyingProviderConnection(), false, "lifted after a failed outer call");

// Overlapping (not nested) calls: the guard holds until both have ended.
let releaseFirst;
const first = withProviderConnectionGuard(() => new Promise((resolve) => { releaseFirst = resolve; }));
const second = withProviderConnectionGuard(async () => {});
await second;
assert.equal(isApplyingProviderConnection(), true, "held while the first overlapping call still runs");
releaseFirst();
await first;
assert.equal(isApplyingProviderConnection(), false, "lifted once every overlapping call has ended");

console.log("settings-guard.test.mjs: ok");
