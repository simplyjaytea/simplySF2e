import {
  MODULE_ID, getProviderAuthWarningKey, getProviderRequestConfig,
  authorizeApiKeyForCurrentBaseUrl
} from "./settings.mjs";
import { generateShopConcept, selectShopStock } from "./ai.mjs";
import { getShopCandidates, getCandidateDocument, getPacksFor, toItemData, priceToGp } from "./compendium.mjs";
import {
  SHOP_SIZES, SHOP_CATEGORIES, SHOP_RARITIES, SHOP_MIN_LEVEL, SHOP_MAX_LEVEL,
  clampShopLevel, normalizeShopConcept, shopTypesFor, pickShopStock, shopStockValue, shopActorData
} from "./shop.mjs";
import { verifyCreatedActor } from "./post-create.mjs";
import { moveToGeneratedFolder } from "./folders.mjs";
import { SourcesConfigApp } from "./sources-app.mjs";
import { gpToCredits } from "./currency.mjs";
import { SpfApp } from "./app-base.mjs";

const TYPE_LABELS = {
  weapon: "SIMPLYSF2E.Shop.TypeWeapon",
  ammo: "SIMPLYSF2E.Shop.TypeAmmo",
  armor: "SIMPLYSF2E.Shop.TypeArmor",
  shield: "SIMPLYSF2E.Shop.TypeShield",
  equipment: "SIMPLYSF2E.Shop.TypeGear",
  backpack: "SIMPLYSF2E.Shop.TypeGear",
  consumable: "SIMPLYSF2E.Shop.TypeConsumable"
};

/**
 * Shop generator: describe a shop, the AI names it and picks its stock by ID
 * from real equipment-pack items of the shop's level, and Create makes a
 * native loot actor in Merchant mode holding exact compendium clones.
 */
