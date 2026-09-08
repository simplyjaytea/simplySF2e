import { MODULE_ID, SETTINGS, getSetting } from "./settings.mjs";
import { TREASURE_AMOUNT_MULTIPLIER } from "./tables.mjs";

/**
 * Generation presets: guidance text injected into the AI prompt that shapes
 * the creature's road map (stat scales, techniques, casting) while the GM's
 * concept text still drives flavor. Built-ins are flavor keys for the six
 * SF2e classes in packs/sf2e/classes/ (foundryvtt/pf2e v14-dev) — module-local
 * ids, not pack UUIDs or COMPLETE_PC_CLASS_SLUGS. GMs save their own presets
 * in world settings.
 *
 * Standard is envoy, mystic, operative, solarian, soldier, witchwarper only.
 * Flavor is scale-words / enum slugs; the AI still never emits numbers.
 */

export const BUILT_IN_PRESETS = [
  {
    id: "envoy",
    name: "SIMPLYSF2E.Presets.Envoy",
    prompt: "Build like an ENVOY: a charming leader and influencer. High Charisma, high Diplomacy or Deception, moderate AC and HP, a ranged small-arm strike at moderate-to-high attack. A get-them-moving or covering-fire signature ability that aids allies, leadership-style flavor, a light weapon as backup. No spellcasting."
  },
  {
    id: "mystic",
    name: "SIMPLYSF2E.Presets.Mystic",
    prompt: "Build like a MYSTIC: a connection caster bound to cosmic forces. Spellcasting at high DC with healing, vitality, or mind spells fitting a clear connection theme, high Wisdom and Will, moderate HP, low-to-moderate AC and attack. A bond-or-vitality-network signature ability that aids allies, Religion or a connection skill, a simple weapon or small-arm strike as a last resort."
  },
  {
    id: "operative",
    name: "SIMPLYSF2E.Presets.Operative",
    prompt: "Build like an OPERATIVE: a focused professional marksman. High Dexterity, high Reflex, a high or extreme ranged small-arm or sniper strike, low-to-moderate AC and HP. A studied-mark or trick-attack-like ability that improves accuracy or damage against a chosen target, high Stealth and a specialization skill (Thievery, Computers flavor, or Society). No spellcasting."
  },
  {
    id: "solarian",
    name: "SIMPLYSF2E.Presets.Solarian",
    prompt: "Build like a SOLARIAN: a solar knight of gravity and light. High Strength or Charisma, high Fortitude, high AC, moderate-to-high HP. A solar-weapon melee strike or a solar-flare ranged strike, and a stellar-attunement signature that cycles photon and graviton flavor (one mode boosting allies or speed, the other controlling or striking harder). No traditional spellcasting."
  },
  {
    id: "soldier",
    name: "SIMPLYSF2E.Presets.Soldier",
    prompt: "Build like a SOLDIER: a heavy-armor area-weapon specialist. Extreme or high AC, high HP, high Fortitude, a high attack with a heavy or area weapon (automatic, explosive, or suppressing-fire flavor). A fighting-style signature ability, Athletics and Intimidation, walking-armory gear. No spellcasting."
  },
  {
    id: "witchwarper",
    name: "SIMPLYSF2E.Presets.Witchwarper",
    prompt: "Build like a WITCHWARPER: a reality-warping caster. Spellcasting at high or extreme DC with a paradox theme (alternate timelines, quantum fields, displaced matter), high Charisma, high Will, low HP and AC, low attack. A quantum-field or paradox-flavored signature ability, an anchoring memory or object as flavor, a simple weapon or small-arm strike as a last resort."
  }
];

/** Module-local flavor keys for the Standard optgroup; not pack document ids. */
export const STANDARD_PRESET_IDS = BUILT_IN_PRESETS.map((p) => p.id);

/**
 * Example concept sentences shown as the description placeholder, five per
 * preset (keyed by preset id; "" = no preset). The generator cycles through
 * them to show the range of what each preset can build.
 */
