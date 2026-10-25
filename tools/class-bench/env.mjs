// In-memory fake of the Foundry surface the PC pipeline reaches: packs, index,
// documents, fromUuid, settings, i18n, CONFIG, an Actor. Only Foundry globals
// are faked; every module function under test is the real one from scripts/.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const SETTINGS_ID = "simplysf2e";

/** Recursively collect pack JSON files (the sf2e pack folders nest by book). */
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.name.endsWith(".json") && entry.name !== "_folders.json") out.push(full);
  }
  return out.sort();
}

/** Copy only the requested dotted paths, like Foundry's CompendiumCollection#getIndex. */
function project(data, fields) {
  const out = { _id: data._id, name: data.name, type: data.type };
  for (const field of fields) {
    const parts = field.split(".");
    let from = data;
    for (const part of parts) {
      if (from === null || typeof from !== "object" || !(part in from)) { from = undefined; break; }
      from = from[part];
    }
    if (from === undefined) continue;
    let to = out;
    for (const part of parts.slice(0, -1)) to = (to[part] ??= {});
    to[parts.at(-1)] = structuredClone(from);
  }
  return out;
}

class FakeDocument {
  constructor(pack, data) {
    Object.assign(this, structuredClone(data));
    Object.defineProperty(this, "uuid", { value: `Compendium.${pack.collection}.Item.${data._id}` });
    Object.defineProperty(this, "pack", { value: pack.collection });
    Object.defineProperty(this, "id", { value: data._id });
  }
  toObject() { return structuredClone({ ...this }); }
}

class FakePack {
  constructor(name, docs) {
    this.collection = `sf2e.${name}`;
    this.title = name;
    this.metadata = { id: this.collection, type: "Item", packageName: "sf2e", label: name, name };
    this.docs = docs;
    this.byId = new Map(docs.map((d) => [d._id, d]));
    this.byName = new Map();
    for (const d of docs) if (!this.byName.has(d.name)) this.byName.set(d.name, d);
  }
  async getIndex({ fields = [] } = {}) { return this.docs.map((d) => project(d, fields)); }
  /** Foundry resolves a compendium uuid tail by id first, then by exact name. */
  async getDocument(id) {
    const data = this.byId.get(id) ?? this.byName.get(id);
    return data ? new FakeDocument(this, data) : null;
  }
}

export async function loadPacks(cacheDir) {
  const system = JSON.parse(await readFile(join(cacheDir, "system.sf2e.json"), "utf8"));
  const packs = new Map();
  for (const meta of system.packs.filter((p) => p.type === "Item")) {
    const dir = join(cacheDir, meta.name);
    const files = await walk(dir).catch(() => []);
    const docs = [];
    for (const file of files) docs.push(JSON.parse(await readFile(file, "utf8")));
    packs.set(`sf2e.${meta.name}`, new FakePack(meta.name, docs));
  }
  return { system, packs };
}

// ---------------------------------------------------------------- the Actor
const SKILLS = ["acrobatics", "arcana", "athletics", "crafting", "deception", "diplomacy", "intimidation", "medicine",
  "nature", "occultism", "performance", "religion", "society", "stealth", "survival", "thievery", "computers", "piloting"];

/** A character stand-in with NO derived data: ranks come only from the class and
 * background `trainedSkills.value` plus lore items; Int is 0; HP max is 1. */
class FakeActor {
  constructor(data, items = [], skillOverrides = {}) {
    this.name = data.name;
    this.type = data.type;
    this._source = { system: { skills: Object.fromEntries(SKILLS.map((s) => [s, { rank: skillOverrides[s] ?? 0 }])) } };
    this._items = items;
    this.items = { get: (id) => this._items.find((item) => item._id === id) ?? null };
    const ranks = Object.fromEntries(SKILLS.map((s) => [s, skillOverrides[s] ?? 0]));
    for (const item of items) {
      if (item.type !== "class" && item.type !== "background") continue;
      for (const slug of item.system?.trainedSkills?.value ?? []) if (slug in ranks) ranks[slug] = Math.max(ranks[slug], 1);
    }
    this.system = {
      skills: Object.fromEntries(SKILLS.map((s) => [s, { rank: ranks[s] }])),
      abilities: { int: { base: 0, mod: 0 } },
      attributes: { hp: { max: 1, value: 1 } },
      autoChanges: {}
    };
  }
  static async create(data) { return new FakeActor(data); }
  clone(data = {}) {
    const overrides = {};
    for (const slug of SKILLS) {
      const key = `system.skills.${slug}.rank`;
      overrides[slug] = Math.max(this._source.system.skills[slug].rank, data[key] ?? 0);
    }
    return new FakeActor(this, data.items ?? this._items, overrides);
  }
  toObject() { return { items: structuredClone(this._items) }; }
  async createEmbeddedDocuments(_type, items) { this._items = [...this._items, ...structuredClone(items)]; this.items = { get: (id) => this._items.find((item) => item._id === id) ?? null }; return items; }
  async update(changes) {
    for (const [path, value] of Object.entries(changes)) {
      const m = /^system\.skills\.([a-z]+)\.rank$/.exec(path);
      if (m) { this._source.system.skills[m[1]].rank = value; this.system.skills[m[1]].rank = Math.max(this.system.skills[m[1]].rank, value); }
    }
    return this;
  }
  async updateEmbeddedDocuments() { return []; }
  async delete() {}
}

/** Install the globals. `state.freeArchetype` is read live by getSetting(). */
export function installFoundry({ packs, state }) {
  let counter = 0;
  const sort = (a, b) => a.localeCompare(b);
  const packList = [...packs.values()];
  globalThis.game = {
    packs: Object.assign(packList, { get: (id) => packs.get(id) }),
    i18n: { localize: (key) => key },
    settings: {
      get(module, key) {
        if (module !== SETTINGS_ID) throw new Error(`unexpected settings read ${module}.${key}`);
        if (key === "sourcePacks") return {};
        if (key === "freeArchetype") return state.freeArchetype;
        throw new Error(`unexpected setting ${key}`);
      }
    }
  };
  globalThis.foundry = { utils: { randomID: () => `bench${String(++counter).padStart(11, "0")}` } };
  globalThis.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 50 } };
  // CONFIG.PF2E.skills is the only config path any sf2e ChoiceSet reads
  // (`choices: { config: "skills" }`, 4 rules). Built from the 18 sf2e core
  // skills (pc-skills.mjs documents the same list). `languages` is read but empty.
  globalThis.CONFIG = { PF2E: {
    skills: Object.fromEntries(SKILLS.slice().sort(sort).map((s) => [s, { label: `PF2E.Skill${s}` }])),
    languages: {}
  } };
  globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
  globalThis.Hooks = { on() {}, once() {}, callAll() {} };
  globalThis.Actor = FakeActor;
  globalThis.fromUuid = async (uuid) => {
    const m = /^Compendium\.([^.]+)\.([^.]+)\.Item\.(.+)$/.exec(String(uuid));
    if (!m) return null;
    const pack = packs.get(`${m[1]}.${m[2]}`);
    return pack ? pack.getDocument(m[3]) : null;
  };
}
