// Static UI contract checks for the compact provider strip and responsive
// controls. These complement live/browser QA by preventing the two templates
// or the narrow-window overflow fix from silently drifting apart.
// Run: node scripts/ui.layout.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [generator, itemForge, providerSetup, managePresets, sources, progress, generatorApp, itemForgeApp, appBase, css, langJson] = await Promise.all([
  read("templates/generator.hbs"),
  read("templates/itemforge.hbs"),
  read("templates/provider-setup.hbs"),
  read("templates/manage-presets.hbs"),
  read("templates/sources.hbs"),
  read("templates/_progress.hbs"),
  read("scripts/generator-app.mjs"),
  read("scripts/itemforge-app.mjs"),
  read("scripts/app-base.mjs"),
  read("module.json").then(async (manifest) =>
    (await Promise.all(JSON.parse(manifest).styles.map(read))).join("\n")),
  read("lang/en.json")
]);

for (const [name, template] of [
  ["generator", generator],
  ["item forge", itemForge]
]) {
  assert.match(template, /spf-provider-summary/, `${name} must identify the active provider`);
  assert.match(template, /provider\.model/, `${name} must show the exact model identifier`);
  assert.match(template, /providerReady/, `${name} must expose provider readiness at a glance`);
  assert.match(template, /data-action="configureProvider"/, `${name} must offer direct provider setup`);
  assert.match(template, /data-action="testProvider"/, `${name} must offer a connection check`);
  assert.match(template, /name="activeConnection"/, `${name} must expose a one-click connection switch`);
  assert.match(template, /connectionName/, `${name} must show the active connection name`);
  assert.match(
    template,
    /spf-provider-state" role="img" aria-label=/,
    `${name} provider readiness must not depend on color or a tooltip`
  );
  assert.match(template, /notification warning spf-provider-warning" role="status"/, `${name} provider warnings must expose status semantics`);
  assert.match(template, /notification error" role="alert"/, `${name} generation failures must be announced as alerts`);
}

for (const [name, template] of [
  ["generator", generator],
  ["item forge", itemForge],
  ["preset manager", managePresets],
  ["provider setup", providerSetup]
]) {
  for (const match of template.matchAll(/<button\b([^>]*)>\s*<i\b[^>]*><\/i>\s*<\/button>/g)) {
    assert.match(
      match[1],
      /\baria-label=/,
      `${name} icon-only buttons must have an accessible name: ${match[0]}`
    );
  }
}

for (const [name, template] of [
  ["generator", generator],
  ["item forge", itemForge]
]) {
  const ids = new Set([...template.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  for (const match of template.matchAll(/<label\b[^>]*\bfor="([^"]+)"[^>]*>/g)) {
    assert.ok(ids.has(match[1]), `${name} label must target an existing control: ${match[0]}`);
  }
  for (const match of template.matchAll(/<(?:input|select|textarea)\b([^>]*)\bname="[^"]+"[^>]*>/g)) {
    if (/type="(?:checkbox|radio)"/.test(match[0])) continue;
    assert.match(match[1], /\bid="[^"]+"/, `${name} named fields must have a label target: ${match[0]}`);
  }
}

assert.match(providerSetup, /data-provider="\{\{this\.id\}\}"/, "provider setup must render preset choices");
assert.match(providerSetup, /name="apiBaseUrl"/);
assert.match(providerSetup, /name="model"/);
assert.match(providerSetup, /name="connectionName"/, "provider setup must name the active connection");
assert.match(providerSetup, /name="activeConnection"/, "provider setup must list saved connections");
assert.match(providerSetup, /data-action="createConnection"/, "provider setup must create a named connection");
assert.match(providerSetup, /data-action="deleteConnection"/, "provider setup must delete a named connection");
assert.match(providerSetup, /type="password" name="apiKey"/, "the saved key must never be rendered back into the form");
assert.match(providerSetup, /data-action="saveAndTest"/, "provider setup must offer direct save-and-test");
assert.match(providerSetup, /data-action="loadModels"/, "provider setup must offer authorized model discovery");
assert.match(providerSetup, /<datalist id="spf-provider-model-list">/, "discovered models must remain editable suggestions");
assert.match(
  generator,
  /spf-mode-toggle" role="radiogroup" aria-label=/,
  "generation modes must expose a named native radio group"
);
for (const legendKey of ["ConceptLegend", "NpcLegend", "EncounterLegend", "CharacterLegend", "ReskinLegend"]) {
  assert.match(
    generator,
    new RegExp(`SIMPLYSF2E\\.Generator\\.${legendKey}`),
    `generation mode must expose its own fieldset legend: ${legendKey}`
  );
}
for (const [mode, preview] of [
  ["monster", "preview"],
  ["npc", "preview"],
  ["encounter", "encounterPreview"],
  ["character", "pcPreview"],
  ["reskin", "reskinPreview"]
]) {
  assert.match(
    generatorApp,
    mode === "monster" || mode === "npc"
      ? new RegExp(`${preview}: \\["monster", "npc"\\]\\.includes\\(this\\.#input\\.mode\\) \\?`)
      : new RegExp(`${preview}: this\\.#input\\.mode === "${mode}" \\?`),
    `generator must hide other modes' stale previews while ${mode} mode is active`
  );
}
assert.match(
  generatorApp,
  /#modePrompts = \{ monster: "", npc: "", encounter: "", character: "", reskin: "" \}/,
  "each generator mode must keep an independent prompt draft"
);
assert.match(
  generatorApp,
  /this\.#modePrompts\[previousMode\] = renderedPrompt[\s\S]*?this\.#modePrompts\[mode\] \?\? ""/,
  "mode changes must save the old draft and restore the new mode's draft"
);

for (const [name, source] of [
  ["generator", generatorApp],
  ["item forge", itemForgeApp]
]) {
  assert.match(
    source,
    /static async #onAuthorizeApiKey\([^)]*\)\s*\{\s*(?:\/\/[^\n]*\n\s*)+this\.#readForm\(\);/,
    `${name} must preserve unsaved form input before authorization re-renders the app`
  );
}

assert.match(
  css,
  /\.simplysf2e \.spf-row\s*\{[^}]*flex-wrap:\s*wrap;/s,
  "control rows must wrap instead of overflowing a compact Foundry window"
);
assert.match(
  css,
  /\.window-content\s*\{[^}]*container:\s*spf-window \/ inline-size/s,
  "the window content must be the size container, so narrow rules follow the window, not the viewport"
);
assert.match(
  css,
  /@container spf-window \(max-width: 520px\)[\s\S]*?\.simplysf2e \.spf-row \.form-group\s*\{[^}]*flex-basis:\s*calc\(50%/s,
  "narrow windows must use a readable two-column control layout"
);
assert.doesNotMatch(css, /@media \(max-width/, "narrow layout must query the window container, not the viewport");
assert.match(css, /\.simplysf2e \.spf-provider-model\s*\{[^}]*text-overflow:\s*ellipsis;/s);
assert.match(css, /\.simplysf2e \.spf-provider-presets\s*\{[^}]*grid-template-columns:\s*repeat\(3/s);
assert.match(css, /\.simplysf2e \.spf-actions\s*\{[^}]*flex-wrap:\s*wrap;/s,
  "action rows must wrap when localized labels do not fit");
assert.match(css, /\.simplysf2e \.spf-model-picker\s*\{[^}]*flex-wrap:\s*wrap;/s,
  "the model input and discovery action must wrap in narrow windows");
assert.match(css, /\.simplysf2e \.spf-connection-row\s*\{[^}]*flex-wrap:\s*wrap;/s,
  "saved-connection controls must wrap in the provider setup dialog");
assert.match(
  css,
  /\.simplysf2e \.spf-mode-toggle input\[type="radio"\]\s*\{[^}]*position:\s*absolute;[^}]*clip:/s,
  "mode radios must stay keyboard-accessible while visually hidden"
);
assert.match(
  css,
  /\.simplysf2e \.spf-mode-toggle label:focus-within\s*\{[^}]*outline:/s,
  "keyboard focus on a mode must remain visible on its compact tile"
);
assert.match(
  progress,
  /spf-progress-bar" role="progressbar"[^>]*aria-valuemin="0"[^>]*aria-valuemax="100"[^>]*aria-valuenow="\{\{progress\.percent\}\}"/,
  "visual generation progress must expose its current value to assistive technology"
);
assert.match(
  progress,
  /role="status" aria-live="polite"/,
  "indeterminate generation work must be announced without interrupting the user"
);
assert.match(progress, /\{\{#if progress\}\}[\s\S]*spf-progress-steps[\s\S]*\{\{#if busyMessage\}\}/,
  "native character creation must keep the step card and put busyMessage on that chrome");
assert.doesNotMatch(progress, /\{\{#if busyMessage\}\}[\s\S]*\{\{else if progress\}\}/,
  "busyMessage must not swap the PC apply path to a spinner-only view");
assert.doesNotMatch(progress, /\{\{\{busyMessage\}\}\}/, "status text must never be rendered as raw HTML");
assert.match(generatorApp, /busyMessage: this\.#busyMessage/, "generator must expose its native creation status");
assert.match(generatorApp, /_beginProgress\(\[\s*\["apply", applyLabel\]\s*\], \{\s*cancellable:\s*false\s*\}\)/,
  "PC apply must stay on progress chrome and must not arm Cancel during Foundry writes");
assert.match(generator, /created\.grounding\.rows/, "completion card must report the validated content grounding");
assert.match(generator, /\{\{#if tokenReport\}\}[\s\S]*?Tokens\.Heading/, "completion card must retain the generation token report");
assert.match(generatorApp, /const manifest = completionManifest\([\s\S]*?assertComplete\(manifest\);[\s\S]*?this\.#manifest = manifest;/,
  "a single generation must retain its validated manifest until creation commits");
assert.doesNotMatch(generatorApp, /this\.#created = \{ name: actor\.name, actorId: actor\.id, count: 1 \};\s*\}\s*finally/,
  "generation failure handling must not fabricate a creation result from an unavailable actor");
assert.match(generatorApp, /selectChoices: async \(groups\) =>[\s\S]*?selectCharacterChoices\([\s\S]*?this\._recordTokens\(label, usage, timing\)/,
  "character creation must use the grounded provider selector and record its usage");
assert.match(generatorApp, /finally \{\s*this\.#busy = false;\s*this\.#busyMessage = null;\s*this\._finishRun\(\);/,
  "character success and failure must clear both native and AI progress state");
const messages = JSON.parse(langJson).SIMPLYSF2E;
assert.match(messages.Progress.ApplyingCharacter, /SF2e choice dialogs/);
assert.match(messages.Generator.ChoicesNeedInput, /could not be selected automatically/);

// --- Shared visual system (UI overhaul) ---------------------------------
// One primary action per window, shared icon-button/card/empty-state kit.

for (const [name, template, createAction] of [
  ["generator", generator, "createActor"],
  ["item forge", itemForge, "createItem"]
]) {
  assert.match(
    template,
    /class="spf-primary" data-action="generate"/,
    `${name} generate must be the styled primary action`
  );
  assert.match(
    template,
    new RegExp(`class="spf-primary" data-action="${createAction}"`),
    `${name} create must be the styled primary action`
  );
  assert.match(template, /spf-empty/, `${name} must show an empty state before the first generation`);
  assert.match(template, /spf-inputs spf-card/, `${name} inputs must use the shared card surface`);
}

assert.match(generatorApp, /showEmptyState:/, "generator must expose the empty-state flag");
assert.match(itemForgeApp, /showEmptyState:/, "item forge must expose the empty-state flag");

// Reading order: mode switch → prompt → prominent level → advanced → generate.
{
  const promptAt = generator.indexOf('id="spf-generator-prompt"');
  const presetAt = generator.indexOf('id="spf-generator-preset"');
  const modeAt = generator.indexOf("spf-mode-toggle");
  const levelAt = generator.indexOf('id="spf-generator-level"');
  const advancedAt = generator.indexOf('class="spf-advanced"');
  assert.ok(modeAt >= 0 && promptAt >= 0 && presetAt >= 0 && levelAt >= 0 && advancedAt >= 0, "generator flow anchors must exist");
  assert.ok(modeAt < promptAt, "the mode switch must precede the prompt");
  assert.ok(promptAt < levelAt, "the prompt must precede the prominent level control");
  assert.ok(levelAt < advancedAt, "the level must remain outside the advanced disclosure");
  assert.ok(advancedAt < presetAt, "presets must live in the advanced disclosure");
}

assert.match(generator, /<details class="spf-advanced">[\s\S]*?<summary>\{\{localize "SIMPLYSF2E\.Generator\.Advanced"\}\}<\/summary>/,
  "secondary controls must be in a native, keyboard-operable Advanced disclosure");
assert.match(generator, /data-action="managePresets"[\s\S]*?SIMPLYSF2E\.Presets\.Manage/,
  "the generator exposes one labeled Manage Presets control instead of edit icons");
assert.match(generator, /<optgroup label="\{\{localize 'SIMPLYSF2E\.Presets\.StandardGroup'\}\}">/,
  "built-in SF2e classes must render in a Standard optgroup");
assert.match(generator, /\{\{#if customPresets\.length\}\}[\s\S]*?<optgroup label="\{\{localize 'SIMPLYSF2E\.Presets\.CustomGroup'\}\}">/,
  "the Custom optgroup must be omitted when this world has no custom presets");
assert.match(generator, /class="spf-hint spf-preset-trust" role="note"/,
  "the picker must carry a readable complete-only flavor-guide trust line");
assert.match(generator, /aria-describedby="spf-generator-preset-trust"/,
  "the preset select must point at the trust line");
assert.match(css, /\.simplysf2e \.spf-preset-trust\s*\{/, "preset trust line must have dedicated type, not a buried generic hint");
assert.match(css, /\.simplysf2e \.spf-preset-controls\s*\{[^}]*align-items:\s*stretch/s,
  "Manage Presets must stretch to the select height");
assert.doesNotMatch(css, /\.simplysf2e \.spf-preset[\s\S]{0,800}(?:animation:|transition:)/,
  "preset chrome must not add motion; prefers-reduced-motion stays a progress-only concern");
assert.doesNotMatch(generator, /\{\{#each presets\}\}/,
  "the picker must not flatten Standard and Custom into one option list");
assert.doesNotMatch(generator, /data-action="savePreset"|data-action="duplicatePreset"|data-action="deletePreset"/,
  "preset editing controls belong in Manage Presets, not the generation flow");
assert.match(managePresets, /data-action="newPreset"/, "preset management must retain a direct creation path");

assert.match(providerSetup, /class="spf-primary" data-action="saveAndTest"/,
  "provider setup must mark Save & Test as the primary action");

// Progress: the step list and the live-updated detail line form one status system.
assert.match(progress, /spf-progress-steps/, "progress must list the pipeline steps");
assert.match(progress, /spf-step-\{\{this\.state\}\}/, "each progress step must carry its state class");
assert.match(progress, /spf-progress-\{\{progress\.phase\}\}/, "progress chrome must expose thinking vs writing");
assert.match(progress, /<p class="spf-progress-detail">/,
  "the streaming detail line must stay a direct-textContent target for app-base");
assert.match(progress, /data-action="cancelGeneration"/, "in-flight generation must offer Cancel on the progress chrome");
assert.match(progress, /SIMPLYSF2E\.Progress\.Cancel/);
assert.doesNotMatch(progress, /\{\{\{progress\.detail\}\}\}/);
assert.match(progress, /<p class="spf-progress-percent">\{\{progress\.percent\}\}%<\/p>/,
  "the percent readout must stay a direct-textContent target for in-place stream ticks");
assert.match(
  css,
  /\.simplysf2e \.spf-progress-fill\s*\{[^}]*transition:\s*width/s,
  "the progress fill must CSS-transition width instead of snapping between step buckets"
);
assert.match(
  css,
  /\.simplysf2e \.spf-progress-fill::after\s*\{[^}]*animation:\s*spf-step-slide/s,
  "within-step motion stays on the sheen while phase fill holds width"
);
assert.match(appBase, /_paintProgress\(\)/, "stream ticks must patch the existing fill instead of re-rendering the app");
assert.match(appBase, /streamFraction\(\{ phase, prior:/, "intra-step fill is phase-based, not chars-vs-unknown-length");
assert.match(appBase, /exact \? "SIMPLYSF2E\.Progress\.WritingExact"/, "live copy drops ≈ only for provider usage");
assert.match(generatorApp, /call: focusLabel/, "multi-call spell steps sub-label the detail line without extra bar steps");
assert.match(messages.Tokens.StepEstimated, /estimated/);
assert.match(messages.Tokens.StepTotal, /\{total\} tokens/);
assert.match(messages.Tokens.LastRun, /^last: \{total\} tokens$/);
assert.match(messages.Tokens.LastRunEstimated, /≈ \{total\} tokens/, "estimated last-run copy must keep ≈");
assert.match(messages.Errors.Cancelled, /cancelled/i);
assert.match(css, /prefers-reduced-motion:\s*reduce/, "generating animation must yield to reduced motion");
assert.match(css, /--spf-brand-dark:\s*#1d3c53/, "brand dark is cited SF2e primary navy");
assert.match(css, /--spf-brand-accent:\s*#9edae6/, "brand accent is cited SF2e trait cyan");
assert.match(css, /--spf-brand-secondary:\s*#40256f/, "brand secondary is cited SF2e violet");
assert.match(css, /--spf-warning:\s*#98503d/, "warning token is cited SF2e legendary orange");
assert.match(css, /\.simplysf2e button\.spf-secondary\s*\{/, "quiet companion actions share HUD chrome");
assert.match(css, /\.application\.simplysf2e \.window-header\s*\{/, "module windows restyle the Foundry header toward SF2e navy");
assert.match(generator, /simplysf2e-generator\{\{#if monsterMode\}\} spf-mode-monster\{\{else if npcMode\}\} spf-mode-npc\{\{else if encounterMode\}\} spf-mode-encounter\{\{else if characterMode\}\} spf-mode-character\{\{else if reskinMode\}\} spf-mode-reskin\{\{\/if\}\}\{\{#if busy\}\} spf-busy\{\{\/if\}\}/,
  "generator root must carry exactly one Neon Drift mode class and flag busy for HUD chrome without inventing progress copy");
assert.match(generatorApp, /classList\?\.toggle\("spf-busy"/, "generator window must toggle busy chrome from context");
assert.doesNotMatch(css, /#58180d|#a3512c|#d8c384/, "PF2e maroon/gold tokens must not remain");
assert.match(css, /\.simplysf2e \.spf-progress-thinking/, "thinking must have a distinct phase treatment");
assert.match(css, /\.simplysf2e \.spf-progress-writing/, "writing must have a distinct phase treatment");
assert.match(css, /\.simplysf2e \.spf-last-run\s*\{/, "last-run cost must be a compact secondary near the provider strip");
for (const [name, template] of [["generator", generator], ["item forge", itemForge]]) {
  assert.match(template, /spf-last-run/, `${name} must show last-run token cost near the provider strip`);
  assert.match(template, /lastRunCost/);
}
assert.match(generatorApp, /cancelGeneration: GeneratorApp\.#onCancelGeneration/);
assert.match(itemForgeApp, /cancelGeneration: ItemForgeApp\.#onCancelGeneration/);
assert.match(generatorApp, /lastRunCost: this\._formatLastRunCost\(\)/);
assert.match(itemForgeApp, /lastRunCost: this\._formatLastRunCost\(\)/);
const busyAt = generator.indexOf("{{#if busy}}{{> simplysf2e-progress}}");
const errorAt = generator.indexOf('{{#if error}}');
assert.ok(busyAt >= 0 && errorAt > busyAt, "generation errors must remain below progress, not covered by it");

assert.match(css, /\.spf-directory-row\s*\{/, "item forge directory entry needs its own row");
assert.match(css, /\.spf-directory-row \.spf-directory-button\s*\{[^}]*width:\s*100%/s,
  "item forge directory row must span below native controls");
for (const rule of ["spf-card", "spf-icon-btn", "spf-empty"]) {
  assert.match(css, new RegExp(`\\.simplysf2e \\.${rule}\\s*\\{`), `shared kit class .${rule} must be defined`);
}
assert.match(css, /\.simplysf2e button\.spf-primary\s*\{/, "the primary button treatment must be defined");
assert.match(
  css,
  /\.simplysf2e :is\(button, input, select, textarea, summary\):focus-visible\s*\{[^}]*outline:/s,
  "every control must have a visible focus state"
);
assert.match(css, /\.simplysf2e button:disabled\s*\{[^}]*opacity/s, "disabled controls must read as disabled");
assert.match(css, /\.application\.simplysf2e\s*\{[^}]*min-width/s,
  "resizable windows must clamp to a usable minimum size");

// --- Cross-app uniformity (UI uniformity pass) --------------------------
// The two apps share the same visual language while the forge gets a
// purpose-built, accessible kind chooser.
assert.match(itemForge, /class="spf-kind-choices" role="group" aria-label=/,
  "item forge kind selector must be an accessible choice group");
assert.match(itemForge, /class="spf-kind-choice \{\{#if this\.selected\}\}spf-kind-selected/,
  "each kind tile must render selected state from context");
assert.match(itemForge, /data-action="selectKind" data-kind="\{\{this\.value\}\}" aria-pressed="\{\{this\.selected\}\}"/,
  "kind tiles must expose ApplicationV2 action and explicit pressed state");
assert.match(itemForge, /this\.hint/,
  "kind tiles must render localized concise hints from their context");
assert.match(itemForgeApp, /selectKind: ItemForgeApp\.#onSelectKind/,
  "kind selection must use an ApplicationV2 data-action callback");
assert.match(itemForgeApp, /#input = \{ \.\.\.this\.#input, kind \}/,
  "kind selection must preserve prompt, level, and rarity");
for (const icon of ["fa-ring", "fa-sword", "fa-shield-halved"]) {
  assert.match(itemForgeApp, new RegExp(`icon: "${icon}"`), `kind context must retain the ${icon} tile icon`);
}
assert.doesNotMatch(itemForgeApp, /querySelectorAll\('input\[name="kind"\]'/,
  "kind selection must not rely on fragile per-render listeners");
assert.match(css, /\.simplysf2e \.spf-kind-choices\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(/s,
  "kind tiles must respond to the resizable app's intrinsic width without viewport media queries");

// Dice: one control in the generate row for every mode. Encounter no longer
// uses a separate action; Character is no longer gated off as creature-only.
{
  const rowAt = generator.indexOf('class="spf-generate-row"');
  const fieldsetEnd = generator.indexOf("</fieldset>");
  const row = generator.slice(rowAt, fieldsetEnd);
  assert.ok(rowAt >= 0 && fieldsetEnd > rowAt, "the generate row must sit inside the input fieldset");
  assert.match(row, /data-action="generate"/);
  assert.match(row, /data-action="previewPlan"/);
  assert.match(row, /class="spf-random-button" data-action="generateRandom"/);
  assert.ok(row.indexOf('data-action="generate"') < row.indexOf('data-action="previewPlan"'));
  assert.ok(row.indexOf('data-action="previewPlan"') < row.indexOf('data-action="generateRandom"'));
  assert.doesNotMatch(generator, /data-action="generateRandomEncounter"/);
  assert.doesNotMatch(generator, /Character mode gets no dice button/);
  assert.doesNotMatch(generator, /creatureMode/);
  assert.match(generator, /data-tooltip="\{\{localize randomTooltipKey\}\}"/);
  assert.match(generator, /aria-label="\{\{localize randomTooltipKey\}\}"/);
  assert.match(
    generatorApp,
    /randomTooltipKey: \{[\s\S]*?monster: "SIMPLYSF2E\.Generator\.RandomTooltip"[\s\S]*?npc: "SIMPLYSF2E\.Generator\.RandomNpcTooltip"[\s\S]*?encounter: "SIMPLYSF2E\.Generator\.RandomEncounterTooltip"[\s\S]*?character: "SIMPLYSF2E\.Generator\.RandomCharacterTooltip"/,
    "each mode must expose its own dice tooltip key"
  );
  assert.doesNotMatch(generatorApp, /generateRandomEncounter/);
  const lang = JSON.parse(langJson).SIMPLYSF2E.Generator;
  assert.match(lang.RandomTooltip, /Random creature/);
  assert.match(lang.RandomNpcTooltip, /Random NPC/);
  assert.match(lang.RandomEncounterTooltip, /Random encounter/);
  assert.match(lang.RandomCharacterTooltip, /Random character/);
}

// 2. The preset row renders in EVERY generator mode (one stable slot; the
//    guidance feeds all three pipelines, Random ignores it like the shared
//    dice button always has).
{
  const presetAt = generator.indexOf('class="form-group spf-preset stacked"');
  assert.ok(presetAt >= 0, "the preset row must exist");
  const before = generator.slice(Math.max(0, presetAt - 400), presetAt);
  assert.ok(
    !before.includes("{{#if singleMode}}"),
    "the preset row must not be gated to Single mode"
  );
}
assert.match(
  generatorApp,
  /preset: isRandom \? null : findPreset\(this\.#input\.preset\)\?\.prompt \?\? null,[\s\S]*?amount: this\.#input\.treasureAmount/,
  "encounter members must honor the selected preset"
);
assert.match(
  generatorApp,
  /generatePCConcept\(\{[\s\S]*?preset: isRandom \? null : findPreset\(this\.#input\.preset\)\?\.prompt \?\? null/,
  "character generation must honor the selected preset"
);

// 3. Source configuration stays visible: both windows carry a labeled
//    Compendium Content row in the status strip; the forge's Generate row has
//    no second gear beside it.
{
  const rowAt = itemForge.indexOf('class="spf-generate-row"');
  const gearAt = itemForge.indexOf('data-action="configureSources"');
  const labelAt = itemForge.indexOf("SIMPLYSF2E.Generator.CompendiumContent");
  const fieldsetAt = itemForge.indexOf("<fieldset");
  assert.ok(labelAt >= 0 && gearAt > labelAt && gearAt < fieldsetAt, "item forge sources gear must sit in the labeled Compendium Content row");
  assert.ok(rowAt > fieldsetAt && itemForge.indexOf('data-action="configureSources"', gearAt + 1) < 0, "item forge generate row must not repeat the sources gear");
}
assert.match(generator, /SIMPLYSF2E\.Generator\.CompendiumContent/);
assert.match(generator, /SIMPLYSF2E\.Generator\.SourcesReady/);
assert.match(generator, /data-action="configureSources"/);
for (const [name, source] of [
  ["generator", generatorApp],
  ["item forge", itemForgeApp]
]) {
  assert.match(source, /configureSources:/, `${name} must register the sources gear action`);
  assert.match(source, /new SourcesConfigApp\(\)\.render\(true\)/, `${name} sources gear must open the shared sources app`);
}

// 4. One stable options order in every mode: Level → rarity control →
//    Treasure → Spellcasting, with encounter extras appended AFTER the
//    shared columns.
{
  const levelAt = generator.indexOf('id="spf-generator-level"');
  const rarityCapAt = generator.indexOf('id="spf-generator-rarity-cap"');
  const rarityAt = generator.indexOf('id="spf-generator-rarity"');
  const treasureAt = generator.indexOf('id="spf-generator-treasure-amount"');
  const spellsAt = generator.indexOf('name="allowSpellcasting"');
  const partyAt = generator.indexOf('id="spf-generator-party-size"');
  const threatAt = generator.indexOf('id="spf-generator-threat"');
  for (const [label, at] of [["level", levelAt], ["rarity cap", rarityCapAt], ["rarity", rarityAt], ["treasure", treasureAt], ["spellcasting", spellsAt], ["party size", partyAt], ["threat", threatAt]]) {
    assert.ok(at >= 0, `options anchor must exist: ${label}`);
  }
  assert.ok(levelAt < rarityCapAt && levelAt < rarityAt, "Level must lead the options row");
  assert.ok(rarityAt < treasureAt && rarityCapAt < treasureAt, "the rarity control must precede Treasure amount");
  assert.ok(treasureAt < spellsAt, "Treasure amount must precede Allow spellcasting");
  assert.ok(spellsAt < partyAt && partyAt < threatAt, "encounter extras must append after the shared columns");
}

// 5. Window titles and prompt labels follow one pattern.
{
  const lang = JSON.parse(langJson).SIMPLYSF2E;
  assert.match(lang.Generator.Title, /^SimplySF2e — /, "generator title must follow the shared pattern");
  assert.match(lang.ItemForge.Title, /^SimplySF2e — /, "item forge title must follow the shared pattern");
  for (const [key, value] of [
    ["Generator.Prompt", lang.Generator.Prompt],
    ["Generator.CharacterPrompt", lang.Generator.CharacterPrompt],
    ["ItemForge.Prompt", lang.ItemForge.Prompt]
  ]) {
    assert.match(value, /^Describe the /, `${key} must follow the shared 'Describe the …' pattern`);
  }
  assert.match(lang.Generator.EncounterTheme, /^Describe the encounter theme \(optional\)$/,
    "the encounter label must follow the shared pattern with the surprise hint moved out");
  assert.match(lang.Generator.EncounterThemePlaceholder, /leave blank for a surprise/,
    "the surprise hint must live in the encounter placeholder");
}

// Native-choice review is an escaped, explicitly limited snapshot, not an actor repair.
const reviewCard = generator.slice(generator.indexOf("{{#if characterReview}}"));
assert.match(reviewCard, /role="status"/);
assert.match(reviewCard, /\{\{characterReview.actorName\}\}/);
assert.match(reviewCard, /\{\{this.itemName\}\}/);
assert.match(reviewCard, /\{\{localize this.prompt\}\}/);
assert.doesNotMatch(reviewCard, /\{\{\{/);
for (const action of ["openReviewedCharacter", "dismissCharacterReview"]) {
  assert.match(reviewCard, new RegExp(`data-action="${action}"`));
  assert.match(generatorApp, new RegExp(`${action}: GeneratorApp\\.#on`));
}
const reviewLanguage = JSON.parse(langJson).SIMPLYSF2E.Generator;
assert.match(reviewLanguage.ReviewHint, /snapshot.*not a full character validation/);
assert.match(reviewLanguage.ReviewHint, /conditional or intentionally disabled/);
assert.match(reviewLanguage.ReviewIncomplete, /Not every item/);
assert.match(generator, /pcPreview.skillPriorities/);
assert.match(generator, /pcPreview.automaticSkills/);
assert.match(reviewCard, /characterReview.skills.rows/);
assert.match(reviewCard, /\{\{this.name\}\} — \{\{this.rank\}\}/);
assert.match(reviewCard, /characterReview.skills.warnings/);
assert.match(JSON.parse(langJson).SIMPLYSF2E.Skills.Snapshot, /not a full character validation/);

// --- Starfinder 2e space-fantasy iconography ----------------------------
// Generation modes use sci-fi HUD icons, not PF2e-era fantasy glyphs:
// xenobiology (monster), personnel file (NPC), tactical ops (encounter),
// spacefarer operative (character). Mode values, radio names, and the
// radiogroup contract above are untouched — only the glyphs changed.
for (const [mode, icon] of [
  ["monster", "fa-dna"],
  ["npc", "fa-id-badge"],
  ["encounter", "fa-crosshairs"],
  ["character", "fa-user-astronaut"]
]) {
  assert.match(
    generator,
    new RegExp(`fa-solid ${icon}.*SIMPLYSF2E\\.Mode\\.${mode === "npc" ? "Npc" : mode[0].toUpperCase() + mode.slice(1)}`, "s"),
    `${mode} mode must render the ${icon} sci-fi glyph`
  );
}
assert.doesNotMatch(generator, /fa-dragon/, "fantasy dragon glyph must not remain in the generator");
assert.doesNotMatch(generator, /fa-user-tie/, "fantasy NPC glyph must not remain in the generator");
assert.doesNotMatch(generator, /fa-people-group/, "fantasy encounter glyph must not remain in the generator");
assert.doesNotMatch(generator, /fa-solid fa-user"/, "generic fantasy user glyph must not remain in the generator");
for (const hintKey of ["MonsterHint", "NpcHint", "EncounterHint", "CharacterHint"]) {
  assert.match(
    generator,
    new RegExp(`SIMPLYSF2E\\.Mode\\.${hintKey}`),
    `generation mode must expose its sci-fi descriptor tooltip: ${hintKey}`
  );
  assert.equal(
    typeof JSON.parse(langJson).SIMPLYSF2E.Mode[hintKey],
    "string",
    `Mode.${hintKey} must exist in en.json`
  );
}

// --- Cross-app sci-fi HUD chrome ------------------------------------------
// Every app root carries the shared HUD hook; the preset manager and the
// compendium sources add HUD card/accent treatment. Class-only changes:
// no data-action binding or control structure is altered.
for (const [name, template] of [
  ["item forge", itemForge],
  ["preset manager", managePresets],
  ["provider setup", providerSetup],
  ["compendium sources", sources]
]) {
  assert.match(template, /spf-hud/, `${name} must carry the shared sci-fi HUD hook`);
}
assert.match(managePresets, /spf-manage-list spf-card/, "preset rows must sit on the shared HUD card surface");
assert.match(managePresets, /spf-hud-actions/, "preset actions must carry the HUD treatment");
assert.match(sources, /spf-source-category spf-card/, "source categories must keep the shared card surface");
assert.match(sources, /spf-hud-accent/, "sources must carry a HUD accent line");
assert.match(sources, /fa-satellite-dish/, "sources hint must use a sci-fi uplink glyph");

// --- Sci-fi HUD infusion (Starfinder 2e space-fantasy chrome) -------------
// Holographic scanlines, chamfered corner ticks, neon primary/mode glow,
// telemetry progress, HUD readout legends, and console inputs — all
// on-palette (SF2e navy/cyan/violet), with motion yielding to reduced motion.
assert.match(css, /\.simplysf2e\s*\{[^}]*--spf-neon:/s, "HUD glow tokens must be defined");
assert.match(
  css,
  /\.application\.simplysf2e \.window-content\s*\{[^}]*repeating-linear-gradient/s,
  "window content must carry holographic scanline/grid texture"
);
assert.match(
  css,
  /\.simplysf2e \.spf-card\s*\{[^}]*repeating-linear-gradient/s,
  "cards must carry holographic scanline texture"
);
assert.match(
  css,
  /\.simplysf2e \.spf-card::before\s*\{[^}]*clip-path:\s*polygon/s,
  "cards must use chamfered angled corner ticks"
);
assert.match(
  css,
  /\.simplysf2e \.spf-card::after\s*\{[^}]*clip-path:\s*polygon/s,
  "cards must mirror the chamfer tick on the opposite corner"
);
assert.match(
  css,
  /\.simplysf2e button\.spf-primary\s*\{[^}]*--spf-neon/s,
  "the primary action must carry neon cyan/violet charge"
);
assert.match(
  css,
  /\.simplysf2e \.spf-mode-toggle label\.spf-mode-active\s*\{[^}]*text-shadow/s,
  "the active mode selector must carry neon glow"
);
assert.match(
  css,
  /\.simplysf2e \.spf-progress-bar\s*\{[^}]*repeating-linear-gradient\(90deg/s,
  "the progress bar must carry segmented telemetry divisions"
);
assert.match(
  css,
  /\.simplysf2e \.spf-progress-percent\s*\{[^}]*text-shadow/s,
  "the telemetry readout must glow"
);
assert.match(css, /@keyframes spf-telemetry-blink/, "telemetry pip motion must be a named keyframe");
assert.match(
  css,
  /\.simplysf2e \.spf-step-active i\s*\{[^}]*animation:\s*spf-telemetry-blink/s,
  "the active step pip must blink telemetry"
);
assert.match(
  css,
  /prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.simplysf2e \.spf-step-active i\s*\{[^}]*animation:\s*none/s,
  "telemetry motion must yield to reduced motion"
);
assert.match(
  css,
  /\.simplysf2e \.spf-inputs legend\s*\{[^}]*background:/s,
  "generator legends must render as HUD readout chips"
);
assert.match(
  css,
  /\.simplysf2e \.spf-source-category legend\s*\{[^}]*box-shadow/s,
  "source legends must render as HUD readout chips"
);
assert.match(css, /caret-color:\s*var\(--spf-brand-accent\)/, "console inputs must carry a cyan caret");
assert.match(
  css,
  /\.simplysf2e input\[type="number"\]\s*\{[^}]*tabular-nums/s,
  "numeric console readouts must use tabular figures"
);
for (const hook of ["spf-hud-accent", "spf-hud-actions", "spf-hud-frame", "spf-hud-list", "spf-hud-empty"]) {
  assert.match(
    css,
    new RegExp(`\\.simplysf2e \\.${hook}\\s*\\{`),
    `shared HUD hook .${hook} must be defined`
  );
}
assert.match(css, /\.simplysf2e \.spf-hud\s*\{[^}]*--spf-hud-on/s, "the app HUD root flag must be defined");

// --- Neon Drift overhaul ------------------------------------------------
// Mode-scoped theme classes, a shared statusbar strip, a grouped defense
// grid, and neon tokens: class/hook-only changes, no control structure
// or data-action binding is altered.
assert.match(generator, /<div class="spf-statusbar">[\s\S]*?spf-provider-summary[\s\S]*?spf-provider-summary/,
  "generator statusbar must wrap both provider rows in one container");
assert.doesNotMatch(generator, /spf-statusbar[\s\S]*spf-statusbar/,
  "generator must use a single statusbar container, not one per row");
assert.match(itemForge, /<div class="spf-statusbar">[\s\S]*?spf-provider-summary/,
  "item forge must wrap its provider row in the shared statusbar container");
for (const [mode, flag] of [["monster", "monsterMode"], ["npc", "npcMode"], ["encounter", "encounterMode"], ["character", "characterMode"]]) {
  assert.match(
    generator,
    new RegExp(`spf-mode-${mode}\\{\\{#if ${flag}\\}\\} spf-mode-active`),
    `${mode} mode toggle must carry its per-mode class alongside the active state`
  );
}
assert.match(generator, /<div class="spf-statgrid">[\s\S]*?spf-statline spf-defenses[\s\S]*?preview\.iwr\.weaknesses/,
  "monster preview must group defenses and IWR statlines inside the stat grid");
for (const key of ["immunities", "resistances", "weaknesses"]) {
  assert.match(
    generator,
    new RegExp(`preview\\.iwr\\.${key}`),
    `monster preview must retain its ${key} statline inside the stat grid`
  );
}
assert.match(css, /--spf-neon:\s*#ff2e88/, "neon magenta token must be defined");
assert.match(css, /--spf-amber:\s*#ffb347/, "amber token must be defined");
assert.match(css, /--spf-cut:/, "notch cut token must be defined");
for (const mode of ["monster", "npc", "encounter", "character"]) {
  assert.match(
    css,
    new RegExp(`--spf-mode-${mode}:`),
    `${mode} mode accent token must be defined`
  );
}
assert.match(css, /\.simplysf2e \.spf-statusbar\s*\{/, "statusbar strip must be styled");
assert.match(css, /\.simplysf2e \.spf-statgrid\s*\{/, "stat grid must be styled");
assert.match(css, /\.simplysf2e \.spf-card\s*\{[^}]*clip-path:/s, "cards must be notched via clip-path");

console.log("UI layout contract checks passed.");
