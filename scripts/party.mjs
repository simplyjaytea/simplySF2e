// "Use my party" helper. Upstream foundryvtt/pf2e v14-dev:
//   src/module/collection/actors.ts: `get party(): PartyPF2e<null> | null` (game.actors.party)
//   src/module/actor/party/document.ts line 25: `declare members: CreaturePF2e[];`
//     lines 99-102: members = details.members mapped via fromUuidSync, filtered to creatures
//   src/module/actor/base.ts lines 211-213: `get level(): number { return this.system.details.level.value; }`
//   A player character actor has `type === "character"`.

/** Pure: summarize a party { name, members } for the encounter generator. */
export function partySummary(party) {
  if (!party) return null;
  const characters = (Array.isArray(party.members) ? party.members : [])
    .filter((member) => member?.type === "character");
  if (characters.length === 0) return null;
  const levels = characters.map((member) => member.level).filter((level) => Number.isFinite(level));
  if (levels.length === 0) return null;
  const count = characters.length;
  const mean = levels.reduce((sum, level) => sum + level, 0) / levels.length;
  return {
    name: String(party.name),
    count,
    size: Math.min(8, Math.max(1, count)),
    level: Math.min(20, Math.max(1, Math.round(mean)))
  };
}

/** The world's active party as a partySummary, or null (never throws). */
export function activeParty() {
  try {
    return partySummary(globalThis.game?.actors?.party ?? null);
  } catch {
    return null;
  }
}
