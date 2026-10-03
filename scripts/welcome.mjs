// Pure first-run welcome logic: which readiness rows to show and when the
// window opens by itself. No Foundry globals, so it is node-testable; the
// app (welcome-app.mjs) gathers the live inputs and passes them in.

/** Lowest sf2e version the module allows. Must match module.json relationships. */
export const MIN_SYSTEM_VERSION = "1.5.0";

/**
 * Compare dotted numeric versions ("1.5.1" vs "1.5.0"). Missing parts count as
 * 0 and non-numeric parts as 0, so "1.5" equals "1.5.0".
 * @returns {number} negative, 0 or positive like a sort comparator.
 */
export function compareVersions(a, b) {
  const parts = (value) => String(value ?? "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const left = parts(a);
  const right = parts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

/**
 * Build the welcome window's readiness rows.
 * @param {object} input
 * @param {string} input.systemId          game.system.id
 * @param {string} input.systemVersion     game.system.version
 * @param {{ready:boolean, missing:string[], packCount:number}} input.creatureSources sourceReadiness("npc")
 * @param {{ready:boolean, missing:string[], packCount:number}} input.characterSources sourceReadiness("character")
 * @param {string|null} input.providerWarningKey getProviderAuthWarningKey() result (null = ready)
 * @param {string|null} input.jevSource    jevKeySource() result (null = off)
 * @returns {{system:object, sources:object, provider:object, jev:object, ready:boolean}}
 */
export function welcomeState({
  systemId,
  systemVersion,
  creatureSources,
  characterSources,
  providerWarningKey = null,
  jevSource = null
} = {}) {
  const systemReady = systemId === "sf2e" && compareVersions(systemVersion, MIN_SYSTEM_VERSION) >= 0;
  const missing = [...new Set([...(creatureSources?.missing ?? []), ...(characterSources?.missing ?? [])])];
  const sourcesReady = Boolean(creatureSources?.ready && characterSources?.ready);
  const providerReady = !providerWarningKey;
  return {
    system: { ready: systemReady, version: String(systemVersion ?? ""), minimum: MIN_SYSTEM_VERSION },
    sources: {
      ready: sourcesReady,
      missing,
      packCount: Math.max(creatureSources?.packCount ?? 0, characterSources?.packCount ?? 0)
    },
    provider: { ready: providerReady, warningKey: providerWarningKey ?? null },
    // Fast picks are optional: "off" is a normal state, never a blocker.
    jev: { on: Boolean(jevSource), source: jevSource ?? null },
    ready: systemReady && sourcesReady && providerReady
  };
}

/**
 * Whether the welcome window opens by itself at login (JT's "Until ready"
 * default): only for a GM on sf2e, and only until the AI connection works or
 * the GM ticks "Don't show this again".
 */
export function shouldAutoOpenWelcome({ isGM, systemId, dismissed, providerReady } = {}) {
  return Boolean(isGM) && systemId === "sf2e" && !dismissed && !providerReady;
}
