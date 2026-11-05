// Final Welcome states. Shape follows WelcomeApp._prepareContext()
// (welcome-app.mjs); no connection behavior runs in the preview harness.
import { localize } from "./_shared.mjs";

const providers = [
  { id: "openrouter", label: "OpenRouter", icon: "fa-cloud", selected: true, recommended: true, note: "" },
  { id: "openai", label: "OpenAI", icon: "fa-cloud", selected: false, recommended: false, note: "" },
  { id: "deepseek", label: "DeepSeek", icon: "fa-cloud", selected: false, recommended: false, note: "" },
  { id: "google", label: "Google", icon: "fa-cloud", selected: false, recommended: false, note: localize("SIMPLYSF2E.Welcome.LiveCheckPending") },
  { id: "ollama", label: "Ollama", icon: "fa-server", selected: false, recommended: false, note: "" }
];

function welcome(patch = {}) {
  return {
    readinessWarning: "",
    providers: providers.map((provider) => ({ ...provider })),
    selectedProvider: "OpenRouter",
    apiKey: "",
    keyless: false,
    showBaseUrl: false,
    baseUrl: "",
    model: "",
    availableModels: [],
    modelChoice: false,
    connectDisabled: true,
    connecting: false,
    connected: false,
    connectionProvider: "",
    errorMessage: "",
    advancedOpen: false,
    dismissed: false,
    ...patch
  };
}

export default [
  { id: "welcome-fresh", app: "welcome", context: welcome() },
  {
    id: "welcome-key-entered",
    app: "welcome",
    context: welcome({ apiKey: "sk-or-v1-preview-only", connectDisabled: false })
  },
  {
    id: "welcome-connecting",
    app: "welcome",
    context: welcome({ apiKey: "sk-or-v1-preview-only", connecting: true })
  },
  {
    id: "welcome-model-choice",
    app: "welcome",
    context: welcome({
      modelChoice: true,
      availableModels: ["deepseek/deepseek-v4.1-flash", "openai/gpt-6-luna"]
    })
  },
  {
    id: "welcome-connected",
    app: "welcome",
    context: welcome({
      connected: true,
      connectionProvider: "OpenRouter",
      model: "deepseek/deepseek-v4.1-flash"
    })
  },
  {
    id: "welcome-error",
    app: "welcome",
    context: welcome({
      apiKey: "sk-or-v1-preview-only",
      connectDisabled: false,
      errorMessage: localize("SIMPLYSF2E.Welcome.BadKeyMessage", { provider: "OpenRouter" })
    })
  },
  { id: "welcome-advanced", app: "welcome", context: welcome({ advancedOpen: true }) },
  {
    id: "welcome-ollama",
    app: "welcome",
    context: welcome({
      providers: providers.map((provider) => ({ ...provider, selected: provider.id === "ollama" })),
      selectedProvider: "Ollama",
      keyless: true,
      showBaseUrl: true,
      baseUrl: "http://localhost:11434/v1",
      connectDisabled: false
    })
  },
  {
    id: "welcome-readiness-warning",
    app: "welcome",
    context: welcome({
      readinessWarning: localize("SIMPLYSF2E.Welcome.SourcesMissing", { categories: "Spells" })
    })
  }
];
