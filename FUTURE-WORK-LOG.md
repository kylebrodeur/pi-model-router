# FUTURE-WORK-LOG

This log tracks out-of-scope ideas, features, and discoveries for the `pi-model-router` package. As per the Kaggle sprint principles, these items were identified as high-value but deferred to focus on shipping the core demo.

## [2026-04-26] — Auto-restore from fallback
**Found:** We currently lack a mechanism to automatically restore the primary model once a fallback model (like Ollama) takes over due to a rate limit or cloud error.
**Why it matters:** Users might get stuck on lower-tier local models indefinitely if the cloud API recovers but the router doesn't know to switch back.
**Effort:** Medium (requires background health checking or optimistic retry on next turn)
**Location:** `extensions/rate-limit.ts`
**Post-Kaggle context:** Stability / Polish phase

## [2026-04-26] — Smart fallback selection
**Found:** Fallback models don't currently match the capabilities of the primary model (e.g., vision, reasoning, JSON mode).
**Why it matters:** Falling back to a model that can't handle the task (e.g., providing an image to an LLM without vision) will still result in an error.
**Effort:** Medium
**Location:** `extensions/routing.ts`
**Post-Kaggle context:** Advanced Routing phase

## [2026-04-26] — Per-profile Ollama models
**Found:** We only support a single global fallback Ollama model, rather than tying specific Ollama models to specific router profiles (`cheap` vs `deep`).
**Why it matters:** Users with powerful rigs might want a large local model for the `deep` profile and a tiny one for the `cheap` profile.
**Effort:** Low
**Location:** `extensions/config.ts` and `extensions/rate-limit.ts`
**Post-Kaggle context:** Feature expansion

## [2026-04-26] — Rate limit dashboard
**Found:** Rate limit and fallback history is hidden in logs or router-state.
**Why it matters:** A TUI widget via `/router rate-limit show` would give users visibility into when and why their models are downgrading.
**Effort:** Low
**Location:** `extensions/commands.ts` / `extensions/ui.ts`
**Post-Kaggle context:** UX / TUI enhancements

## [2026-04-26] — Config UI wizard
**Found:** Users must hand-edit `model-router.json` to configure the router.
**Why it matters:** An interactive `/router config setup` command with prompts would dramatically lower the barrier to entry for new users.
**Effort:** Low
**Location:** `extensions/commands.ts`
**Post-Kaggle context:** Onboarding improvements
