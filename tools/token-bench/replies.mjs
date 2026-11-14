// Scripted provider replies for the token bench. Each reply is what a compliant
// model returns to the prompt it was given: fixed content, shaped to the schema
// the prompt shows. A prompt that asks for one-line JSON gets one-line JSON; a
// prompt that makes a key optional gets a reply without it.

const CASTER = {
  name: "Vessarin Okh, Chartbreaker",
  blurb: "Disgraced Xenowarden technomancer who sells stolen star charts",
  description: "Vessarin Okh was struck from the Xenowarden rolls after copying survey data for a Free Captain buyer, and has traded on stolen charts ever since. She works from the back rooms of drift-side cantinas, a lean lashunta in a patched survey coat, her datapad always half hidden in one sleeve.\n\nIn a fight she never stands still. She opens with a wide disruptive spell to scatter the party, then keeps cover between herself and the nearest blade while her drone-light spells pick at whoever is alone. She runs the moment a buyer's ship is in reach, and she always knows where the nearest exit is.",
  readAloud: "A woman in a patched survey coat looks up from a datapad that floods her face with pale blue light. Star charts drift in the air around her like a slow snowfall, and the smell of hot circuitry rolls off her gloves as her fingers begin to move.",
  recallKnowledge: "Okh relies on her datapad to shape her spells; she casts poorly when it is taken or jammed, and she will abandon a fight to save it.",
  size: "med",
  traits: ["humanoid", "lashunta"],
  languages: ["common", "castrovelian", "akitonian"],
  abilityScales: { str: "low", dex: "high", con: "moderate", int: "extreme", wis: "moderate", cha: "high" },
  acScale: "moderate",
  hpScale: "low",
  perceptionScale: "high",
  saveScales: { fortitude: "low", reflex: "high", will: "high" },
  speeds: [{ type: "land", value: 25 }],
  senses: [{ type: "darkvision", acuity: null, range: null }],
  skills: [
    { name: "Computers", scale: "extreme" }, { name: "Arcana", scale: "high" },
    { name: "Deception", scale: "high" }, { name: "Piloting", scale: "moderate" },
    { name: "Star Chart Lore", scale: "high" }
  ],
  strikes: [
    { name: "semi-auto pistol", type: "ranged", attackScale: "moderate", damageScale: "moderate", damageType: "piercing", traits: [], range: 60, attackEffects: [] },
    { name: "shock baton", type: "melee", attackScale: "low", damageScale: "low", damageType: "electricity", traits: ["agile"], range: null, attackEffects: [] }
  ],
  specialAbilities: [
    { name: "Chart Flare", glossary: null, description: "She throws a stolen star chart into the air, where it bursts into a cone of blinding stellar light.", abilityDcScale: "high", damageType: "fire", template: "area-blast", kind: null, condition: null, shape: "cone", size: "medium", save: "reflex", use: "limited" },
    { name: "Reactive Recalibration", glossary: "Attack of Opportunity", description: "She punishes anyone who turns their back on her.", abilityDcScale: null, damageType: null, template: null, kind: null, condition: null, shape: null, size: null, save: null, use: null },
    { name: "Always an Exit", glossary: null, description: "She has mapped every door, vent and hatch in any room she has stood in for a minute.", abilityDcScale: null, damageType: null, template: null, kind: null, condition: null, shape: null, size: null, save: null, use: null }
  ],
  spellcasting: {
    tradition: "arcane",
    dcScale: "high",
    spells: [
      { name: "Detect Magic", rank: 0 }, { name: "Telekinetic Projectile", rank: 0 }, { name: "Electric Arc", rank: 0 },
      { name: "Force Barrage", rank: 1 }, { name: "Mist", rank: 2 }, { name: "Haste", rank: 3 },
      { name: "Lightning Bolt", rank: 3 }, { name: "Confusion", rank: 4 }, { name: "Translocate", rank: 4 }
    ],
    keywords: ["electricity", "illusion", "teleportation", "control", "debuff"]
  },
  focusSpells: [],
  feats: ["Quick Draw"],
  equipment: [
    { name: "Semi-Auto Pistol", quantity: 1, value: 200 }, { name: "Shock Baton", quantity: 1, value: 150 },
    { name: "Second Skin", quantity: 1, value: 250 }, { name: "Datapad", quantity: 1, value: 50 },
    { name: "Serum of Healing", quantity: 2, value: 120 }, { name: "Hacking Toolkit", quantity: 1, value: 200 }
  ],
  loot: [
    { name: "Credits", quantity: 420, value: 1 }, { name: "Spell Gem of Haste (Rank 3)", quantity: 1, value: 300 },
    { name: "Serum of Healing", quantity: 1, value: 120 }, { name: "Infosphere Antenna", quantity: 1, value: 600 },
    { name: "Stolen Star Chart", quantity: 3, value: 80 }
  ],
  resistances: [],
  weaknesses: [],
  immunities: []
};

