// API Base URL credential refusal: the URL is a world setting every player can
// read, so user:pass@ and key-like query parameters are refused on every write path.
// Run: node scripts/provider-connect.url-secrets.test.mjs
import assert from "node:assert/strict";
import {
  SETTINGS, apiBaseUrlCredentialInfo, apiBaseUrlCredentialReason, getProviderAuthWarningKey, getProviderRequestConfig, createProviderConnection, chatCompletionsUrl
} from "./settings.mjs";
import { saveProviderConnection } from "./provider-connect.mjs";

const values = new Map();
let writes = 0;
globalThis.game = {
  i18n: {
    localize: (key) => key,
    format: (key, data = {}) => `${key} ${JSON.stringify(data)}`
  },
  settings: {
    get: (_moduleId, key) => values.get(key),
    set: async (_moduleId, key, value) => { writes += 1; values.set(key, structuredClone(value)); return value; }
  }
};
globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };

// Pure function
const reason = apiBaseUrlCredentialReason;
assert.equal(reason("https://user:pass@gw.example/v1"), "userinfo");
assert.equal(reason("https://user@gw.example/v1"), "userinfo");
assert.equal(reason("https://:pass@gw.example/v1"), "userinfo");
const names = [
  "key", "apikey", "api-key", "token", "access-token", "auth", "authorization", "secret",
  "password", "subscription-key", "ocp-apim-subscription-key", "sig", "signature", "code",
  "x-custom-key", "my-token", "app-secret"
];
for (const name of names) {
  for (const variant of [name, name.toUpperCase(), name.replace(/-/g, "_"), name.replace(/-/g, "_").toUpperCase(), name[0].toUpperCase() + name.slice(1)]) {
    assert.equal(reason(`https://gw.example/v1?${variant}=abc`), "query-secret", variant);
    assert.equal(reason(`https://gw.example/v1?api-version=1&${variant}=abc`), "query-secret", `second: ${variant}`);
  }
}
assert.equal(reason("https://gw.example/v1?api-version=1"), null);
assert.equal(reason("https://gw.example/v1?deployment=x&api-version=2"), null);
for (const ok of ["version", "model", "region", "project", "keyword", "tokens", "monkey"]) {
  assert.equal(reason(`https://gw.example/v1?${ok}=1`), null, ok);
}
assert.equal(reason("https://gw.example/v1"), null);
assert.equal(reason(""), null);
assert.equal(reason("not a url"), null);
assert.equal(reason(undefined), null);

// saveProviderConnection: refuses before any write; names the parameter, never the value.
for (const [url, expectKey, mustHave] of [
  ["https://user:hunter2@gw.example/v1", "BaseUrlHasUserinfo", null],
  ["https://gw.example/v1?API_KEY=hunter2", "BaseUrlHasSecret", "API_KEY"],
  ["https://gw.example/v1?api-version=1&Subscription-Key=hunter2", "BaseUrlHasSecret", "Subscription-Key"]
]) {
  writes = 0;
  await assert.rejects(
    saveProviderConnection({ baseUrl: url, model: "m", enteredApiKey: "k", notify: false }),
    (error) => {
      assert.ok(error.message.includes(expectKey), error.message);
      if (mustHave) assert.ok(error.message.includes(mustHave), error.message);
      assert.ok(!error.message.includes("hunter2"), "secret value leaked");
      return true;
    }
  );
  assert.equal(writes, 0, `no settings write for ${url}`);

  // createProviderConnection fails closed the same way.
  await assert.rejects(createProviderConnection({ name: "x", apiBaseUrl: url, model: "m" }), (error) => {
    assert.ok(error.message.includes(expectKey), error.message);
    assert.ok(!error.message.includes("hunter2"));
    return true;
  });
  assert.equal(writes, 0, `no write from createProviderConnection for ${url}`);
}

// Non-secret gateway parameters still save and stay after the appended path.
await saveProviderConnection({ baseUrl: "https://gw.example/v1?api-version=2024-06-01", model: "m", notify: false });
assert.equal(values.get(SETTINGS.apiBaseUrl), "https://gw.example/v1?api-version=2024-06-01");
assert.equal(chatCompletionsUrl("https://gw.example/v1?api-version=2024-06-01"),
  "https://gw.example/v1/chat/completions?api-version=2024-06-01");

// Non-blocking flag for an ALREADY stored URL (Provider Setup shows a standing warning).
{
  const live = (url) => { values.set(SETTINGS.apiBaseUrl, url); values.set(SETTINGS.providerBank, { activeId: "", connections: [] }); };
  live("https://gw.example/v1?api-key=SECRET");
  assert.equal(getProviderRequestConfig().baseUrlCredential, "query-secret");
  live("https://user:pw@gw.example/v1");
  assert.equal(getProviderRequestConfig().baseUrlCredential, "userinfo");
  live("https://gw.example/v1?api-version=2");
  assert.equal(getProviderRequestConfig().baseUrlCredential, null);
  live("");
  assert.equal(getProviderRequestConfig().baseUrlCredential, null);
  assert.deepEqual(apiBaseUrlCredentialInfo("https://gw.example/v1?API_KEY=SECRET"), { reason: "query-secret", name: "API_KEY" });
  assert.equal(JSON.stringify(apiBaseUrlCredentialInfo("https://gw.example/v1?api-key=SECRET")).includes("SECRET"), false, "never the value");
  assert.deepEqual(apiBaseUrlCredentialInfo("https://u:p@gw.example/v1"), { reason: "userinfo", name: "" });

  // Generation readiness is unchanged by a credential-bearing stored URL (the flag must not block).
  const base = { model: "m", hasConfiguredApiKey: true, apiKeyIsBound: true, apiKeyInsecure: false, keylessLocal: false };
  for (const url of ["https://gw.example/v1?api-key=SECRET", "https://u:p@gw.example/v1", "https://gw.example/v1"]) {
    assert.equal(
      getProviderAuthWarningKey({ ...base, baseUrl: url, baseUrlCredential: apiBaseUrlCredentialReason(url) }, "https:"),
      null, `${url}: still ready`
    );
  }
}

console.log("provider-connect.url-secrets tests passed");
