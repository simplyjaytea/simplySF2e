#!/usr/bin/env node
// Offline Item Forge bench. Runs the REAL forge code paths (scripts/item-builder.mjs,
// rule-templates.mjs, runes.mjs, macro-templates.mjs) against the real sf2e
// equipment JSON in the class-bench cache, for every Forge kind x level x rarity,
// and prints a findings matrix. Run tools/class-bench/fetch.mjs first.
//   node tools/pipeline-bench/forge.mjs [--only weapon-graded,wondrous-passive] [--levels 1,3]
//        [--rarities common,uncommon] [--verbose]
//
// The AI is replaced by a deterministic stub that picks the first valid offered
// candidate. The stub never emits a number (checked per run); the forge supplies
// every number. The Forge's private orchestration in itemforge-app.mjs
// (#generateWondrous, #generateRuned, #onCreateItem) is not importable, so this
// bench repeats its call sequence in the same order; the functions it calls are real.
// It fixes nothing and changes no production file.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadPacks, installFoundry } from "../class-bench/env.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, "..", "class-bench", "cache");
const SCRIPTS = join(HERE, "..", "..", "scripts");
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const LEVELS = flag("levels", "1,3,5,8,13,18").split(",").map(Number);
const RARITIES = flag("rarities", "common,uncommon").split(",");
const ONLY = flag("only")?.split(",");
const VERBOSE = args.includes("--verbose");

// ---------------------------------------------------------------- Foundry surface
const { system, packs } = await loadPacks(CACHE);
installFoundry({ packs, state: { freeArchetype: false } });
const source = (await readFile(join(CACHE, "SOURCE.txt"), "utf8")).split("\n")[0];

// Globals the forge touches beyond what class-bench/env.mjs fakes.
game.i18n.format = (key, data = {}) => `${key} ${JSON.stringify(data)}`;
game.folders = [];
let itemCounter = 0;
const setPath = (obj, path, value) => {
  const keys = path.split(".");
  let at = obj;
  for (const key of keys.slice(0, -1)) at = (at[key] ??= {});
  at[keys.at(-1)] = value;
};
class FakeItem {
  constructor(data) {
    Object.assign(this, structuredClone(data));
    this.id = `forge${String(++itemCounter).padStart(4, "0")}`;
    this.uuid = `Item.${this.id}`;
  }
  getFlag(scope, key) { return this.flags?.[scope]?.[key]; }
  async update(changes) {
    for (const [path, value] of Object.entries(changes)) setPath(this, path, structuredClone(value));
    return this;
  }
}
const macros = [];
globalThis.Item = { create: async (data) => new FakeItem(data) };
globalThis.Macro = {
  create: async (data) => {
    const macro = { ...data, uuid: `Macro.m${macros.length + 1}` };
    macros.push(macro);
    return macro;
  }
};
globalThis.Folder = { create: async (data) => ({ id: "folder1", ...data }) };

const { KIND_USAGE, AUGMENTATION_CATEGORIES, GRADE_LEVELS, normalizeMagicItemConcept, buildMagicItemData, priceForLevel,
  getUsageOptions, normalizeRunedItemConcept, buildRunedItem } = await load("item-builder.mjs");
const { getForgeEffectCatalog } = await load("rule-templates.mjs");
const { getBaseItemCandidates, getPropertyRuneCandidates, getFundamentalRuneTiers, getGradeTiers,
  EQUIPMENT_GRADES, WEAPON_UPGRADE_USAGES, ARMOR_UPGRADE_USAGES, PROJECTILE_UPGRADE_USAGE, PROJECTILE_WEAPON_GROUP,
  propertyRuneFitsBase } = await load("runes.mjs");
const { createActivationMacro } = await load("macro-templates.mjs");
const { RARITY_RANK } = await load("compendium.mjs");

async function load(name) { return import(pathToFileURL(join(SCRIPTS, name)).href); }

// Console capture: every console.warn the forge emits lands in the current case.
let warnings = [];
const realWarn = console.warn;
console.warn = (...parts) => warnings.push(parts.map((p) => (p instanceof Error ? p.message : String(p))).join(" ").replace(/^simplysf2e \| /, ""));
const out = (...parts) => process.stdout.write(`${parts.join(" ")}\n`);
console.log = console.info = console.debug = () => {};

