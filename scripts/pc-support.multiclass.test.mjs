// Test Multiclass Dedication resolution in PC pipeline
// Run: node scripts/pc-support.multiclass.test.mjs

import assert from "node:assert/strict";
import {
  SF2E_MULTICLASS_DEDICATIONS,
  getMulticlassDedicationSlug,
  COMPLETE_PC_CLASS_SLUGS
} from "./pc-support.mjs";

for (const cls of COMPLETE_PC_CLASS_SLUGS) {
  const dedication = getMulticlassDedicationSlug(cls);
  assert.ok(dedication, `Every complete SF2e class has a multiclass dedication: ${cls}`);
  assert.equal(dedication, `${cls}-dedication`);
}

assert.equal(getMulticlassDedicationSlug("wizard"), null, "Unsupported class returns null");
assert.equal(getMulticlassDedicationSlug(""), null, "Empty string returns null");
assert.equal(getMulticlassDedicationSlug(null), null, "Null returns null");

console.log("pc-support.multiclass.test.mjs: multiclass dedication mappings verified for all 6 SF2e classes");
