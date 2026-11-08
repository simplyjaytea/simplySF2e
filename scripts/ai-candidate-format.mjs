/**
 * Encode overlapping feat lists once. High-level PCs have many slots whose
 * legal candidates largely repeat; short IDs prevent resending every name for
 * every slot and let invalid cross-slot picks fail closed locally.
 */
export function encodeFeatCandidateSlots(slots) {
  const catalog = [];
  const idByCandidate = new Map();
  const encodedSlots = [];

  for (const [slotIndex, slot] of (Array.isArray(slots) ? slots : []).entries()) {
    const ids = [];
    const seenIds = new Set();
    for (const candidate of Array.isArray(slot?.candidates) ? slot.candidates : []) {
      const name = String(candidate?.name ?? "").trim();
      if (!name) continue;
      const key = String(candidate?.id ?? name.toLocaleLowerCase());
      let id = idByCandidate.get(key);
      if (!id) {
        id = `F${catalog.length.toString(36).toUpperCase()}`;
        idByCandidate.set(key, id);
        catalog.push({ id, name, ...(candidate?.ref ? { candidate: candidate.ref } : {}) });
      }
      if (!seenIds.has(id)) {
        seenIds.add(id);
        ids.push(id);
      }
    }
    encodedSlots.push({
      number: slotIndex + 1,
      type: String(slot?.type ?? "feat"),
      level: Number(slot?.level) || 0,
      ids
    });
  }

  return { catalog, slots: encodedSlots };
}

/** Validate model ID picks against each slot and restore exact feat names. */
export function resolveEncodedFeatPicks(encoded, picks) {
  const candidatesById = new Map(encoded.catalog.map(({ id, name, candidate }) => [id.toUpperCase(), { name, candidate }]));
  const allowedBySlot = new Map(encoded.slots.map((slot) => [
    slot.number,
    new Set(slot.ids.map((id) => id.toUpperCase()))
  ]));
  const resolved = [];
  const seenSlots = new Set();

  for (const pick of Array.isArray(picks) ? picks : []) {
    const slot = Number(pick?.slot);
    const id = String(pick?.id ?? "").trim().toUpperCase();
    if (!Number.isInteger(slot) || seenSlots.has(slot)) continue;
    if (!allowedBySlot.get(slot)?.has(id)) continue;
    const candidate = candidatesById.get(id);
    if (!candidate) continue;
    seenSlots.add(slot);
    resolved.push({ slot, name: candidate.name, ...(candidate.candidate ? { candidate: candidate.candidate } : {}) });
  }
  return resolved;
}

/**
 * Per-request short ids for issued compendium candidates. The model sees
 * `E1`, `E2`, ... instead of the opaque `c-<base64 pack+doc>` id; the module
 * maps an answer back to the exact issued candidate. Each id is bound to the
 * list it was issued with, so an id outside the map (a forged `c-` id, a
 * stale id, a made-up one) decodes to null and the pick is dropped.
 *
 * `encode(list)` returns shallow copies of the candidates whose `id` is the
 * short id. They share the same `ref` object (so `isIssuedCandidate` still
 * holds) and every other field. A candidate without an id keeps none (callers
 * without issued ids keep their name-only path). The same candidate in two
 * lists of one encoder gets the same short id; the counter runs on across
 * lists so ids never repeat inside one request.
 * @param {string} [prefix] one letter or short word naming the list family
 */
export function createCandidateEncoder(prefix = "E") {
  let next = 1;
  const shortByOriginal = new Map();
  const map = new Map();
  const originals = new WeakMap();
  return {
    prefix,
    map,
    encode(list) {
      return (Array.isArray(list) ? list : []).map((candidate) => {
        if (!candidate?.id) return candidate;
        let id = shortByOriginal.get(candidate.id);
        if (!id) {
          id = `${prefix}${next}`;
          next += 1;
          shortByOriginal.set(candidate.id, id);
          map.set(id.toUpperCase(), candidate);
        }
        const shown = { ...candidate, id };
        originals.set(shown, candidate);
        return shown;
      });
    },
    /** The issued candidate a shown copy was made from (identity-preserving). */
    original(shown) {
      return shown ? originals.get(shown) ?? null : null;
    },
    decode(id) {
      return decodeCandidatePick(id, map);
    }
  };
}

/** Encode one list: `{ candidates, map, decode, original }` (see createCandidateEncoder). */
export function encodeCandidates(list, { prefix = "E" } = {}) {
  const encoder = createCandidateEncoder(prefix);
  return { candidates: encoder.encode(list), map: encoder.map, decode: encoder.decode, original: encoder.original };
}

/** The issued candidate behind a short id, or null for anything not in the map. */
export function decodeCandidatePick(id, map) {
  const key = String(id ?? "").trim().toUpperCase();
  return key && map instanceof Map ? map.get(key) ?? null : null;
}
