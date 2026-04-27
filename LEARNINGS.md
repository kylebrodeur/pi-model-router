# Pi Model Router: Extension Development Learnings

This document captures key insights from developing the `pi-model-router` extension, focusing on architectural patterns, type safety, and best practices for future Pi extensions and AI tool integrations.

## 🎯 Extension Architecture

### 1. Provider-First Design Pattern
The extension registers itself as a **custom provider** rather than a simple script. The `router` provider exposes "virtual models" (e.g., `router/auto`, `router/cheap`) that remain stable while underlying concrete models change transparently.

*   **When to use**: For any extension that needs to provide its own model selection logic, caching, or request routing.
*   **Key benefit**: The UI and commands can target `router/auto` consistently, while the backend can swap underlying models based on configuration, load, or context.

### 2. Modularity by Concern
The extension strictly separates responsibilities into dedicated modules:

*   `extensions/types.ts`: All interfaces (e.g., `RouterConfig`, `RoutingRule`)
*   `extensions/config.ts`: Loading, normalization, merging, validation
*   `extensions/routing.ts`: Core decision logic (heuristics, classifier, rules)
*   `extensions/provider.ts`: Provider registration, stream delegation
*   `extensions/state.ts`: Session-persisted state management
*   `extensions/ui.ts`: Status line and widget rendering
*   `extensions/commands.ts`: CLI command registrations and completions
*   `extensions/feature-module.ts`: Feature-specific modules (e.g., `ollama-sync.ts`, `rate-limit.ts`)

*   **When to use**: For any extension with complex logic that will benefit from maintainability and testing benefits.
*   **Key benefit**: Each module can be unit tested in isolation. Changes to one concern (e.g., updating heuristics) don't risk breaking unrelated logic (e.g., command registration).

### 3. State Management via Session Entries
Router state is persisted using `pi.appendEntry('router-state', state)`, which creates custom session entries. This ensures state is **branch-safe**, meaning if a user creates a new conversation branch, the router can either share or isolate state as needed.

*   **When to use**: For any extension that needs to maintain state across agent restarts or conversation branches.
*   **Key benefit**: State survives session reloads and is automatically cleaned up when branches are deleted.

## 🛡️ Type Safety & Code Quality

### 1. Zero-`any` Policy
The extension enforces a strict policy: **Never use the `any` type**. When `any` was encountered, it was replaced with `unknown` or more specific types (e.g., `RoutedTierConfig`, `RouterTier`).

*   **When to use**: For any project where long-term maintainability and robustness are priorities.
*   **Key benefit**: Prevents runtime errors from invalid data structures. The compiler catches mismatches before deployment.

### 2. Arrow Functions Only
All functions are defined as arrow functions (`const myFunc = () => ...`) instead of function statements. This ensures consistent lexical scoping.

*   **When to use**: For consistency across modern TypeScript projects.
*   **Key benefit**: Eliminates unexpected `this` binding issues.

### 3. Prettier-First Development
The extension was formatted with Prettier (`npx prettier --write extensions/*.ts`). This enforced consistency before any deeper logic work.

*   **When to use**: For any multi-author project or open-source contribution.
*   **Key benefit**: Saves time on code reviews and prevents "style wars" in PR discussions.

## 🧭 Routing Decision Logic

### 1. Tiered Decision System
The router uses a tiered (`high`, `medium`, `low`) decision system, ordered by complexity and cost. A priority-based flow:
1. **Budget Check** (downgrade if exceeded)
2. **Context Trigger** (upgrade if large)
3. **Manual Pin** (user override)
4. **Custom Rules** (keyword matching)
5. **LLM Classifier** (optional)
6. **Heuristics** (fallback)
7. **Phase Bias** (stickiness)

*   **When to use**: For any AI agent that needs to balance cost vs. performance dynamically.
*   **Key insight**: Tiering allows fine-grained control over cost vs. quality trade-offs.

### 2. Fallback Sequence Design
The fallback mechanism uses a user-configurable sequence of models: `fallbackSequence: ["anthropic/claude-3-haiku", "ollama/*"]`. This is more robust than hardcoding.

*   **When to use**: For any extension with high-stakes reliability requirements.
*   **Key benefit**: Prevents catastrophic failures when a primary model is unavailable.

### 3. Graceful Error Handling
The extension transparently handles errors. For "out of credits" (`402`) or "rate limit" (`429`), it automatically switches to a fallback model and emits a custom session entry (`router-fallback`) for headless tooling to detect. 
Additionally, for string-based 429 errors specifying a cooldown (e.g., "quota will reset after 58s"), the router can intercept the stream, pause for the required duration (if under `shortDelayThreshold`), and automatically retry the original request without failing the turn.

