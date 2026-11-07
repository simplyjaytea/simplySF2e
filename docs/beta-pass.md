# Beta v0.1.15 live pass

One ordered pass for the next beta: v0.1.14 plus the five-minute run deadline and the reroll/duplicate-glossary fixes. Target **30–45 minutes**. Use one scratch world on **sf2e 1.7.0**, preferably on **Foundry 14.370**. Use real providers; do not use the preview fixtures.

Record: Foundry `____` · sf2e `1.7.0` · SimplySF2e `v0.1.15` · provider/model `____` · browser `____` · date `____`.

Keep the browser console open. Log each result under its QA id in `docs/live-log.md`. Copy a screenshot, value or console line into the note for every failure. The full wording of each row is in `docs/qa-checklist.md`. Mark N/A only when the named provider or version precondition is unavailable.

## Ordered pass

1. **Install and open a fresh browser profile.** Install the beta manifest, enable SimplySF2e in the scratch world and log in as GM. Welcome should open with OpenRouter selected, an empty key and Connect disabled. There should be no module or compatibility warning on Foundry 14.370. In Module Settings, Run deadline should show **5** with its new hint. The What's new note **Runs stop after 5 minutes** should appear once for this browser.
   **Log:** 12t.1, 12aa.5, I-170.5.3.

2. **Fail a key, then connect OpenRouter.** Paste a bad OpenRouter key and press Enter. Check the error and the retained draft. Correct the key and press Enter again. Connect should load the models, choose and test `deepseek/deepseek-v4.1-flash` when listed, then offer **Generate a sample monster**.
   **Log:** 12t.9, 12t.2, 12t.3.

3. **Make the sample preview.** Click **Generate a sample monster**. The Generator should open a level-1 Monster preview for “A level 1 space-pirate scout with a laser pistol”. Do not create it; confirm that no actor exists until Create Actor.
   **Log:** 12t.10.

4. **Check model choice and the other Welcome providers.** Reopen Welcome. For Google, check **Live check pending**, its endpoint and that no model is chosen automatically; pick a model before testing if you have a key. This also covers a missing preset default. Under Advanced, choose **Anthropic via OpenRouter** and confirm that only `anthropic/*` models are offered. With local servers available, choose Ollama and confirm that Connect lists installed models without a key, then choose LM Studio and open both secondary windows from Advanced. Return to the working OpenRouter connection afterwards.
   **Log:** 12t.4, 12t.5, 12t.7, 12t.6, 12t.8.

5. **Check reopening and one compendium warning.** Reload. Welcome should stay closed once the connection works; open it with `/sf2e welcome` and the module-settings button. Disable every Spells pack, press **Check Again**, and confirm one warning names Spells. Restore the pack and check again.
   **Log:** 12t.13, 12t.12.

6. **Record the old-system prerequisite.** Row 12t.11 needs sf2e older than 1.6.0 with compendium problems also present. Do not change this 1.7.0 world. If no older-system world is supplied, mark N/A with that reason. When run, it should show only the old-version warning and its update fix.
   **Log:** 12t.11.

7. **Generate the shared level-7 creature on OpenRouter with no manual prices.** Use Monster or NPC, level 7, Normal, and this prompt:

   > A Large tentacled frost-swamp horror with Constrict, Greater Constrict, Swallow Whole, Engulf, Trample, Frightful Presence and Stench. It has a limited-use 30-foot cone of cold called Frost Breath and a 30-foot aura called Foul Air that sickens nearby creatures. Give it a melee tentacle Strike and normal creature gear.

   Check that the preview has no `(0)` damage, blank DC or zero aura distance. The token report should end in a provider-reported dollar cost with no ≈, and the header should repeat the last-run tokens and cost.
   **Log:** 2.8, 13m.1.

8. **Reroll one published ability before creating.** Use the dice beside a published ability. Only that pick should change, to another real compendium ability. If the model returned no published ability with a reroll button, note that and use the next preview.
   **Log:** 12w.4.

   reroll rows: see 2.x

9. **Create and inspect the level-7 actor.** Check every glossary ability against 2.9: level-7 Constrict/Trample DC 25, moderate aura/Engulf DC 22, 4d6 area damage, Swallow Whole/Engulf Rupture 15, and 90-foot Frightful Presence / 30-foot Stench. Trample must name one of the actor's own melee Strikes. Any unfillable working ability should be absent and named in the console. Also compare saves and all speed entries with the preview; sf2e 1.7.0 should prepare them without errors.
   **Log:** 2.8, 2.9, I-170.5.1.

10. **Check both Area Blast forms and the DeepSeek cost states.** Create the two level-7 creatures below, one at a time:

    - “A dragon with a limited-use searing 30-foot cone of fire; it must catch its breath between blasts.” Expect a 2-action 30-foot cone, 8d6 fire, basic Reflex DC 25 and a 1d4-round recharge link.
    - “A serpent with an at-will 30-foot line of acid.” Expect 4d6 acid, basic Reflex DC 25 and no recharge sentence.

    For the first, use DeepSeek with both price fields empty: no cost line or fake $0.00 should appear. Before the second, set Input `0.27` and Output `1.10` on that same DeepSeek connection and save; check the ≈ total against the token counts. Try `-1` or text once and confirm that saving is refused, then restore the valid prices. Switch to OpenRouter and back and confirm that each connection keeps its own prices.
    **Log:** 2.10, 13m.2, 2.11, 13m.3, 13m.4, 13m.5.

