# Multiclass PCs: sources and draft plan

Status: **draft; JT's decisions recorded in §4.** Nothing here is built. Build it after the class-bench fixes (`tools/class-bench/REPORT.md` B1–B4), because multiclass depends on attribute prerequisites and feat slots working. Sources were fetched from `foundryvtt/pf2e` branch `v14-dev` on 2026-10-25.

## 1. What v14-dev publishes

**System version.** `system.sf2e.json` on v14-dev is now `"version": "1.6.1"`, compatibility `minimum 14.361`, `verified 14.369`. The module now requires 1.6.0 (PLAYBOOK §2).

**Classes.** `packs/sf2e/classes/` holds 8 classes: envoy, **mechanic**, mystic, operative, solarian, soldier, **technomancer**, witchwarper. Mechanic and Technomancer are `"title": "Starfinder Tech Core"`. Since the Tech Core batch, the module supports all 8 (`COMPLETE_PC_CLASS_SLUGS`) and maps all 8 dedications (`SF2E_MULTICLASS_DEDICATIONS`), both in `scripts/pc-support.mjs`.

**Multiclass archetypes.** `packs/sf2e/feats/archetype/multiclass-archetypes/<class>-archetype/*.json`, 75 feats in 8 folders. Every dedication is level 2, `category: "class"`, traits `["archetype","dedication","multiclass"]`:

| Dedication | `_id` | Prerequisite (`system.prerequisites.value`) | Rules | Source |
| --- | --- | --- | --- | --- |
| Envoy Dedication | `wUqOzEWcNX9ohLE2` | `Charisma +2` | GrantItem Envoy Directives; ChoiceSet `flag: "skill"` (deception/diplomacy/intimidation); ActiveEffectLike `system.skills.{item\|flags.system.rulesSelections.skill}.rank` upgrade 1 | Player Core |
| Mechanic Dedication | `zSFQxqmf97ReeU2C` | `Intelligence +2` | none | Tech Core |
| Mystic Dedication | `7kCWmCSwlKQqQkLh` | `Wisdom +2` | GrantItem Connection; GrantItem Mystic Bond | Player Core |
| Operative Dedication | `V0Qm2R3YUmS9fKrE` | `Dexterity +2` | MartialProficiency; GrantItem Aim; 2× ActiveEffectLike | Player Core |
| Solarian Dedication | `1hp73yUEZoKWaV27` | `Strength +2` | GrantItem Stellar Attunement; GrantItem Solar Manifestations; ActiveEffectLike | Player Core |
| Soldier Dedication | `5U1q1pLm3eBIHCXl` | `Constitution +2` | ActiveEffectLike ×7; ChoiceSet armor (predicated) | Player Core |
| Technomancer Dedication | `ZMnWWa7WgjYRGgOv` | `Intelligence +2` | none | Tech Core |
| Witchwarper Dedication | `P8nPDOlSIiKnkQAy` | `Intelligence +2 or Charisma +2` | GrantItem Paradox; GrantItem Warp Reality | Player Core |

Follow-up feats are levels 4–18. Their prerequisites name the dedication or an earlier archetype feat (`Advanced Leadership` ← `Basic Leadership`). Some add a rank clause (`master in connection skill`, `expert in Perception`) or a class-HP clause (`class granting no more Hit Points per level than 8 + your Constitution modifier`).

**Spellcasting dedications.** Mystic, Witchwarper and Technomancer Dedication text: "You cast spells like a mystic… You gain a spell repertoire with two common cantrips… You're trained in the spell attack modifier and spell DC statistics. Your key spellcasting attribute for mystic archetype spells is Wisdom". **No rule element creates the spellcasting entry.** `Basic <Class> Spellcasting` (level 4) has no rules either; it points at the journal's Basic Spellcasting benefits (`JournalEntryPage.DOc3Pf8wmVxanTIv#basic-spellcasting-feat`, not fetched yet).

