import { testProviderConnection } from "./ai.mjs";
import {
  MODULE_ID,
  getActiveProviderPrices,
  getJevRequestConfig,
  getProviderRequestConfig,
  getSetting,
  selectProviderConnection,
  SETTINGS
} from "./settings.mjs";
import { BUG_REPORT_ISSUE_URL, captureFailure, formatBugReport, gatherEnvironment } from "./bug-report.mjs";
import { esc } from "./text.mjs";
import { beginRunBudget, endRunBudget } from "./run-budget.mjs";
import { ProviderSetupApp } from "./provider-setup-app.mjs";
import {
  PHASE_FILL,
  applyStep,
  createProgress,
  progressPercent,
  progressPhaseClass,
  resetStreamPhase,
  stepElapsed,
  streamFraction
} from "./progress.mjs";
import { coarsenTokenEstimate, lastRunTokenTotal } from "./tokens.mjs";
import { formatCost, runCost } from "./cost.mjs";
import { carryOpenFolds, resultArrives, windowBodyClassName } from "./window-parts.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Another open window runs a generation (its progress or run budget is live); the connection must not change under it. */
export function anotherRunInProgress(self) {
  for (const app of foundry.applications.instances?.values?.() ?? []) {
    if (app !== self && (app?._progress || app?._generationAbort)) return true;
  }
  return false;
}

/**
 * Buttons for the bug-report dialogs. The issue URL carries no report text:
 * the GM pastes the copied report into the new issue.
 */
function issueButtons() {
  return [
    {
      action: "issue",
      label: "SIMPLYSF2E.BugReport.OpenIssue",
      icon: "fa-solid fa-arrow-up-right-from-square",
      callback: () => { window.open(BUG_REPORT_ISSUE_URL, "_blank", "noopener"); }
    },
    { action: "close", label: "SIMPLYSF2E.BugReport.ManualClose", default: true }
  ];
}

/**
 * After the active connection changed, re-render every OTHER open window that
 * shows connection state: the four tool windows (their drafts are kept by
 * `_preserveForm`) and Provider Setup (which keeps unsaved edits and guards
 * its own Save). `self` already rendered itself.
 */
export async function refreshOtherConnectionViews(self) {
  for (const app of [...(foundry.applications.instances?.values?.() ?? [])]) {
    if (app === self) continue;
    try {
      if (app instanceof SpfApp) {
        app._preserveForm();
        await app._renderStatus();
      } else if (app instanceof ProviderSetupApp) {
        await app._refreshForConnectionChange();
      }
    } catch (err) {
      console.warn(`${MODULE_ID} | could not refresh a window after the connection changed`, err);
    }
  }
}

/**
 * Shared base for the generator and item-forge dialogs: token-usage tracking
 * and the generate-progress step machinery, identical across both apps.
 * Subclasses use `_tokenUsage`/`_progress` and the `_`-prefixed helpers.
 */
