/**
 * Tidy folders for generated documents. Folders are found by a module flag
 * (not by name), so a GM who renames one keeps it in use.
 */
import { MODULE_ID } from "./settings.mjs";

export const FOLDER_LABELS = {
  root: "SIMPLYSF2E.Folders.Root",
  creature: "SIMPLYSF2E.Folders.Creatures",
  npc: "SIMPLYSF2E.Folders.Npcs",
  character: "SIMPLYSF2E.Folders.Characters",
  shop: "SIMPLYSF2E.Folders.Shops"
};

/** Pure: the first folder-like object with this type, kind and parent id, or null. */
export function findFolder(folders, { type, kind, parentId }) {
  for (const f of folders) {
    if (f?.type !== type) continue;
    if (f.flags?.[MODULE_ID]?.kind !== kind) continue;
    if ((f.folder?.id ?? f.folder ?? null) !== (parentId ?? null)) continue;
    return f;
  }
  return null;
}

async function ensureFolder(type, kind, parentId) {
  const existing = findFolder(game.folders, { type, kind, parentId });
  if (existing) return existing;
  return Folder.create({
    name: game.i18n.localize(FOLDER_LABELS[kind]),
    type,
    folder: parentId ?? null,
    flags: { [MODULE_ID]: { kind } }
  });
}

/** Id of the generated root folder, or of its kind subfolder under that root. */
export async function generatedFolderId(type, kind = "root") {
  const root = await ensureFolder(type, "root", null);
  if (kind === "root") return root.id;
  const sub = await ensureFolder(type, kind, root.id);
  return sub.id;
}

/** Files a committed document into its generated folder. Never throws. */
export async function moveToGeneratedFolder(doc, kind) {
  try {
    await doc.update({ folder: await generatedFolderId(doc.documentName ?? "Actor", kind) });
  } catch (err) {
    console.warn(`${MODULE_ID} | could not file "${doc?.name}" into its folder`, err);
  }
}