**Dedication rule** (`packs/sf2e/journals/archetypes.json`): "Once you take a dedication feat, you can't select a different dedication feat until you complete your dedication by taking two other feats from your current archetype."

## 2. What the module does today

- Free Archetype slots exist (`buildFeatSlots(..., { freeArchetype })`, `pc-builder.mjs:338`), filter on trait `archetype`, and check prerequisites with `stagedActorContext` / `featPrerequisitesMet`.
- **Every multiclass dedication is unreachable, even with Free Archetype.** `clauseMet` (`pc-prerequisites.mjs:134`) reads only `^(strength|…|charisma)\s+(\d+)$`, the PF2e "Strength 14" form. The sf2e text is `Charisma +2`, so the clause falls through to a name match and fails closed. Also, `pc-builder.mjs:340` never passes `abilities` to `stagedActorContext`, so a parsed clause would have no values to compare.
- `getMulticlassDedicationSlug` has no caller.
- The dedication rule is not enforced. `validateArchetypeSlotPlacement` checks trait, level, order, duplicates and named chains only.

## 3. Draft plan (phased)

**Phase 1: make dedications legal (small, pure logic).**
1. `pc-prerequisites.mjs`: parse `<Attribute> +N` as "attribute modifier ≥ N", and `A +N or B +N` as either. Keep the old score form.
2. `pc-builder.mjs:340`: pass the planned attribute modifiers (after boosts up to that slot's level) into `stagedActorContext`.
3. Enforce the dedication rule in `validateArchetypeSlotPlacement`: a second dedication is dropped until two non-dedication feats of the first archetype are placed.
4. Tests for all three.

Effect: with Free Archetype on, non-caster multiclass dedications become pickable. Caster dedications need phase 3 or must be excluded (Q2).

**Phase 2: explicit second class.**
5. Generator PC form: optional "Multiclass" class picker (the supported classes minus the main class), remembered with other settings.
6. When set, pin the first eligible archetype slot (Free Archetype) or the level-2 class slot (no Free Archetype) to that dedication. Later archetype slots prefer that archetype's feats. The AI chooses only among these candidates.
7. Pre-answer dedication ChoiceSets the way `choice-set.mjs` does today. Leave predicated ones (Soldier armor) to native prompts and report them.
8. Release note, i18n, QA rows.

**Phase 3: caster dedications (larger).**
9. Create a spontaneous spellcasting entry for Mystic/Witchwarper (repertoire) and Technomancer (database) with 2 cantrips at Dedication, plus Basic/Expert/Master slots from the journal's Basic Spellcasting table. That table must be fetched and cited first.

**Out of scope for now:** Mechanic and Technomancer as main classes (separate task: sf2e 1.6 support), a full archetype grant graph.

## 4. JT's decisions (2026-10-25)

1. **Who picks the second class:** both. A GM picker wins when set; otherwise the AI may choose from the prompt.
2. **Caster dedications:** build them now (phase 3 is in scope). Fetch and cite the journal's Basic Spellcasting table first.
3. **Without Free Archetype:** multiclass requires Free Archetype; the picker only appears when that setting is on.
4. **sf2e 1.6:** done first (Mechanic and Technomancer are complete classes; their dedications are already in the map).

## 5. Task split (once approved)

| Task | Model | Files |
| --- | --- | --- |
| P1a attribute prerequisite parsing + tests | Sonnet (schema) | `pc-prerequisites.mjs`, new test |
| P1b pass modifiers into context | Sonnet (schema) | `pc-builder.mjs` |
| P1c dedication rule + tests | Haiku | `pc-prerequisites.mjs` (after P1a), test |
| P2 UI picker, settings, i18n, release note | Haiku | `generator-app.mjs`, `templates/generator.hbs`, `lang/en.json`, `whats-new.mjs`, `generator-memory.mjs` |
| P2 slot pinning | Sonnet (schema) | `pc-builder.mjs`, `pc-support.mjs` |

Review: tier 1 + 2 on every task; tier 3 on P1a, P1b and P2 slot pinning (PC grants and slots).
