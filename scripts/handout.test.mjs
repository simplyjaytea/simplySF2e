// Pure player handout HTML: escaping and the player-safe field allowlist.
// Run: node scripts/handout.test.mjs
import assert from "node:assert/strict";
import { handoutHtml, inertProse } from "./handout.mjs";

const hostile = `<script>alert("x")</script>'"`;
const escaped = "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&#39;&quot;";

const html = handoutHtml({
  name: hostile,
  img: `https://example.test/a.webp?"><script>`,
  blurb: hostile,
  readAloud: `${hostile}\n\nSecond ${hostile}`
});
assert.ok(!html.includes("<script>"), "no raw script tag may survive");
assert.ok(html.includes(escaped), "hostile text must be escaped");
assert.ok(html.includes(`src="https://example.test/a.webp?&quot;&gt;&lt;script&gt;"`), "img must be escaped");
assert.ok(html.includes(`alt="${escaped}"`), "name in alt must be escaped");
assert.ok(html.includes("<p>"), "readAloud paragraphs are wrapped");

// Figure only with an image.
assert.ok(!handoutHtml({ name: "Vex", blurb: "Quiet." }).includes("<figure"));
assert.ok(handoutHtml({ name: "Vex", img: "a.webp", blurb: "Quiet." }).includes(`<figure class="spf-handout-portrait">`));

// GM-only fields never leak, even when passed.
const leaky = handoutHtml({
  name: "Vex", img: "a.webp", blurb: "Quiet.", readAloud: "Hello.",
  description: "SECRET TACTICS", recallKnowledge: "SECRET WEAKNESS", stats: { hp: 99 }
});
assert.ok(!leaky.includes("SECRET"), "description and recallKnowledge must never appear");
assert.ok(!leaky.includes("99"), "stats must never appear");

// Blank prose yields no handout.
assert.equal(handoutHtml({ name: "Vex", img: "a.webp", blurb: "", readAloud: "  " }), "");
assert.equal(handoutHtml({ name: "Vex", img: "a.webp" }), "");

console.log("handout.test.mjs: player handout escaping and allowlist assertions passed");

// Enricher syntax in AI prose is broken so it cannot become a macro link or roll.
const enriched = handoutHtml({ name: "Vex", blurb: "@UUID[Macro.abc]{Click}", readAloud: "Roll [[/r 1d20]] and @Check[dc:20]" });
assert.ok(!/@[A-Za-z]+\[/.test(enriched), "no live @Word[ enricher may survive");
assert.ok(!enriched.includes("[["), "no live [[ inline roll may survive");
assert.ok(!/&[A-Za-z]+\[/.test(inertProse("&Reference[frightened]")), "no live &Word[ enricher may survive");
assert.equal(inertProse("plain @ mention [one] [two]"), "plain @ mention [one] [two]");
console.log("handout enricher tests passed");
