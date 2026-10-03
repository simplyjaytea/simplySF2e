// Copy bug report: a plain-text summary of a failed run that a GM can paste
// to the module author. Pure helpers (redaction, formatting) have no Foundry
// dependency and are node-testable; `gatherEnvironment` reads Foundry globals
// defensively so a half-loaded world still yields a report.
//
// Never include an API key. Settings are an explicit allowlist, the key
// settings only report whether they are set, and every string in the report
// passes through `redactSecrets` with the configured keys as exact matches.

const MAX_STACK_LINES = 12;
const MAX_PROMPT_CHARS = 600;
const REDACTED = "[redacted]";

/** Generic key shapes masked even when the exact key is unknown. */
const SECRET_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /\b(?:sk|pk|rk|ts|xai)-[A-Za-z0-9_-]{8,}/g,
  /\bgsk_[A-Za-z0-9_-]{8,}/g,
  // Any long token with a digit in it (hex or base64-ish keys of unknown shape).
  /\b(?=[A-Za-z_-]*\d)[A-Za-z0-9_-]{32,}/g,
  /\bAIza[A-Za-z0-9_-]{20,}/g,
  /([?&](?:api[_-]?key|key|token|access_token)=)[^&\s"']+/gi
];

const MIN_SECRET_FRAGMENT = 8;

/**
 * Replace each exact secret, any cut-off start or end of one (a provider
 * error truncated mid-key), and anything key-shaped with "[redacted]".
 */
export function redactSecrets(text, secrets = []) {
  let out = String(text ?? "");
  for (const secret of secrets) {
    const value = String(secret ?? "").trim();
    // A very short "key" would mask ordinary words; real keys are long.
    if (value.length < 6) continue;
    out = out.split(value).join(REDACTED);
    for (let len = value.length - 1; len >= MIN_SECRET_FRAGMENT; len--) {
      out = out.split(value.slice(0, len)).join(REDACTED);
      out = out.split(value.slice(-len)).join(REDACTED);
    }
  }
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (match, prefix) => (typeof prefix === "string" && match.startsWith(prefix)
      ? `${prefix}${REDACTED}`
      : REDACTED));
  }
  return out;
}

/** Scheme + host (+ port) only; userinfo, path and query can carry secrets. */
export function endpointHost(url) {
  const raw = String(url ?? "").trim();
  if (!raw) return "(not set)";
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "(unparseable URL)";
  }
}

/** First lines of a stack, without the message line it repeats. */
export function trimStack(stack, message = "") {
  const lines = String(stack ?? "").split("\n").map((line) => line.trimEnd()).filter(Boolean);
  if (lines.length && message && lines[0].includes(message)) lines.shift();
  const kept = lines.slice(0, MAX_STACK_LINES);
  if (lines.length > kept.length) kept.push(`    ... ${lines.length - kept.length} more lines`);
  return kept.join("\n");
}

/**
 * Snapshot of a failed run, taken while the progress steps still exist.
 * `shown` is the exact error text the window displays, so a stale failure
 * never pairs with a newer error message.
 */
export function captureFailure(err, { operation, shown, progress = null, now = new Date() } = {}) {
  const steps = progress?.steps ?? [];
  const active = steps.find((step) => step.state === "active");
  return {
    operation: String(operation ?? "unknown"),
    shown: String(shown ?? err?.message ?? err ?? ""),
    message: String(err?.message ?? err ?? ""),
    name: String(err?.name ?? "Error"),
    stack: typeof err?.stack === "string" ? err.stack : "",
    cancelled: Boolean(err?.cancelled),
    step: active?.label ?? null,
    stepsDone: steps.filter((step) => step.state === "done").map((step) => step.label),
    at: now.toISOString()
  };
}

function line(label, value) {
  return `${label}: ${value === undefined || value === null || value === "" ? "(none)" : value}`;
}

function formatValue(value) {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "(none)";
  return value;
}

/**
 * Plain-text report. `env` comes from `gatherEnvironment`; `input` is the
 * window's form values. Wrapped in a code fence so chat apps keep the layout.
 */
