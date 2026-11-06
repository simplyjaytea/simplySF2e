// Pure HTML escaping independent of Foundry globals.
// Run: node scripts/text.test.mjs
import assert from "node:assert/strict";
import { esc, toHtml, signed, plainAiText, inertProse, escAi } from "./text.mjs";

const originalFoundry = Object.getOwnPropertyDescriptor(globalThis, "foundry");
const hostileText = `<img src="x" onerror='alert(1)'> & already &lt;`;
const escapedText = "&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt; &amp; already &amp;lt;";

try {
  delete globalThis.foundry;
  assert.equal(esc(hostileText), escapedText, "HTML must be escaped without a Foundry global");

  assert.equal(esc(null), "");
  assert.equal(esc(undefined), "");
  assert.equal(esc(0), "0");
  assert.equal(esc("ordinary text"), "ordinary text");
  assert.equal(signed(3), "+3");
  assert.equal(signed(0), "+0");
  assert.equal(signed(-2), "-2");
  assert.equal(signed("-1"), "-1");
  assert.equal(signed("4"), "+4");
  assert.equal(signed(null), "");
  assert.equal(signed(undefined), "");
  assert.equal(signed(NaN), "");
  assert.equal(signed(-0), "+0");
  assert.equal(toHtml(null), "");
  assert.equal(toHtml(undefined), "");
  assert.equal(toHtml(""), "");
  assert.equal(
    toHtml("  <b>First</b> & friends\ncontinued  \n\n  Second 'paragraph'  "),
    "<p>&lt;b&gt;First&lt;/b&gt; &amp; friends\ncontinued</p><p>Second &#39;paragraph&#39;</p>",
    "paragraph wrapping must preserve text structure and escape every paragraph"
  );

  let nativeCalls = 0;
  for (const nativeHelper of [
    (value) => value,
    () => { throw new Error("native helper must not run"); }
  ]) {
    globalThis.foundry = { utils: { escapeHTML(value) {
      nativeCalls += 1;
      return nativeHelper(value);
    } } };
    assert.equal(esc(hostileText), escapedText, "native helpers must not affect quoted-attribute escaping");
  }
  assert.equal(nativeCalls, 0, "HTML escaping must not consult Foundry helpers");
} finally {
  if (originalFoundry) Object.defineProperty(globalThis, "foundry", originalFoundry);
  else delete globalThis.foundry;
}

// plainAiText: inline-syntax characters go, whitespace collapses, the rest stays.
assert.equal(plainAiText("Blast]]"), "Blast");
assert.equal(plainAiText("[[/r 1d20]]"), "/r 1d20");
assert.equal(plainAiText("@Damage[1d6]"), "Damage1d6");
assert.equal(plainAiText("{x} a|b"), "x ab");
assert.equal(plainAiText("  Searing   gust \n now "), "Searing gust now");
assert.equal(plainAiText("<i>Gust</i> & 'x'"), "<i>Gust</i> & 'x'", "HTML characters are left for esc()");
assert.equal(plainAiText(undefined), "");

// inertProse: enricher forms go inert, visible text is unchanged (U+200B is the only addition).
const visible = (text) => text.replaceAll("\u200B", "");
const LIVE = [/@\w+\[/, /&\w+\[/, /\[\[/, /\]\]/];
const ENRICHERS = [
  "@UUID[Actor.x]{Boss}", "@Check[reflex|dc:20]", "@Damage[2d6[fire]]", "@Template[type:cone|distance:30]",
  "@Localize[PF2E.Foo]", "@Embed[Item.x]", "@Compendium[x.y]{z}", "@Unknown[a]", "&Reference[frightened]",
  "[[/r 1d20]]", "[[/gmr 1d4 #Recharge X]]", "Blast]]", "one [[ two ]] three",
  "@Foo1[x]", "@Foo_x[x]", "&Ref_1[x]"
];
for (const input of ENRICHERS) {
  const out = inertProse(input);
  assert.equal(visible(out), input, `visible text unchanged: ${input}`);
  for (const pattern of LIVE) assert.ok(!pattern.test(out), `no live ${pattern} in ${input}`);
}
// Prose that is not enricher syntax is untouched.
for (const input of ["[sic]", "Hunter [Lvl 2]", "a @ b", "R&D", "Tom & Jerry", "Gear [Mk II]", "x]y", "a[b", "@", "[one] [two]"]) {
  assert.equal(inertProse(input), input, `unchanged: ${input}`);
}
// Escaping and HTML: escAi and toHtml inert and escaped.
assert.equal(escAi("<b>@UUID[x]{y}</b>"), "&lt;b&gt;@\u200BUUID[x]{y}&lt;/b&gt;", "escAi escapes then inerts");
assert.equal(visible(toHtml("Roll [[/r 1d20]] and @Check[reflex]")), "<p>Roll [[/r 1d20]] and @Check[reflex]</p>", "toHtml keeps visible text");
assert.ok(!/\[\[|@[A-Za-z]+\[/.test(toHtml("Roll [[/r 1d20]] and @Check[reflex]")), "toHtml output has no live enricher");
assert.equal(inertProse(null), "", "null is empty");
// toHtml keeps its falsy contract: no coerced "0" or "false" paragraphs.
assert.equal(toHtml(0), "", "toHtml(0) is empty");
assert.equal(toHtml(false), "", "toHtml(false) is empty");
assert.equal(toHtml(""), "", "toHtml empty string is empty");

console.log("text.test.mjs: pure HTML escaping assertions passed");
