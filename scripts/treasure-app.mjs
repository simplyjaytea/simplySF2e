import {
  MODULE_ID, getProviderAuthWarningKey, getProviderRequestConfig,
  authorizeApiKeyForCurrentBaseUrl
} from "./settings.mjs";
import { generateTreasureConcept, selectTreasureItems } from "./ai.mjs";
import { getShopCandidates, getCandidateDocument, getPacksFor, toItemData, priceToGp } from "./compendium.mjs";
import { SHOP_CATEGORIES, shopTypesFor } from "./shop.mjs";
import {
  TREASURE_AMOUNTS, TREASURE_PICKS, TREASURE_RARITIES, TREASURE_MIN_LEVEL, TREASURE_MAX_LEVEL,
  TREASURE_MIN_PARTY, TREASURE_MAX_PARTY, clampTreasureLevel, clampPartySize, treasureBudgetCredits,
  creditsEach, normalizeTreasureConcept, resolveIssuedPicks, fillHoard, hoardLeftover, treasureActorData
} from "./treasure.mjs";
import { verifyCreatedActor } from "./post-create.mjs";
import { moveToGeneratedFolder } from "./folders.mjs";
import { SourcesConfigApp } from "./sources-app.mjs";
import { gpToCredits, assembleCurrency, splitCurrency } from "./currency.mjs";
import { activeParty } from "./party.mjs";
import { SpfApp } from "./app-base.mjs";

/**
 * Treasure hoard: describe a theme, the module sets the budget from the GM
 * Core Treasure by Level table, the AI picks items by ID from real equipment
 * of the party's level or lower, and Create makes a native loot actor holding
 * exact compendium clones plus a Credstick for the leftover credits.
 */
