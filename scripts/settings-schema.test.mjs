// Settings schema: pending migration selection (pure). Migrations run in
// migrateSettings() on ready; this file tests only the ordering and bounds.
// Run: node scripts/settings-schema.test.mjs
import assert from "node:assert/strict";
import { SETTINGS, SETTINGS_SCHEMA, SETTINGS_MIGRATIONS, pendingSettingsMigrations } from "./settings.mjs";

const a = { version: 1, run: () => {} };
const b = { version: 2, run: () => {} };
const c = { version: 3, run: () => {} };
const steps = [c, a, b];

// Schema is versioned and the setting key is registered by name.
assert.equal(SETTINGS_SCHEMA, 1);
assert.equal(SETTINGS.settingsSchema, "settingsSchema");
// No steps today: schema 1 is the first versioned layout.
assert.deepEqual(SETTINGS_MIGRATIONS, []);

// Fresh world (0) with two steps up to 2: both, oldest first.
assert.deepEqual(pendingSettingsMigrations(0, 2, steps), [a, b]);
// Already at 1: only the later step.
assert.deepEqual(pendingSettingsMigrations(1, 3, steps), [b, c]);
// Current version is inclusive, steps above it are not run.
assert.deepEqual(pendingSettingsMigrations(0, 2, [a, c]), [a]);
// Up to date: nothing to run.
assert.deepEqual(pendingSettingsMigrations(3, 3, steps), []);
// Stored above current (a downgrade): nothing runs.
assert.deepEqual(pendingSettingsMigrations(5, 3, steps), []);
// Missing or non-numeric stored value counts as 0.
assert.deepEqual(pendingSettingsMigrations(undefined, 1, [a]), [a]);
assert.deepEqual(pendingSettingsMigrations(NaN, 1, [a]), [a]);
// Empty step list (the shipped state).
assert.deepEqual(pendingSettingsMigrations(0, SETTINGS_SCHEMA), []);
// Input order does not matter and the input array is not reordered.
assert.deepEqual(pendingSettingsMigrations(0, 3, steps), [a, b, c]);
assert.deepEqual(steps, [c, a, b]);

console.log("settings-schema.test.mjs: ok");
