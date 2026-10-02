// Item Forge window. Shapes follow ItemForgeApp._prepareContext(),
// #buildPreviewContext() (wondrous / augmentation / crystal) and
// #buildRunedPreviewContext() (weapon / armor) in scripts/itemforge-app.mjs.
import { RARITIES, providerContext, PROVIDER_ATTENTION, TOKEN_REPORT, progressAt, localize } from "./_shared.mjs";

const KINDS = [
  { value: "wondrous", label: "SIMPLYSF2E.ItemForge.KindWondrous", hint: "SIMPLYSF2E.ItemForge.KindWondrousHint", icon: "fa-ring" },
  { value: "weapon", label: "SIMPLYSF2E.ItemForge.KindWeapon", hint: "SIMPLYSF2E.ItemForge.KindWeaponHint", icon: "fa-sword" },
  { value: "armor", label: "SIMPLYSF2E.ItemForge.KindArmor", hint: "SIMPLYSF2E.ItemForge.KindArmorHint", icon: "fa-shield-halved" },
  { value: "augmentation", label: "SIMPLYSF2E.ItemForge.KindAugmentation", hint: "SIMPLYSF2E.ItemForge.KindAugmentationHint", icon: "fa-microchip" },
  { value: "crystal", label: "SIMPLYSF2E.ItemForge.KindCrystal", hint: "SIMPLYSF2E.ItemForge.KindCrystalHint", icon: "fa-gem" }
];

const FORGE_STEPS = [
  ["templates", "Scanning published items"],
  ["concept", "Drafting the item"],
  ["resolve", "Resolving components"]
];

export function itemforgeContext(kind, patch = {}) {
  const input = { prompt: "", level: 4, rarity: "common", kind, ...(patch.input ?? {}) };
  const { input: _ignored, ...rest } = patch;
  return {
    input,
    busy: false,
    canCancel: false,
    error: null,
    progress: null,
    ...providerContext(),
    minLevel: 1,
    maxLevel: 20,
    kinds: KINDS.map((k) => ({ ...k, selected: k.value === kind })),
    rarities: RARITIES,
    unavailableNote: null,
    preview: null,
    showEmptyState: true,
    ...rest
  };
}

const wondrous = (kind = "wondrous") => ({
  concept: {
    name: kind === "crystal" ? "Resonant Solarian Crystal of the Long Dusk" : "Mindshutter Band",
    level: 6,
    description: "A narrow band of matte alloy that hums when anyone nearby tries to read the wearer's thoughts."
  },
  traits: ["uncommon", "invested", "tech"],
  usage: "worn headband",
  bulk: "L",
  price: "2,150 gp",
  invested: true,
  effects: ["Item bonus +1 to Perception", "Resistance 3 mental"],
  hasEffects: true,
  activation: "<strong>Activate</strong> [reaction] — attempt a DC 24 Will save; 1/day"
});

export default [
  ...KINDS.map((k) => ({
    id: `itemforge-empty-${k.value}`,
    app: "itemforge",
    context: itemforgeContext(k.value)
  })),
  {
    id: "itemforge-empty-attention",
    app: "itemforge",
    context: itemforgeContext("wondrous", { ...PROVIDER_ATTENTION })
  },
  {
    id: "itemforge-busy",
    app: "itemforge",
    // ItemForgeApp._prepareContext() has no busyMessage; _progress.hbs reads it.
    optionalKeys: ["busyMessage"],
    context: itemforgeContext("wondrous", {
      input: { prompt: "A band that hides thoughts" }, busy: true, canCancel: true, showEmptyState: false,
      progress: progressAt(FORGE_STEPS, 1, { phase: "thinking", percent: 22, detail: "Thinking…" })
    })
  },
  {
    id: "itemforge-error",
    app: "itemforge",
    context: itemforgeContext("wondrous", {
      error: "The provider returned no usable item. Try rewording the prompt.", showEmptyState: false,
      unavailableNote: localize("SIMPLYSF2E.ItemForge.KindsUnavailable", { kinds: "weakness, immunity, speed" })
    })
  },
  {
    id: "itemforge-wondrous-preview",
    app: "itemforge",
    context: itemforgeContext("wondrous", { showEmptyState: false, tokenReport: TOKEN_REPORT, lastRunCost: "Last run: 1,840 tokens", preview: wondrous() })
  },
  {
    id: "itemforge-wondrous-no-effects",
    app: "itemforge",
    context: itemforgeContext("wondrous", {
      showEmptyState: false,
      preview: { ...wondrous(), effects: [], hasEffects: false, activation: null, invested: false }
    })
  },
  {
    id: "itemforge-augmentation-preview",
    app: "itemforge",
    context: itemforgeContext("augmentation", { showEmptyState: false, preview: { ...wondrous("augmentation"), usage: "implanted" } })
  },
  {
    id: "itemforge-crystal-preview",
    app: "itemforge",
    context: itemforgeContext("crystal", { showEmptyState: false, preview: wondrous("crystal") })
  },
  ...["weapon", "armor"].map((kind) => ({
    id: `itemforge-${kind}-preview`,
    app: "itemforge",
    context: itemforgeContext(kind, {
      showEmptyState: false, tokenReport: TOKEN_REPORT,
      preview: {
        concept: { name: kind === "weapon" ? "Tactical Plasma Rifle, Advanced" : "Advanced Fortress Plate", level: 5, description: "Grade-native gear with installed upgrade modules." },
        traits: ["uncommon", "tech"],
        price: "1,350 credits",
        runed: true,
        grade: "advanced",
        upgrades: ["Flaming (installed in a weapon)", "Ghost Touch (installed in a weapon)"],
        potency: 0,
        secondary: null,
        propertyRunes: []
      }
    })
  }))
];
