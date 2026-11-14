import { MODULE_ID, interfaceSoundVolume } from "./settings.mjs";
import { CUE_ORDER, playCue } from "./sounds.mjs";

const { ApplicationV2 } = foundry.applications.api;

/** Seconds between the cues of a test, long enough to tell them apart. */
const TEST_GAP_MS = 700;

/**
 * The "Test sounds" button in the module settings. Foundry opens a settings
 * menu by constructing its class and calling render(); this one opens no
 * window. It plays the four cues in order at the normal level, whatever the
 * Interface sounds setting says, so the GM can judge them before turning
 * them on.
 */
export class SoundTestApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = { id: `${MODULE_ID}-sound-test` };

  async render() {
    const volume = interfaceSoundVolume();
    ui.notifications.info("SIMPLYSF2E.Sounds.TestPlaying", { localize: true });
    CUE_ORDER.forEach((name, index) => {
      setTimeout(() => playCue(name, { level: "normal", volume }), index * TEST_GAP_MS);
    });
    return this;
  }
}
