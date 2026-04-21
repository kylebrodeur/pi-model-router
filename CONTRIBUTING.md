# Contributing to Upstream (pi-model-router)

This fork is designed for eventual upstream contribution. Here's how to structure and deliver your changes.

## Fork Strategy

```
yeliu84/pi-model-router (upstream)
    │
    └── your-github/pi-model-router-fork (this repo)
            │
            ├── branch: main (tracks upstream)
            ├── branch: feature/ollama-sync
            ├── branch: feature/rate-limit-fallback
            └── branch: feature/feature-toggles
```

## Recommended Commit Structure

Separate your work into **independent PRs** for maximum merge probability:

### PR 1: Feature Toggle Framework
**Commit message:** `feat: add feature toggle system for modular extensions`

**Files touched:**
- `extensions/types.ts` — add `FeatureToggles`, `OllamaSyncConfig`, `RateLimitFallbackConfig`
- `extensions/config.ts` — add feature fields to `mergeConfig()` and `normalizeConfig()`

**Rationale:**
- Minimal surface area
- No behavior changes to existing code
- Enables future features
- Easy to review and merge

### PR 2: Ollama Auto-Sync Feature
**Commit message:** `feat: add ollama-sync for auto-registering local models`

**Files touched:**
- `extensions/ollama-sync.ts` — new file
- `extensions/index.ts` — conditionally initialize from toggles

**Rationale:**
- Self-contained module
- Uses existing patterns (pi.exec, config merge)
- Useful to upstream community (many Pi users use Ollama)

### PR 3: Rate Limit Fallback
**Commit message:** `feat: add rate-limit fallback with manual restore`

**Files touched:**
- `extensions/rate-limit.ts` — new file
- `extensions/index.ts` — conditionally initialize from toggles

**Rationale:**
- Solves real production pain (API rate limits)
- Manual fallback is safe (no auto-magic)
- Composable with any routing profile

## Upstream Compatibility Rules

### ✅ Do

1. **Extend existing types** rather than replacing
   ```typescript
   // ✅ Good
   export interface RouterConfig {
     // ... existing fields ...
     features?: FeatureToggles;
   }
   
   // ❌ Bad
   export interface RouterConfigWithToggles { } // Separate type
   ```

2. **Use existing patterns** from upstream code
   - Session persistence via `pi.appendEntry('router-state', ...)`
   - Config merge: global → project (already in `loadRouterConfig()`)
   - Commands via `pi.registerCommand()`
   - State restoration in `session_start`

3. **Make features opt-out** (enabled by default)
   ```typescript
   const isEnabled =
     !currentConfig.features ||
     currentConfig.features.myFeature !== false;
   ```

4. **Co-locate feature commands** under `/router-*` namespace
   - `/router-ollama-sync` not `/ollama-sync`
   - `/router-fallback` not `/fallback`

5. **Follow style guide**
   - Single quotes for strings
   - Trailing commas in objects/arrays
   - Same naming conventions (kebab-case files, camelCase identifiers)

### ❌ Don't

1. **Don't modify upstream internals** without justification
   - Don't change `provider.ts` routing logic
   - Don't change `routing.ts` tier decisions
   - Don't modify UI rendering unless adding new elements

2. **Don't introduce breaking config changes**
   - Keep `model-router.json` backward compatible
   - New fields must be optional

3. **Don't add new dependencies**
   - Use built-in `node:*` modules
   - If upstream uses a package, you can use it

4. **Don't auto-switch models without explicit user action**
   - Manual fallback only (user must type `/router-fallback`)
   - Optional auto-fallback behind config flag (disabled by default)

5. **Don't modify the `RouterPersistedState` structure**
   - Use separate session entries for feature state
   - Or nest inside state object without changing required fields

## PR Preparation Checklist

For each PR:

- [ ] All TypeScript compiles with `npx tsc --noEmit`
- [ ] No lint errors (`npm run lint` if available)
- [ ] Upstream tests pass (`npm test` if available)
- [ ] New code follows file header comment pattern
- [ ] README.md updated with new feature docs
- [ ] Example config in `model-router.example.json` updated
- [ ] CHANGELOG.md entry (if upstream uses one)

## Commit Message Format

Follow upstream conventions:

