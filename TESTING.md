# 🧪 Testing Checklist - pi-model-router Fork

## Pre-requisites

- [ ] **Pi updated** to 0.67+ (for `after_provider_response` event support)
- [ ] **Node.js** 18+ available
- [ ] **Ollama installed and running**
- [ ] At least one Ollama model pulled locally

## Installation Steps

```bash
# 1. Navigate to fork
cd ~/projects/pi-model-router-forked

# 2. Install dependencies
npm install

# 3. Install as Pi extension globally (development mode)
mkdir -p ~/.pi/agent/extensions/pi-model-router
cp -r extensions/* ~/.pi/agent/extensions/pi-model-router/
cp package.json ~/.pi/agent/extensions/pi-model-router/
cp tsconfig.json ~/.pi/agent/extensions/pi-model-router/

# 4. Create config
cat > ~/.pi/agent/model-router.json << 'EOF'
{
  "features": {
    "ollamaSync": true,
    "rateLimitFallback": true,
    "perTurnRouting": true,
    "intentClassifier": false,
    "costBudgeting": true,
    "phaseMemory": true
  },
  "ollamaSync": {
    "enabled": true,
    "onStartup": true,
    "onReload": true,
    "addLaunchFlag": false
  },
  "rateLimitFallback": {
    "enabled": true,
    "shortDelayThreshold": 60,
    "autoFallback": false,
    "autoRestore": false,
    "fallbackSequence": ["ollama/*"]
  },
  "profiles": {
    "balanced": {
      "high": { "model": "anthropic/claude-sonnet-4", "thinking": "high" },
      "medium": { "model": "google/gemini-flash-latest", "thinking": "medium" },
      "low": { "model": "ollama/gemma4:9b", "thinking": "off" }
    }
  }
}
EOF
```

## Test 1: Basic Router Functionality (Upstream Baseline)

**Goal:** Verify upstream routing still works with our changes.

```bash
# Start Pi with router extension
pi -e ~/.pi/agent/extensions/pi-model-router/index.ts
```

- [ ] Pi starts without errors
- [ ] Console shows `[router] Feature sync complete`
- [ ] Status bar shows router info

```
# In Pi TUI
/router status
```

- [ ] Shows current profile, tier, model
- [ ] Shows `Router enabled: true`

### Test Routing Decision

```
# Switch to router profile
/router profile balanced
```

- [ ] Model switches to `router/balanced`
- [ ] Status bar updates

```
# Ask a simple question (should route to low tier)
What is 2+2?
```

- [ ] Request uses low-tier model

```
# Ask a complex design question (should route to high tier)
Design a full-stack app architecture with React, Node, and PostgreSQL
```

- [ ] Request uses high-tier model

## Test 2: Ollama Auto-Sync

**Goal:** Verify new Ollama models are detected and added.

### Step 1: Pull a New Model

```bash
# In another terminal
ollama pull llama3.2:3b
```

### Step 2: Trigger Sync in Pi

```
# In Pi TUI
/router ollama-sync
```

**Expected:**
- [ ] Notification: `[Router] Added 1 model(s)`
- [ ] Notification: `Run /reload to see: llama3.2:3b`

### Step 3: Reload and Verify

```
/reload
```

**Expected:**
- [ ] Extension reloads
- [ ] New model appears in `/model` selector under "ollama"

### Step 4: Auto-Sync on Session Start

```
/model  # Switch to a non-router model
/new     # Start new session
```

**Expected:**
- [ ] On session start, Ollama sync runs automatically
- [ ] If new models exist, notifications appear
- [ ] Console log: `[router] ollama-sync: feature enabled`

### Step 5: Project-Level Config Override

```bash
# In your project directory
echo '{ "features": { "ollamaSync": false } }' > .pi/model-router.json
```

```
# In Pi TUI (from project directory)
/router
```

**Expected:**
- [ ] Auto-sync doesn't run on session start
- [ ] Manual `/router ollama-sync` still works

## Test 3: Rate Limit Fallback

**Goal:** Verify rate limit detection and manual fallback.

### Step 1: Verify Rate Limit Monitoring

**Note:** Real rate limits are hard to trigger intentionally. This requires actual API usage.

```
# In Pi TUI, ensure tracking is active
/router status
```

**Expected:**
- [ ] Status output includes rate limit or fallback info if relevant.

### Step 2: Manual Fallback

```
# Switch to a cloud model first
/model anthropic/claude-sonnet-4

# Then trigger manual fallback
/router fallback
```

**Expected:**
- [ ] Switches to fallback model (best available matching sequence)
- [ ] Status bar shows `🏠 fallback`
- [ ] Console log shows fallback model name

