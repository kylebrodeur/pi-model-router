# Phase 3: Package Polish Plan

Objective: Finalize the `pi-model-router` for a production-ready developer preview by refactoring the codebase into modules, updating documentation, and refining example configurations.

## 1. Code Refactoring (Break up `extensions/index.ts`)
The main extension file has grown too large (~1700 lines). It will be split into smaller, focused modules:

- `extensions/types.ts`: All interfaces and type definitions.
- `extensions/config.ts`: Configuration loading, normalization, and merging.
- `extensions/routing.ts`: Core routing logic (heuristics, classifier, rule matching).
- `extensions/provider.ts`: Custom `router` provider registration and delegation stream.
- `extensions/state.ts`: Session-persisted state management and snapshotting.
- `extensions/ui.ts`: UI status line and widget rendering logic.
- `extensions/commands.ts`: CLI command registrations and completions.
- `extensions/index.ts`: Main entry point that initializes and wires the modules.

## 2. Documentation Update & Relocation
- **Move `ARCHITECTURE.md` to `docs/ARCHITECTURE.md`**.
- **Rewrite `docs/ARCHITECTURE.md`** to reflect the modularized architecture and final features (Tiers, Profiles, Budgeting, Context Trigger, Fallbacks, Rules).
- **Rewrite `README.md`** to include all new features and a comprehensive command/config guide.

## 3. Configuration Examples
Update `model-router.example.json` to showcase the versatility of the system.
- Include profiles: `auto`, `cheap`, `deep`, `anthropic`, `openai`.
- Include global settings: `classifierModel`, `largeContextThreshold`, `maxSessionBudget`, `rules`.

## Implementation Steps

1.  **Extract types** to `extensions/types.ts`.
2.  **Extract config logic** to `extensions/config.ts`.
3.  **Extract routing logic** to `extensions/routing.ts`.
4.  **Extract state management** to `extensions/state.ts`.
5.  **Extract UI logic** to `extensions/ui.ts`.
6.  **Extract commands** to `extensions/commands.ts`.
7.  **Extract provider** to `extensions/provider.ts`.
8.  **Simplify `extensions/index.ts`** to be the orchestrator.
9.  **Relocate and rewrite documentation**.
10. **Update examples**.

## Verification
- Review all documents for accuracy.
- Verify `pi install .` still works correctly.
- Verify examples are valid JSON.
