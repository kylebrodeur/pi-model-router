# Phase Memory Improvements Plan

Objective: Enhance the `pi-model-router` with more robust and "sticky" phase transitions to improve routing stability in multi-turn conversations.

## Key Files & Context

- `extensions/index.ts`: The main extension logic where `decideRouting` and `runClassifier` are implemented.
- `docs/plans/model-router-extension-plan.md`: The overall project plan for context.

## Implementation Steps

### 1. Update `RouterConfig`
Add a `phaseBias` field to `RouterConfig` to allow users to tune the stickiness of phases.

```typescript
interface RouterConfig {
    // ... existing
    classifierModel?: string;
    phaseBias?: number; // 0 to 1, where 1 is highly sticky. Default: 0.5.
    profiles: Record<string, RouterProfile>;
}
```

### 2. Enhance `decideRouting` (Heuristics)
Refine the heuristic logic to use the `phaseBias` and `previousDecision` more effectively.
- If in `planning` phase, increase the word count threshold for switching *out* of high tier.
- Better detect the "handoff" from planning to implementation (e.g., when a plan is confirmed or tools start being used).
- If the last decision was `high` and we are still exploratory (no tools), keep it `high` even for shorter messages.

### 3. Contextual Classifier
Pass the *current phase* to the LLM classifier in `runClassifier`. This helps the classifier understand the conversation state.

Update the classifier prompt:
```text
Current conversation phase: [planning|implementation|lightweight]

... existing prompt ...

Consider the current phase when categorizing the request. If we are in "planning", bias toward "high" unless the request is clearly a simple implementation or summary.
```

### 4. Code Changes in `extensions/index.ts`
- Update `normalizeConfig` and `mergeConfig` to handle `phaseBias`.
- Update `runClassifier` to accept and use `currentPhase`.
- Update `registerRouterProvider` to pass the previous phase to `runClassifier`.
- Refine `decideRouting` logic to use the new `phaseBias`.

## Verification & Testing

### 1. Multi-turn Stability Test
- Turn 1: "Let's plan a new feature." -> Expected: `high` (planning)
- Turn 2: "Tell me more about the architecture." -> Expected: `high` (planning) - SHOULD REMAIN STABLE.
- Turn 3: "Okay, implement it." -> Expected: `medium` (implementation) - SHOULD TRANSITION.

### 2. Stickiness Test
- Turn 1: "I have a complex bug." -> Expected: `high` (planning)
- Turn 2: "Wait, actually, just summarize the log." -> Expected: `low` (lightweight) - SHOULD BE ABLE TO ESCAPE STICKY PHASE WITH CLEAR SIGNAL.

### 3. Config Test
- Verify that `phaseBias` can be set in `model-router.json` and is respected.
