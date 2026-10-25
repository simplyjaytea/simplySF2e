#!/usr/bin/env node
// Which sf2e feat prerequisite clauses can scripts/pc-prerequisites.mjs NEVER prove?
// Every feat in sf2e.feats is tested against a maximal staged actor (all skills
// legendary, every ability 30, every item/feature name in every pack possessed).
// A clause that still fails is unreadable to the parser, not merely unmet.
//   node tools/class-bench/audit-prereqs.mjs
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
import { loadPacks, installFoundry } from "./env.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, "cache");
const { packs } = await loadPacks(CACHE);
installFoundry({ packs, state: { freeArchetype: false } });
const pre = await import(pathToFileURL(join(HERE, "..", "..", "scripts", "pc-prerequisites.mjs")).href);
const { CORE_SKILLS } = await import(pathToFileURL(join(HERE, "..", "..", "scripts", "pc-skills.mjs")).href);

const feats = packs.get("sf2e.feats").docs.filter((d) => d.type === "feat");
const everything = [...packs.values()].flatMap((p) => p.docs.map((d) => ({ name: d.name })));
const maximal = pre.stagedActorContext({
  level: 20, skills: Object.fromEntries(CORE_SKILLS.map((s) => [s, 4])),
  abilities: { str: 30, dex: 30, con: 30, int: 30, wis: 30, cha: 30 }, features: everything
});
const FAMILIES = [
  ["ability score written \"Charisma +2\" / \"Wis +2\"", /^(str|dex|con|int|wis|cha)[a-z]*\s*\+\d+/i],
  ["ability inside an OR (\"Wis +2 or ability to cast ...\")", /(str|dex|con|int|wis|cha)[a-z]*\s*\+\d+/i],
  ["\"<name> heritage\"", /heritage$/i],
  ["\"<name> exocortex\"", /exocortex$/i],
  ["\"<name> programming language\"", /programming language$/i],
  ["spellcasting / class-feature description", /cast|spell|class feature|pool|bond/i]
];
const byCategory = {};
const unreadable = {};
for (const feat of feats) {
  const cat = (byCategory[feat.system.category] ??= { feats: 0, noPrerequisites: 0, provableAtMax: 0, unprovable: [] });
  cat.feats++;
  const list = feat.system.prerequisites?.value ?? [];
  if (!list.length) cat.noPrerequisites++;
  if (pre.featPrerequisitesMet(feat, maximal)) { cat.provableAtMax++; continue; }
  cat.unprovable.push(feat.name);
  for (const entry of list) {
    if (pre.featPrerequisitesMet({ system: { prerequisites: { value: [entry] } } }, maximal)) continue;
    const family = FAMILIES.find(([, re]) => re.test(entry.value.trim()))?.[0] ?? "other";
    (unreadable[family] ??= []).push(`${feat.system.category}:${feat.name} <= ${JSON.stringify(entry.value)}`);
  }
}
const out = { byCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, { ...v, unprovable: v.unprovable.length }])), families: Object.fromEntries(Object.entries(unreadable).map(([k, v]) => [k, v.length])) };
console.log(JSON.stringify(out, null, 1));
await writeFile(join(CACHE, "prereq-audit.json"), JSON.stringify({ byCategory, unreadable }, null, 1));
console.log("examples per family: tools/class-bench/cache/prereq-audit.json");