const MARTIAL = {
  ...CASTER,
  name: "Void-Sworn Cutter",
  blurb: "Cult foot soldier with a ritual blade and nothing to lose",
  description: "Cutters are the rank and file of the cult: dock hands and deserters who took the void's mark for a meal and a purpose. They fight in pairs, one pinning a target while the other circles behind.\n\nThey break when their leader falls, but not before.",
  readAloud: "Two figures in grease-stained vac suits step out from behind the cargo crates, visors blacked out with paint. Each drags a hooked blade along the deck plates with a long, patient scrape.",
  recallKnowledge: "Cutters are trained to flank; a character who keeps their back to a wall denies them their best attacks.",
  traits: ["humanoid", "human"],
  languages: ["common"],
  abilityScales: { str: "high", dex: "moderate", con: "moderate", int: "low", wis: "moderate", cha: "low" },
  acScale: "high", hpScale: "moderate", perceptionScale: "moderate",
  saveScales: { fortitude: "high", reflex: "moderate", will: "low" },
  senses: [],
  skills: [{ name: "Athletics", scale: "high" }, { name: "Intimidation", scale: "moderate" }, { name: "Stealth", scale: "moderate" }],
  strikes: [
    { name: "hooked blade", type: "melee", attackScale: "high", damageScale: "high", damageType: "slashing", traits: ["trip"], range: null, attackEffects: [] },
    { name: "laser pistol", type: "ranged", attackScale: "moderate", damageScale: "moderate", damageType: "fire", traits: [], range: 80, attackEffects: [] }
  ],
  specialAbilities: [
    { name: "Pack Attack", glossary: "Sneak Attack", description: "They strike hardest when a partner holds the target's attention.", abilityDcScale: null, damageType: null, template: null, kind: null, condition: null, shape: null, size: null, save: null, use: null }
  ],
  spellcasting: null,
  feats: [],
  equipment: [
    { name: "Laser Pistol", quantity: 1, value: 150 }, { name: "Dueling Sword", quantity: 1, value: 100 },
    { name: "Flight Suit", quantity: 1, value: 100 }, { name: "Battery", quantity: 2, value: 10 }
  ],
  loot: [
    { name: "Credits", quantity: 90, value: 1 }, { name: "Serum of Healing", quantity: 1, value: 120 },
    { name: "Cult Token", quantity: 1, value: 40 }
  ]
};

const BEAST = {
  ...MARTIAL,
  name: "Void Jackal",
  blurb: "Vacuum-hardened pack hunter of derelict stations",
  description: "Void jackals are lean, hairless scavengers whose hide has hardened into grey plates against hard vacuum. A pack follows a ship's wake for weeks, slipping aboard through breached hulls and waiting in the dark for the crew to split up.\n\nThey harry a target from several sides, dragging it down before closing on the throat, and they retreat as one when two of their number fall.",
  readAloud: "Claws tick on the deck plates somewhere beyond the light. Then a low, wet clicking answers from the other side of the corridor, and four pairs of pale eyes open in the dark.",
  recallKnowledge: "Void jackals hunt by scent and by the vibration of footsteps; bright light and sudden loud noise scatter a pack for a few moments.",
  size: "sm",
  traits: ["animal"],
  languages: [],
  abilityScales: { str: "moderate", dex: "high", con: "moderate", int: "low", wis: "high", cha: "low" },
  acScale: "moderate", hpScale: "moderate", perceptionScale: "high",
  saveScales: { fortitude: "moderate", reflex: "high", will: "low" },
  speeds: [{ type: "land", value: 40 }, { type: "climb", value: 20 }],
  senses: [{ type: "darkvision", acuity: null, range: null }, { type: "scent", acuity: "imprecise", range: 30 }],
  skills: [{ name: "Stealth", scale: "high" }, { name: "Athletics", scale: "moderate" }, { name: "Survival", scale: "moderate" }],
  strikes: [
    { name: "jaws", type: "melee", attackScale: "high", damageScale: "moderate", damageType: "piercing", traits: [], range: null, attackEffects: ["knockdown"] },
    { name: "claw", type: "melee", attackScale: "moderate", damageScale: "low", damageType: "slashing", traits: ["agile"], range: null, attackEffects: [] }
  ],
  specialAbilities: [
    { name: "Pack Attack", glossary: "Pack Attack", description: "A jackal bites deeper when its packmates crowd the same prey.", abilityDcScale: null, damageType: null, template: null, kind: null, condition: null, shape: null, size: null, save: null, use: null },
    { name: "Vacuum Hide", glossary: null, description: "Its plated hide lets it cross open vacuum for a short while without harm.", abilityDcScale: null, damageType: null, template: null, kind: null, condition: null, shape: null, size: null, save: null, use: null }
  ],
  equipment: [],
  loot: []
};

