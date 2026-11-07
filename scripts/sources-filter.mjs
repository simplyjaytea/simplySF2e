export function packMatches(pack, { query = "", selectedOnly = false } = {}) {
  if (selectedOnly && !pack?.checked) return false;
  const q = String(query ?? "").trim().toLowerCase();
  if (q === "") return true;
  const fields = [pack?.title, pack?.package, pack?.id].map((v) => String(v ?? "").toLowerCase());
  return fields.some((f) => f.includes(q));
}

export function applyFilter(categories, filter = {}) {
  const f = { query: filter.query ?? "", selectedOnly: !!filter.selectedOnly };
  const active = String(f.query).trim() !== "" || f.selectedOnly;
  let shown = 0;
  let total = 0;
  const out = (Array.isArray(categories) ? categories : []).map((cat) => {
    const packs = (Array.isArray(cat?.packs) ? cat.packs : []).map((pack) => {
      const p = { ...pack, checked: !!pack?.checked };
      const hidden = active ? !packMatches(p, f) : false;
      if (!hidden) shown++;
      total++;
      return { ...p, hidden };
    });
    const selectedCount = packs.filter((p) => p.checked).length;
    const hidden = active && packs.length > 0 && packs.every((p) => p.hidden);
    return { ...cat, packs, selectedCount, hidden };
  });
  return { categories: out, shown, total, noMatches: active && shown === 0, active };
}