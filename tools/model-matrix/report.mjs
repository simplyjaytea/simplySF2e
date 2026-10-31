export function summarizeRuns(runs) {
  const byTask = {};
  for (const r of runs) {
    const t = r.task;
    if (!byTask[t]) byTask[t] = [];
    byTask[t].push(r);
  }
  const summary = {};
  for (const [task, rs] of Object.entries(byTask)) {
    const passes = rs.filter(r => r.ok).length;
    const fails = rs.length - passes;
    const keys = {};
    for (const r of rs) if (!r.ok && r.errorKey) {
      const k = String(r.errorKey).startsWith("SIMPLYSF2E.Errors.") ? r.errorKey : "redacted";
      keys[k] = (keys[k]||0)+1;
    }
    const ms = rs.map(r => r.ms).sort((a,b)=>a-b);
    const median = ms.length ? ms[Math.floor(ms.length/2)] : 0;
    const toks = rs.map(r => (r.usage?.total||0));
    const avgTok = toks.length ? toks.reduce((a,b)=>a+b,0)/toks.length : 0;
    summary[task] = { runs: rs.length, pass: passes, fail: fails, failKeys: keys, medianMs: median, avgTokens: avgTok };
  }
  return summary;
}

export function renderMatrix(summary, meta) {
  let out = `# Matrix\n\nConfig: ${meta.configPath}\nUTC: ${meta.utc}\nRuns: ${meta.runs}\n\n`;
  for (const [task, s] of Object.entries(summary)) {
    out += `## ${task}\n\n`;
    out += `| model | runs | pass | fail | fail keys | median ms | avg tokens | est. cost/run |\n|---|---|---|---|---|---|---|---|\n`;
    // per model not in summary; render aggregate row
    out += `| (all) | ${s.runs} | ${s.pass} | ${s.fail} | ${Object.keys(s.failKeys).join(",")} | ${s.medianMs} | ${s.avgTokens.toFixed(1)} | n/a |\n\n`;
  }
  return out;
}

export function validateConfig(cfg) {
  if (!cfg || typeof cfg !== "object") throw new Error("config must be object");
  if (!cfg.baseUrl) throw new Error("missing baseUrl");
  if (!cfg.apiKeyEnv) throw new Error("missing apiKeyEnv");
  if (!Array.isArray(cfg.models) || cfg.models.length === 0) throw new Error("models must be non-empty array");
  if (!Array.isArray(cfg.tasks) || cfg.tasks.length === 0) throw new Error("tasks must be non-empty array");
  return true;
}