```
feat: add ollama-sync for auto-registering local models

- Detect new Ollama models on session start/reload
- Infer capabilities (vision, reasoning, context window)
- Update models.json with sensible defaults
- Toggle via features.ollamaSync in config

Refs: #upstream-issue-if-any
```

```
feat: add rate-limit fallback to local Ollama models

- Monitor after_provider_response for HTTP 429/503
- Manual fallback command: /router-fallback
- Restore command: /router-restore
- Configurable via features.rateLimitFallback

Refs: #upstream-issue-if-any
```

```
feat: add feature toggle system for modular extension

- features config key for enabling/disabling features
- ollamaSync and rateLimitFallback as first features
- Per-turn routing preserved as default behavior
- Project-level override support
```

## Testing for Upstream PRs

Before submitting each PR:

1. **Clean checkout of upstream `main` branch**
   ```bash
   git remote add upstream https://github.com/yeliu84/pi-model-router.git
   git fetch upstream
   git checkout -b my-feature upstream/main
   ```

2. **Cherry-pick only your feature commits**
   ```bash
   git cherry-pick <commit-hash-from-fork>
   ```

3. **Ensure no other fork changes leak in**
   ```bash
   git diff upstream/main --name-only
   # Should only show files relevant to this PR
   ```

4. **Test against upstream's vanilla config**
   ```bash
   mv ~/.pi/agent/model-router.json ~/.pi/agent/model-router.json.bak
   
   # Test with upstream defaults only
   # Ensure no runtime errors when features are absent
   
   mv ~/.pi/agent/model-router.json.bak ~/.pi/agent/model-router.json
   ```

## Handling Merge Conflicts

If upstream changes while your PR is open:

```bash
# Fetch latest
git fetch upstream

# Rebase your branch
git rebase upstream/main

# Resolve conflicts (usually in config.ts and index.ts)
# - Always preserve upstream defaults
# - Add your features as additions
git add .
git rebase --continue
```

Common conflict points:
- **`config.ts` `normalizeConfig()`** — add your feature fields at the end
- **`index.ts` imports** — add new feature imports in alphabetical order
- **`index.ts` `actions` object** — add `syncFeatures` last
- **`types.ts`** — add new interfaces at the bottom

## Conversation with Upstream

### What to say in your PR description

```markdown
## Summary
Adds [feature name] to pi-model-router. This feature [1-sentence problem it solves].

## Configuration
Users can enable it in their `model-router.json`:
```json
{
  "features": {
    "[featureName]": true
  }
}
```

## How it works
[2-3 sentence description]

## Backward Compatibility
- Disabled by default (opt-out after feature framework PR)
- No changes to existing routing behavior
- Existing configs work without modification

## Testing
- [ ] Tested with Pi 0.67+
- [ ] Tested with Ollama [if applicable]
- [ ] Regression tested upstream routing
```

### What NOT to say
- Don't pitch it as "our fork adds X"
- Don't mention other features in the same PR description
- Don't change scope mid-PR (no "later I'll also add Y")

## If Upstream Declines

Your options:

1. **Maintain fork** — Keep this repo, publish as separate npm package
2. **Plugin architecture** — Request upstream add an extension hook API
3. **Separate extension** — Extract to `.pi/extensions/some-name.ts` as standalone

## Quick Reference: Files by PR

### PR 1: Feature Toggles (minimal)
| File | Change |
|------|--------|
| `extensions/types.ts` | +FeatureToggles, +OllamaSyncConfig, +RateLimitFallbackConfig, add fields to RouterConfig |
| `extensions/config.ts` | preserve feature fields in mergeConfig/normalizeConfig |

### PR 2: Ollama Sync
| File | Change |
|------|--------|
| `extensions/ollama-sync.ts` | New file |
| `extensions/index.ts` | Import + conditional init |

### PR 3: Rate Limit Fallback
| File | Change |
|------|--------|
| `extensions/rate-limit.ts` | New file |
| `extensions/index.ts` | Import + conditional init |

---

## Release Plan (for your fork)

Before upstream PRs merge, your fork can be used as:

```bash
# Install from local folder
pi install ~/projects/pi-model-router-forked

# Or register manually
cp -r ~/projects/pi-model-router-forked/extensions ~/pi/extensions/model-router
```

Once upstream merges, switch back:

```bash
# Update upstream package
npm install -g @yeliu84/pi-model-router

# Remove local override
rm -rf ~/.pi/agent/extensions/pi-model-router
```