11. **Check both Aura kinds on the canvas.** At level 8, create “a fungal swamp hulk whose spores sicken everything that comes near it” and “a glowing reactor core that burns everything within ten feet each turn”. Place each token. The first should show a 30-foot aura, Fortitude DC 23 and sickened 2. The second should show a 10-foot aura, 4d6 fire and basic Fortitude DC 23. Click the check/damage links and apply the condition or damage as GM; the module should not apply it for you.
    **Log:** 2.12, 2.13.

12. **Reskin the shared level-7 actor and re-level to 12.** Use the theme “an ancient crystal-and-frost guardian”. In the preview, check the changed statistics and the lines saying Frost Breath, Foul Air and Constrict were rebuilt. Create the copy. At 12, expect Frost Breath 13d6 cold / Reflex DC 32, Foul Air 30 feet / Fortitude DC 29 / sickened 2, and Constrict 5d8 / DC 32. Names and Constrict's glossary source flag must survive. Read one published, non-filled ability and confirm its text is unchanged.
    **Log:** 12ab.1, 12ab.2, 12ab.3, 12ab.7, 12ab.5.

13. **Re-level down and check the blocked rebuild.** Re-level the same kind of copy to 2. Expect Frost Breath 3d6 / DC 18, Foul Air Fortitude DC 15 / sickened 1 and Constrict 2d6 / DC 18. Then make a Swallow Whole copy Tiny before re-leveling. Its text should stay unchanged and the preview should say why it was kept.
    **Log:** 12ab.4, 12ab.6.

14. **Check a partial cost.** With no chat prices set, make an OpenRouter run that includes a request with no provider-reported cost, such as Jev on another route. The report should say **at least** and must never price Jev with chat prices. Repeat with chat prices set and check the mixed ≈ wording. If no such route is available, mark N/A and name the missing precondition.
    **Log:** 13m.6.

15. **Stop a run at the token budget.** Set Run token budget to `5` and generate a monster. It should stop with the budget message, with no actor and no retained preview. Use **Copy bug report** on the failure: settings should say only `Manual prices set: yes/no`, with no price values. Restore the budget to `60000`.
    **Log:** 12aa.1, 13m.7.

16. **Stop a run at the deadline.** Set Run deadline to `1`, keep the token budget at `60000`, and start an encounter with at least three members. Leave it alone. After about a minute it should stop with the time-limit message and create no actors. Restore the deadline to `5`.
    **Log:** 12aa.2.

17. **Confirm normal runs with both defaults restored.** Generate one monster, one PC and one Forge item. None should hit a budget/deadline message. During PC Create, watch the choice/apply steps: the non-cancellable apply step should offer no Cancel button. For the Forge item, choose a published passive whose Rules tab includes RollOption, then make the affected roll on sf2e 1.7.0; it should work without a new error. Also confirm that the What's new note **Per-run token budget** appeared once for this update.
    **Log:** 12aa.3, 12aa.4, I-170.5.2.

18. **Finish the per-browser Welcome checks.** Clear the key or use a second browser, tick **Don't show this again at login**, and reload; Welcome should stay closed. Then log in as a player in the same world: no Welcome window should open, and `/sf2e welcome` should show the GM-only warning.
    **Log:** 12t.14, 12t.15.

## Results

Copy these rows into the session in `docs/live-log.md`, then replace the result and note cells. The three I-170 entries are the live checks requested by report I-170 §5.

| QA id | PASS/FAIL | Note |
| --- | --- | --- |
| 12t.1 |  |  |
| 12t.2 |  |  |
| 12t.3 |  |  |
| 12t.4 |  |  |
| 12t.5 |  |  |
| 12t.6 |  |  |
| 12t.7 |  |  |
| 12t.8 |  |  |
| 12t.9 |  |  |
| 12t.10 |  |  |
| 12t.11 |  |  |
| 12t.12 |  |  |
| 12t.13 |  |  |
| 12t.14 |  |  |
| 12t.15 |  |  |
| 2.8 |  |  |
| 2.9 |  |  |
| 2.10 |  |  |
| 2.11 |  |  |
| 2.12 |  |  |
| 2.13 |  |  |
| 12w.4 |  |  |
| 12ab.1 |  |  |
| 12ab.2 |  |  |
| 12ab.3 |  |  |
| 12ab.4 |  |  |
| 12ab.5 |  |  |
| 12ab.6 |  |  |
| 12ab.7 |  |  |
| 13m.1 |  |  |
| 13m.2 |  |  |
| 13m.3 |  |  |
| 13m.4 |  |  |
| 13m.5 |  |  |
| 13m.6 |  |  |
| 13m.7 |  |  |
| 12aa.1 |  |  |
| 12aa.2 |  |  |
| 12aa.3 |  |  |
| 12aa.4 |  |  |
| 12aa.5 |  |  |
| I-170.5.1 |  | NPC speeds and saves |
| I-170.5.2 |  | RollOption item and affected roll |
| I-170.5.3 |  | Foundry 14.370 loads without a version warning |
