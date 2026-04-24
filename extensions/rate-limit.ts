/**
 * Rate Limit Fallback Feature
 *
 * Monitors provider responses for rate limiting.
 * NOTE: Requires Pi 0.67+ for after_provider_response event.
 */
import type {
  ExtensionAPI,
  ExtensionContext,
} from '@mariozechner/pi-coding-agent';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  enabled: boolean;
  shortDelayThreshold: number;
  autoFallback: boolean;
  autoRestore: boolean;
  restoreCheckInterval: number;
  fallbackSequence: string[];
}

export interface RateLimitEventEntry {
  timestamp: number;
  provider: string;
  model: string;
  retryAfter?: number;
  httpStatus: number;
}

export interface ModelCapabilities {
  vision: boolean;
  reasoning: boolean;
  contextWindow: number;
  maxTokens: number;
}

export interface FallbackState {
  preferredModel?: string;
  fallbackActive: boolean;
  autoRestore: boolean;
  triggeredAt?: number;
  triggerReason?: 'rate_limit' | 'budget_exceeded' | 'manual';
  lastRestoreAttempt?: number;
  requiredCapabilities?: ModelCapabilities;
}

// ─── Config ─────────────────────────────────────────────────────────────────

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  enabled: true,
  shortDelayThreshold: 60,
  autoFallback: false,
  autoRestore: false,
  restoreCheckInterval: 300,
  fallbackSequence: ['ollama/*'],
};

// ─── Module State ───────────────────────────────────────────────────────────

let state: FallbackState = {
  fallbackActive: false,
  autoRestore: false,
};

let history: RateLimitEventEntry[] = [];

// ─── Helpers ────────────────────────────────────────────────────────────────

const getModelCapabilities = (model: {
  input: string[];
  reasoning: boolean;
  contextWindow: number;
  maxTokens: number;
}): ModelCapabilities => ({
  vision: model.input.includes('image'),
  reasoning: model.reasoning,
  contextWindow: model.contextWindow,
  maxTokens: model.maxTokens,
});

const capabilitiesMatch = (
  required: ModelCapabilities,
  candidate: ModelCapabilities,
): { match: boolean; missing: string[] } => {
  const missing: string[] = [];
  if (required.vision && !candidate.vision) missing.push('vision');
  if (required.reasoning && !candidate.reasoning) missing.push('reasoning');
  if (candidate.contextWindow < required.contextWindow)
    missing.push(
      `contextWindow ${candidate.contextWindow} < ${required.contextWindow}`,
    );
  if (candidate.maxTokens < required.maxTokens)
    missing.push(`maxTokens ${candidate.maxTokens} < ${required.maxTokens}`);
  return { match: missing.length === 0, missing };
};

const findBestFallbackModel = (
  ctx: ExtensionContext,
  sequence: string[],
  required?: ModelCapabilities,
): { provider: string; id: string; missing?: string[] } | undefined => {
  const availableModels = ctx.modelRegistry.getAvailable();

  for (const pattern of sequence) {
    for (const model of availableModels) {
      const targetId = `${model.provider}/${model.id}`;
      if (
        pattern === targetId ||
        (pattern.endsWith('*') && targetId.startsWith(pattern.slice(0, -1)))
      ) {
        if (required) {
          const caps = getModelCapabilities(model);
          const { match, missing } = capabilitiesMatch(required, caps);
          if (!match) {
            return { provider: model.provider, id: model.id, missing };
          }
        }
        return { provider: model.provider, id: model.id };
      }
    }
  }

  return undefined;
};

// ─── Public API ─────────────────────────────────────────────────────────────

export const tryFallback = async (
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  config: RateLimitConfig,
  triggerReason: FallbackState['triggerReason'] = 'manual',
  contextCompressionEnabled: boolean = false,
): Promise<{ success: boolean; message: string }> => {
  const currentModel = ctx.model;

  if (!currentModel) {
    return { success: false, message: 'No current model' };
  }

  if (currentModel.provider !== 'ollama' && !state.fallbackActive) {
    state.preferredModel = `${currentModel.provider}/${currentModel.id}`;
    state.requiredCapabilities = getModelCapabilities(currentModel);
  }

  const target = findBestFallbackModel(
    ctx,
    config.fallbackSequence.length > 0 ? config.fallbackSequence : ['ollama/*'],
    state.requiredCapabilities,
  );

  if (!target) {
    return { success: false, message: 'No fallback models available' };
  }

  if (target.missing) {
    return {
      success: false,
      message: `Fallback model ${target.provider}/${target.id} lacks required capabilities: ${target.missing.join(', ')}`,
    };
  }

  const targetModel = ctx.modelRegistry.find(target.provider, target.id);
  if (!targetModel) {
    return {
      success: false,
      message: `Model ${target.provider}/${target.id} not in registry. Try /reload.`,
    };
  }

  const success = await pi.setModel(targetModel);
  if (success) {
    state.fallbackActive = true;
    state.autoRestore = config.autoRestore;
    state.triggeredAt = Date.now();
    state.triggerReason = triggerReason;

    // Context Compression Bridge: Bookmark the start of the fallback period
    if (
      contextCompressionEnabled &&
      ctx.sessionManager &&
      'appendLabelChange' in ctx.sessionManager
    ) {
      try {
        const sm = ctx.sessionManager as any;
        const leafId = sm.getLeafId();
        if (leafId) {
          sm.appendLabelChange(leafId, 'router-fallback-start');
        }
      } catch (err) {
        // Silently fail if session manager doesn't support labels
      }
    }
  }

  return {
    success,
    message: success
      ? `Switched to ${target.provider}/${target.id}`
      : `Failed to switch to ${target.provider}/${target.id}`,
  };
};