*   **When to use**: For any extension exposed to external API services.
*   **Key insight**: Never mask API errors; provide enough detail (status codes) in UI notifications for users to diagnose, but handle transient issues (like short rate limits) invisibly where possible.

## 🔌 Pi Integration Patterns

### 1. Feature Toggles via Config
A `features` object in `model-router.json` allows enabling/disabling features at runtime:
```json
{
  "features": {
    "ollamaSync": true,
    "respectPiScope": false,
    "rateLimitFallback": true
  }
}
```

*   **When to use**: For any extension with optional functionality.
*   **Key benefit**: Allows backward compatibility while testing new features.

### 2. Config Merging Strategy
The extension supports both global and project-level config:
- Global: `~/.pi/agent/model-router.json`
- Project: `.pi/model-router.json`

The project config **overrides** the global config, enabling granular overrides per repository.

*   **When to use**: For any extension where users want both global defaults and per-project overrides.
*   **Key insight**: A clear merge hierarchy avoids confusion about where settings live.

### 3. Command Registration
Commands are registered under `/router` with subcommands (`/router status`, `/router profile`, etc.). This namespace keeps the command list clean and avoids conflicts.

*   **When to use**: For any extension with multiple commands.
*   **Key benefit**: Users can discover commands via autocompletion.

## 📊 Pi Extension Best Practices (Learnings Summary)

### For Future Pi Extensions

1.  **Provider Registration**
    -   Always register a custom provider if your extension needs to provide its own models or routing logic.
    -   Keep the provider name stable while underlying models change.

2.  **State Management**
    -   Use `pi.appendEntry('router-state', state)` for session-persisted state.
    -   Use a `type` field (e.g., `customType: 'router-state'`) to serialize/deserialize custom state.

3.  **Type Safety**
    -   Never use `any`. Replace with `unknown` or specific interfaces.
    -   Enforce TypeScript strict mode.
    -   Format code with Prettier.

4.  **Configuration**
    -   Support global (`~/.pi/agent/`) and project (`.pi/`) config.
    -   Use feature flags (`features: {...}`) to enable/disable optional behavior.

5.  **Command Design**
    -   Prefix all commands with a single top-level namespace (e.g., `/router *`).
    -   Use autocompletion (`getArgumentCompletions`) to guide users.

6.  **Error Handling**
    -   Never mask API errors. Provide details (status codes) in UI notifications.
    -   For critical failures, emit custom session entries so headless tooling can react.

### For AI Tools and LLM Systems

1.  **Fallback Strategy**
    -   Always implement a fallback sequence. Never leave the user hanging on a single point of failure.

2.  **Cost vs. Quality Trade-off**
    -   Tiering (`high`, `medium`, `low`) is a powerful abstraction for managing cost vs. quality.
    -   Let users define their own tiers based on their wallet and performance needs.

3.  **Context Awareness**
    -   Be aware of context size limits. Many models have smaller context windows than their advertised maximum.
    -   Implement context truncation and auto-oversight to prevent failures.

4.  **User Transparency**
    -   Inform users when switching models or tiers.
    -   Provide history or logs so users can audit decisions.

5.  **Testing and Documentation**
    -   Create a `TESTING.md` for step-by-step user validation.
    -   Create a `QUICKSTART.md` for users to get running in 5 minutes.
    -   Document all feature flags and their trade-offs.

## 🚀 Next Steps for pi-model-router

1.  **NPM Publishing**
    -   Bump version in `package.json` (e.g., `v0.1.2`).
    -   Run `npm publish --access public`.
    -   Tag release on GitHub (`git tag v0.1.2`).

2.  **Documentation Enhancements**
    -   Consider adding a "Thinking Guide" for users to choose thinking levels (`off`, `minimal`, `medium`, `high`, `xhigh`) based on task type.
    -   Add a "Tier Selection" guide, explaining when to use `high` vs. `medium` vs. `low`.

3.  **Future Feature Ideas**
    -   Per-profile Ollama models (different models per router profile).
    -   Rate limit dashboard (`/router rate-limit show` with history graph).
    -   Config UI wizard (`/router config setup` interactive).

This document serves as a knowledge base for the project, capturing lessons learned and recommendations for future development. It can be used to onboard new contributors or to inform the architecture of similar extensions.