export function formatBugReport({ app, failure, input = {}, env = {}, secrets = [] }) {
  const out = [];
  out.push("SimplySF2e bug report");
  out.push(line("Time", failure?.at));
  out.push(line("Window", app));
  out.push("");
  out.push("## What failed");
  out.push(line("Operation", failure?.operation));
  out.push(line("Failed step", failure?.step ?? "(no step running)"));
  out.push(line("Steps finished", formatValue(failure?.stepsDone ?? [])));
  out.push(line("Error shown", failure?.shown));
  if (failure?.message && failure.message !== failure.shown) out.push(line("Error", failure.message));
  out.push(line("Error type", failure?.name));
  const stack = trimStack(failure?.stack, failure?.message);
  if (stack) {
    out.push("Stack:");
    out.push(stack);
  }
  out.push("");
  out.push("## Form");
  for (const [key, value] of Object.entries(input ?? {})) {
    if (value === undefined) continue;
    let shown = formatValue(value);
    // Redact before cutting, so a key spanning the cut cannot survive in part.
    if (typeof shown === "string") shown = redactSecrets(shown, secrets);
    if (key === "prompt" && typeof shown === "string" && shown.length > MAX_PROMPT_CHARS) {
      shown = `${shown.slice(0, MAX_PROMPT_CHARS)}... (${shown.length} chars)`;
    }
    out.push(line(key, shown));
  }
  out.push("");
  out.push("## Settings");
  for (const [key, value] of Object.entries(env.settings ?? {})) out.push(line(key, formatValue(value)));
  out.push("");
  out.push("## Versions");
  out.push(line("SimplySF2e", env.moduleVersion));
  out.push(line("System", env.system));
  out.push(line("Foundry", env.foundry));
  out.push(line("Browser", env.browser));
  out.push(line("Other active modules", formatValue(env.modules ?? [])));
  const body = redactSecrets(out.join("\n"), secrets);
  // A stray fence inside the error would end the block early.
  return `\`\`\`\n${body.replace(/```/g, "'''")}\n\`\`\``;
}

/**
 * Read versions and the allowlisted settings from Foundry. `provider` is the
 * result of getProviderRequestConfig(); `jev` of getJevRequestConfig().
 * Returns `{ env, secrets }`; secrets are only for redaction, never printed.
 */
export function gatherEnvironment({ moduleId, provider = {}, jev = {}, getSetting: readSetting = () => undefined }) {
  const getSetting = (key) => {
    try { return readSetting(key); } catch { return undefined; }
  };
  const game = globalThis.game ?? {};
  const mod = game.modules?.get?.(moduleId);
  const system = game.system;
  const modules = [];
  try {
    for (const entry of game.modules?.values?.() ?? []) {
      if (!entry?.active || entry.id === moduleId) continue;
      modules.push(entry.version ? `${entry.id} ${entry.version}` : entry.id);
    }
  } catch {
    // A partial modules collection only shortens the list.
  }
  const sourcePacks = getSetting("sourcePacks");
  const packList = sourcePacks && typeof sourcePacks === "object"
    ? Object.entries(sourcePacks).map(([category, packs]) =>
      `${category}=${Array.isArray(packs) ? packs.join("|") || "(none)"
        : packs && typeof packs === "object" ? JSON.stringify(packs) : String(packs)}`)
    : [];
  const env = {
    moduleVersion: mod?.version ?? "(unknown)",
    system: system ? `${system.id} ${system.version ?? ""}`.trim() : "(unknown)",
    foundry: game.version ?? game.release?.version ?? "(unknown)",
    browser: globalThis.navigator?.userAgent ?? "(unknown)",
    modules: modules.sort(),
    settings: {
      "Provider": provider.provider?.name ?? "(unknown)",
      "Connection": provider.connectionName,
      "Saved connections": provider.connections?.length ?? 0,
      "Endpoint": endpointHost(provider.baseUrl),
      "Model": provider.model,
      "API key set": Boolean(provider.hasConfiguredApiKey),
      "API key authorized for endpoint": Boolean(provider.apiKeyIsBound),
      "Keyless local endpoint": Boolean(provider.keylessLocal),
      "Temperature": getSetting("temperature"),
      "Max tokens": getSetting("maxTokens"),
      "Request timeout": getSetting("requestTimeout"),
      "Jev key set": Boolean(jev.apiKey),
      "Jev source": jev.source,
      "Free Archetype": Boolean(getSetting("freeArchetype")),
      "Source packs": packList.length ? packList : "(defaults)"
    }
  };
  const bank = getSetting("providerBank");
  const bankKeys = Array.isArray(bank?.connections) ? bank.connections.map((connection) => connection?.apiKey) : [];
  return {
    env,
    secrets: [provider.apiKey, jev.apiKey, getSetting("apiKey"), getSetting("jevApiKey"), ...bankKeys]
  };
}
