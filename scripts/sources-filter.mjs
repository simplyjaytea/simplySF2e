export function packMatches(pack, { query = "", selectedOnly = false } = {}) {
  if (selectedOnly && !pack?.checked) return false;
  const q = String(query ?? "").trim().toLowerCase();
  if (q === "") return true;
  const fields = [pack?.title, pack?.package, pack?.id].map((v) => String(v ?? "").toLowerCase());
  return fields.some((f) => f.includes(q));
}