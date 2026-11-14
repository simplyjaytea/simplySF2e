// The Reskin mode's preview and re-level controls the Generator template renders.
// Moved out of generator-app.mjs unchanged (T-P4): pure functions of the dropped
// source, the chosen level and the loaded source data (relevel.mjs does the math).
import { relevelPreview, RELEVEL_MIN, RELEVEL_MAX } from "../relevel.mjs";

export function buildReskinPreviewContext(flavor, source, targetLevel) {
  if (!flavor || !source) return null;
  return {
    name: flavor.name ?? source.name,
    level: targetLevel,
    releveled: targetLevel !== source.level,
    sourceName: source.name,
    blurb: flavor.blurb,
    readAloud: flavor.readAloud,
    paragraphs: (flavor.description ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    recallKnowledge: flavor.recallKnowledge,
    renames: flavor.renames
  };
}

/** Re-level controls and the before/after rows for the loaded NPC (relevel.mjs). */
export function buildRelevelContext(source, level, data, sources) {
  if (!source) return null;
  const preview = data
    ? relevelPreview(data, level, sources)
    : { rows: [], abilities: [] };
  const bands = {
    extreme: "BandExtreme", high: "BandHigh", moderate: "BandModerate", low: "BandLow", terrible: "BandTerrible"
  };
  const locScale = (row) => bands[row.scale] ? game.i18n.localize(`SIMPLYSF2E.StatCheck.${bands[row.scale]}`) : "";
  const locRow = (row) => ({
    label: row.name ? game.i18n.format(row.label, { name: row.name }) : game.i18n.localize(row.label),
    scale: locScale(row),
    from: row.from,
    to: row.to
  });
  const rows = [];
  const strikesMap = new Map();
  const strikeOrder = [];
  for (const row of preview.rows) {
    const key = String(row.key ?? "");
    const m = key.match(/^(strike|damage)-(.+)$/);
    if (m) {
      const kind = m[1];
      const id = m[2];
      if (!strikesMap.has(id)) {
        strikesMap.set(id, { name: row.name, attack: null, damage: null });
        strikeOrder.push(id);
      }
      const entry = strikesMap.get(id);
      if (!entry.name && row.name) entry.name = row.name;
      const obj = { scale: locScale(row), from: row.from, to: row.to };
      if (kind === "strike") entry.attack = obj;
      else entry.damage = obj;
    } else {
      rows.push(locRow(row));
    }
  }
  const strikes = strikeOrder.map((id) => strikesMap.get(id));
  const changed = level !== source.level;
  if (!changed) {
    rows.length = 0;
    strikes.length = 0;
  }
  return {
    from: source.level,
    level,
    min: RELEVEL_MIN,
    max: RELEVEL_MAX,
    changed,
    rows,
    strikes,
    hasRows: changed ? (rows.length > 0 || strikes.length > 0) : false,
    abilities: preview.abilities.map((line) => line.rebuilt
      ? { kept: false, label: game.i18n.format("SIMPLYSF2E.Relevel.AbilityRebuilt", { name: line.name, level }) }
      : { kept: true, label: game.i18n.format("SIMPLYSF2E.Relevel.AbilityKept", { name: line.name, reason: line.reason }) })
  };
}
