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
  return {
    providers: PROVIDER_PRESETS.map((provider) => ({ ...provider, selected: provider.id === selected })),
    connections: [
      { id: "c1", name: "OpenRouter", active: true },
      { id: "c2", name: "Home Ollama", active: false }
    ],
    connectionName: "OpenRouter",
    canDeleteConnection: true,
    apiBaseUrl: "https://openrouter.ai/api/v1",
    model: "anthropic/claude-sonnet-5",
    availableModels: [],
    hasApiKey: true,
    hasJevKey: false,
    showLocalHint: ["ollama", "lmstudio", "custom"].includes(selected),
    localServerHint: localize("SIMPLYSF2E.ProviderSetup.LocalServerHint", { origin: "http://localhost:30000" }),
    ...patch
  };
}

const pack = (id, title, pkg, checked, isDefault) => ({ id, title, package: pkg, checked, isDefault });

function sources(patch = {}) {
  const categories = Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
    key,
    label,
    packs: [
      pack(`sf2e.${key}`, key === "bestiaryActors" ? "Alien Core Bestiary" : `${key[0].toUpperCase()}${key.slice(1)} (SF2e)`, "sf2e", true, true),
      pack(`homebrew.${key}`, `Homebrew ${key} with a deliberately long compendium title for wrapping`, "starfinder-homebrew-collection", false, false)
    ]
  }));
  const emptied = patch.noPacks ? categories.map((c) => ({ ...c, packs: [] })) : categories;
  return { categories: emptied, noPacks: emptied.every((c) => !c.packs.length) };
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
      apiBaseUrl: "http://localhost:11434/v1", model: "llama3.1:70b-instruct-q4_K_M", hasApiKey: false,
      availableModels: ["llama3.1:70b-instruct-q4_K_M", "qwen2.5:32b", "mistral-nemo:12b"]
    })
  },
  { id: "sources-default", app: "sources", height: 640, context: sources() },
  { id: "sources-no-packs", app: "sources", context: sources({ noPacks: true }) },
  {
    id: "manage-presets-list",
    app: "manage-presets",
    context: { presets: [preset("p1", "Vesk raider band"), preset("p2", "Corporate security (a deliberately very long preset name that must not break the row)"), preset("p3", "Void cultists")] }
  },
  { id: "manage-presets-empty", app: "manage-presets", context: { presets: [] } }
];
