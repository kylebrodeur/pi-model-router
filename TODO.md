# TODO — Pi Model Router

## Completed ✅

| # | Task | Status |
|---|------|--------|
| 1 | Update Pi to 0.70.2 (`after_provider_response`) | ✅ |
| 2 | Remove `@ts-expect-error` workaround | ✅ |
| 3 | Replace `require()` with ESM imports | ✅ |
| 4 | Convert function statements to arrow functions | ✅ |
| 5 | Remove `any` types | ✅ |
| 6 | Gate/remove `console.log` per pi standards | ✅ |
| 7 | Prettier formatting | ✅ |
| 8 | TypeScript strict compilation | ✅ 0 errors |
| 9 | Scope shim (`setScopedModels` workaround) | ✅ `extensions/scope-shim.ts` |
| 10 | Upstream API issue | ✅ [#3535](https://github.com/badlogic/pi-mono/issues/3535) |
| 11 | Progressive Enhancement | ✅ Plugin detection (`detectPlugins`) + conditional integration |
| 12 | Progressive Configs | ✅ `model-router.ledger.json`, `model-router.agent-bus.json`, `model-router.essential.json` |
| 13 | Update README for public repo | ✅ Merged README_FORK.md, added badges, feature tables |
| 14 | GitHub repo metadata | ✅ Description, topics, wiki/projects disabled |
| 15 | Add CHANGELOG.md | ✅ |
| 16 | Add CODE_OF_CONDUCT.md | ✅ |
| 17 | Add GitHub templates | ✅ Issue + PR templates |
| 18 | Add LEARNINGS.md | ✅ Development insights doc |
| 19 | Update package.json for release | ✅ `files`, `author`, peer deps, typebox |
| 20 | Create GitHub release v0.1.2 | ✅ [Release page](https://github.com/kylebrodeur/pi-model-router/releases/tag/v0.1.2) |
| 21 | Publish to npm | ✅ `@kylebrodeur/pi-model-router@0.1.2` |

---

## Current Work (Maintenance Review)

- [x] Review context-management skill and notes/ledger to understand the repository.
- [x] Investigate `extensions/index.ts` runtime error (`Cannot read properties of undefined (reading 'warn')`). Fixed by adding safety check (`pi.log || console`).
- [x] Check for upstream updates from the fork source. No new updates from `origin/main`.
- [x] Check for Pi package updates. Package `@mariozechner/pi-coding-agent` is at the latest (`0.70.2`).
- [x] Lint, typecheck, build, and test. `npm run tsc` passes.

---

## Post-Publish Verification

| Check | Status |
|-------|--------|
| TypeScript compiles | ✅ 0 errors |
| Formatting clean | ✅ |
| No any/require/console leakage | ✅ |
| Package contents correct (`npm pack`) | ✅ 26 files, 45 KB |
| GitHub release created | ✅ v0.1.2 |
| npm package published | ✅ `@kylebrodeur/pi-model-router@0.1.2` |
| README npm badge active | ✅ |

---

## Backlog — Ready for Review (POST-KAGGLE)

**Note:** As per the [Agent Operating Principles](~/projects/microfactory/docs/_kaggle/07-AGENT-OPERATING-PRINCIPLES.md), full `pi-model-router` integration and extensive new features here are currently **OUT OF SCOPE** for the Kaggle Sprint deadline (May 18). Any work done here must pass *The One Test*: does it directly help the 3-minute video demo?

Because the demo relies on a specific `gemma-demo` scenario and simple two-tier routing (rather than the full router framework), all feature work below is paused and logged for post-Kaggle development.

### Paused / Future Work (Post-Kaggle)

| # | Feature | Description | Complexity |
|---|---------|-------------|------------|
| B1 | **Auto-restore from fallback** | When cloud API recovers, automatically switch back from fallback/Ollama to primary. | Medium |
| B2 | **Smart fallback selection** | Match task capabilities (vision, reasoning) to available fallback models. | Medium |
| B3 | **Per-profile Ollama models** | Allow different Ollama models per router profile. | Low |
| B4 | **Rate limit dashboard** | `/router rate-limit show` TUI widget. | Low |
| B5 | **Config UI wizard** | Interactive `/router config setup` command. | Low |

### Approved Microfactory Connections (Kaggle Scope)

| # | Task | Description |
|---|------|-------------|
| K1 | **Document Routing Patterns** | Note how `pi-model-router` fallback and tier logic can inform the Microfactory two-tier `GemmaAgent` model selection (Log in `FUTURE-WORK-LOG.md` or Microfactory docs). |
| K2 | **Maintain Stability** | Only merge critical bug fixes (like the `index.ts` crash) that unblock local development across the ecosystem. |

### Meta / Non-Code

| # | Task | Description |
|---|------|-------------|
| M1 | **Announce release** | Post to relevant Discord/Slack/forums about v0.1.2 (Post-Kaggle) |
| M2 | **Upstream PRs** | Split fork changes into upstream-friendly PRs (Post-Kaggle) |
| M3 | **Update LEARNINGS.md** | Add insights from publish process |

---

## Code Quality Gates

| Gate | Command | Expected | Status |
|------|---------|----------|--------|
| TypeScript strict | `npm run tsc` | 0 errors | ✅ |
| Prettier | `npx prettier --check extensions/*.ts` | All clean | ✅ |
| No `any` types | `grep -rn ": any\\b" extensions/` | Empty | ✅ |
| No `require()` | `grep -rn "require(" extensions/` | Empty | ✅ |
| No stray `console.log` | `grep -rn "console\.log" extensions/` | Only gated debug in `index.ts` | ✅ |
| Arrow functions only | `grep -rn "function " extensions/ \| grep -v "=>"` | Empty | ✅ |

---

## Files Reference

| File | Purpose |
|------|---------|
| `README.md` | Project overview, install, config, commands |
| `CHANGELOG.md` | Version history |
| `LEARNINGS.md` | Development insights and best practices |
| `TESTING.md` | Full testing checklist |
| `CONTRIBUTING.md` | Upstream PR strategy |
| `QUICKSTART.md` | 6-step install guide |
| `CODE_OF_CONDUCT.md` | Community guidelines |
| `extensions/ollama-sync.ts` | Ollama sync module |
| `extensions/rate-limit.ts` | Rate limit fallback module |
| `extensions/scope-shim.ts` | Scoped models shim |

---

## Current Status

| Check | Result |
|-------|--------|
| TypeScript compiles (all branches) | ✅ 0 errors |
| Commands scoped under `/router` | ✅ |
| Runtime config via `/router config` | ✅ |
| Console logging gated/removed | ✅ |
| Ready to install in Pi | ✅ |
| Published on npm | ✅ |
| Repo metadata set | ✅ |
| GitHub templates added | ✅ |