export class ShopApp extends SpfApp {
  static DEFAULT_OPTIONS = {
    id: "simplysf2e-shop",
    tag: "form",
    classes: ["simplysf2e"],
    window: {
      title: "SIMPLYSF2E.Shop.Title",
      icon: "fa-solid fa-store",
      resizable: true
    },
    position: { width: 720, height: "auto" },
    actions: {
      generate: ShopApp.#onGenerate,
      createShop: ShopApp.#onCreateShop,
      discard: ShopApp.#onDiscard,
      removeStock: ShopApp.#onRemoveStock,
      authorizeApiKey: ShopApp.#onAuthorizeApiKey,
      configureProvider: ShopApp.#onConfigureProvider,
      configureSources: ShopApp.#onConfigureSources,
      testProvider: ShopApp.#onTestProvider,
      cancelGeneration: ShopApp.#onCancelGeneration,
      levelUp: ShopApp.#onLevelUp,
      levelDown: ShopApp.#onLevelDown,
      copyBugReport: ShopApp.#onCopyBugReport
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/shop.hbs`, scrollable: [""] }
  };

  #input = { prompt: "", level: 3, size: "standard", rarity: "common" };
  #busy = false;
  #error = null;
  /** Normalized shop concept of the current preview. */
  #concept = null;
  /** Stock rows: {key, name, type, level, rarity, credits, quantity, itemData}. */
  #stock = [];
  /** Shop level the stock was picked at (the form may change after). */
  #level = null;
  /** Picks dropped because the AI returned an ID that was not offered. */
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
        authState.baseUrl && authState.hasConfiguredApiKey && !authState.apiKeyIsBound
      ),
      model: authState.model,
      minLevel: SHOP_MIN_LEVEL,
      maxLevel: SHOP_MAX_LEVEL,
      sizes: Object.entries(SHOP_SIZES).map(([value, count]) => ({
        value, count, label: `SIMPLYSF2E.Shop.Size${value[0].toUpperCase()}${value.slice(1)}`
      })),
      rarities: SHOP_RARITIES.map((value) => ({
        value, label: `SIMPLYSF2E.Rarity.${value[0].toUpperCase()}${value.slice(1)}`
      })),
      preview: this.#buildPreviewContext(),
      tokenReport: this._buildTokenReport(),
      showEmptyState: !this.#busy && !this.#error && !this.#concept
    };
  }

  #buildPreviewContext() {
    if (!this.#concept) return null;
    const concept = this.#concept;
    const rows = this.#stock.map((row) => ({
      key: row.key,
      name: row.name,
      typeLabel: TYPE_LABELS[row.type] ?? "SIMPLYSF2E.Shop.TypeGear",
      level: row.level,
      rarity: row.rarity !== "common" ? row.rarity : null,
      price: `${row.credits.toLocaleString()}`,
      quantity: row.quantity
    }));
    return {
      concept,
      level: this.#level,
      categories: concept.categories.map((slug) => `SIMPLYSF2E.Shop.Category${slug[0].toUpperCase()}${slug.slice(1)}`),
      rows,
      hasStock: rows.length > 0,
      count: rows.length,
      total: shopStockValue(this.#stock).toLocaleString(),
      dropped: this.#dropped
    };
  }

  #readForm() {
    const form = this.element;
    if (!form) return;
    const prompt = form.querySelector('[name="prompt"]')?.value ?? this.#input.prompt;
    const level = clampShopLevel(form.querySelector('[name="level"]')?.value ?? this.#input.level, this.#input.level);
    const rawSize = form.querySelector('[name="size"]')?.value ?? this.#input.size;
    const size = Object.hasOwn(SHOP_SIZES, rawSize) ? rawSize : "standard";
    const rawRarity = form.querySelector('[name="rarity"]')?.value ?? this.#input.rarity;
    const rarity = SHOP_RARITIES.includes(rawRarity) ? rawRarity : "common";
    this.#input = { prompt, level, size, rarity };
  }

  _preserveForm() {
    this.#readForm();
  }

  static #onLevelUp() {
    this.#stepLevel(1);
  }

  static #onLevelDown() {
    this.#stepLevel(-1);
  }

  #stepLevel(delta) {
    const input = this.element.querySelector('input[name="level"]');
    if (!input) return;
    const current = Number.parseInt(input.value, 10);
    input.value = clampShopLevel((Number.isNaN(current) ? this.#input.level : current) + delta, this.#input.level);
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

  static async #onGenerate() {
    if (this.#busy) return;
    this.#readForm();
    if (!this.#input.prompt.trim()) {
      ui.notifications.warn(game.i18n.localize("SIMPLYSF2E.Shop.NoPrompt"));
      return;
    }
    if (!getPacksFor("equipment").some((packId) => game.packs?.get(packId))) {
      ui.notifications.error(game.i18n.localize("SIMPLYSF2E.Shop.NoEquipmentPack"));
      return;
    }
    this.#busy = true;
    this.#error = null;
    this._tokenUsage = [];
    this.#clearPreview();
    const { prompt, level, size, rarity } = this.#input;
    const count = SHOP_SIZES[size];
    const signal = this._beginProgress([
      ["shopConcept", game.i18n.localize("SIMPLYSF2E.Shop.ProgressConcept")],
      ["candidates", game.i18n.localize("SIMPLYSF2E.Shop.ProgressCandidates")],
      ["stock", game.i18n.localize("SIMPLYSF2E.Shop.ProgressStock")],
      ["prices", game.i18n.localize("SIMPLYSF2E.Shop.ProgressPrices")]
    ]);
    try {
      // 1. Flavor and search terms only.
      await this._setStep("shopConcept");
      const { concept: raw, usage } = await generateShopConcept({
        prompt, level, categories: Object.keys(SHOP_CATEGORIES),
        onProgress: (p) => this._onAIProgress(p), signal
      });
      this._recordTokens(game.i18n.localize("SIMPLYSF2E.Shop.ProgressConcept"), usage);
      const concept = normalizeShopConcept(raw);

      // 2. Real catalog: the shop's types, level or lower, rarity cap.
      await this._setStep("candidates");
      const { types } = shopTypesFor(concept.categories);
      const candidates = await getShopCandidates(level, concept.keywords, { types, maxRarity: rarity });
      if (!candidates.length) throw new Error(game.i18n.localize("SIMPLYSF2E.Shop.NoCandidates"));

      // 3. The AI picks IDs; only issued ones survive.
      await this._setStep("stock");
      const { ids, usage: stockUsage } = await selectShopStock({
        concept, candidates, count, gmPrompt: prompt,
        onProgress: (p) => this._onAIProgress(p), signal
      });
      this._recordTokens(game.i18n.localize("SIMPLYSF2E.Shop.ProgressStock"), stockUsage);
      const { stock, unknown } = pickShopStock(ids, candidates, count);
      for (const id of unknown) console.warn(`${MODULE_ID} | shop pick "${id}" was not on the offered list; dropped`);

      // 4. Exact documents: price and item data come from the compendium.
      await this._setStep("prices");
      const rows = [];
      for (const pick of stock) {
        const doc = await getCandidateDocument(pick);
        if (!doc) {
          console.warn(`${MODULE_ID} | shop pick "${pick.name}" did not resolve; dropped`);
          continue;
        }
        const itemData = toItemData(doc);
        itemData.system ??= {};
        itemData.system.quantity = pick.quantity;
        rows.push({
          key: pick.id,
          name: doc.name,
          type: doc.type,
          level: doc.system?.level?.value ?? pick.level,
          rarity: doc.system?.traits?.rarity ?? pick.rarity ?? "common",
          credits: gpToCredits(priceToGp(doc.system?.price?.value)),
          quantity: pick.quantity,
          itemData
        });
      }
      this._throwIfCancelled();
      if (!rows.length) throw new Error(game.i18n.localize("SIMPLYSF2E.Shop.NoStock"));
      rows.sort((a, b) => a.type.localeCompare(b.type) || a.level - b.level || a.name.localeCompare(b.name));
      this.#concept = concept;
      this.#stock = rows;
      this.#level = level;
      this.#dropped = unknown.length + (stock.length - rows.length);
    } catch (err) {
      if (err?.cancelled) console.warn(`${MODULE_ID} | shop generation cancelled`);
      else console.error(`${MODULE_ID} | shop generation failed`, err);
      this.#error = err.message;
      this._recordFailure(err, "shop generation", this.#error);
      this.#clearPreview();
    } finally {
      this.#busy = false;
      this._finishRun();
      await this.render();
    }
  }

  static async #onRemoveStock(_event, target) {
    if (this.#busy) return;
    const key = target?.dataset?.key;
    this.#readForm();
    this.#stock = this.#stock.filter((row) => row.key !== key);
    await this.render();
  }

  static async #onCreateShop() {
    if (this.#busy || !this.#concept || !this.#stock.length) return;
    this.#readForm();
    this.#busy = true;
    this.#error = null;
    let actor = null;
    try {
      await this.render();
      const items = this.#stock.map((row) => foundry.utils.deepClone(row.itemData));
      actor = await Actor.create(shopActorData(this.#concept, this.#level, items, {
        shopkeeperLabel: game.i18n.localize("SIMPLYSF2E.Shop.Shopkeeper")
      }));
      verifyCreatedActor(actor, { complete: true }, items);
      const created = actor;
      actor = null;
      await moveToGeneratedFolder(created, "shop");
      // Committed: consume the draft before presentation so a sheet error
      // cannot lead to a duplicate shop.
      this.#clearPreview();
      ui.notifications.info(game.i18n.format("SIMPLYSF2E.Shop.Created", { name: created.name }));
      try {
        await created.sheet.render(true);
      } catch (err) {
        console.warn(`${MODULE_ID} | shop created, but its sheet could not be displayed`, err);
      }
    } catch (err) {
      console.error(`${MODULE_ID} | shop creation failed`, err);
      // Roll back a half-made merchant so a failed create leaves nothing behind.
      if (actor?.id) {
        try { await actor.delete(); } catch (deleteErr) { console.warn(`${MODULE_ID} | could not roll back shop`, deleteErr); }
      }
      this.#error = err.message;
      this._recordFailure(err, "shop creation", this.#error);
    } finally {
      this.#busy = false;
      await this.render();
    }
  }

  static async #onCopyBugReport() {
    this.#readForm();
    return this._copyBugReport("Shop", { ...this.#input });
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
    this.#stock = [];
    this.#level = null;
    this.#dropped = 0;
  }
}
