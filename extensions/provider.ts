import {
  createAssistantMessageEventStream,
  streamSimple,
  type Api,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  type Model,
  type SimpleStreamOptions,
  type Message,
} from '@mariozechner/pi-ai';
import type { ExtensionAPI, ExtensionContext } from '@mariozechner/pi-coding-agent';
import type {
  RouterConfig,
  RoutingDecision,
  RouterTier,
  RouterPinByProfile,
  RouterThinkingByProfile,
} from './types';
import { profileNames, parseCanonicalModelRef } from './config';
import {
  phaseForTier,
  buildRoutingDecision,
  decideRouting,
  runClassifier,
  extractTextFromContent,
} from './routing';

export const createErrorMessage = (model: Model<Api>, message: string): AssistantMessage => {
  return {
    role: 'assistant',
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: 'error',
    errorMessage: message,
    timestamp: Date.now(),
  };
};

/**
 * Heuristic token estimator (conservative: 3 characters per token)
 */
const estimateTokens = (text: string): number => Math.ceil(text.length / 3);

/**
 * Truncate context to fit within a target token limit by removing oldest messages.
 * Always preserves the first system message and the latest user message.
 */
const truncateContext = (context: Context, limit: number): Context => {
  const messages = [...context.messages];
  if (messages.length <= 2) return context;

  // Initial estimate
  let totalTokens = messages.reduce(
    (sum, m) => sum + estimateTokens(extractTextFromContent(m.content)),
    0,
  );
  if (totalTokens <= limit) return context;

  const systemMessage = messages[0].role === 'system' ? messages.shift() : undefined;
  const latestMessage = messages.pop()!; // The current turn

  // Remove oldest until it fits
  while (messages.length > 0) {
    const currentTokens =
      (systemMessage ? estimateTokens(extractTextFromContent(systemMessage.content)) : 0) +
      estimateTokens(extractTextFromContent(latestMessage.content)) +
      messages.reduce((sum, m) => sum + estimateTokens(extractTextFromContent(m.content)), 0);

    if (currentTokens <= limit) break;
    messages.shift(); // Remove oldest
  }

  const finalMessages: Message[] = [];
  if (systemMessage) finalMessages.push(systemMessage);
  finalMessages.push(...messages);
  finalMessages.push(latestMessage);

  return { ...context, messages: finalMessages };
};

