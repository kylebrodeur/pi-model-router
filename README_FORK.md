# pi-model-router Fork

**Enhanced version of [yeliu84/pi-model-router](https://github.com/yeliu84/pi-model-router)** with Ollama auto-sync, rate limit fallback, and feature toggles.

## What's Added

| Feature                 | Status   | Description                                         |
| ----------------------- | -------- | --------------------------------------------------- |
| **Ollama Sync**         | ✅ Ready | Auto-detect and register Ollama models              |
| **Rate Limit Fallback** | ✅ Ready | Detect rate limits, manual fallback to local models |
| **Feature Toggles**     | ✅ Ready | Enable/disable features at user or project level    |

## Files Changed from Upstream

```
extensions/
├── index.ts            # MODIFIED: Conditional feature initialization
├── config.ts           # MODIFIED: Parse feature toggle fields
├── types.ts            # MODIFIED: Extended RouterConfig with features
├── ollama-sync.ts      # NEW: Ollama auto-sync module
├── rate-limit.ts       # NEW: Rate limit fallback module
├── scope-shim.ts       # NEW: Scoped models setting shim for pi core
├── features.ts         # NEW: Feature toggle types (unused, for reference)
├── commands.ts         # UNCHANGED (upstream command logic preserved)
├── provider.ts         # UNCHANGED
├── routing.ts          # UNCHANGED
├── state.ts            # UNCHANGED
├── ui.ts               # UNCHANGED
├── constants.ts        # UNCHANGED
└── README.md           # NEW: This file
├── TESTING.md          # NEW: Comprehensive testing checklist
├── CONTRIBUTING.md       # NEW: Upstream contribution guide
└── model-router.example.json  # UNCHANGED (add feature fields as needed)
```

## Quick Start

### 1. Install Extension

```bash
pi install npm:@kylebrodeur/pi-model-router
```

### 2. Initialize Config

```
/router init
```

This scaffolds a default configuration at `~/.pi/agent/model-router.json`.

### 3. Edit Config (Optional)

```bash
cat ~/.pi/agent/model-router.json
```

### 3. Reload Pi

```
/reload
```

## New Commands

| Command               | Feature           | Description                       |
| --------------------- | ----------------- | --------------------------------- |
| `/router ollama-sync` | ollamaSync        | Manually sync Ollama models       |
| `/router fallback`    | rateLimitFallback | Switch to fallback model sequence |
| `/router restore`     | rateLimitFallback | Restore cloud model               |
| `/router init`        |                   | Scaffold default config file      |

## Feature Toggle Config

```json
{
  "features": {
    "ollamaSync": true, // Auto-sync Ollama models
    "rateLimitFallback": true, // Rate limit detection + fallback
    "scopeShim": true, // Sync profiles to enabledModels in Pi
    "perTurnRouting": true, // Original: tier-based routing
    "intentClassifier": false, // Original: LLM-based intent detection
    "costBudgeting": true, // Original: Session spend tracking
    "phaseMemory": true // Original: Planning/implementation bias
  }
}
```

**Priority:** Project config `.pi/model-router.json` overrides user config `~/.pi/agent/model-router.json`. Both override defaults.

## Requirements

- **Pi 0.67+** — Required for `after_provider_response` event (rate limit detection)
- **Ollama** — Running locally for Ollama sync and fallback
- **Node.js 18+** — For TypeScript compilation

## Documentation

- [TESTING.md](TESTING.md) — Step-by-step testing checklist
- [CONTRIBUTING.md](CONTRIBUTING.md) — How to contribute back to upstream
- [Upstream README](https://github.com/yeliu84/pi-model-router#readme) — Original routing documentation

## Architecture

See upstream [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for routing internals.

Our additions follow the same patterns:

- `pi.on('session_start', ...)` for startup hooks
- `pi.registerCommand()` for slash commands
- Config via `model-router.json` (global + project merge)
- State persistence via `pi.appendEntry()` (session entries)
- Feature files are self-contained modules with their own config + commands

## Comparison: This Fork vs Upstream

| Capability            | Upstream       | This Fork                                      |
| --------------------- | -------------- | ---------------------------------------------- |
| Per-turn routing      | ✅             | ✅                                             |
| Tier management       | ✅             | ✅                                             |
| Cost budgeting        | ✅             | ✅                                             |
| Phase memory          | ✅             | ✅                                             |
| Ollama auto-sync      | ❌             | ✅                                             |
| Rate limit fallback   | ❌             | ✅ (402, 429, 503, 529 support)                |
| Transparent Fallbacks | ❌             | ✅ (UI notifications + Session Entry Tracking) |
| Scope shim            | ❌             | ✅                                             |
| Feature toggles       | ❌             | ✅                                             |
| Project-level config  | ❌ (user only) | ✅ (user + project)                            |

### Transparent Fallbacks in RPC/Headless Mode

When `pi` encounters an API outage or rate limit (HTTP `402`, `429`, `503`, or `529`), the router acts transparently:

1. **Never masks auth errors:** HTTP `401`/`403` will _never_ trigger fallback, ensuring bad keys are properly surfaced.
2. **UI Clarity:** Provides contextual toast notifications (e.g. "out of credits (402)" vs "provider overloaded (529)").
3. **Session Logs:** Emits a custom session entry via `pi.appendEntry('router-fallback', ...)` so headless scripts parsing `.pi/agent/sessions/` can programmatically detect that a model switch occurred mid-conversation.

## License

MIT (same as upstream)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- How to split changes into upstream-friendly PRs
- Commit message conventions
- Testing requirements
- What to say in PR descriptions
