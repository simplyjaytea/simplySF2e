// First-run welcome. Shape follows WelcomeApp._prepareContext() (welcome-app.mjs):
// welcomeState() from welcome.mjs plus the localized strings the app adds.
import { localize } from "./_shared.mjs";

function welcome(patch = {}) {
  return {
    system: { ready: true, version: "1.5.1", minimum: "1.5.0" },
    sources: { ready: true, missing: [], packCount: 10 },
    provider: { ready: true, warningKey: null },
    jev: { on: true, source: "connection" },
    ready: true,
    sourcesMissing: "",
    providerWarning: "",
    dismissed: false,
    ...patch
  };
}

export default [
  {
    id: "welcome-first-run",
    app: "welcome",
    context: welcome({
      provider: { ready: false, warningKey: "SIMPLYSF2E.Generator.NoApiKey" },
      providerWarning: localize("SIMPLYSF2E.Generator.NoApiKey"),
      jev: { on: false, source: null },
      ready: false
    })
  },
  {
    id: "welcome-problems",
    app: "welcome",
    context: welcome({
      system: { ready: false, version: "1.4.2", minimum: "1.5.0" },
      sources: { ready: false, missing: ["spells", "bestiaryActors"], packCount: 6 },
      sourcesMissing: "Spells, Bestiary Actors",
      provider: { ready: false, warningKey: "SIMPLYSF2E.Generator.ApiKeyNotAuthorized" },
      providerWarning: localize("SIMPLYSF2E.Generator.ApiKeyNotAuthorized"),
      jev: { on: false, source: null },
      ready: false,
      dismissed: true
    })
  },
  { id: "welcome-all-ready", app: "welcome", context: welcome() }
];