export const tryRestore = async (
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  contextCompressionEnabled: boolean = false,
): Promise<{ success: boolean; message: string; restored: boolean }> => {
  if (!state.fallbackActive || !state.preferredModel) {
    return {
      success: false,
      message: 'No preferred model stored',
      restored: false,
    };
  }

  const [provider, id] = state.preferredModel.split('/');
  const model = ctx.modelRegistry.find(provider, id);

  if (!model) {
    return {
      success: false,
      message: `Model ${state.preferredModel} not available`,
      restored: false,
    };
  }

  const success = await pi.setModel(model);
  if (success) {
    state.fallbackActive = false;
    state.autoRestore = false;
    state.lastRestoreAttempt = undefined;
    state.requiredCapabilities = undefined;

    if (contextCompressionEnabled) {
      pi.sendMessage(
        {
          customType: 'router-context-compression',
          content:
            "System Context: You have just been restored to the primary high-tier model after a period of rate-limit fallback. Before continuing the user's task, please use your `context_checkout` tool to squash the previous fallback period into a concise summary. Use the target `router-fallback-start`.",
          display: false,
        },
        { deliverAs: 'followUp' },
      );
    }
  }

  return {
    success,
    restored: success,
    message: success
      ? `Restored ${state.preferredModel}`
      : 'Failed to restore model',
  };
};

/**
 * Periodically check if the preferred cloud model is healthy and auto-restore.
 * Call this from turn_end or another periodic hook.
 */
export const checkAndRestore = async (
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  contextCompressionEnabled: boolean = false,
  restoreCheckIntervalSec: number = 300,
): Promise<{ attempted: boolean; success: boolean; message: string }> => {
  if (!state.autoRestore || !state.fallbackActive || !state.preferredModel) {
    return {
      attempted: false,
      success: false,
      message: 'Auto-restore not active',
    };
  }

  const now = Date.now();
  const intervalMs = restoreCheckIntervalSec * 1000;

  if (state.lastRestoreAttempt && now - state.lastRestoreAttempt < intervalMs) {
    return {
      attempted: false,
      success: false,
      message: 'Restore throttled',
    };
  }

  state.lastRestoreAttempt = now;
  const result = await tryRestore(pi, ctx, contextCompressionEnabled);
  return { attempted: true, ...result };
};

export const getFallbackState = (): FallbackState => {
  return { ...state };
};

export const getRateLimitHistory = (): RateLimitEventEntry[] => {
  return [...history];
};

export const recordRateLimit = (
  provider: string,
  model: string,
  httpStatus: number,
  retryAfter?: number,
): void => {
  history.push({
    timestamp: Date.now(),
    provider,
    model,
    retryAfter,
    httpStatus,
  });
  // Keep last 100
  if (history.length > 100) history = history.slice(-100);
};

export const resetRateLimitState = (): void => {
  state = {
    fallbackActive: false,
    autoRestore: false,
    lastRestoreAttempt: undefined,
    requiredCapabilities: undefined,
  };
  history = [];
};

// ─── Extension Integration ──────────────────────────────────────────────────

export const initializeRateLimitFallback = (
  pi: ExtensionAPI,
  rawConfig: Record<string, unknown>,
  contextCompressionEnabled: boolean = false,
): void => {
  const config = { ...DEFAULT_RATE_LIMIT_CONFIG };
  for (const key of Object.keys(config) as Array<keyof typeof config>) {
    if (rawConfig[key] !== undefined) config[key] = rawConfig[key] as never;
  }

  if (!config.enabled) {
    return;
  }

  // Monitor rate limits (requires Pi 0.68+)
  pi.on('after_provider_response', async (event, ctx) => {
    // 402: Payment Required (Out of credits)
    // 429: Too Many Requests (Rate limit)
    // 503: Service Unavailable
    // 529: Site Overloaded (Anthropic specifically)
    // Note: We intentionally ignore 401/403 to avoid silently masking bad API keys.
    const fallbackTriggers = [402, 429, 503, 529];
    if (!fallbackTriggers.includes(event.status)) return;

    const currentModel = ctx.model;
    const retryAfter = parseInt(
      String(event.headers?.['retry-after'] || '0'),
      10,
    );

    recordRateLimit(
      currentModel?.provider || 'unknown',
      currentModel?.id || 'unknown',
      event.status,
      retryAfter || undefined,
    );

    // Provide transparent UI notifications to the user about why fallback is occurring
    const statusReason =
      event.status === 402
        ? 'out of credits (402)'
        : event.status === 529
          ? 'provider overloaded (529)'
          : event.status === 503
            ? 'service unavailable (503)'
            : `rate limited (429)`;

    if (retryAfter > 0 && retryAfter < config.shortDelayThreshold) {
      ctx.ui.notify(
        `[Router] ${statusReason}. Retry after ${retryAfter}s`,
        'warning',
      );
    } else if (config.autoFallback && !state.fallbackActive) {
      const result = await tryFallback(
        pi,
        ctx,
        config,
        'rate_limit',
        contextCompressionEnabled,
      );
      if (result.success) {
        ctx.ui.notify(
          `[Router] Auto-fallback due to ${statusReason}: ${result.message}`,
          'info',
        );
        // Transparent session tracking (for RPC clients)
        pi.appendEntry('router-fallback', { reason: statusReason, result });
      }
    } else {
      ctx.ui.notify(
        `[Router] ${statusReason}. Use /router fallback to switch`,
        'warning',
      );
    }
  });

  // Status bar indicator
  pi.on('model_select', async (_event, ctx) => {
    if (state.fallbackActive) {
      ctx.ui.setStatus('router-fallback', '\ud83c\udfe0 fallback');
    } else {
      ctx.ui.setStatus('router-fallback', '');
    }
  });
};