const PC = {
  name: "Dravvek Sorn",
  ancestry: "Vesk", heritage: null, background: "Bodyguard", class: "Soldier", keyAbility: "con",
  abilityPriorities: ["str", "wis", "dex"],
  blurb: "Vesk soldier turned bodyguard with a soft spot for strays",
  backstory: "Dravvek served two tours with a Veskarium line regiment before a border skirmish left him the only one of his squad still standing. He mustered out, drifted to Absalom Station and found that people would pay well for someone large and patient to stand next to them.\n\nHe is good at the work and bored by most of his clients. What he actually cares about is the growing collection of station cats, runaway kids and one half-broken security drone that have decided his bunk is home.",
  appearance: "Broad even for a vesk, with slate-green scales, a notched frill and a heavy armored coat he never quite fastens.",
  age: "34", gender: "Male", height: "7 ft. 1 in.", weight: "310 lbs.",
  ethnicity: "Vesk Prime highlander", nationality: "Veskarium",
  personality: "Slow to speak and slower to anger; narrates what he is about to do so nobody is surprised.",
  alignmentFlavor: "He keeps his contracts to the letter and bends every rule that would hurt someone smaller than him.",
  likes: "station cats, strong tea, clients who listen", dislikes: "slavers, small talk, low doorways",
  allies: "Mira Oyelaran, a Starfinder Society quartermaster who throws him honest work.",
  enemies: "Captain Hessk of his old regiment, who blames him for surviving.",
  organizations: "Licensed with the Absalom Station Bodyguards' Compact.",
  languages: ["vesk", "ysoki"],
  feats: ["Shield Block", "Intimidating Glare", "Toughness", "Ready Reload"],
  skillPriorities: ["athletics", "intimidation", "medicine", "perception", "piloting"],
  spellcasting: null,
  focusSpells: [],
  equipment: [
    { name: "Machine Gun", quantity: 1, value: 400 }, { name: "Defiance Series Squad Armor", quantity: 1, value: 300 },
    { name: "Battery", quantity: 4, value: 10 }, { name: "Serum of Healing", quantity: 2, value: 120 },
    { name: "Medkit", quantity: 1, value: 50 }, { name: "Tactical Shield", quantity: 1, value: 100 }
  ]
};

const LOOT = { loot: [
  { name: "Credits", quantity: 250, value: 1 }, { name: "Serum of Healing", quantity: 2, value: 120 },
  { name: "Stun Stick (Tactical)", quantity: 1, value: 700 }, { name: "Spell Gem of Haste (Rank 3)", quantity: 1, value: 300 },
  { name: "Infosphere Antenna", quantity: 1, value: 600 }
] };

const SHOP = {
  name: "Tikk's Second Chances",
  shopkeeper: "Tikk Varrowmend, a retired ysoki ship mechanic with oil-black whiskers and a prosthetic tail",
  blurb: "If it flew once, Tikk can sell you the part that will make it fly again.",
  description: "The stall is three cargo containers welded end to end, every wall hung with salvaged tools, cracked visors and coils of cable. A workbench runs down the middle under a string of mismatched lamps.\n\nPilots between contracts and dock crews on their break pick through the bins while Tikk talks them out of whatever they came in for and into something better.",
  keywords: ["tool", "kit", "salvage", "battery", "armor", "pistol", "drone"],
  categories: ["weapons", "armor", "gear"]
};

const TREASURE = {
  name: "Cryo-lab smugglers' cache",
  description: "Waist-deep meltwater fills the lower lab, and the smugglers' crates have floated free of their straps. Most are split, their contents scattered across the flooded floor and caught in the frost on the walls.\n\nA sealed case sits on the one dry bench, still humming.",
  keywords: ["serum", "medical", "cold", "weapon", "tool", "gem"],
  categories: ["consumables", "gear", "weapons"]
};

const has = (text, pattern) => pattern.test(text);

/** Name the call from its system prompt (the bench has no access to the task id). */
export function classify(system) {
  const rules = [
    [/expert Starfinder 2e creature designer/, "creature concept"],
    [/player character designer/, "character concept"],
    [/player-character equipment designer/, "wealth items draft"],
    [/loot designer/, "loot draft"],
    [/thematic focus/, "spell focus"],
    [/selecting spells/, "spell selection"],
    [/selecting carried equipment/, "equipment selection"],
    [/selecting dropped loot/, "loot selection"],
    [/class feats for a creature/, "creature feat selection"],
    [/bestiary actions/, "ability selection"],
    [/ancestry, heritage, background and class/, "ancestry and class"],
    [/designing a themed Starfinder 2e encounter/, "encounter design"],
    [/design shops/, "shop concept"],
    [/stock a Starfinder 2e shop/, "shop stock"],
    [/describe treasure hoards/, "treasure concept"],
    [/fill a Starfinder 2e treasure hoard/, "treasure picks"]
  ];
  return rules.find(([pattern]) => pattern.test(system))?.[1] ?? "other";
}

