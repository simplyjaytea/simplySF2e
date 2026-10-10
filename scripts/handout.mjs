/**
 * Player-facing journal handout for a generated NPC. Only the portrait, a
 * blurb and read-aloud text are shared; GM tactics never leave the actor.
 */
import { esc, toHtml } from "./text.mjs";
import { generatedFolderId } from "./folders.mjs";

/** Pure: handout HTML from the player-safe fields only. "" when there is no prose. */
export function handoutHtml({ name, img, blurb, readAloud }) {
  if (!String(blurb ?? "").trim() && !String(readAloud ?? "").trim()) return "";
  const parts = [];
  if (img) parts.push(`<figure class="spf-handout-portrait"><img src="${esc(img)}" alt="${esc(name)}"></figure>`);
  if (blurb) parts.push(`<p><em>${esc(blurb)}</em></p>`);
  if (readAloud) parts.push(toHtml(readAloud));
  return parts.join("");
}

/** Creates the player handout journal entry. Never throws. */
export async function createHandout(actor, concept) {
  const html = handoutHtml({ name: actor.name, img: actor.img, blurb: concept.blurb, readAloud: concept.readAloud });
  if (html === "") return null;
  try {
    const entry = await JournalEntry.create({
      name: actor.name,
      folder: await generatedFolderId("JournalEntry", "root"),
      pages: [{ name: actor.name, type: "text", text: { content: html, format: 1 } }]
    });
    return entry;
  } catch (err) {
    console.warn(`simplysf2e | could not create the player handout for "${actor.name}"`, err);
    return null;
  }
}
