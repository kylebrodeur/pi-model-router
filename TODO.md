# TODO — Pi Model Router Fork

## Completed ✅

| # | Task | Status |
|---|------|--------|
| 1 | Update Pi to 0.68+ (`after_provider_response`) | ✅ |
| 2 | Remove `@ts-expect-error` workaround | ✅ |
| 3 | Replace `require()` with ESM imports | ✅ |
| 4 | Convert function statements to arrow functions | ✅ |
| 5 | Remove `any` types | ✅ |
| 6 | Gate/remove `console.log` per pi standards | ✅ |
| 7 | Prettier formatting | ✅ |
| 8 | TypeScript strict compilation | ✅ 0 errors |
| 9 | Scope shim (`setScopedModels` workaround) | ✅ `extensions/scope-shim.ts` |
| 10 | Upstream API issue | ✅ [#3535](https://github.com/badlogic/pi-mono/issues/3535) |

---

## Ready to Test & Publish

### Install Locally (Pre-Publish Test)

```bash
pi install git:github.com/kylebrodeur/pi-model-router@main

# Create default config
/router init
```

### Testing Checklist

Run these in a fresh Pi session:

```
/reload
/new
/router init            # Create default config
/router status          # Should show enabled, correct profiles
/router config          # Should list features
/router ollama-sync     # Should sync Ollama models (if Ollama running)
/router profile auto    # Switch profiles
/router pin high        # Pin tier
/router fix medium      # Fix last decision
/router debug on        # Enable debug logging
/router widget on       # Enable status widget
/router reload          # Hot-reload config
/router disable         # Disable router
/router scope apply     # Sync router profiles to Pi enabled models
```

**Verify:**
- [x] No `console.log` noise in stdout on init
- [x] No TypeScript errors on `/reload`
- [x] `/router status` shows features: `ollamaSync=on`, `rateLimit=on`
- [x] Ollama sync runs on session start (if `onStartup: true`)
- [x] Rate-limit fallback handler registers silently
- [x] Debug output visible only when `/router debug on`
- [x] Fallback status shows in footer when active (`🏠 fallback`)

### Run Static Checks

```bash
cd ~/projects/pi-model-router-forked

# TypeScript
./node_modules/.bin/tsc --noEmit

# Formatting
./node_modules/.bin/prettier --check extensions/*.ts

# No console leakage (should only show the gated debug log in index.ts)
grep -rn "console\." extensions/ || echo "Clean"
```

---

## Publishing Steps

### 1. Version Bump

```bash
# Update version in package.json before each release
npm version patch   # or minor / major
```

### 2. Pre-Publish Verification

```bash
npm run tsc         # Ensure TypeScript compiles
npm run build       # Optional: emit .js if needed
```

### 3. Publish to npm

```bash
npm publish --access public
```

### 4. Tag Release on GitHub

```bash
git tag v$(node -p "require('./package.json').version")
git push origin --tags
```

### 5. Upstream PRs (when ready)

See `CONTRIBUTING.md` for branch split strategy. Recommended PR order:

1. **feature/feature-toggles** → `yeliu84/pi-model-router:main`
2. **feature/ollama-sync** → `yeliu84/pi-model-router:main`
3. **feature/rate-limit** → `yeliu84/pi-model-router:main`

---

## Code Quality Gates (Pre-Publish)

| Gate | Command | Expected |
|------|---------|----------|
| TypeScript strict | `npx tsc --noEmit` | 0 errors |
| Prettier | `npx prettier --check extensions/*.ts` | All clean |
| No `any` types | `grep -rn ": any\\b" extensions/` | Empty |
| No `require()` | `grep -rn "require(" extensions/` | Empty |
| No stray `console.log` | `grep -rn "console\.log" extensions/` | Only gated debug in `index.ts` |
| Arrow functions only | `grep -rn "function " extensions/ \| grep -v "=>"` | Empty |

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

## Branches Reference

| Branch | Built From | Contains |
|--------|-----------|----------|
| `main` | upstream + all features | Ready to use today |
| `feature/feature-toggles` | upstream + types + config | PR 1 |
| `feature/ollama-sync` | upstream + types + config + ollama | PR 2 |
| `feature/rate-limit` | upstream + types + config + rate-limit | PR 3 |

---

## Files Reference

| File | Purpose |
|------|---------|
| `TESTING.md` | Full testing checklist |
| `CONTRIBUTING.md` | Upstream PR strategy |
| `README_FORK.md` | Fork documentation |
| `QUICKSTART.md` | 6-step install guide |
| `extensions/ollama-sync.ts` | Ollama sync module |
| `extensions/rate-limit.ts` | Rate limit fallback module |

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