export class TreasureApp extends SpfApp {
  static DEFAULT_OPTIONS = {
    id: "simplysf2e-treasure",
    tag: "form",
    classes: ["simplysf2e"],
    window: {
      title: "SIMPLYSF2E.Treasure.Title",
      icon: "fa-solid fa-gem",
      resizable: true
    },
    position: { width: 720, height: "auto" },
    actions: {
      generate: TreasureApp.#onGenerate,
      reroll: TreasureApp.#onGenerate,
      createTreasure: TreasureApp.#onCreateTreasure,
      discard: TreasureApp.#onDiscard,
      removeItem: TreasureApp.#onRemoveItem,
      useParty: TreasureApp.#onUseParty,
      authorizeApiKey: TreasureApp.#onAuthorizeApiKey,
      configureProvider: TreasureApp.#onConfigureProvider,
      configureSources: TreasureApp.#onConfigureSources,
      testProvider: TreasureApp.#onTestProvider,
      cancelGeneration: TreasureApp.#onCancelGeneration,
      levelUp: TreasureApp.#onLevelUp,
      levelDown: TreasureApp.#onLevelDown,
      partyUp: TreasureApp.#onPartyUp,
      partyDown: TreasureApp.#onPartyDown,
      copyBugReport: TreasureApp.#onCopyBugReport
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/treasure.hbs`, scrollable: [""] }
  };

  #input = { prompt: "", level: 3, partySize: 4, amount: "encounter", rarity: "common" };
  #busy = false;
  #error = null;
  /** Normalized treasure concept of the current preview. */
  #concept = null;
  /** Item rows: {key, name, type, level, rarity, credits, quantity, itemData}. */
  #items = [];
  /** Level, party size and budget the hoard was filled at (the form may change after). */
  #level = null;
  #partySize = null;
  #budget = 0;
  /** The "How much" the shown hoard was filled for (the form may change after). */
  #amount = null;
  /** Picks dropped: not offered, unpriced, or over budget. */
  #dropped = 0;

  async _prepareContext() {
    const authState = getProviderRequestConfig();
    const authWarningKey = getProviderAuthWarningKey(authState);
    return {
      input: this.#input,
      busy: this.#busy,
      canCancel: this._canCancel,
      lastRunCost: this._formatLastRunCost(),
      error: this.#error,
      canReportBug: this._canReportBug(this.#error),
      progress: this._progress,
      apiKeyWarning: authWarningKey ? game.i18n.localize(authWarningKey) : null,
      providerBaseUrl: authState.baseUrl,
      provider: authState.provider,
      connectionName: authState.connectionName,
      connections: authState.connections ?? [],
      canSwitchConnection: (authState.connections?.length ?? 0) > 1,
      providerReady: !authWarningKey,
      canAuthorizeApiKey: Boolean(
        authState.baseUrl && authState.hasConfiguredApiKey && !authState.apiKeyIsBound && !authState.apiKeyInsecure
      ),
      model: authState.model,
      minLevel: TREASURE_MIN_LEVEL,
      maxLevel: TREASURE_MAX_LEVEL,
      minParty: TREASURE_MIN_PARTY,
      maxParty: TREASURE_MAX_PARTY,
      party: activeParty(),
      amounts: TREASURE_AMOUNTS.map((value) => ({
        value, label: `SIMPLYSF2E.Treasure.Amount${value[0].toUpperCase()}${value.slice(1)}`
      })),
      rarities: TREASURE_RARITIES.map((value) => ({
        value, label: `SIMPLYSF2E.Rarity.${value[0].toUpperCase()}${value.slice(1)}`
      })),
      preview: this.#buildPreviewContext(),
      tokenReport: this._buildTokenReport(),
      showEmptyState: !this.#busy && !this.#error && !this.#concept
    };
  }

  #buildPreviewContext() {
    if (!this.#concept) return null;
    const rows = this.#items.map((row) => ({
      key: row.key,
      name: row.name,
      level: row.level,
      rarity: row.rarity !== "common" ? row.rarity : null,
      price: row.credits.toLocaleString()
    }));
    const leftover = hoardLeftover(this.#budget, this.#items);
    return {
      concept: this.#concept,
      level: this.#level,
      rows,
      hasItems: rows.length > 0,
      count: rows.length,
      leftover: leftover.toLocaleString(),
      hasLeftover: leftover > 0,
      budget: this.#budget.toLocaleString(),
      each: creditsEach(this.#budget, this.#partySize).toLocaleString(),
      partySize: this.#partySize,
      amount: this.#amount,
      dropped: this.#dropped
    };
  }

  #readForm() {
    const form = this.element;
    if (!form) return;
    const prompt = form.querySelector('[name="prompt"]')?.value ?? this.#input.prompt;
    const level = clampTreasureLevel(form.querySelector('[name="level"]')?.value ?? this.#input.level, this.#input.level);
    const partySize = clampPartySize(form.querySelector('[name="partySize"]')?.value ?? this.#input.partySize, this.#input.partySize);
    const rawAmount = form.querySelector('[name="amount"]')?.value ?? this.#input.amount;
    const amount = TREASURE_AMOUNTS.includes(rawAmount) ? rawAmount : "encounter";
    const rawRarity = form.querySelector('[name="rarity"]')?.value ?? this.#input.rarity;
    const rarity = TREASURE_RARITIES.includes(rawRarity) ? rawRarity : "common";
    this.#input = { prompt, level, partySize, amount, rarity };
  }

  _preserveForm() {
    this.#readForm();
  }

  static #onLevelUp() {
    this.#stepNumber("level", 1, clampTreasureLevel);
  }

  static #onLevelDown() {
    this.#stepNumber("level", -1, clampTreasureLevel);
  }

  static #onPartyUp() {
    this.#stepNumber("partySize", 1, clampPartySize);
  }

  static #onPartyDown() {
    this.#stepNumber("partySize", -1, clampPartySize);
  }

  #stepNumber(name, delta, clamp) {
    const input = this.element.querySelector(`input[name="${name}"]`);
    if (!input) return;
    const current = Number.parseInt(input.value, 10);
    input.value = clamp((Number.isNaN(current) ? this.#input[name] : current) + delta, this.#input[name]);
  }

  /** Fill party level and size from the world's active party (same as Encounter mode). */
  static async #onUseParty() {
    if (this.#busy) return;
    this.#readForm();
    const party = activeParty();
    if (!party) {
      ui.notifications.warn(game.i18n.localize("SIMPLYSF2E.Party.None"));
      return;
    }
    this.#input.level = clampTreasureLevel(party.level, this.#input.level);
    this.#input.partySize = clampPartySize(party.size, this.#input.partySize);
    ui.notifications.info(game.i18n.format("SIMPLYSF2E.Party.Filled", { name: party.name }));
    await this.render();
  }

  static async #onAuthorizeApiKey(_event, target) {
    this.#readForm();
    const authorized = await authorizeApiKeyForCurrentBaseUrl(target.dataset.baseUrl);
    if (authorized) {
      ui.notifications.info(game.i18n.localize("SIMPLYSF2E.Generator.ApiKeyAuthorized"));
    } else {
      ui.notifications.warn(game.i18n.localize("SIMPLYSF2E.Generator.ApiKeyAuthorizationFailed"));
    }
    await this.render();
  }

  static #onConfigureProvider() {
    this.#readForm();
    this._openProviderSetup();
  }

  static #onConfigureSources() {
    this.#readForm();
    new SourcesConfigApp().render(true);
  }

  static async #onTestProvider(_event, target) {
    await this._testProvider(target);
  }

  static #onCancelGeneration() {
    this._cancelGeneration();
  }

  /** Generate and Reroll both run the whole pipeline again from the form. */
  static async #onGenerate() {
    if (this.#busy) return;
    this.#readForm();
    if (!getPacksFor("equipment").some((packId) => game.packs?.get(packId))) {
      ui.notifications.error(game.i18n.localize("SIMPLYSF2E.Treasure.NoEquipmentPack"));
      return;
    }
    this.#busy = true;
    this.#error = null;
    this._tokenUsage = [];
    this.#clearPreview();
    const { prompt, level, partySize, amount, rarity } = this.#input;
    const budget = treasureBudgetCredits(level, amount);
    const signal = this._beginProgress([
      ["treasureConcept", game.i18n.localize("SIMPLYSF2E.Treasure.ProgressConcept")],
      ["candidates", game.i18n.localize("SIMPLYSF2E.Treasure.ProgressCandidates")],
      ["picks", game.i18n.localize("SIMPLYSF2E.Treasure.ProgressPicks")],
      ["prices", game.i18n.localize("SIMPLYSF2E.Treasure.ProgressPrices")]
    ]);
    try {
      // 1. Flavor and search terms only.
      await this._setStep("treasureConcept");
      const { concept: raw, usage } = await generateTreasureConcept({
        prompt, level, categories: Object.keys(SHOP_CATEGORIES),
        onProgress: (p) => this._onAIProgress(p), signal
      });
      this._recordTokens(game.i18n.localize("SIMPLYSF2E.Treasure.ProgressConcept"), usage);
      const concept = normalizeTreasureConcept(raw);

      // 2. Real catalog: party level or lower, rarity cap.
      await this._setStep("candidates");
      const { types } = shopTypesFor(concept.categories);
      const candidates = await getShopCandidates(level, concept.keywords, { types, maxRarity: rarity });
      if (!candidates.length) throw new Error(game.i18n.localize("SIMPLYSF2E.Treasure.NoCandidates"));

      // 3. The AI picks IDs; only issued ones survive.
      await this._setStep("picks");
      const { ids, usage: pickUsage } = await selectTreasureItems({
        concept, candidates, count: TREASURE_PICKS[amount], amount, gmPrompt: prompt,
        onProgress: (p) => this._onAIProgress(p), signal
      });
      this._recordTokens(game.i18n.localize("SIMPLYSF2E.Treasure.ProgressPicks"), pickUsage);

      // 4. Exact documents: the price is the compendium document's own, read
      // the way the shop does (priceToGp, then gpToCredits).
      await this._setStep("prices");
      const { issued } = resolveIssuedPicks(ids, candidates);
      const priced = [];
      const docs = new Map();
      for (const candidate of issued) {
        if (docs.has(candidate.id)) continue;
        const doc = await getCandidateDocument(candidate);
        if (!doc) {
          console.warn(`${MODULE_ID} | treasure pick "${candidate.name}" did not resolve; dropped`);
          continue;
        }
        docs.set(candidate.id, doc);
        priced.push({ ...candidate, credits: gpToCredits(priceToGp(doc.system?.price?.value)) });
      }
      const hoard = fillHoard(ids, priced, budget);
      const offered = new Set(issued.map((candidate) => candidate.id));
      for (const id of hoard.unknown) {
        // Issued picks whose document failed to load were warned above.
        if (!offered.has(id)) console.warn(`${MODULE_ID} | treasure pick "${id}" was not on the offered list; dropped`);
      }
      for (const name of hoard.overBudget) console.warn(`${MODULE_ID} | treasure pick "${name}" does not fit the budget; dropped`);
      for (const name of hoard.unpriced) console.warn(`${MODULE_ID} | treasure pick "${name}" has no price; dropped`);

      const rows = hoard.items.map((pick) => {
        const doc = docs.get(pick.id);
        const itemData = toItemData(doc);
        itemData.system ??= {};
        itemData.system.quantity = 1;
        return {
          key: pick.id,
          name: doc.name,
          type: doc.type,
          level: doc.system?.level?.value ?? pick.level,
          rarity: doc.system?.traits?.rarity ?? pick.rarity ?? "common",
          credits: pick.credits,
          quantity: 1,
          itemData
        };
      });
      this._throwIfCancelled();
      if (!rows.length) throw new Error(game.i18n.localize("SIMPLYSF2E.Treasure.NoItems"));
      this.#concept = concept;
      this.#items = rows;
      this.#level = level;
      this.#partySize = partySize;
      this.#budget = budget;
      this.#amount = amount;
      this.#dropped = hoard.unknown.length + hoard.overBudget.length + hoard.unpriced.length;
    } catch (err) {
      if (err?.cancelled) console.warn(`${MODULE_ID} | treasure generation cancelled`);
      else console.error(`${MODULE_ID} | treasure generation failed`, err);
      this.#error = err.message;
      this._recordFailure(err, "treasure generation", this.#error);
      this.#clearPreview();
    } finally {
      this.#busy = false;
      this._finishRun();
      await this.render();
    }
  }

  static async #onRemoveItem(_event, target) {
    if (this.#busy) return;
    const key = target?.dataset?.key;
    this.#readForm();
    this.#items = this.#items.filter((row) => row.key !== key);
    await this.render();
  }

  static async #onCreateTreasure() {
    if (this.#busy || !this.#concept) return;
    this.#readForm();
    this.#busy = true;
    this.#error = null;
    let actor = null;
    try {
      await this.render();
      const items = this.#items.map((row) => foundry.utils.deepClone(row.itemData));
      // Removed rows hand their price back, so the Credstick holds whatever
      // the budget has left (cited credstick.json template, see currency.mjs).
      // One Credstick holds at most CURRENCY_ITEM_MAX credits, so a large
      // leftover (high levels, whole level) goes on several.
      for (const part of splitCurrency(hoardLeftover(this.#budget, this.#items))) {
        const credstick = assembleCurrency("credits", part);
        if (!credstick) throw new Error(game.i18n.localize("SIMPLYSF2E.Treasure.NoItems"));
        items.push(credstick);
      }
      if (!items.length) throw new Error(game.i18n.localize("SIMPLYSF2E.Treasure.NoItems"));
      actor = await Actor.create(treasureActorData(this.#concept, this.#level, items));
      verifyCreatedActor(actor, { complete: true }, items);
      const created = actor;
      actor = null;
      await moveToGeneratedFolder(created, "treasure");
      // Committed: consume the draft before presentation so a sheet error
      // cannot lead to a duplicate hoard.
      this.#clearPreview();
      ui.notifications.info(game.i18n.format("SIMPLYSF2E.Treasure.Created", { name: created.name }));
      try {
        await created.sheet.render(true);
      } catch (err) {
        console.warn(`${MODULE_ID} | treasure created, but its sheet could not be displayed`, err);
      }
    } catch (err) {
      console.error(`${MODULE_ID} | treasure creation failed`, err);
      // Roll back a half-made hoard so a failed create leaves nothing behind.
      if (actor?.id) {
        try { await actor.delete(); } catch (deleteErr) { console.warn(`${MODULE_ID} | could not roll back treasure`, deleteErr); }
      }
      this.#error = err.message;
      this._recordFailure(err, "treasure creation", this.#error);
    } finally {
      this.#busy = false;
      await this.render();
    }
  }

  static async #onCopyBugReport() {
    this.#readForm();
    return this._copyBugReport("Treasure", { ...this.#input });
  }

  static async #onDiscard() {
    if (this.#busy) return;
    if (!await this._confirm("SIMPLYSF2E.Generator.DiscardTitle", "SIMPLYSF2E.Generator.DiscardConfirm")) return;
    if (this.#busy) return;
    this.#readForm();
    this.#clearPreview();
    this.#error = null;
    this._tokenUsage = [];
    await this.render();
  }

  #clearPreview() {
    this.#concept = null;
    this.#items = [];
    this.#level = null;
    this.#partySize = null;
    this.#budget = 0;
    this.#amount = null;
    this.#dropped = 0;
  }
}