/** Candidate ids in a block of prompt text, in order: `E12 | Name` or `E12 Name`. */
function idsIn(text) {
  return [...String(text).matchAll(/(?:^|[\s;:(])([A-Z]\d+)(?= \| | [A-Z0-9'"(])/gm)].map((m) => m[1]);
}
const spread = (list, count) => {
  if (list.length <= count) return list;
  const step = list.length / count;
  return Array.from({ length: count }, (_, i) => list[Math.floor(i * step)]);
};
const after = (text, marker) => {
  const at = text.indexOf(marker);
  return at < 0 ? "" : text.slice(at + marker.length);
};

/** Drop what the prompt no longer asks for, so the reply follows the schema it was shown. */
function shapeConcept(concept, system) {
  const lean = has(system, /leave out any key whose value would be null or \[\]/i);
  const strip = (entry) => (lean
    ? Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== null && !(Array.isArray(v) && !v.length)))
    : entry);
  const out = { ...concept };
  out.strikes = concept.strikes.map(strip);
  out.senses = concept.senses.map(strip);
  out.specialAbilities = concept.specialAbilities.map(strip);
  if (concept.spellcasting) {
    const { keywords, ...rest } = concept.spellcasting;
    out.spellcasting = has(system, /"keywords": string\[\]/) ? { ...rest, keywords } : rest;
  }
  if (has(system, /"equipment": string\[\]/)) out.equipment = concept.equipment.map((item) => item.name);
  if (!has(system, /"loot": \[ \{ "name": string, "quantity": number, "value": number \} \]/)) {
    out.loot = concept.loot.map(({ name, quantity }) => ({ name, quantity }));
  }
  return out;
}

function reply(system, user) {
  switch (classify(system)) {
    case "creature concept":
      return shapeConcept(has(user, /\[caster\]/) ? CASTER : has(user, /\[beast\]/) ? BEAST : MARTIAL, system);
    case "character concept": {
      const out = { ...PC };
      if (has(system, /"equipment": string\[\]/)) out.equipment = PC.equipment.map((item) => item.name);
      return out;
    }
    case "wealth items draft":
    case "loot draft":
      return has(system, /"value": number/) ? LOOT : { loot: LOOT.loot.map(({ name, quantity }) => ({ name, quantity })) };
    case "spell focus":
      return { keywords: CASTER.spellcasting.keywords };
    case "spell selection": {
      const lines = after(user, "Available spells").split("\n");
      const spells = [];
      for (const line of lines) {
        const rank = /^Cantrips/.test(line) ? 0 : Number(/^Rank (\d+)/.exec(line)?.[1]);
        if (!Number.isInteger(rank)) continue;
        for (const id of spread(idsIn(line), rank === 0 ? 3 : 2)) spells.push({ id, rank });
      }
      return { spells, focusSpellIds: [] };
    }
    case "equipment selection":
      return { equipment: spread(idsIn(after(user, "Available items")), 6).map((id) => ({ id, quantity: 1 })) };
    case "loot selection":
      return { loot: spread(idsIn(after(user, "Available items")), 4).map((id) => ({ id, quantity: 1 })) };
    case "creature feat selection":
      return { featIds: idsIn(after(user, "Feat catalog")).slice(0, 1) };
    case "ability selection":
      return { abilityIds: spread(idsIn(after(user, "Bestiary action catalog")), 2) };
    case "ancestry and class": {
      const pick = (label) => idsIn(user.split("\n").find((line) => line.startsWith(label)) ?? "")[0] ?? null;
      return {
        ancestryId: pick("Available ancestries"), heritageId: null,
        backgroundId: pick("Available backgrounds"), classId: pick("Available classes"), keyAbility: "con"
      };
    }
    case "encounter design":
      return {
        name: "The Hollow Choir",
        briefs: [
          "[caster] A void-touched cult preacher who speaks in a chorus of stolen voices and bends starlight into weapons.",
          "Cult foot soldiers in blacked-out vac suits who fight in pairs with hooked ritual blades."
        ]
      };
    case "shop concept": return SHOP;
    case "shop stock": return { ids: spread(idsIn(after(user, "Available items")), 16) };
    case "treasure concept": return TREASURE;
    case "treasure picks": return { ids: spread(idsIn(after(user, "Available items")), 8) };
    default: return {};
  }
}

/** The reply text for one request. Indented unless the prompt asks for one-line JSON. */
export function replyFor({ system, user }) {
  const data = reply(system, user);
  return has(system, /on one line|minified|no line breaks/i) ? JSON.stringify(data) : JSON.stringify(data, null, 2);
}