export const EXAMPLE_PROMPTS = {
  "": [
    "A Drift-lost courier whose cargo started whispering coordinates",
    "A Pact Worlds customs inspector who never reports the interesting finds",
    "A swarm-scarred mechanic keeping a dying tramp freighter one jump ahead of repo",
    "A station-born bartender who sells rumors cheaper than drinks",
    "A silent android bodyguard whose last contract ended in a crater"
  ],
  envoy: [
    "A con artist selling shares in a star that does not exist",
    "A Pact Worlds attache who smiles while the room rearranges itself",
    "A visicaster host whose audience will riot if the feed drops",
    "A mercenary officer who leads from the front and bills from the rear",
    "A diplomat who never raises a weapon and never needs to"
  ],
  mystic: [
    "A vitality-network medic who treats gunshot wounds like weather",
    "A connection-of-the-dead chaplain hearing last words from empty helmets",
    "A mind-link courier who delivers feelings instead of files",
    "A shrine-keeper of a star that went out last century",
    "A bond-healer who will not let anyone on the crew die first"
  ],
  operative: [
    "An Absalom Station sniper who never takes the same perch twice",
    "A corporate extraction specialist with a smile and a silenced pistol",
    "A Drift-lane scout who maps things the charts pretend are empty",
    "A visiliberty thief who steals secrets, not credsticks",
    "A bounty hunter who talks to marks like old coworkers"
  ],
  solarian: [
    "A photon-attuned knight whose solar blade hums like a distant sun",
    "A graviton duelist who folds corridors shut behind fleeing foes",
    "A solar pilgrim walking the Pact Worlds with a flare for a lantern",
    "A cycle-keeper who will not strike until the attunement turns",
    "A station security captain whose shield is a disk of bottled starlight"
  ],
  soldier: [
    "A heavy-armor door-kicker who treats hallways like firing lanes",
    "A suppressing-fire specialist who never lets the other side peek",
    "A walking-armory veteran whose coat rattles with spare magazines",
    "A trench-world sergeant who still hears the artillery in the Drift",
    "A Pact Worlds marine who volunteered for the boarding action nobody wanted"
  ],
  witchwarper: [
    "A paradox caster who keeps an extra version of every hallway",
    "A quantum-field smuggler whose cargo exists only while observed",
    "A timeline-split survivor arguing with a self that stayed behind",
    "A memory-anchor witch who pins reality to a cracked datapad",
    "A Drift-sick warper whose spells arrive from rooms that are not there yet"
  ]
};

/** Placeholder example for a preset, cycling with `tick`. */
export function examplePrompt(presetId, tick) {
  const pool = EXAMPLE_PROMPTS[presetId] ?? EXAMPLE_PROMPTS[""];
  return pool[((tick % pool.length) + pool.length) % pool.length];
}

/**
 * Keep a still-valid last-used id. Empty stays empty (fresh default is
 * None so Monster/NPC/Encounter are not force-flavored). A vanished id
 * (deleted custom or retired thematic built-in) falls back to the first
 * Standard class, not None.
 */
export function resolveSelectedPresetId(id, customPresets = []) {
  if (!id) return "";
  if (BUILT_IN_PRESETS.some((p) => p.id === id)) return id;
  if ((Array.isArray(customPresets) ? customPresets : []).some((p) => p && p.id === id && p.name)) return id;
  return BUILT_IN_PRESETS[0]?.id ?? "";
}

/**
 * Picker model: None is outside groups; Standard is always present; Custom
 * is omitted by the caller when `custom` is empty.
 */
export function presetPickerGroups(selectedId, customPresets = []) {
  const selected = resolveSelectedPresetId(selectedId, customPresets);
  return {
    selectedId: selected,
    standard: BUILT_IN_PRESETS.map((p) => ({ id: p.id, nameKey: p.name, selected: selected === p.id })),
    custom: (Array.isArray(customPresets) ? customPresets : [])
      .filter((p) => p && p.id && p.name)
      .map((p) => ({ id: p.id, name: p.name, selected: selected === p.id }))
  };
}