// ---------------------------------------------------------------- source data (cache)
const equipmentDocs = packs.get("sf2e.equipment").docs;
const equipmentById = packs.get("sf2e.equipment").byId;
const PUBLISHED_GRADES = new Set(equipmentDocs.map((d) => d.system?.grade).filter(Boolean));
const docFor = (type, name) => equipmentDocs.find((d) => d.type === type && d.name === name) ?? null;
const sourceDocFor = (uuid) => {
  const m = /^Compendium\.sf2e\.equipment\.Item\.(.+)$/.exec(String(uuid));
  return m ? equipmentById.get(m[1]) ?? null : null;
};
/** Key-order-independent JSON, so a clone compares equal to its source object. */
const canon = (value) => JSON.stringify(value, (_k, v) => (v && typeof v === "object" && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]])) : v));
const numberLeaves = (value, path = "") => {
  if (typeof value === "number") return [path || "(root)"];
  if (Array.isArray(value)) return value.flatMap((v, i) => numberLeaves(v, `${path}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => numberLeaves(v, path ? `${path}.${k}` : k));
  return [];
};
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

// ---------------------------------------------------------------- AI stub (never a number)
const ITEM_TEXT = { name: "Bench Item", description: "Bench <b>item</b> text.\n\nSecond paragraph." };
const SHOT_NAME = "Bench <img src=x onerror=alert(1)> \"Wand\" & Co";
const pickUsage = (usageOptions) => usageOptions.find((u) => u.startsWith("worn")) ?? usageOptions[0];
const distinctKinds = (catalog, n) => {
  const seen = new Set();
  const out = [];
  for (const e of catalog) {
    if (seen.has(e.kind)) continue;
    seen.add(e.kind);
    out.push(e);
    if (out.length === n) break;
  }
  return out;
};
/** A raw effect the AI would write: an enum/scale pick, copied from an offered catalog entry. */
function rawEffect(e, scale) {
  const base = { kind: e.kind, scale };
  if (e.kind === "itemBonus") return { ...base, statistic: e.statistic };
  if (e.kind === "sense" || e.kind === "speed") return { ...base, type: e.type };
  return { ...base, damageType: e.damageType };
}
const groupOf = (name, type) => docFor(type, name)?.system?.group ?? null;
const GRADE_LABEL = /\((Commercial|Tactical|Advanced|Superior|Elite|Ultimate|Paragon)\)/i;

const VARIANTS = [
  {
    id: "wondrous-passive", family: "magic", kind: "wondrous", label: "wondrous, passive effects",
    stub: ({ catalog, usageOptions }) => {
      const picks = distinctKinds(catalog, 2);
      if (!picks.length) return { na: "no published passive effect at this level and rarity" };
      return { raw: { ...ITEM_TEXT, usage: pickUsage(usageOptions), invested: true, effects: picks.map((e, i) => rawEffect(e, i ? "high" : "low")) } };
    }
  },
  {
    id: "wondrous-1day-damage", family: "magic", kind: "wondrous", label: "wondrous, 1/day damage",
    stub: ({ usageOptions }) => ({ raw: { ...ITEM_TEXT, name: SHOT_NAME, usage: pickUsage(usageOptions), activation: { template: "damage", actionCost: "two", params: { damageType: "fire", saveType: "reflex", basicSave: true } } } })
  },
  {
    id: "wondrous-1day-condition", family: "magic", kind: "wondrous", label: "wondrous, 1/day condition",
    stub: ({ usageOptions }) => ({ raw: { ...ITEM_TEXT, name: SHOT_NAME, usage: pickUsage(usageOptions), activation: { template: "condition", actionCost: "single", params: { conditionSlug: "frightened", saveType: "will", duration: "round" } } } })
  },
  {
    id: "wondrous-1day-heal", family: "magic", kind: "wondrous", label: "wondrous, 1/day heal",
    stub: ({ usageOptions }) => ({ raw: { ...ITEM_TEXT, name: SHOT_NAME, usage: pickUsage(usageOptions), activation: { template: "heal", actionCost: "single", params: {} } } })
  },
  {
    id: "wondrous-1day-selfbuff", family: "magic", kind: "wondrous", label: "wondrous, 1/day self-buff",
    stub: ({ catalog, usageOptions }) => {
      const picks = distinctKinds(catalog, 1);
      if (!picks.length) return { na: "no published passive effect to grant at this level and rarity" };
      return { raw: { ...ITEM_TEXT, name: SHOT_NAME, usage: pickUsage(usageOptions), activation: { template: "selfBuff", actionCost: "free", params: { effectName: "Bench Effect", description: "Bench <i>effect</i>.", duration: "minute", ruleEffectKinds: [rawEffect(picks[0], "low")] } } } };
    }
  },
  {
    id: "augmentation", family: "magic", kind: "augmentation", label: "augmentation (biotech)",
    stub: ({ catalog }) => ({ raw: { ...ITEM_TEXT, category: "biotech", invested: true, effects: distinctKinds(catalog, 1).map((e) => rawEffect(e, "low")) } })
  },
  {
    id: "crystal", family: "magic", kind: "crystal", label: "Solarian crystal",
    stub: ({ catalog }) => ({ raw: { ...ITEM_TEXT, effects: distinctKinds(catalog, 1).map((e) => rawEffect(e, "low")) } })
  },
  {
    // The brief's stub: first offered base (non-projectile), first offered grade, up to two fitting upgrades.
    id: "weapon-graded", family: "runed", kind: "weapon", label: "weapon, first grade + upgrades",
    stub: ({ baseCandidates, runeCandidates, grades }) => {
      const base = baseCandidates.filter((c) => groupOf(c.name, "weapon") !== PROJECTILE_WEAPON_GROUP)[0];
      if (!base) return { na: "no non-projectile base weapon" };
      const group = groupOf(base.name, "weapon");
      const upgrades = runeCandidates.filter((u) => propertyRuneFitsBase("weapon", u.usage, group)).slice(0, 2).map((u) => u.name);
      return { raw: { ...ITEM_TEXT, baseItemName: base.name, grade: grades[0], upgrades } };
    }
  },
  {
    // Highest-level non-projectile base <= level at the highest offered grade, up to two fitting upgrades.
    id: "weapon-top-grade", family: "runed", kind: "weapon", label: "weapon, top grade + upgrades",
    stub: ({ baseCandidates, runeCandidates, grades }) => {
      const base = baseCandidates.filter((c) => groupOf(c.name, "weapon") !== PROJECTILE_WEAPON_GROUP).at(-1);
      if (!base) return { na: "no non-projectile base weapon" };
      const group = groupOf(base.name, "weapon");
      const upgrades = runeCandidates.filter((u) => propertyRuneFitsBase("weapon", u.usage, group)).slice(0, 2).map((u) => u.name);
      return { raw: { ...ITEM_TEXT, baseItemName: base.name, grade: grades.at(-1), upgrades } };
    }
  },
  {
    id: "weapon-projectile", family: "runed", kind: "weapon", label: "projectile weapon + projectile upgrade",
    stub: ({ baseCandidates, runeCandidates, grades }) => {
      const base = baseCandidates.filter((c) => groupOf(c.name, "weapon") === PROJECTILE_WEAPON_GROUP).at(-1);
      const upgrade = runeCandidates.find((u) => u.usage === PROJECTILE_UPGRADE_USAGE);
      if (!base) return { na: "no projectile-group base weapon at this level" };
      if (!upgrade) return { na: "no projectile-only upgrade at this level" };
      return { raw: { ...ITEM_TEXT, baseItemName: base.name, grade: grades.at(-1), upgrades: [upgrade.name] } };
    }
  },
  {
    // First base that is itself published at a non-commercial grade (e.g. "Caramel Cannon", tactical), at the first grade.
    id: "weapon-published-grade", family: "runed", kind: "weapon", label: "weapon already published at a grade",
    stub: ({ baseCandidates, grades }) => {
      const base = baseCandidates.find((c) => {
        const grade = docFor("weapon", c.name)?.system?.grade;
        return Boolean(grade) && grade !== "commercial";
      });
      if (!base) return { na: "no pre-graded base weapon at this level" };
      return { raw: { ...ITEM_TEXT, baseItemName: base.name, grade: grades[0] } };
    }
  },
  {
    // Negative control: a projectile-only upgrade on a non-projectile base must be dropped, never installed.
    id: "weapon-projectile-misfit", family: "runed", kind: "weapon", label: "projectile upgrade on non-projectile base (must drop)",
    expectWarn: /cannot be installed/,
    stub: ({ baseCandidates, runeCandidates, grades }) => {
      const base = baseCandidates.filter((c) => groupOf(c.name, "weapon") !== PROJECTILE_WEAPON_GROUP).at(-1);
      const upgrade = runeCandidates.find((u) => u.usage === PROJECTILE_UPGRADE_USAGE);
      if (!base) return { na: "no non-projectile base weapon" };
      if (!upgrade) return { na: "no projectile-only upgrade at this level" };
      return { raw: { ...ITEM_TEXT, baseItemName: base.name, grade: grades.at(-1), upgrades: [upgrade.name] } };
    }
  },
  {
    id: "armor-graded", family: "runed", kind: "armor", label: "armor, first grade + upgrade",
    stub: ({ baseCandidates, runeCandidates, grades }) => {
      const base = baseCandidates[0];
      if (!base) return { na: "no base armor at this level" };
      const upgrades = runeCandidates.filter((u) => ARMOR_UPGRADE_USAGES.has(u.usage)).slice(0, 1).map((u) => u.name);
      return { raw: { ...ITEM_TEXT, baseItemName: base.name, grade: grades[0], upgrades } };
    }
  },
  {
    id: "armor-top-grade", family: "runed", kind: "armor", label: "armor, top grade + upgrade",
    stub: ({ baseCandidates, runeCandidates, grades }) => {
      const base = baseCandidates.at(-1);
      if (!base) return { na: "no base armor at this level" };
      const upgrades = runeCandidates.filter((u) => ARMOR_UPGRADE_USAGES.has(u.usage)).slice(0, 1).map((u) => u.name);
      return { raw: { ...ITEM_TEXT, baseItemName: base.name, grade: grades.at(-1), upgrades } };
    }
  }
];

// ---------------------------------------------------------------- case runners
/** The orchestration of itemforge-app #generateWondrous + #onCreateItem, in the same order. */
async function runMagic(v, level, rarity, rec, check, step) {
  const kind = v.kind;
  step("templates");
  const fixedUsage = KIND_USAGE[kind];
  const catalog = (await getForgeEffectCatalog(level, rarity)).filter((e) => !fixedUsage || !e.exemplar?.requiresInvestment);
  const availableKinds = [...new Set(catalog.map((e) => e.kind))];
  const usageOptions = await getUsageOptions(kind);
  step("concept");
  const plan = v.stub({ catalog, usageOptions });
  if (plan.na) return { na: plan.na };
  check(numberLeaves(plan.raw).length === 0, `stub emitted numbers at ${numberLeaves(plan.raw).join(", ")} (bench bug: the AI never emits numbers)`);
  step("assemble");
  const concept = normalizeMagicItemConcept(plan.raw, { level, rarity, availableKinds, effectCatalog: catalog, usageOptions, kind });
  check(concept.level === level, `concept level ${concept.level} != GM level ${level}`);
  check(concept.kind === kind, `concept kind ${concept.kind} != ${kind}`);
  const benchPrice = await priceForLevel(concept.level, concept.rarity);
  const data = await buildMagicItemData(concept);
  step("create");
  const item = await Item.create(data);
  check(Boolean(item?.id), "Item.create returned no id");
  const traits = data.system.traits.value;

  // Price, level, usage and traits.
  check(Number.isFinite(data.system.price.value.gp) && data.system.price.value.gp >= 0, "price is not a finite gp value");
  check(data.system.price.value.gp === benchPrice, `price ${data.system.price.value.gp} != priceForLevel ${benchPrice}`);
  check(data.system.level.value === level, `system.level ${data.system.level.value} != ${level}`);
  if (kind === "augmentation") {
    const cats = AUGMENTATION_CATEGORIES.filter((c) => traits.includes(c));
    check(cats.length === 1, `augmentation has ${cats.length} category traits (want exactly 1)`);
    check(data.system.usage.value === "implanted", `augmentation usage "${data.system.usage.value}"`);
  } else {
    if (kind === "crystal") check(data.system.usage.value === "other", `crystal usage "${data.system.usage.value}"`);
    else check(usageOptions.includes(data.system.usage.value), `usage "${data.system.usage.value}" was not offered`);
    check(traits.includes("magical"), "non-augmentation item is not tagged magical");
  }
  if (traits.includes("invested")) check(data.system.usage.value.startsWith("worn"), "invested item is not worn");
  check(!traits.includes("augmentation"), "forbidden trait 'augmentation' present");
  check(!/<b>/.test(data.system.description.value) && /&lt;b&gt;/.test(data.system.description.value), "AI description not escaped");

  // Passive rules: each must be an unchanged clone of a real sf2e.equipment rule.
  check(data.system.rules.length === concept.effects.length, `rules ${data.system.rules.length} != effects ${concept.effects.length}`);
  concept.effects.forEach((effect, i) => {
    const src = sourceDocFor(effect.exemplar.sourceUuid);
    const srcRule = src?.system?.rules?.find((r) => canon(r) === canon(effect.exemplar.rule));
    check(src, `effect ${effect.kind}: source ${effect.exemplar.sourceUuid} is not in sf2e.equipment`);
    check(srcRule, `effect ${effect.kind}: rule is not identical to any rule of "${effect.exemplar.sourceName}"`);
    check(canon(data.system.rules[i]) === canon(effect.exemplar.rule), `effect ${effect.kind}: created rule differs from its exemplar`);
    check(effect.exemplar.sourceLevel <= level, `effect ${effect.kind}: source level ${effect.exemplar.sourceLevel} > ${level}`);
    check(RARITY_RANK[effect.exemplar.sourceRarity] <= RARITY_RANK[rarity], `effect ${effect.kind}: source rarity ${effect.exemplar.sourceRarity} above ${rarity}`);
    if (effect.exemplar.requiresInvestment) check(traits.includes("invested") && data.system.usage.value.startsWith("worn"), `effect ${effect.kind} needs investment but item is not invested`);
    if (src) rec.detail.push(`rule ${i}: ${effect.kind} = "${src.name}" (${effect.exemplar.sourceUuid})`);
  });

  if (!concept.activation) return { data, concept };

  // Activation: 1/day counter, native frequency, and one companion macro.
  const forge = data.flags?.simplysf2e?.forge;
  check(forge?.uses?.value === 1 && forge?.uses?.max === 1 && forge?.uses?.per === "day", "activation counter is not 1/day");
  check(data.system.frequency?.max === 1 && data.system.frequency?.per === "day", "native frequency is not 1/day");
  step("macro");
  const macro = await createActivationMacro({ item, concept });
  check(Boolean(macro), "createActivationMacro returned no macro");
  if (macro) {
    const command = macro.command;
    try { new AsyncFunction(command); } catch (err) { check(false, `macro body does not compile: ${err.message}`); }
    check(!command.includes("<img"), "macro body contains raw <img from the item name (not escaped)");
    check(command.includes("&lt;img"), "macro body does not carry the escaped item name");
    check(/@UUID\[Macro\./.test(item.system.description.value), "item description has no @UUID Macro link");
    if (concept.activation.template === "selfBuff") {
      const embedded = /^const RULES = (.*);$/m.exec(command);
      check(embedded, "selfBuff macro has no RULES constant");
      const rules = embedded ? JSON.parse(embedded[1]) : [];
      const want = concept.activation.params.ruleEffectKinds;
      check(rules.length === want.length, `selfBuff RULES ${rules.length} != ${want.length}`);
      want.forEach((effect, i) => {
        const src = sourceDocFor(effect.exemplar.sourceUuid);
        check(src?.system?.rules?.some((r) => canon(r) === canon(rules[i])), `selfBuff RULES[${i}] is not a rule of a real sf2e.equipment item`);
      });
    }
    rec.detail.push(`macro "${macro.name}" ${command.length} chars`);
  }
  return { data, concept };
}

async function runRuned(v, level, rarity, rec, check, step) {
  const kind = v.kind;
  step("templates");
  const [baseCandidates, runeCandidates, tiers, gradeTiers] = await Promise.all([
    getBaseItemCandidates(kind, level), getPropertyRuneCandidates(kind, level),
    getFundamentalRuneTiers(kind, level), getGradeTiers(kind, level)
  ]);
  step("concept");
  const plan = v.stub({ baseCandidates, runeCandidates, grades: gradeTiers.grades });
  if (plan.na) return { na: plan.na };
  check(numberLeaves(plan.raw).length === 0, `stub emitted numbers at ${numberLeaves(plan.raw).join(", ")} (bench bug)`);
  step("assemble");
  const concept = normalizeRunedItemConcept(plan.raw, {
    kind, rarity, baseCandidates, runeCandidates, grades: gradeTiers.grades,
    potencyTiers: tiers.potencyTiers, secondaryTiers: tiers.secondaryTiers
  });
  const built = await buildRunedItem(concept);
  const { itemData: data, preview } = built;
  const baseDoc = docFor(kind, concept.baseItemName);
  const baseGroup = baseDoc?.system?.group ?? null;
  const baseCandidate = baseCandidates.find((c) => c.name === concept.baseItemName);
  const grade = data.system.grade;

  check(baseDoc && !baseDoc.system?.specific, `base "${concept.baseItemName}" is not an ordinary sf2e.equipment ${kind}`);
  // Grade: a published grade, offered at this level, and not above the level.
  check(PUBLISHED_GRADES.has(data.system.grade), `grade "${data.system.grade}" is not a grade on any sf2e.equipment item`);
  check(EQUIPMENT_GRADES.includes(data.system.grade) && gradeTiers.grades.includes(data.system.grade), `grade "${data.system.grade}" was not offered at level ${level}`);
  check((GRADE_LEVELS[kind][data.system.grade] ?? 0) <= level, `grade "${data.system.grade}" needs level ${GRADE_LEVELS[kind][data.system.grade]} > ${level}`);
  check(preview.level <= level, `preview level ${preview.level} > ${level}`);
  // Runes are zeroed: the grade replaces them and the system derives price/level.
  check(data.system.runes.potency === 0 && data.system.runes.property.length === 0, "legacy runes not zeroed");
  // Module-written price/level: none are assigned here, but toItemData copies the base's values onto the item.
  if (data.system.price !== undefined || data.system.level !== undefined) {
    rec.warns.push("system.price and system.level copied from base item onto graded item (item-builder.mjs:299 toItemData); PLAYBOOK §7 says never write them");
  }
  // Installed upgrades: only usages the forge offers, only where the real base accepts them.
  const slots = baseCandidate?.upgradeSlots ?? 0;
  const subs = data.system.subitems ?? [];
  check(subs.length <= slots, `${subs.length} upgrades installed, forge slot count ${slots}`);
  // The slot cap in normalizeRunedItemConcept breaks without a warning: a requested upgrade past the cap vanishes.
  const requested = plan.raw.upgrades ?? [];
  if (requested.length > concept.upgrades.length && !warnings.some((w) => /dropped/.test(w))) {
    rec.warns.push("upgrade requested beyond the base's slot count is dropped with no warning (item-builder.mjs:237)");
  }
  // A base published at a non-commercial grade (runes.mjs getBaseItemCandidates lists it as an ordinary base) is re-graded.
  if (baseDoc?.system?.grade && baseDoc.system.grade !== "commercial") {
    rec.warns.push("base item is itself published at a non-commercial grade; the forge overwrites system.grade (item-builder.mjs:301)");
  }
  // A base whose published name already carries a grade label gets a second one from the forge.
  if (grade !== "commercial" && GRADE_LABEL.test(baseDoc?.name ?? "")) {
    rec.warns.push("base name already has a grade label and the forge adds another (item-builder.mjs:327-337)");
  }
  rec.detail.push(`name "${data.name}"`);
  for (const sub of subs) {
    const usage = sub.system?.usage?.value;
    check(WEAPON_UPGRADE_USAGES.has(usage) || ARMOR_UPGRADE_USAGES.has(usage) || usage === PROJECTILE_UPGRADE_USAGE,
      `upgrade "${sub.name}" usage "${usage}" is not an offered upgrade usage`);
    check(propertyRuneFitsBase(kind, usage, baseGroup), `upgrade "${sub.name}" (${usage}) does not fit ${kind} group ${baseGroup}`);
    check((sub.system?.level?.value ?? 0) <= level, `upgrade "${sub.name}" level above ${level}`);
    check(runeCandidates.some((c) => c.name === sub.name), `upgrade "${sub.name}" was not an offered candidate`);
    rec.detail.push(`upgrade "${sub.name}" (${usage}) on ${baseDoc?.name} [group ${baseGroup}]`);
  }
  check(data.name.includes(baseDoc?.name ?? "?"), `item name "${data.name}" lost its base name`);
  check(!/<b>/.test(data.system.description.value) && /&lt;b&gt;/.test(data.system.description.value), "AI description not escaped");
  rec.detail.push(`grade ${data.system.grade}, ${subs.length} upgrade(s), preview level ${preview.level}`);
  return { data, concept };
}

async function runCase(v, level, rarity) {
  warnings = [];
  const rec = { variant: v.id, level, rarity, status: null, stage: null, fails: [], warns: [], detail: [], na: null };
  const check = (ok, msg) => { if (!ok) rec.fails.push(msg); };
  const step = (name) => { rec.stage = name; };
  try {
    const result = v.family === "magic"
      ? await runMagic(v, level, rarity, rec, check, step)
      : await runRuned(v, level, rarity, rec, check, step);
    if (result.na) rec.na = result.na;
  } catch (err) {
    rec.fails.push(`throw@${rec.stage}: ${err.message}`);
    if (VERBOSE) realWarn(`[${v.id} L${level} ${rarity}]`, err.stack);
  }
  const unexpected = warnings.filter((w) => !(v.expectWarn && v.expectWarn.test(w)));
  if (v.expectWarn && !warnings.some((w) => v.expectWarn.test(w)) && !rec.na && !rec.fails.length) {
    rec.fails.push("expected the forge to drop the misfit upgrade with a warning; no warning was raised");
  }
  rec.warns.push(...unexpected);
  rec.warns = [...new Set(rec.warns)];
  rec.status = rec.na ? "n/a" : rec.fails.length ? "FAIL" : rec.warns.length ? "WARN" : "PASS";
  return rec;
}

// ---------------------------------------------------------------- run + matrix
const selected = VARIANTS.filter((v) => !ONLY || ONLY.includes(v.id));
const results = [];
for (const v of selected) {
  for (const level of LEVELS) {
    for (const rarity of RARITIES) results.push(await runCase(v, level, rarity));
  }
}

const cell = (rec) => (rec.status === "WARN" ? `WARN(${rec.warns.length})` : rec.status === "FAIL" ? `FAIL(${rec.fails.length})` : rec.status === "n/a" ? "n/a" : rec.status);
const columns = LEVELS.flatMap((l) => RARITIES.map((r) => ({ level: l, rarity: r, label: `L${l} ${r.slice(0, 2)}` })));
const header = ["variant", ...columns.map((c) => c.label)];
const rows = selected.map((v) => [v.id, ...columns.map((c) => {
  const rec = results.find((r) => r.variant === v.id && r.level === c.level && r.rarity === c.rarity);
  return rec ? cell(rec) : "-";
})]);
const table = [header, header.map(() => "---"), ...rows].map((r) => `| ${r.join(" | ")} |`).join("\n");
const tally = results.reduce((t, r) => ((t[r.status] = (t[r.status] ?? 0) + 1), t), {});
const summary = `source ${source} (sf2e ${system.version}); ${results.length} cases: ${Object.entries(tally).map(([k, n]) => `${n} ${k}`).join(", ")}`;

const causes = {};
for (const rec of results) {
  for (const msg of rec.fails) (causes[`FAIL ${msg.replace(/"[^"]*"/g, '"..."').replace(/\d+/g, "#")}`] ??= []).push(`${rec.variant} L${rec.level} ${rec.rarity}`);
  for (const msg of rec.warns) (causes[`WARN ${msg.replace(/"[^"]*"/g, '"..."')}`] ??= []).push(`${rec.variant} L${rec.level} ${rec.rarity}`);
}
const breakdown = Object.entries(causes).sort((a, b) => b[1].length - a[1].length)
  .map(([tag, cases]) => `${String(cases.length).padStart(3)} cases  ${tag}`).join("\n");
const naList = [...new Set(results.filter((r) => r.na).map((r) => `${r.variant}: ${r.na}`))].join("\n");

console.warn = realWarn;
const report = `${table}\n\n${summary}\n\nWhat each non-PASS case hit (a case can hit several):\n${breakdown || "(none)"}\n\nn/a (nothing to test at that level):\n${naList || "(none)"}\n`;
out(report);
await writeFile(join(CACHE, "forge-results.json"), JSON.stringify({ source, system: system.version, results }, null, 1));
await writeFile(join(CACHE, "forge-matrix.md"), report);
out("full per-case detail: tools/class-bench/cache/forge-results.json");
if (VERBOSE) for (const rec of results.filter((r) => r.status !== "PASS" && r.status !== "n/a")) out(`${rec.variant} L${rec.level} ${rec.rarity}: ${[...rec.fails, ...rec.warns].join(" | ")}`);
process.exitCode = tally.FAIL ? 1 : 0;