### Step 3: Restore

```
/router restore
```

**Expected:**
- [ ] Restores to original cloud model
- [ ] Status bar clears `🏠 fallback`

### Step 4: Feature Disabled

```bash
echo '{ "features": { "rateLimitFallback": false } }' > ~/.pi/agent/model-router.json
```

```
/reload
```

**Expected:**
- [ ] Console shows `[router] rate-limit-fallback: disabled`
- [ ] Status bar still shows router info but no fallback indicator

## Test 4: Feature Toggles (Config Merging)

### Step 1: User-Level Config

```bash
cat > ~/.pi/agent/model-router.json << 'EOF'
{
  "features": {
    "ollamaSync": true,
    "rateLimitFallback": true,
    "perTurnRouting": true
  }
}
EOF
```

### Step 2: Project-Level Override

```bash
mkdir -p .pi
cat > .pi/model-router.json << 'EOF'
{
  "features": {
    "ollamaSync": false,
    "rateLimitFallback": false
  }
}
EOF
```

### Step 3: Verify

```
# In Pi TUI from project directory
/router
```

**Expected:**
- [ ] Console shows `[router] rate-limit-fallback: disabled`
- [ ] Console shows `[router] ollama-sync: disabled`
- [ ] Per-turn routing still works (project didn't override it)

## Test 5: Edge Cases

### Missing Ollama

```
# Stop Ollama
ollama stop  # or kill process

# Try sync
/router ollama-sync
```

**Expected:**
- [ ] Notification: `Ollama not available`
- [ ] No crash, graceful failure

### Missing models.json

```bash
mv ~/.pi/agent/models.json ~/.pi/agent/models.json.bak
```

```
/router ollama-sync
```

**Expected:**
- [ ] Notification: `models.json not found`

```bash
# Restore
mv ~/.pi/agent/models.json.bak ~/.pi/agent/models.json
```

### No Ollama Models Configured

```bash
# Temporarily move models.json ollama section
```

```
/router fallback
```

**Expected:**
- [ ] `No Ollama models available` error notification

## Test 6: Combined Features (Full Workflow)

**Goal:** Verify all features work together.

```bash
# Pull new model
ollama pull qwen3.5:7b
```

```
# Pi session
/new
```

**Expected:**
1. [ ] Session starts
2. [ ] Auto-sync detects `qwen3.5:7b`
3. [ ] Notification: `Added 1 model(s)`
4. [ ] `/reload` prompt shown
5. [ ] After `/reload`, routing profiles work
6. [ ] `/router profile balanced` switches to router
7. [ ] Simple query routes to low tier (possibly Ollama)
8. [ ] Complex query routes to high tier (cloud)

## Regression Tests (Upstream Feature Checklist)

- [ ] `/router` shows status
- [ ] `/router profile <name>` switches profiles
- [ ] `/router pin high` pins tier
- [ ] `/router pin auto` releases pin
- [ ] `/router disable` disables router
- [ ] `/router debug toggle` enables debug
- [ ] `/router widget toggle` toggles widget
- [ ] `/router reload` reloads config
- [ ] Routing decisions shown in UI (if debug enabled)
- [ ] Cost tracking works (if budgeting enabled)
- [ ] Cost budget forces downgrade when exceeded
- [ ] Phase memory works across turns
- [ ] Custom rules match and override tiers
- [ ] Context trigger forces high tier on large contexts

## Troubleshooting

### Extension Not Loading

```bash
# Check file paths
ls -la ~/.pi/agent/extensions/pi-model-router/
# Should see: index.ts, config.ts, types.ts, routing.ts, provider.ts, commands.ts, state.ts, ui.ts, constants.ts, ollama-sync.ts, rate-limit.ts, features.ts
```

### TypeScript Errors After Update

```bash
cd ~/.pi/agent/extensions/pi-model-router
npm install  # ensure dependencies match
./node_modules/.bin/tsc --noEmit
```

### Config Not Applying

```bash
# Verify files exist
cat ~/.pi/agent/model-router.json
cat .pi/model-router.json 2>/dev/null || echo "No project config"
```

### Rate Limit Not Detected

```
# Requires Pi 0.67+ — check version
pi --version

# If outdated:
npm install -g @mariozechner/pi-coding-agent
```

### Fallback Model Not In Registry

```
/reload
/model  # Check if new models appear
```

If Ollama models don't appear after `/reload`:
1. Check `models.json` has ollama provider section
2. Verify `baseUrl` is correct: `http://127.0.0.1:11434/v1`
3. Check Ollama is running: `ollama list` in terminal
