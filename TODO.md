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

---

## Next Steps

### Pre-Publish Verification

Before publishing, run these checks:

```bash
# 1. TypeScript
npm run tsc

# 2. Formatting
npx prettier --check extensions/*.ts

# 3. No any/require/console leakage
grep -rn ": any\\b" extensions/ || echo "Clean"
grep -rn "require(" extensions/ || echo "Clean"
grep -rn "console\.log" extensions/ || echo "Clean"
```

### Publish to npm

```bash
# 1. Bump version
npm version patch   # or minor / major

# 2. Verify package contents
npm pack --dry-run

# 3. Publish
npm publish --access public

# 4. Tag on GitHub
git tag v$(node -p "require('./package.json').version")
git push origin --tags

# 5. Create GitHub release
gh release create v$(node -p "require('./package.json').version") \
  --title "v$(node -p "require('./package.json').version")" \
  --notes-file CHANGELOG.md
```

### Post-Publish Testing

Test the published package in a fresh Pi session:

```bash
# Clean install
pi install npm:@kylebrodeur/pi-model-router

# Create config
/router init

# Run full command checklist
/router status
/router config
/router ollama-sync
/router profile auto
/router pin high
/router fix medium
/router debug on
/router widget on
/router reload
/router scope apply
/router scope show
/router disable
```

**Verify:**
- [ ] No TypeScript errors on `/reload`
- [ ] `/router status` shows correct profiles and features
- [ ] Ollama sync works (if enabled and Ollama running)
- [ ] Rate-limit fallback handler registers silently
- [ ] Debug output visible only when `/router debug on`
- [ ] Scope commands work (`apply`, `show`, `reset`)
- [ ] Install from npm works cleanly (no devDependencies needed)

### Post-Publish Documentation

- [ ] Update README to point to npm badge once first publish completes
- [ ] Announce in relevant Discord/Slack/forums
- [ ] Update `LEARNINGS.md` with any new insights from publish process

---

## Code Quality Gates (Pre-Publish)

| Gate | Command | Expected | Status |
|------|---------|----------|--------|
| TypeScript strict | `npm run tsc` | 0 errors | ✅ |
| Prettier | `npx prettier --check extensions/*.ts` | All clean | ✅ |
| No `any` types | `grep -rn ": any\\b" extensions/` | Empty | ✅ |
| No `require()` | `grep -rn "require(" extensions/` | Empty | ✅ |
| No stray `console.log` | `grep -rn "console\.log" extensions/` | Only gated debug in `index.ts` | ✅ |
| Arrow functions only | `grep -rn "function " extensions/ \| grep -v "=>"` | Empty | ✅ |

---

## Future Enhancements (Backlog)

| Feature | Priority | Notes |
|---------|----------|-------|
| Auto-restore from fallback | Medium | When cloud API recovers, auto-switch back |
| Smart fallback selection | Medium | Match capabilities (vision, reasoning) to task |
| Per-profile ollama models | Low | Different Ollama models per router profile |
| Rate limit dashboard | Low | `/router rate-limit show` with history graph |
| Config UI wizard | Low | Interactive `/router config setup` |

---

## Upstream PRs (when ready)

See `CONTRIBUTING.md` for branch split strategy. Recommended PR order:

1. **feature/feature-toggles** → `yeliu84/pi-model-router:main`
2. **feature/ollama-sync** → `yeliu84/pi-model-router:main`
3. **feature/rate-limit** → `yeliu84/pi-model-router:main`

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
| Upstream feature branches clean | ✅ |
| Console logging gated/removed | ✅ |
| Ready to install in Pi | ✅ |
| Ready to publish | ✅ |
| Repo metadata set | ✅ |
| GitHub templates added | ✅ |
