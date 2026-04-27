# pi-model-router

[![npm version](https://img.shields.io/npm/v/@kylebrodeur/pi-model-router.svg)](https://www.npmjs.com/package/@kylebrodeur/pi-model-router)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Pi Version](https://img.shields.io/badge/pi-%3E%3D0.70.2-blue)](https://github.com/mariozechner/pi-coding-agent)

Intelligent per-turn model router extension for the [pi](https://github.com/mariozechner/pi-coding-agent) coding agent. Automatically selects between high, medium, and low-tier LLMs based on task intent, session budget, context size, and custom rules — with automatic fallbacks, phase awareness, Ollama sync, and transparent rate-limit recovery.

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Logical Router Provider** | Registers a `router` provider that exposes stable profiles (e.g., `router/auto`) as models. |
| **Per-Turn Routing** | Intelligently chooses between `high`, `medium`, and `low` tiers for every turn based on task intent and complexity. |
| **Task-Aware Heuristics** | Detects planning vs. implementation vs. lightweight tasks using keyword analysis, word count, and conversation history. |
| **LLM Intent Classifier** | Optionally use a fast model to categorize intent (overrides heuristics). |
| **Custom Rules** | Define keyword-based tier overrides for specific patterns (e.g., `deploy` → `high`). |
| **Context Trigger** | Automatically upgrade to high-tier when token usage exceeds a threshold. |
| **Cost Budgeting** | Set a session spend limit; high tier downgrades to medium once exceeded. |
| **Fallback Chains** | Automatic retry with alternative models if the primary choice fails. |
| **Phase Memory** | Biased stickiness to keep you in the same tier during multi-turn planning or implementation work. |
| **Thinking Control** | Full control over reasoning/thinking levels per tier and profile. |
| **Persistent State** | Pins, profiles, costs, and debug history are remembered across agent restarts and conversation branches. |
| **Ollama Auto-Sync** | Auto-detect and register local Ollama models. |
| **Rate-Limit Fallback** | Detect HTTP 402/429/503/529 and transparently fall back to local models. |
| **Feature Toggles** | Enable/disable features at user or project level. |
| **Progressive Enhancement** | Detects installed plugins (qmd-ledger, agent-bus) and integrates conditionally. |

## 📦 Installation

### From npm

```bash
pi install npm:@kylebrodeur/pi-model-router
```

### From source

```bash
git clone https://github.com/kylebrodeur/pi-model-router.git
cd pi-model-router
pi install .
```

### Quick test

```bash
pi -e ./extensions/index.ts
```

## 🚀 Quick Start

```bash
# 1. Install the extension
pi install npm:@kylebrodeur/pi-model-router

# 2. Create default config
/router init

# 3. Reload to apply
/reload

# 4. Check status
/router status
```

## ⚙️ Configuration

Copy the example config to one of:

- `~/.pi/agent/model-router.json` (Global)
- `.pi/model-router.json` (Project-specific)

### Basic Config Shape

```json
{
  "defaultProfile": "auto",
  "classifierModel": "google/gemini-flash-latest",
  "maxSessionBudget": 1.0,
  "profiles": {
    "auto": {
      "high": { "model": "openai/gpt-5.4-pro", "thinking": "high" },
      "medium": { "model": "google/gemini-flash-latest", "thinking": "medium" },
      "low": { "model": "openai/gpt-5.4-nano", "thinking": "low" }
    }
  }
}
```

### Configuration Fields

| Field | Description |
|-------|-------------|
| `defaultProfile` | The profile to use when starting a new session. |
| `classifierModel` | (Optional) Model used to categorize intent. If omitted, fast heuristics are used. |
| `maxSessionBudget` | (Optional) USD budget for the session. Forces `medium` tier once exceeded. |
| `largeContextThreshold` | (Optional) Token count trigger to force `high` tier for large contexts. |
| `phaseBias` | (0.0 - 1.0) Stickiness of the current phase. Higher = more stable. Default `0.5`. |
| `rules` | List of custom keyword rules (e.g. `{ "matches": "deploy", "tier": "high" }`). |
| `profiles` | Map of profile definitions, each containing `high`, `medium`, and `low` tiers. |

### Feature Toggles

```json
{
  "features": {
    "ollamaSync": true,
    "rateLimitFallback": true,
    "scopeShim": true,
    "perTurnRouting": true,
    "intentClassifier": false,
    "costBudgeting": true,
    "phaseMemory": true,
    "contextCompression": true,
    "ledgerIntegration": false,
    "agentBusIntegration": false
  }
}
```

**Priority:** Project config `.pi/model-router.json` overrides user config `~/.pi/agent/model-router.json`. Both override defaults.

### Rate Limit Interception & Fallback

The router can gracefully handle 429 Rate Limit and Quota errors. If the error specifies a wait time (e.g., "reset after 58s"), the router will pause and automatically retry the prompt if the wait time is under your threshold. If it exceeds the threshold or is unparseable, it fails over to the next available model in your fallback sequence.

```json
{
  "rateLimitFallback": {
    "enabled": true,
    "shortDelayThreshold": 60,
    "autoFallback": true,
    "autoRestore": true,
    "restoreCheckInterval": 300,
    "fallbackSequence": ["anthropic/claude-3-haiku-20240307", "ollama/*"]
  }
}
```

| Field | Description |
|-------|-------------|
| `shortDelayThreshold` | Maximum time (in seconds) the router will pause and wait to retry when encountering a rate limit. If the cooldown is longer than this, it triggers a fallback. |
| `fallbackSequence` | Array of model IDs (or wildcards like `ollama/*`) to try if the primary model fails or the wait time is too long. |
| `autoFallback` | (Optional) Automatically switch session to the fallback model globally after a hard failure. |
| `autoRestore` | (Optional) If fallback was triggered, automatically try to restore the original cloud model after `restoreCheckInterval` seconds. |

### Progressive Enhancement Configs

After installing optional extensions, copy one of these to `.pi/model-router.json`:

| File | Feature |
|------|---------|
| `model-router.ledger.json` | Log routing decisions to qmd-ledger |
| `model-router.agent-bus.json` | Publish model changes to agent-bus |
| `model-router.essential.json` | All integrations enabled |

## ⌨️ Commands

### Core Router Commands

| Command | Description |
|---------|-------------|
| `/router` | Show detailed status, current profile, spend, and settings. |
| `/router status` | Alias for `/router` (show current status). |
| `/router profile [name]` | Switch to a profile or list available ones (enables router if off). |
| `/router pin [prof] <t\|a>` | Pin a tier (high/medium/low/auto) for the current or specified profile. |
| `/router fix <tier>` | Correct the *last* decision and pin that tier for the current profile. |
| `/router thinking ...` | Override thinking levels (e.g., `/router thinking low xhigh`). |
| `/router disable` | Disable the router and switch back to the last non-router model. |
| `/router widget <on\|off>` | Toggle the persistent state widget (supports `toggle`). |
| `/router debug <on\|off>` | Toggle turn-by-turn routing notifications (supports `toggle`, `clear`, `show`). |
| `/router reload` | Hot-reload the configuration JSON. |
| `/router help` | Show usage help for all subcommands. |

### Fork-Added Commands

| Command | Feature | Description |
|---------|---------|-------------|
| `/router ollama-sync` | ollamaSync | Manually sync Ollama models |
| `/router fallback` | rateLimitFallback | Switch to fallback model sequence |
| `/router restore` | rateLimitFallback | Restore cloud model |
| `/router init` | | Scaffold default config file |
| `/router scope apply` | scopeShim | Sync router profiles to Pi enabled models |
| `/router scope reset` | scopeShim | Clear router profiles from Pi enabled list |
| `/router scope show` | scopeShim | Show current Pi scoped models settings |

## 🔒 Requirements

- **Pi >= 0.70.2** — Required for `after_provider_response` event (rate limit detection)
- **Ollama** — Running locally for Ollama sync and fallback
- **Node.js >= 18** — For TypeScript compilation

## 📚 Documentation

- [Architecture Guide](docs/ARCHITECTURE.md): Deep dive into routing logic and modular design.
- [Testing Guide](TESTING.md): Step-by-step testing checklist.
- [Contributing Guide](CONTRIBUTING.md): How to contribute back to upstream.
- [Quick Start](QUICKSTART.md): 6-step install guide.
- [Sample Configuration](model-router.example.json): Diverse profile examples (`cheap`, `deep`, `balanced`).
- [Learnings](LEARNINGS.md): Development insights and best practices.

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- How to split changes into upstream-friendly PRs
- Commit message conventions
- Testing requirements
- What to say in PR descriptions

## 📜 License

MIT — See [LICENSE](LICENSE).

## 🙏 Acknowledgements

- **[yeliu84/pi-model-router](https://github.com/yeliu84/pi-model-router)**: The original author and architecture behind the `router` provider.
- **[shouvik12/trooper](https://github.com/shouvik12/trooper)**: Inspiration for robust, transparent HTTP rate-limit fallback triggers.
