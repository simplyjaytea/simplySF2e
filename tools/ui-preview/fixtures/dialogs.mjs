// The three small dialogs. Shapes follow ProviderSetupApp._prepareContext()
// (provider-setup-app.mjs), SourcesConfigApp._prepareContext() (sources-app.mjs)
// and ManagePresetsApp._prepareContext() (manage-presets-app.mjs).
import { localize } from "./_shared.mjs";

// Copied from PROVIDER_PRESETS in provider-setup-app.mjs, which cannot be
// imported here because it needs the Foundry application classes at load.
const PROVIDER_PRESETS = [
  { id: "deepseek", label: "DeepSeek", icon: "fa-cloud" },
  { id: "openai", label: "OpenAI", icon: "fa-cloud" },
  { id: "openrouter", label: "OpenRouter", icon: "fa-cloud" },
  { id: "ollama", label: "Ollama", icon: "fa-server" },
  { id: "lmstudio", label: "LM Studio", icon: "fa-server" },
  { id: "custom", label: "Custom", icon: "fa-sliders" }
];

const CATEGORY_LABELS = {
  abilities: "SIMPLYSF2E.Sources.Abilities",
  spells: "SIMPLYSF2E.Sources.Spells",
  feats: "SIMPLYSF2E.Sources.Feats",
  equipment: "SIMPLYSF2E.Sources.Equipment",
  ancestries: "SIMPLYSF2E.Sources.Ancestries",
  backgrounds: "SIMPLYSF2E.Sources.Backgrounds",
  classes: "SIMPLYSF2E.Sources.Classes",
  classFeatures: "SIMPLYSF2E.Sources.ClassFeatures",
  heritages: "SIMPLYSF2E.Sources.Heritages",
  bestiaryActors: "SIMPLYSF2E.Sources.BestiaryActors"
};

function providerSetup(selected, patch = {}) {
  // The active connection is the one named by connectionName, so the select, the name field and the preset agree.
  const connectionName = patch.connectionName ?? "OpenRouter";
  return {
    providers: PROVIDER_PRESETS.map((provider) => ({ ...provider, selected: provider.id === selected })),
    connections: [
      { id: "c1", name: connectionName, active: true },
      { id: "c2", name: "Home Ollama", active: false }
    ],
    connectionName,
    canDeleteConnection: true,
    apiBaseUrl: "https://openrouter.ai/api/v1",
    model: "anthropic/claude-sonnet-5",
    availableModels: [],
    inputPerM: "",
    outputPerM: "",
    hasApiKey: true,
    hasJevKey: false,
    jevSources: [
      { id: "openrouter", label: "OpenRouter", selected: true },
      { id: "typesafe", label: "TypeSafe AI", selected: false }
    ],
    jevOnTypeSafe: false,
    jevEndpoint: "",
    jevDefaultEndpoint: "https://api.typesafe.ai/v1/systemone",
    jevKeyPlaceholder: localize("SIMPLYSF2E.ProviderSetup.JevKeyPlaceholder", { source: "OpenRouter" }),
    // Contract (docs/ui-contract.md, item 2): fold state and summaries.
    pricesOpen: false,
    priceError: null,
    priceErrorField: null,
    pricesSummary: null,
    jevOpen: false,
    showLocalHint: ["ollama", "lmstudio", "custom"].includes(selected),
    localServerHint: localize("SIMPLYSF2E.ProviderSetup.LocalServerHint", { origin: "http://localhost:30000" }),
    ...patch
  };
}

const pack = (id, title, pkg, checked, isDefault) => ({ id, title, package: pkg, checked, isDefault });

// Contract (docs/ui-contract.md, item 4): `filter` state, per-pack and
// per-category `hidden`, per-category `selectedCount`. Mirrors the pure
// helper the app must add (a case-insensitive match on title, package or id;
// "Selected only" keeps checked packs).
const packMatches = (pack, { query, selectedOnly }) => {
  const q = query.trim().toLowerCase();
  if (selectedOnly && !pack.checked) return false;
  return !q || [pack.title, pack.package, pack.id].some((text) => text.toLowerCase().includes(q));
};

