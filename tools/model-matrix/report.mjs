export function summarizeRuns(runs) {
  const byTask = {};
  for (const r of runs) {
    if (!byTask[r.task]) byTask[r.task] = {};
    if (!byTask[r.task][r.model]) byTask[r.task][r.model] = [];
    byTask[r.task][r.model].push(r);
  }
  const summary = {};
  for (const [task, models] of Object.entries(byTask)) {
    const modelRows = {};
    for (const [model, rs] of Object.entries(models)) {
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
      modelRows[model] = { runs: rs.length, pass: passes, fail: fails, failKeys: keys, medianMs: median, avgTokens: avgTok };
    }
    summary[task] = { models: modelRows };
  }
  return summary;
}

export function renderMatrix(summary, meta) {
  const price = meta.pricePerMTok || {};
  let out = `# Matrix\n\nConfig: ${meta.configPath}\nUTC: ${meta.utc}\nRuns: ${meta.runs}\n\n`;
  for (const [task, info] of Object.entries(summary)) {
    out += `## ${task}\n\n`;
    out += `| model | runs | pass | fail | fail keys | median ms | avg tokens | est. cost/run |\n|---|---|---|---|---|---|---|---|\n`;
    for (const [model, s] of Object.entries(info.models)) {
      const p = price[model];
      let cost = "n/a";
      if (p) cost = ((p.input + p.output)/2 * s.avgTokens / 1e6).toFixed(4);
      out += `| ${model} | ${s.runs} | ${s.pass} | ${s.fail} | ${Object.keys(s.failKeys).join(",")} | ${s.medianMs} | ${s.avgTokens.toFixed(1)} | ${cost} |\n`;
    }
    out += "\n";
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