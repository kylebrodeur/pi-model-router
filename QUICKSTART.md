# Quick Start — Use the Fork TODAY

## 1. Install Extension

```bash
cd ~/projects/pi-model-router-forked

# Create Pi extension directory
mkdir -p ~/.pi/agent/extensions/pi-model-router

# Copy all source files
cp extensions/*.ts ~/.pi/agent/extensions/pi-model-router/
cp package.json ~/.pi/agent/extensions/pi-model-router/
cp tsconfig.json ~/.pi/agent/extensions/pi-model-router/
```

## 2. Enable Features in Config

```bash
cat > ~/.pi/agent/model-router.json << 'EOF'
{
  "features": {
    "ollamaSync": true,
    "rateLimitFallback": true,
    "perTurnRouting": true,
    "costBudgeting": true,
    "phaseMemory": true
  },
  "profiles": {
    "balanced": {
      "high": { "model": "anthropic/claude-sonnet-4" },
      "medium": { "model": "google/gemini-flash-latest" },
      "low": { "model": "ollama/gemma4:9b" }
    }
  }
}
EOF
```

## 3. Use in Pi

In Pi, run:
```
/reload
```

You should see in console:
```
[router] Feature sync complete - ollama: true rate-limit: true
[router] ollama-sync: enabled
[router] rate-limit-fallback: enabled
```

## 4. Verify Features

### Auto-Sync Test

```bash
# In another terminal
ollama pull llama3.2:3b
```

```
# In Pi
/router-ollama-sync
```

Expected: `Added: llama3.2:3b`

### Fallback Test

```
# In Pi — switch to a cloud model first
/model anthropic/claude-sonnet-4

# Then trigger fallback
/router-fallback
```

Expected: switches to best available Ollama model

```
# Restore
/router-restore
```

### Rate Limit Status

```
/router-rate-limit-status
```

## 5. New Commands

| Command | What it does |
|---------|-------------|
| `/router-ollama-sync` | Manually sync Ollama models |
| `/router-fallback` | Switch to Ollama (manual) |
| `/router-restore` | Restore cloud model |
| `/router-rate-limit-status` | Show rate limit history |

All existing `/router *` commands still work unchanged.

## 6. Daily Workflow

```bash
# Pull new Ollama model
ollama pull qwen3.5:7b
```

```
# In Pi — auto-sync triggers on session start
/new
# → [Router] Added 1 model(s): qwen3.5:7b
# → Run /reload to see: qwen3.5:7b

/reload
# → Model now available in /model
```

## Troubleshooting

**"Ollama not available"**
→ Check `ollama list` works in terminal

**Models not in registry**
→ `/reload` — extension reload refreshes model registry

**TypeScript errors**
→ Requires Pi 0.67+ for rate-limit fallback (uses `after_provider_response` event)
→ Ollama sync works with current Pi version

**Config not applying**
→ Verify `~/.pi/agent/model-router.json` exists
→ Check with `cat ~/.pi/agent/model-router.json`
