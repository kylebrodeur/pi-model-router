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
  preferredLocalModels: string[];
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
  preferredLocalModels: [],
};

// ─── Module State ───────────────────────────────────────────────────────────

let state: FallbackState = {
  fallbackActive: false,
  autoRestore: false,
};

let history: RateLimitEventEntry[] = [];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getModelsJsonPath(): string {
  return process.env.HOME
    ? `${process.env.HOME}/.pi/agent/models.json`
    : '/.pi/agent/models.json';
}

function findBestOllamaModel(preferred: string[]): string | undefined {
  try {
    const fs = require('node:fs');
    const data = JSON.parse(fs.readFileSync(getModelsJsonPath(), 'utf-8'));
    const models: Array<{ id: string; _launch?: boolean }> =
      data?.providers?.ollama?.models || [];
    if (models.length === 0) return undefined;

    for (const pref of preferred) {
      if (models.some((m) => m.id === pref)) return pref;
      const match = models.find((m) => m.id.startsWith(pref));
      if (match) return match.id;
    }

    return models.find((m) => m._launch)?.id || models[0]?.id;
  } catch {
    return undefined;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function tryFallback(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  config: RateLimitConfig,
  triggerReason: FallbackState['triggerReason'] = 'manual',
): Promise<{ success: boolean; message: string }> {
  const currentModel = ctx.model;

  if (!currentModel) {
    return { success: false, message: 'No current model' };
  }

  if (currentModel.provider !== 'ollama' && !state.fallbackActive) {
    state.preferredModel = `${currentModel.provider}/${currentModel.id}`;
  }

  const targetId = findBestOllamaModel(
    config.preferredLocalModels.length > 0
      ? config.preferredLocalModels
      : [],
  );

  if (!targetId) {
    return { success: false, message: 'No Ollama models available' };
  }

  const targetModel = ctx.modelRegistry.find('ollama', targetId);
  if (!targetModel) {
    return {
      success: false,
      message: `Ollama ${targetId} not in registry. Try /reload.`,
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
      ? `Switched to Ollama ${targetId}`
      : 'Failed to switch to Ollama',
  };
}

export async function tryRestore(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<{ success: boolean; message: string }> {
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
}

export function getFallbackState(): FallbackState {
  return { ...state };
}

export function getRateLimitHistory(): RateLimitEventEntry[] {
  return [...history];
}

export function recordRateLimit(
  provider: string,
  model: string,
  httpStatus: number,
  retryAfter?: number,
): void {
  history.push({
    timestamp: Date.now(),
    provider,
    model,
    retryAfter,
    httpStatus,
  });
  // Keep last 100
  if (history.length > 100) history = history.slice(-100);
}

export function resetRateLimitState(): void {
  state = {
    fallbackActive: false,
    autoRestore: false,
  };
  history = [];
}

// ─── Extension Integration ──────────────────────────────────────────────────

export function initializeRateLimitFallback(
  pi: ExtensionAPI,
  rawConfig: Record<string, unknown>,
): void {
  const config = { ...DEFAULT_RATE_LIMIT_CONFIG };
  for (const key of Object.keys(config) as Array<keyof typeof config>) {
    if (rawConfig[key] !== undefined) config[key] = rawConfig[key] as never;
  }

  if (!config.enabled) {
    console.log('[router] rate-limit-fallback: disabled');
    return;
  }

  // Monitor rate limits (Pi 0.67+)
  // @ts-expect-error — after_provider_response in Pi 0.67+
  pi.on('after_provider_response', async (event, ctx) => {
    if (event.status !== 429 && event.status !== 503) return;

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

    if (retryAfter > 0 && retryAfter < config.shortDelayThreshold) {
      ctx.ui.notify(
        `[Router] Rate limited. Retry after ${retryAfter}s`,
        'warning',
      );
    } else if (config.autoFallback && !state.fallbackActive) {
      const result = await tryFallback(pi, ctx, config, 'rate_limit');
      if (result.success) {
        ctx.ui.notify(`[Router] Auto-fallback: ${result.message}`, 'info');
      }
    } else {
      ctx.ui.notify(
        '[Router] Rate limited. Use /router fallback to switch to Ollama',
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

  console.log('[router] rate-limit-fallback: enabled');
}