export const registerRouterProvider = (
  pi: ExtensionAPI,
  state: {
    lastRegisteredModels: string;
    readonly currentConfig: RouterConfig;
    readonly currentModelRegistry: ExtensionContext['modelRegistry'] | undefined;
    readonly lastExtensionContext: ExtensionContext | undefined;
    selectedProfile: string;
    routerEnabled: boolean;
    lastDecision: RoutingDecision | undefined;
    readonly thinkingByProfile: RouterThinkingByProfile;
    readonly pinnedTierByProfile: RouterPinByProfile;
    accumulatedCost: number;
  },
  actions: {
    persistState: () => void;
    recordDebugDecision: (decision: RoutingDecision) => void;
    getThinkingOverride: (profileName: string, tier: RouterTier) => any;
  },
) => {
  const profileList = profileNames(state.currentConfig);

  // Map profiles to their capacities
  const modelDefinitions = profileList.map((name) => {
    const profile = state.currentConfig.profiles[name];
    let contextWindow = 1_000_000;
    let maxTokens = 64_000;
    let anyTierSupportsReasoning = false;

    if (state.currentModelRegistry) {
      const tiers: RouterTier[] = ['high', 'medium', 'low'];
      for (const tier of tiers) {
        try {
          const { provider, modelId } = parseCanonicalModelRef(profile[tier].model);
          const tierModel = state.currentModelRegistry.find(provider, modelId);
          if (tierModel) {
            if (tier === 'high') {
              contextWindow = tierModel.contextWindow ?? contextWindow;
              maxTokens = tierModel.maxTokens ?? maxTokens;
            }
            if (tierModel.reasoning) {
              anyTierSupportsReasoning = true;
            }
          }
        } catch (e) {
          // ignore
        }
      }
    }

    return {
      id: name,
      name: `Router ${name}`,
      reasoning: anyTierSupportsReasoning,
      input: ['text', 'image'] as ('text' | 'image')[],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow,
      maxTokens,
    };
  });

  const modelsKey = modelDefinitions
    .map((m) => `${m.id}:${m.contextWindow}:${m.maxTokens}:${m.reasoning}`)
    .join(',');
  if (state.lastRegisteredModels === modelsKey) return;

  pi.registerProvider('router', {
    baseUrl: 'router://local',
    apiKey: 'pi-model-router',
    api: 'router-local-api',
    models: modelDefinitions,
    streamSimple(
      model: Model<Api>,
      context: Context,
      options?: SimpleStreamOptions,
    ): AssistantMessageEventStream {
      const stream = createAssistantMessageEventStream();

      (async () => {
        try {
          if (!state.currentModelRegistry) {
            throw new Error('Router provider not initialized yet. Wait for session_start and retry.');
          }
          const profile = state.currentConfig.profiles[model.id];
          if (!profile) {
            throw new Error(`Unknown router profile: ${model.id}`);
          }

          state.selectedProfile = model.id;
          state.routerEnabled = true;

          const pinnedTier = state.pinnedTierByProfile[model.id];
          const isBudgetExceeded =
            state.currentConfig.maxSessionBudget !== undefined &&
            state.accumulatedCost >= state.currentConfig.maxSessionBudget;

          let decision: RoutingDecision = decideRouting(
            context,
            model.id,
            profile,
            state.lastDecision,
            pinnedTier,
            state.thinkingByProfile[model.id],
            state.currentConfig.phaseBias,
            state.currentConfig.rules,
            isBudgetExceeded,
          );

          // Optional Context Trigger Upgrade
          if (
            state.currentConfig.largeContextThreshold &&
            decision.tier !== 'high' &&
            state.lastExtensionContext
          ) {
            try {
              const usage = await state.lastExtensionContext.getContextUsage();
              if (usage.totalTokens > state.currentConfig.largeContextThreshold) {
                decision = buildRoutingDecision(
                  model.id,
                  profile,
                  'high',
                  'planning',
                  `Context usage (${usage.totalTokens}) exceeds threshold (${state.currentConfig.largeContextThreshold}). Forced high tier.`,
                  state.thinkingByProfile[model.id],
                  false,
                );
                decision.isContextTriggered = true;
              }
            } catch (e) {
              // ignore
            }
          }

          // Classifier Override
          if (
            state.currentConfig.classifierModel &&
            !pinnedTier &&
            !decision.isContextTriggered &&
            !decision.isRuleMatched
          ) {
            const classifierResult = await runClassifier(
              state.currentConfig.classifierModel,
              state.currentModelRegistry,
              context,
              state.lastDecision?.phase,
            );
            if (classifierResult) {
              decision = buildRoutingDecision(
                model.id,
                profile,
                classifierResult.tier,
                phaseForTier(classifierResult.tier),
                `Classifier: ${classifierResult.reasoning}`,
                state.thinkingByProfile[model.id],
                true,
              );
              if (isBudgetExceeded && decision.tier === 'high') {
                decision.tier = 'medium';
                decision.phase = 'implementation';
                decision.reasoning = `Budget exceeded. Downgraded classifier decision to medium. (Original: ${decision.reasoning})`;
                decision.isBudgetForced = true;
              }
            }
          }

          const lastMessage = context.messages[context.messages.length - 1];
          const previousDecision = state.lastDecision;
          const isGoogleThinkingToolContinuation =
            lastMessage?.role === 'toolResult' &&
            previousDecision?.profile === model.id &&
            previousDecision.targetProvider === 'google' &&
            previousDecision.thinking !== 'off' &&
            decision.targetProvider === 'google' &&
            decision.thinking !== 'off' &&
            previousDecision.targetLabel !== decision.targetLabel;

          if (isGoogleThinkingToolContinuation) {
            decision = {
              ...decision,
              tier: previousDecision!.tier,
              phase: previousDecision!.phase,
              targetProvider: previousDecision!.targetProvider,
              targetModelId: previousDecision!.targetModelId,
              targetLabel: previousDecision!.targetLabel,
              thinking: previousDecision!.thinking,
              reasoning:
                `Preserved ${previousDecision!.targetLabel} for a Google tool-result continuation ` +
                `to avoid thought-signature replay errors. (Original: ${decision.reasoning})`,
            };
          }

          state.lastDecision = decision;
          actions.recordDebugDecision(decision);

          const modelsToTry = [decision.targetLabel, ...(profile[decision.tier].fallbacks ?? [])];
          let lastError: any;
          let success = false;

          for (let i = 0; i < modelsToTry.length; i++) {
            const modelRef = modelsToTry[i];
            const { provider: targetProvider, modelId: targetModelId } =
              parseCanonicalModelRef(modelRef);

            if (targetProvider === 'router') continue;

            const targetModel = state.currentModelRegistry.find(targetProvider, targetModelId);
            if (!targetModel) {
              lastError = new Error(`Routed model not found: ${targetProvider}/${targetModelId}`);
              continue;
            }

            const apiKey = await state.currentModelRegistry.getApiKey(targetModel);
            if (!apiKey) {
              lastError = new Error(`No API key for routed model: ${targetProvider}/${targetModelId}`);
              continue;
            }

            try {
              // HONESTY CHECK & AUTO-TRUNCATION
              // If the picked model has a smaller context than what we reported, truncate now.
              let effectiveContext = context;
              const targetLimit = targetModel.contextWindow || 128_000;
              if (targetLimit < model.contextWindow!) {
                effectiveContext = truncateContext(context, targetLimit);
              }

              const thinkingOverride = actions.getThinkingOverride(model.id, decision.tier);
              const delegatedReasoning =
                targetModel.reasoning && (thinkingOverride ?? decision.thinking) !== 'off'
                  ? (thinkingOverride ?? decision.thinking)
                  : undefined;
              const delegatedStream = streamSimple(targetModel, effectiveContext, {
                ...options,
                apiKey,
                ...(delegatedReasoning ? { reasoning: delegatedReasoning } : {}),
              });

              let contentReceived = false;
              for await (const event of delegatedStream) {
                if (event.type === 'done') {
                  const cost = event.message.usage?.cost?.total ?? 0;
                  state.accumulatedCost += cost;
                }
                if (event.type === 'error' && !contentReceived) {
                  throw new Error(
                    (event as any).error?.errorMessage || 'Model failed before sending content.',
                  );
                }
                const isContent =
                  event.type === 'chunk' ||
                  event.type === 'text_delta' ||
                  event.type === 'thinking_delta' ||
                  (event.type as string) === 'tool_call_delta' ||
                  (event.type as string) === 'toolCall';
                if (isContent) contentReceived = true;
                stream.push(event);
              }
              success = true;
              if (i > 0) decision.isFallback = true;
              break;
            } catch (err) {
              lastError = err;
            }
          }

          if (!success) {
            throw lastError || new Error('Failed to delegate to any model in the chain.');
          }

          stream.end();
        } catch (error) {
          stream.push({
            type: 'error',
            reason: 'error',
            error: createErrorMessage(model, error instanceof Error ? error.message : String(error)),
          });
          stream.end();
        } finally {
          actions.persistState();
        }
      })();

      return stream;
    },
  });

  state.lastRegisteredModels = modelsKey;
};
