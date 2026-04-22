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

export interface FallbackState {
  preferredModel?: string;
  fallbackActive: boolean;
  autoRestore: boolean;
  triggeredAt?: number;
  triggerReason?: 'rate_limit' | 'budget_exceeded' | 'manual';
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

const findBestFallbackModel = (
  ctx: ExtensionContext,
  sequence: string[],
): { provider: string; id: string } | undefined => {
  const availableModels = ctx.modelRegistry.getAvailable();

  for (const pattern of sequence) {
    for (const model of availableModels) {
      const targetId = `${model.provider}/${model.id}`;
      if (pattern === targetId)
        return { provider: model.provider, id: model.id };
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        if (targetId.startsWith(prefix))
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
): Promise<{ success: boolean; message: string }> => {
  const currentModel = ctx.model;

  if (!currentModel) {
    return { success: false, message: 'No current model' };
  }

  if (currentModel.provider !== 'ollama' && !state.fallbackActive) {
    state.preferredModel = `${currentModel.provider}/${currentModel.id}`;
  }

  const target = findBestFallbackModel(
    ctx,
    config.fallbackSequence.length > 0 ? config.fallbackSequence : ['ollama/*'],
  );

  if (!target) {
    return { success: false, message: 'No fallback models available' };
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
): Promise<{ success: boolean; message: string }> => {
  if (!state.fallbackActive || !state.preferredModel) {
    return { success: false, message: 'No preferred model stored' };
  }

  const [provider, id] = state.preferredModel.split('/');
  const model = ctx.modelRegistry.find(provider, id);

  if (!model) {
    return {
      success: false,
      message: `Model ${state.preferredModel} not available`,
    };
  }

  const success = await pi.setModel(model);
  if (success) {
    state.fallbackActive = false;
    state.autoRestore = false;
  }

  return {
    success,
    message: success
      ? `Restored ${state.preferredModel}`
      : 'Failed to restore model',
  };
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
  };
  history = [];
};

// ─── Extension Integration ──────────────────────────────────────────────────

export const initializeRateLimitFallback = (
  pi: ExtensionAPI,
  rawConfig: Record<string, unknown>,
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
      const result = await tryFallback(pi, ctx, config, 'rate_limit');
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