export class SpfApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * The window's entry in WINDOW_PARTS (window-parts.mjs). A subclass that
   * sets it renders its parts (status, brief, result) inside one persistent
   * `.spf-window-body` element; null keeps Foundry's own single-root layout.
   */
  static WINDOW_ID = null;

  /** Whether a result card that a finished run replaced in place plays its arrival (window-parts.mjs `resultArrives`). */
  static ARRIVE_AFTER_RUN = true;
  /** Whether the window's content rises in once each time the window opens (Welcome, What's new). Never on a re-render. */
  static ARRIVE_ON_OPEN = false;
  /** Class attribute of the body element for the render in progress. */
  _bodyClassName = "spf-window-body";
  /** Exact token usage per AI call of the last generation: [{label, usage}]. */
  _tokenUsage = [];
  _progress = null;
  /** Compact last finished run: {total, estimated} or null. */
  _lastRunCost = null;
  _generationAbort = null;
  _canCancel = false;
  /** True once the window was closed, so a late pipeline `render()` cannot reopen it. */
  _closed = false;
  /**
   * Set to true right before a render that must show input the app itself
   * just set (a mode switch, a preset's defaults, a chat command...): the form
   * on screen still shows the old values, so reading it back would undo the
   * change. Set it with no await before the `render` call; that render
   * consumes it.
   */
  _skipFormReadOnce = false;
  _closePromptOpen = false;
  /** Window frame the shortcut is bound to; a reopened window gets a new frame. */
  _keysElement = null;
  /** Snapshot of the last failed run for Copy bug report (see bug-report.mjs). */
  _failure = null;
  _bugReportBusy = false;

  /**
   * Remember a failure for the bug report. Call it in the catch, before
   * `_finishRun()` drops the progress steps, with the exact error text shown.
   */
  _recordFailure(err, operation, shown) {
    try {
      this._failure = captureFailure(err, { operation, shown, progress: this._progress });
    } catch (captureErr) {
      console.warn(`${MODULE_ID} | could not record failure for the bug report`, captureErr);
      this._failure = null;
    }
  }

  /** True when `shown` is the error of the recorded failure and it was not a cancel. */
  _canReportBug(shown) {
    const failure = this._failure;
    return Boolean(shown && failure && !failure.cancelled && failure.shown === shown);
  }

  /** Build the report for this window's last failure and copy it to the clipboard. */
  async _copyBugReport(appName, input) {
    if (!this._failure || this._bugReportBusy) return;
    this._bugReportBusy = true;
    try {
      await this._deliverBugReport(appName, input);
    } catch (err) {
      console.error(`${MODULE_ID} | could not build the bug report`, err);
      ui.notifications.error(game.i18n.localize("SIMPLYSF2E.BugReport.Failed"));
    } finally {
      this._bugReportBusy = false;
    }
  }

  async _deliverBugReport(appName, input) {
    const failure = this._failure;
    const { env, secrets } = gatherEnvironment({
      moduleId: MODULE_ID,
      provider: getProviderRequestConfig(),
      jev: getJevRequestConfig(),
      getSetting
    });
    const text = formatBugReport({ app: appName, failure, input, env, secrets });
    const { DialogV2 } = foundry.applications.api;
    if (await this._writeClipboard(text)) {
      await DialogV2.wait({
        window: { title: "SIMPLYSF2E.BugReport.CopiedTitle" },
        content: `<p>${esc(game.i18n.localize("SIMPLYSF2E.BugReport.Copied"))}</p>`,
        buttons: issueButtons(),
        rejectClose: false
      });
      return;
    }
    // No clipboard access (plain-http world, denied permission): show the
    // text selected so the GM can copy it by hand.
    await DialogV2.wait({
      window: { title: "SIMPLYSF2E.BugReport.ManualTitle" },
      position: { width: 640 },
      content: `<p>${esc(game.i18n.localize("SIMPLYSF2E.BugReport.ManualHint"))}</p>`
        + `<textarea class="spf-bug-report-text" readonly rows="14" aria-label="${esc(game.i18n.localize("SIMPLYSF2E.BugReport.ManualTitle"))}">${esc(text)}</textarea>`,
      buttons: issueButtons(),
      rejectClose: false,
      render: (_event, dialog) => {
        const area = (dialog?.element ?? dialog)?.querySelector?.(".spf-bug-report-text");
        // After the dialog's own autofocus on its button, or Ctrl+C copies nothing.
        requestAnimationFrame(() => {
          area?.focus();
          area?.select();
        });
      }
    });
  }

  /**
   * Clipboard write; false when the browser refuses. Uses the browser API
   * directly because it throws on refusal, so "Copied" is never shown falsely.
   */
  async _writeClipboard(text) {
    try {
      if (!globalThis.navigator?.clipboard?.writeText) return false;
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn(`${MODULE_ID} | clipboard copy failed`, err);
      return false;
    }
  }

  /** Yes/No dialog; resolves false when declined or dismissed. */
  async _confirm(titleKey, bodyKey) {
    const { DialogV2 } = foundry.applications.api;
    return Boolean(await DialogV2.confirm({
      window: { title: titleKey },
      content: `<p>${game.i18n.localize(bodyKey)}</p>`,
      rejectClose: false
    }));
  }

  /**
   * Closing (X or Esc) while a provider run is cancellable asks first; Yes
   * aborts the run so no more tokens are spent, No keeps the window open.
   */
  async close(options = {}) {
    if (this._canCancel) {
      if (this._closePromptOpen) return this;
      this._closePromptOpen = true;
      let stop;
      try {
        stop = await this._confirm("SIMPLYSF2E.Progress.CloseTitle", "SIMPLYSF2E.Progress.CloseConfirm");
      } finally {
        this._closePromptOpen = false;
      }
      if (!stop) return this;
      this._cancelGeneration();
    }
    this._closed = true;
    return super.close(options);
  }

  /**
   * A forced render (re)opens the window; a plain render after close is dropped.
   * Every render of a window already on screen first reads its form back
   * (`_preserveForm`), because a render replaces the form with the stored
   * input: without the read, a GM's typed-but-unused edits snap back.
   */
  async render(options = {}, _options = {}) {
    const forced = options === true || options?.force === true;
    // Consume a skip-once request even when this render is dropped, so it never leaks to a later one.
    const skipFormRead = this._skipFormReadOnce;
    this._skipFormReadOnce = false;
    if (this._closed && !forced) return this;
    if (forced) this._closed = false;
    if (!skipFormRead) this._keepFormBeforeRender();
    return super.render(options, _options);
  }

  /** Read the on-screen form into the app's input; nothing before the first render. */
  _keepFormBeforeRender() {
    if (!this.element) return;
    try {
      this._preserveForm();
    } catch (err) {
      console.warn(`${MODULE_ID} | could not read the form before a render`, err);
    }
  }

  /**
   * Show a changed connection, model or key state. In a tool window only the
   * status strip reads them, so the form and the preview keep their DOM.
   */
  async _renderStatus() {
    return this.render(this.constructor.WINDOW_ID ? { parts: ["status"] } : {});
  }

  /** Open the focused provider setup and refresh this app after it saves. */
  _openProviderSetup() {
    ProviderSetupApp.open(() => this._renderStatus());
  }

  /**
   * Subclasses that keep unsaved form drafts override this to read the form
   * into their input. `render` calls it before every re-render.
   */
  _preserveForm() {}

  /** Localized unit letters for the progress card's elapsed times. */
  _elapsedUnits() {
    return {
      seconds: game.i18n.localize("SIMPLYSF2E.Progress.UnitSeconds"),
      minutes: game.i18n.localize("SIMPLYSF2E.Progress.UnitMinutes")
    };
  }

  /**
   * Activate a saved connection from the compact header switch. The live
   * request config follows that profile; unknown ids fail closed.
   */
  async _switchActiveConnection(id) {
    const current = getProviderRequestConfig().connectionId;
    if (!id || id === current) return;
    // A run in this window or in another one reads the connection per request: refuse, do not switch under it.
    if (this._progress || this._generationAbort || anotherRunInProgress(this)) {
      ui.notifications.warn("SIMPLYSF2E.ProviderSetup.BusySwitch", { localize: true });
      const select = this.element?.querySelector?.("[name='activeConnection']");
      if (select) select.value = current;
      return;
    }
    this._preserveForm();
    await selectProviderConnection(id);
    await this._renderStatus();
    await refreshOtherConnectionViews(this);
  }

  /** Remember the body classes this render's context asks for, before the parts are built. */
  async _renderHTML(context, options) {
    const windowId = this.constructor.WINDOW_ID;
    if (windowId) this._bodyClassName = windowBodyClassName(windowId, context);
    this._renderBusy = Boolean(context?.busy);
    return super._renderHTML(context, options);
  }

  /**
   * Tool windows keep one `.spf-window-body` element for their whole life and
   * swap parts inside it. Foundry's own replacement runs against that element,
   * so a part that was not re-rendered keeps its DOM, focus and listeners, and
   * the body keeps its scroll position. Open folds are carried into the new
   * markup, and each new part element gets its listeners exactly once.
   */
  _replaceHTML(result, content, options) {
    if (!this.constructor.WINDOW_ID) return super._replaceHTML(result, content, options);
    let body = content.querySelector(":scope > .spf-window-body");
    if (!body) {
      body = document.createElement("div");
      content.replaceChildren(body);
      this._resultState = null;   // a new frame: a stored result is shown, it does not arrive
    }
    body.className = this._bodyClassName;
    for (const [partId, element] of Object.entries(result)) {
      carryOpenFolds(body.querySelector(`:scope > [data-application-part="${partId}"]`), element);
    }
    super._replaceHTML(result, body, options);
    for (const [partId, element] of Object.entries(result)) {
      try {
        this._onPartRendered(partId, element);
      } catch (err) {
        console.error(`${MODULE_ID} | could not bind the "${partId}" part`, err);
      }
    }
  }

  /**
   * Bind listeners on a part element that was just put in the window. It runs
   * once per element: a part that a render leaves alone is not bound again.
   * Subclasses extend it and call super.
   */
  _onPartRendered(partId, element) {
    if (partId === "result") this._playResultArrival(element);
    if (partId !== "status") return;
    element.querySelector?.("[name='activeConnection']")?.addEventListener("change", (event) =>
      this._switchActiveConnection(event.currentTarget.value)
    );
  }

  /**
   * Motion "arrive": the result card rises in once when it comes on screen
   * (`resultArrives`). The class only starts a CSS animation (transform and
   * opacity, off under reduced motion); nothing waits for it.
   */
  _playResultArrival(element) {
    const card = element.querySelector?.(".spf-preview") ?? null;
    const now = { busy: Boolean(this._renderBusy), kind: card ? (card.dataset?.result || "card") : "" };
    const arrives = resultArrives(now, this._resultState ?? null, { afterRun: this.constructor.ARRIVE_AFTER_RUN });
    this._resultState = now;
    if (arrives) card.classList?.add("spf-arrive");
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    // The frame survives re-renders but not close and reopen, so bind once per frame.
    if (this._keysElement !== this.element && this.element?.addEventListener) {
      this._keysElement = this.element;
      if (this.constructor.ARRIVE_ON_OPEN) this.element.querySelector?.(".spf-window-body")?.classList?.add("spf-arrive");
      this.element.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey) || event.isComposing) return;
        const generate = this.element.querySelector("[data-action='generate']");
        if (!generate || generate.disabled) return;
        event.preventDefault();
        generate.click();
      });
      // The wheel scrolls the window, never steps a focused number box
      // (Level, Party Size) the pointer happens to pass over.
      this.element.addEventListener("wheel", (event) => {
        const target = event.target;
        if (target?.matches?.("input[type='number']") && target === document.activeElement) target.blur();
      }, { passive: true });
    }
  }

  /**
   * Verify the exact production request path without re-rendering the form,
   * which would otherwise discard text the GM has typed but not generated.
   */
  async _testProvider(target) {
    if (target.disabled) return;
    const icon = target.querySelector("i");
    const originalClass = icon?.className;
    target.disabled = true;
    if (icon) icon.className = "fa-solid fa-spinner fa-spin";
    try {
      const usage = await testProviderConnection();
      const { provider, model } = getProviderRequestConfig();
      ui.notifications.info(game.i18n.format("SIMPLYSF2E.ProviderSetup.TestSuccess", {
        provider: provider.name,
        model,
        total: usage.total.toLocaleString()
      }));
    } catch (err) {
      console.error("simplysf2e | provider connection test failed", err);
      ui.notifications.error("SIMPLYSF2E.ProviderSetup.TestFailed", {
        localize: true,
        format: { message: err?.message ?? String(err) },
        escape: true
      });
    } finally {
      target.disabled = false;
      if (icon && originalClass) icon.className = originalClass;
    }
  }

  /**
   * Record one AI call's token usage under a step label. `timing` (optional,
   * `{ source: "jev"|"llm", ms, jevMs? }`) is shown on the token report line.
   */
  _recordTokens(label, usage, timing = null) {
    if (!usage) return;
    // Snapshot the manual prices of the connection making this request: a later
    // connection switch, a mid-run switch or a restored history draft must not reprice it.
    let prices = { inputPerM: null, outputPerM: null };
    let connectionId = "";
    try { prices = getActiveProviderPrices(); } catch { /* no bank yet: no manual prices */ }
    try { connectionId = getProviderRequestConfig().connectionId ?? ""; } catch { /* unknown connection */ }
    this._tokenUsage.push({ label, usage, prices, connectionId, ...(timing ? { timing } : {}) });
  }

  /** Per-step token usage lines plus a total, ready for the template. */
  _buildTokenReport() {
    if (!this._tokenUsage.length) return null;
    const stepTotal = (usage) => usage.estimated
      ? coarsenTokenEstimate(usage.total || 0)
      : (usage.total || 0);
    const total = this._tokenUsage.reduce((sum, e) => sum + stepTotal(e.usage), 0);
    const anyEstimated = this._tokenUsage.some((e) => e.usage.estimated);
    return {
      steps: this._tokenUsage.map(({ label, usage, timing }) => {
        const showSplit = !usage.estimated && ((usage.prompt || 0) > 0 || (usage.completion || 0) > 0);
        const text = usage.estimated
          ? game.i18n.format("SIMPLYSF2E.Tokens.StepEstimated", {
              total: coarsenTokenEstimate(usage.total || 0).toLocaleString()
            })
          : showSplit
            ? game.i18n.format("SIMPLYSF2E.Tokens.Step", {
                prompt: usage.prompt.toLocaleString(),
                completion: usage.completion.toLocaleString(),
                total: usage.total.toLocaleString()
              })
            : game.i18n.format("SIMPLYSF2E.Tokens.StepTotal", {
                total: (usage.total || 0).toLocaleString()
              });
        const via = this._formatStepTiming(timing);
        return { label, text: via ? `${text} · ${via}` : text };
      }),
      totalText: game.i18n.format(
        anyEstimated ? "SIMPLYSF2E.Tokens.TotalEstimated" : "SIMPLYSF2E.Tokens.Total",
        { total: total.toLocaleString() }
      ),
      costText: this._formatRunCost(this._runCostInfo())
    };
  }

  /** Cost of this run: provider-reported amounts, else each entry's own recorded manual prices. */
  _runCostInfo() {
    return runCost(this._tokenUsage.map(({ usage, timing, prices }) => ({
      ...usage,
      prices: prices ?? {},
      // Jev runs on its own model: the chat connection's prices do not apply to it.
      ...(timing?.source === "jev" ? { noManual: true } : {})
    })));
  }

  /** "Cost: $0.0042" / "Cost: ≈ $0.0042 (partial: ...)"; null when nothing could be priced. */
  _formatRunCost(info) {
    const amount = info ? formatCost(info.amount) : null;
    if (!amount) return null;
    const key = info.partial ? "CostPartial"
      : info.source === "manual" ? "CostManual"
      : info.source === "mixed" ? "CostMixed"
      : "Cost";
    return game.i18n.format(`SIMPLYSF2E.Tokens.${key}`, { amount });
  }

  /** "Jev, 0.8 s" / "chat model, 6.1 s" / fallback wording; null without a usable timing. */
  _formatStepTiming(timing) {
    const ms = Number(timing?.ms);
    if (!Number.isFinite(ms) || ms < 0 || !["jev", "llm"].includes(timing?.source)) return null;
    const seconds = (ms / 1000).toFixed(1);
    const key = timing.source === "jev"
      ? "SIMPLYSF2E.Tokens.ViaJev"
      : Number.isFinite(Number(timing.jevMs)) ? "SIMPLYSF2E.Tokens.ViaChatFallback" : "SIMPLYSF2E.Tokens.ViaChat";
    return game.i18n.format(key, { seconds });
  }

  /** Compact last-run copy for the provider strip. Null when no finished run. */
  _formatLastRunCost() {
    const cost = this._lastRunCost;
    if (!cost) return null;
    const base = game.i18n.format(
      cost.estimated ? "SIMPLYSF2E.Tokens.LastRunEstimated" : "SIMPLYSF2E.Tokens.LastRun",
      { total: cost.total.toLocaleString() }
    );
    const amount = cost.money ? formatCost(cost.money.amount) : null;
    if (!amount) return base;
    const mark = cost.money.partial ? "≥ " : cost.money.source !== "provider" ? "≈ " : "";
    return game.i18n.format("SIMPLYSF2E.Tokens.LastRunCost", { base, cost: `${mark}${amount}` });
  }

  _armCancel({ cancellable = true } = {}) {
    this._disarmCancel();
    this._generationAbort = new AbortController();
    // A non-cancellable step still runs AI calls, so it still gets a run budget
    // and deadline; it just must not offer a cancel affordance.
    this._canCancel = Boolean(cancellable);
    const signal = this._generationAbort.signal;
    const minutes = Number(getSetting(SETTINGS.runDeadline)) || 0;
    beginRunBudget(signal, {
      tokenBudget: Number(getSetting(SETTINGS.runTokenBudget)),
      deadlineMs: minutes > 0 ? minutes * 60000 : 0
    });
    return signal;
  }

  _disarmCancel() {
    const signal = this._generationAbort?.signal;
    if (signal) endRunBudget(signal);
    this._canCancel = false;
    this._generationAbort = null;
  }

  /**
   * Abort the in-flight provider pipeline. Document creation is not armed.
   * Partial preview state is discarded by the pipeline catch; this only
   * signals abort and keeps the bar from looking finished.
   */
  _cancelGeneration() {
    const abort = this._generationAbort;
    if (!abort || abort.signal.aborted) return;
    this._canCancel = false;
    abort.abort();
    const progress = this._progress;
    if (progress) {
      progress.phase = "cancelling";
      progress.detail = game.i18n.localize("SIMPLYSF2E.Progress.Cancelling");
      this._paintProgress();
    }
    const btn = this.element?.querySelector?.('[data-action="cancelGeneration"]');
    if (btn) {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
    }
  }

  _throwIfCancelled() {
    if (!this._generationAbort?.signal.aborted) return;
    const err = new Error(game.i18n.localize("SIMPLYSF2E.Errors.Cancelled"));
    err.cancelled = true;
    throw err;
  }

  /** Snapshot last-run cost, drop the bar, and unlink the abort signal. */
  _finishRun() {
    const cost = lastRunTokenTotal(this._tokenUsage);
    if (cost) this._lastRunCost = { ...cost, money: this._runCostInfo() };
    this._progress = null;
    this._disarmCancel();
  }

  /** Initialize the step list shown while generating. */
  _beginProgress(defs, { cancellable = true, reuseRunSignal = false } = {}) {
    // A continuation step inside one run (choice rounds, the apply step after
    // them) must not open a second budget window: reuse the live run signal so
    // tokens already spent and the run's deadline still apply.
    if (reuseRunSignal && this._generationAbort) {
      this._progress = createProgress(defs);
      return this._generationAbort.signal;
    }
    this._disarmCancel();
    this._progress = createProgress(defs);
    return this._armCancel({ cancellable });
  }

  /** Mark `key` active, everything before it done, and paint without remounting the bar. */
  async _setStep(key) {
    this._throwIfCancelled();
    const progress = this._progress;
    if (!progress) return;
    if (!applyStep(progress.steps, key)) return;
    resetStreamPhase(progress);
    progress.phase = "local";
    progress.detail = "";
    progress.percent = progressPercent({
      steps: progress.steps,
      activeKey: key,
      streamFrac: PHASE_FILL.start,
      floor: progress.percent
    });
    if (this._paintStepList()) {
      this._paintProgress();
      return;
    }
    // The card is not on screen yet: render the part that holds it.
    await this.render(this.constructor.WINDOW_ID ? { parts: ["result"] } : {});
  }

  /**
   * Streaming callback: phase fill (thinking → writing) plus live token copy.
   * Token counts never drive percent — final length is unknown. Exact copy
   * is reserved for provider usage; estimates stay marked ≈.
   */
  _onAIProgress({ phase, tokens = 0, exact = false, call }) {
    const progress = this._progress;
    if (!progress) return;
    if (this._generationAbort?.signal.aborted) return;
    const step = progress.steps.find((s) => s.state === "active");
    progress.phase = phase === "thinking" || phase === "writing" ? phase : "local";
    progress.streamFrac = streamFraction({ phase, prior: progress.streamFrac });
    progress.percent = progressPercent({
      steps: progress.steps,
      activeKey: step?.key,
      streamFrac: progress.streamFrac,
      floor: progress.percent
    });
    const stepLabel = call && step?.label
      ? `${step.label} — ${call}`
      : (call || step?.label || "");
    const shownTokens = exact
      ? Math.max(0, Number(tokens) || 0)
      : coarsenTokenEstimate(tokens);
    progress.detail = game.i18n.format(
      phase === "thinking"
        ? (exact ? "SIMPLYSF2E.Progress.ThinkingExact" : "SIMPLYSF2E.Progress.Thinking")
        : (exact ? "SIMPLYSF2E.Progress.WritingExact" : "SIMPLYSF2E.Progress.Writing"),
      { step: stepLabel, tokens: shownTokens.toLocaleString() }
    );
    this._paintProgress();
  }

  /** Patch step icons/classes in place so the fill element is not remounted. */
  _paintStepList() {
    const items = this.element?.querySelectorAll(".spf-progress-steps li");
    const steps = this._progress?.steps;
    if (!items || !steps || items.length !== steps.length) return false;
    steps.forEach((step, i) => {
      const li = items[i];
      li.className = `spf-step-${step.state}`;
      const state = li.querySelector(".spf-step-state");
      if (state) {
        state.textContent = game.i18n.localize(
          step.state === "done" ? "SIMPLYSF2E.Progress.StepDone"
            : step.state === "active" ? "SIMPLYSF2E.Progress.StepActive"
              : "SIMPLYSF2E.Progress.StepPending"
        );
      }
      const elapsed = li.querySelector(".spf-step-elapsed");
      if (elapsed) {
        elapsed.textContent = step.state === "active"
          ? game.i18n.localize("SIMPLYSF2E.Progress.Running")
          : stepElapsed(step, this._elapsedUnits());
      }
      const icon = li.querySelector("i");
      if (!icon) return;
      icon.className = step.state === "done"
        ? "fa-solid fa-circle-check"
        : step.state === "active"
          ? "fa-solid fa-spinner fa-spin"
          : "fa-solid fa-circle";
    });
    // One polite announcement per step change (not per percent tick).
    const active = steps.find((step) => step.state === "active");
    const announce = this.element?.querySelector(".spf-progress-announce");
    if (announce && active) announce.textContent = active.label;
    return true;
  }

  _paintProgress() {
    const progress = this._progress;
    const root = this.element;
    if (!progress || !root) return;
    const phase = progressPhaseClass(progress.phase);
    const card = root.querySelector(".spf-progress");
    if (card) {
      card.classList.remove(
        "spf-progress-thinking",
        "spf-progress-writing",
        "spf-progress-local",
        "spf-progress-cancelling"
      );
      card.classList.add(`spf-progress-${phase}`);
      card.dataset.phase = phase;
    }
    const fill = root.querySelector(".spf-progress-fill");
    const bar = root.querySelector(".spf-progress-bar");
    const pct = root.querySelector(".spf-progress-percent");
    const detail = root.querySelector(".spf-progress-detail");
    if (fill) fill.style.width = `${progress.percent}%`;
    if (bar) bar.setAttribute("aria-valuenow", String(progress.percent));
    if (pct) pct.textContent = `${progress.percent}%`;
    if (detail) detail.textContent = progress.detail;
    if (progress.phase === "cancelling") {
      const announce = root.querySelector(".spf-progress-announce");
      if (announce) announce.textContent = progress.detail;
    }
  }
}