const RANDOM_TYPES = [
  "aberration", "animal", "beast", "construct", "dragon", "elemental", "fey",
  "fiend", "fungus", "giant", "humanoid", "monitor", "ooze", "plant", "undead"
];
const RANDOM_ROLES = [
  "brute", "sneak", "skirmisher", "sniper", "soldier", "spellcaster", "ambusher", "leader with minion tactics"
];
const RANDOM_PLACES = [
  "Absalom Station", "a Drift-beached wreck", "the Akiton wastes", "a Castrovel canopy city",
  "a Pact Worlds customs dock", "an abandoned mining asteroid", "the Idari's quiet decks",
  "a swarm-scarred frontier outpost", "a neon understation market", "a silent pre-Gap ruin"
];
const RANDOM_TWISTS = [
  "with an unexpectedly gentle side", "obsessed with collecting something strange",
  "that mimics its prey", "bound by an old bargain", "worshipped by locals as a god",
  "that hunts only at dusk", "hoarding treasure it cannot use", "fleeing something even worse",
  "far smarter than it looks", "stitched together from many creatures"
];
const RANDOM_PC_ORIGINS = [
  "android", "human", "ysoki", "vesk", "lashunta", "kasatha", "shirren", "skittermander"
];
const RANDOM_PC_ROLES = [
  "starship mechanic", "exiled heir", "Pact Worlds marshal", "Drift courier",
  "station champion", "retired gladiator", "corporate extraction specialist", "dockside brawler",
  "oathbound bodyguard", "boarding-action veteran"
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * A fresh local dice-roll brief. Monster/NPC/Encounter reuse the creature
 * type × role × home × twist sentence; Character mode uses a person-oriented
 * adventurer brief so the PC pipeline is not fed a monster concept. Flavor
 * only — the module never treats these words as class or ancestry picks.
 */
export function randomBrief(mode = "monster") {
  if (mode === "character") {
    return `Invent an original ${pick(RANDOM_PC_ORIGINS)} ${pick(RANDOM_PC_ROLES)} from ${pick(RANDOM_PLACES)}, ${pick(RANDOM_TWISTS)}. Surprise us: avoid clichés, and give them one memorable personality hook.`;
  }
  return `Invent an original ${pick(RANDOM_TYPES)} ${pick(RANDOM_ROLES)} from ${pick(RANDOM_PLACES)}, ${pick(RANDOM_TWISTS)}. Surprise us: avoid clichés, and give it one memorable signature ability.`;
}

export function getCustomPresets() {
  const stored = getSetting(SETTINGS.customPresets);
  return Array.isArray(stored) ? stored.filter((p) => p && p.id && p.name) : [];
}

/** Find a preset (built-in or custom) by id. */
export function findPreset(id) {
  if (!id) return null;
  return (
    BUILT_IN_PRESETS.find((p) => p.id === id)
    ?? getCustomPresets().find((p) => p.id === id)
    ?? null
  );
}

/** Value domains for the optional generator-default fields a preset may carry. */
export const PRESET_RARITIES = ["common", "uncommon", "rare", "unique"];

/**
 * Pick only the valid optional generator defaults (rarity, allowSpellcasting,
 * treasureAmount) out of `fields` — anything absent or out of domain is
 * dropped, so older presets simply don't carry the field.
 */
function presetDefaults(fields = {}) {
  const out = {};
  if (PRESET_RARITIES.includes(fields.rarity)) out.rarity = fields.rarity;
  if (typeof fields.allowSpellcasting === "boolean") out.allowSpellcasting = fields.allowSpellcasting;
  if (Object.hasOwn(TREASURE_AMOUNT_MULTIPLIER, fields.treasureAmount ?? "")) out.treasureAmount = fields.treasureAmount;
  return out;
}

export async function addCustomPreset(name, prompt, fields = {}) {
  const preset = {
    id: `custom-${foundry.utils.randomID(8)}`,
    name: String(name).slice(0, 60),
    prompt: String(prompt),
    ...presetDefaults(fields),
    custom: true
  };
  await game.settings.set(MODULE_ID, SETTINGS.customPresets, [...getCustomPresets(), preset]);
  return preset;
}

/** Merge new values into an existing custom preset (no-op if not found). */
export async function updateCustomPreset(id, fields = {}) {
  // Clone before mutating: getCustomPresets() hands back the live setting
  // objects, and mutating them in place before settings.set could confuse
  // Foundry's cached value.
  const presets = getCustomPresets().map((p) => ({ ...p }));
  const preset = presets.find((p) => p.id === id && p.custom);
  if (!preset) return null;
  if (typeof fields.name === "string" && fields.name.trim()) preset.name = fields.name.slice(0, 60);
  if (typeof fields.prompt === "string" && fields.prompt.trim()) preset.prompt = fields.prompt;
  Object.assign(preset, presetDefaults(fields));
  await game.settings.set(MODULE_ID, SETTINGS.customPresets, presets);
  return preset;
}

export async function deleteCustomPreset(id) {
  await game.settings.set(
    MODULE_ID,
    SETTINGS.customPresets,
    getCustomPresets().filter((p) => p.id !== id)
  );
}

/** Pretty JSON of the custom presets matching `ids` (all customs if omitted). */
export function exportPresets(ids = null) {
  const presets = getCustomPresets().filter((p) => !ids || ids.includes(p.id));
  return JSON.stringify(presets, null, 2);
}

/**
 * Import presets from a JSON string (a single preset object or an array).
 * Each valid entry (non-empty name + prompt strings) is added as a NEW custom
 * preset with a fresh id — imported ids are never trusted, avoiding
 * collisions with existing presets. Malformed entries are silently skipped.
 */
export async function importPresets(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { added: 0, skipped: 1 };
  }
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  let added = 0;
  let skipped = 0;
  for (const entry of entries) {
    const valid = entry
      && typeof entry.name === "string" && entry.name.trim()
      && typeof entry.prompt === "string" && entry.prompt.trim();
    if (!valid) {
      skipped++;
      continue;
    }
    await addCustomPreset(entry.name.trim(), entry.prompt.trim(), entry);
    added++;
  }
  return { added, skipped };
}
