Extension API: expose `setScopedModels` for dynamic model cycle lists

## Summary

`AgentSession` already supports `scopedModels` — a per-session list of models the user cycles through with `Ctrl+P`. This list is currently **not accessible from the extension API**. Exposing `setScopedModels` (and optionally `getScopedModels`) on `ExtensionAPI` or `ExtensionContext` would let extensions curate the cycle list dynamically based on session state.

## Prior Context

This was raised before in #3328 and #3330 but auto-closed due to new-contributor policy before maintainer review. Re-opening here with a narrower scope focused on the API surface.

---

## What do you want to change?

Expose `setScopedModels` to the extension runtime so extensions can modify the `Ctrl+P` model cycle list at runtime.

### Proposed API

```typescript
// Option A: On ExtensionAPI (preferred — consistent with pi.setModel / pi.registerProvider)
interface ExtensionAPI {
  // ... existing methods ...
  setScopedModels(models: Array<ScopedModelEntry>): void;
}

interface ScopedModelEntry {
  model: Model<any>;
  thinkingLevel?: ThinkingLevel;
}
```

```typescript
// Option B: On ExtensionContext (if it needs session awareness)
interface ExtensionContext {
  // ...
  setScopedModels(entries: Array<ScopedModelEntry>): void;
}
```

### Behavior

- `setScopedModels` replaces the current scoped model list immediately (no reload required)
- The new list is reflected in the `/scoped-models` UI and `Ctrl+P` cycling
- If empty, falls back to all available models (current behavior)
- Should match the existing internal `AgentSession.setScopedModels()` signature

---

## Why?

1. **Dynamic model discovery**: An extension that registers a custom provider (e.g., from a local proxy or Ollama) may want to limit `Ctrl+P` to only the models from that provider for the current session
2. **Compliance / project-specific scoping**: Different projects require different providers. Extensions should be able to enforce a curated list instead of requiring users to pass `--models` flags
3. **Dynamic tier lists**: When using tiered routing, an extension may want `Ctrl+P` to cycle only models in the current tier (e.g., `high → medium → low`) rather than every model in the registry
4. **Session-start initialization**: An extension could read `PI_SCOPED_MODELS` from the environment and set the list during `session_start`, avoiding CLI flags

---

## How? (optional)

### Minimal Implementation Path

The internal `AgentSession._scopedModels` already has a getter and a `setScopedModels()` method. The work is:

1. **Add the method to `ExtensionAPI`** (in `core/extensions/types.d.ts`)
2. **Wire it** in `core/extensions/runner.ts` to delegate to the bound `AgentSession`
3. **(Optional)** Expose `resolveModelScope` from the model resolver so extensions can parse shorthand references (e.g., `"anthropic/*"` or `"claude-sonnet-4"`) without reimplementing the glob matching

### Example Extension Usage

```typescript
pi.on('session_start', async (event, ctx) => {
  if (event.reason !== 'startup') return;

  // Curate cycle list to only high-reasoning models
  const highReasoning = ctx.modelRegistry.getAvailable()
    .filter(m => m.reasoning)
    .map(m => ({ model: m, thinkingLevel: 'high' as ThinkingLevel }));

  pi.setScopedModels(highReasoning);
});
```

---

## Does this break anything?

No. This is an additive API change. Existing sessions without extensions calling `setScopedModels` behave identically.

---

## Related

- #3328 — Original request (closed by bot)
- #3330 — Duplicate (closed by bot)