function sources(patch = {}) {
  const filter = { query: "", selectedOnly: false, ...(patch.filter ?? {}) };
  const active = Boolean(filter.query.trim()) || filter.selectedOnly;
  const categories = Object.entries(CATEGORY_LABELS).map(([key, label]) => {
    const packs = [
      pack(`sf2e.${key}`, key === "bestiaryActors" ? "Alien Core Bestiary" : `${key[0].toUpperCase()}${key.slice(1)} (SF2e)`, "sf2e", true, true),
      pack(`homebrew.${key}`, `Homebrew ${key} with a deliberately long compendium title for wrapping`, "starfinder-homebrew-collection", key === "spells", false)
    ].map((p) => ({ ...p, hidden: active && !packMatches(p, filter) }));
    return {
      key, label, packs,
      selectedCount: packs.filter((p) => p.checked).length,
      hidden: active && packs.every((p) => p.hidden)
    };
  });
  const emptied = patch.noPacks ? categories.map((c) => ({ ...c, packs: [], selectedCount: 0, hidden: false })) : categories;
  const all = emptied.flatMap((c) => c.packs);
  const shown = all.filter((p) => !p.hidden).length;
  return {
    categories: emptied,
    noPacks: emptied.every((c) => !c.packs.length),
    filter: { ...filter, active, shown, total: all.length, noMatches: active && shown === 0 }
  };
}

const preset = (id, name) => ({ id, name });

export default [
  { id: "provider-setup-saved", app: "provider-setup", context: providerSetup("openrouter") },
  {
    id: "provider-setup-fresh",
    app: "provider-setup",
    context: providerSetup("custom", {
      connections: [{ id: "c1", name: "New connection", active: true }], connectionName: "New connection",
      canDeleteConnection: false, apiBaseUrl: "", model: "", hasApiKey: false
    })
  },
  {
    id: "provider-setup-models-loaded",
    app: "provider-setup",
    context: providerSetup("ollama", {
      connectionName: "Home Ollama", connections: [{ id: "c1", name: "Home Ollama", active: true }, { id: "c2", name: "OpenRouter", active: false }],
      apiBaseUrl: "http://localhost:11434/v1", model: "llama3.1:70b-instruct-q4_K_M", hasApiKey: false,
      availableModels: ["llama3.1:70b-instruct-q4_K_M", "qwen2.5:32b", "mistral-nemo:12b"]
    })
  },
  {
    id: "provider-setup-prices",
    app: "provider-setup",
    context: providerSetup("deepseek", {
      connectionName: "DeepSeek", apiBaseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash",
      inputPerM: 0.27, outputPerM: 1.1, pricesSummary: { input: "$0.27", output: "$1.10" }
    })
  },
  {
    id: "provider-setup-prices-open",
    app: "provider-setup",
    open: ["[data-section='prices']"],
    context: providerSetup("deepseek", {
      connectionName: "DeepSeek", apiBaseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash",
      inputPerM: 0.27, outputPerM: 1.1, pricesSummary: { input: "$0.27", output: "$1.10" }
    })
  },
  {
    // A save with a bad price: the section opened itself and shows the error.
    id: "provider-setup-price-error",
    app: "provider-setup",
    context: providerSetup("deepseek", {
      connectionName: "DeepSeek", apiBaseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash",
      inputPerM: -2, outputPerM: 1.1, pricesOpen: true,
      priceError: localize("SIMPLYSF2E.ProviderSetup.PriceInputInvalid"),
      priceErrorField: "input"
    })
  },
  {
    id: "provider-setup-jev-typesafe",
    app: "provider-setup",
    context: providerSetup("openai", {
      connectionName: "OpenAI",
      apiBaseUrl: "https://api.openai.com/v1", model: "gpt-5.6-luna", hasJevKey: true,
      jevSources: [
        { id: "openrouter", label: "OpenRouter", selected: false },
        { id: "typesafe", label: "TypeSafe AI", selected: true }
      ],
      jevOnTypeSafe: true,
      jevOpen: true,
      jevEndpoint: "https://jev-proxy.example.com/v1/systemone",
      jevKeyPlaceholder: localize("SIMPLYSF2E.ProviderSetup.JevKeyPlaceholder", { source: "TypeSafe AI" })
    })
  },
  { id: "sources-default", app: "sources", height: 640, context: sources() },
  { id: "sources-no-packs", app: "sources", context: sources({ noPacks: true }) },
  { id: "sources-filtered", app: "sources", height: 640, context: sources({ filter: { query: "spell" } }) },
  { id: "sources-selected-only", app: "sources", height: 640, context: sources({ filter: { query: "homebrew", selectedOnly: true } }) },
  { id: "sources-no-match", app: "sources", height: 640, context: sources({ filter: { query: "pathfinder" } }) },
  {
    id: "manage-presets-list",
    app: "manage-presets",
    context: { presets: [preset("p1", "Vesk raider band"), preset("p2", "Corporate security (a deliberately very long preset name that must not break the row)"), preset("p3", "Void cultists")] }
  },
  { id: "manage-presets-empty", app: "manage-presets", context: { presets: [] } }
];
