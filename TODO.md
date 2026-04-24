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

## Backlog — Ready for Review

These are the next potential features to implement. **Review and rank** before starting any.

### Medium Priority

| # | Feature | Description | Complexity |
|---|---------|-------------|------------|
| B1 | **Auto-restore from fallback** | When cloud API recovers (health check or next turn succeeds), automatically switch back from fallback/Ollama to the primary model. Avoids leaving the user on local models indefinitely. | Medium |
| B2 | **Smart fallback selection** | Match task capabilities (vision, reasoning, JSON mode) to available fallback models. Don't fall back to a model that can't handle the current task type. | Medium |

### Low Priority

| # | Feature | Description | Complexity |
|---|---------|-------------|------------|
| B3 | **Per-profile Ollama models** | Allow different Ollama models per router profile (e.g., `cheap` profile uses `phi4`, `deep` profile uses `deepseek-r1:14b`). | Low |
| B4 | **Rate limit dashboard** | `/router rate-limit show` with a TUI widget/graph showing fallback history, timestamps, and recovery attempts. | Low |
| B5 | **Config UI wizard** | Interactive `/router config setup` command that walks users through creating their first `model-router.json` with prompts instead of hand-editing JSON. | Low |

### Meta / Non-Code

| # | Task | Description |
|---|------|-------------|
| M1 | **Announce release** | Post to relevant Discord/Slack/forums about v0.1.2 |
| M2 | **Upstream PRs** | Split fork changes into upstream-friendly PRs (`feature/feature-toggles`, `feature/ollama-sync`, `feature/rate-limit`) |
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
