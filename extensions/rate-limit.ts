/**
 * Rate Limit Fallback Feature
 *
 * Monitors provider responses for rate limiting.
 * NOTE: Requires Pi update to 0.67+ for after_provider_response event support.
 */
import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
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

export interface FallbackStateEntry {
  preferredModel?: string;
  fallbackActive: boolean;
  autoRestore: boolean;
  triggeredAt?: number;
  triggerReason?: 'rate_limit' | 'budget_exceeded' | 'manual';
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const CONFIG_DEFAULTS: RateLimitConfig = {
  enabled: true,
  shortDelayThreshold: 60,
  autoFallback: false,
  autoRestore: false,
  restoreCheckInterval: 300,
  preferredLocalModels: [],
};

// ─── Module State ───────────────────────────────────────────────────────────

let fallbackState: FallbackStateEntry = { fallbackActive: false, autoRestore: false };
let rateLimitHistory: RateLimitEventEntry[] = [];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getModelsJsonPath(): string {
  return process.env.HOME ? `${process.env.HOME}/.pi/agent/models.json` : '/.pi/agent/models.json';
}

function findBestOllamaModel(preferred: string[]): string | undefined {
  try {
    const fs = require('node:fs');
    const data = JSON.parse(fs.readFileSync(getModelsJsonPath(), 'utf-8'));
    const models: Array<{ id: string; _launch?: boolean }> = data?.providers?.ollama?.models || [];
    if (models.length === 0) return undefined;

    for (const pref of preferred) {
      if (models.some((m) => m.id === pref)) return pref;
      const match = models.find((m) => m.id.startsWith(pref));
      if (match) return match.id;
    }
    return models.find((m) => m._launch)?.id || models[0]?.id;
  } catch { return undefined; }
}

// ─── Core Logic ─────────────────────────────────────────────────────────────

export async function tryFallback(
  pi: ExtensionAPI,
  ctx: ExtensionContext | ExtensionCommandContext,
  _config: RateLimitConfig,
  triggerReason: FallbackStateEntry['triggerReason'],
): Promise<{ success: boolean; message: string }> {
  const extCtx = 'model' in ctx ? ctx : (ctx as ExtensionContext);
  const currentModel = extCtx.model;

  if (!currentModel) return { success: false, message: 'No current model' };
  if (currentModel.provider !== 'ollama' && !fallbackState.fallbackActive) {
    fallbackState.preferredModel = `${currentModel.provider}/${currentModel.id}`;
  }

  const targetId = findBestOllamaModel(_config.preferredLocalModels.length > 0 ? _config.preferredLocalModels : []);
  if (!targetId) return { success: false, message: 'No Ollama models available' };

  const modelReg = 'modelRegistry' in ctx ? ctx.modelRegistry : undefined;
  const targetModel = modelReg?.find('ollama', targetId);
  if (!targetModel) return { success: false, message: `Ollama ${targetId} not in registry. Try /reload.` };

  const success = await pi.setModel(targetModel);
  if (success) {
    fallbackState.fallbackActive = true;
    fallbackState.autoRestore = _config.autoRestore;
    fallbackState.triggeredAt = Date.now();
    fallbackState.triggerReason = triggerReason;
  }
  return { success, message: success ? `Switched to Ollama ${targetId}` : 'Failed to switch to Ollama' };
}

export async function tryRestore(
  pi: ExtensionAPI,
  ctx: ExtensionContext | ExtensionCommandContext,
): Promise<{ success: boolean; message: string }> {
  if (!fallbackState.fallbackActive || !fallbackState.preferredModel) {
    return { success: false, message: 'No preferred model stored' };
  }
  const [provider, id] = fallbackState.preferredModel.split('/');
  const modelReg = 'modelRegistry' in ctx ? ctx.modelRegistry : undefined;
  const model = modelReg?.find(provider, id);
  if (!model) return { success: false, message: `Model ${fallbackState.preferredModel} not available` };

  const success = await pi.setModel(model);
  if (success) { fallbackState.fallbackActive = false; fallbackState.autoRestore = false; }
  return { success, message: success ? `Restored ${fallbackState.preferredModel}` : 'Failed to restore model' };
}

// ─── Initialization ─────────────────────────────────────────────────────────

export function initializeRateLimitFallback(
  pi: ExtensionAPI,
  rawConfig: Record<string, unknown>,
): void {
  const config = { ...CONFIG_DEFAULTS, ...rawConfig };
  if (!config.enabled) { console.log('[router] rate-limit-fallback: disabled'); return; }

  // Monitor rate limits (Pi 0.67+ required for after_provider_response)
  // @ts-expect-error — after_provider_response available in Pi 0.67+
  pi.on('after_provider_response', async (event, ctx) => {
    if (event.status !== 429 && event.status !== 503) return;

    const currentModel = ctx.model.getCurrentModel();
    const retryAfter = parseInt(String(event.headers?.['retry-after'] || '0'), 10);

    rateLimitHistory.push({
      timestamp: Date.now(),
      provider: currentModel?.provider || 'unknown',
      model: currentModel?.id || 'unknown',
      retryAfter: retryAfter || undefined,
      httpStatus: event.status,
    });

    if (retryAfter > 0 && retryAfter < config.shortDelayThreshold) {
      ctx.ui.notify(`[Router] Rate limited. Retry after ${retryAfter}s`, 'warning');
    } else if (config.autoFallback && !fallbackState.fallbackActive) {
      const result = await tryFallback(pi, ctx, config, 'rate_limit');
      if (result.success) ctx.ui.notify(`[Router] Auto-fallback: ${result.message}`, 'info');
    } else {
      ctx.ui.notify('[Router] Rate limited. Use /router-fallback to switch to Ollama', 'warning');
    }
  });

  // Commands
  pi.registerCommand('router-fallback', {
    description: 'Switch to Ollama model (fallback)',
    handler: async (_args, ctx) => {
      if (fallbackState.fallbackActive) { ctx.ui.notify('Fallback already active', 'warning'); return; }
      const result = await tryFallback(pi, ctx, config, 'manual');
      ctx.ui.notify(result.message, result.success ? 'info' : 'error');
    },
  });

  pi.registerCommand('router-restore', {
    description: 'Restore original model after fallback',
    handler: async (_args, ctx) => {
      if (!fallbackState.fallbackActive) { ctx.ui.notify('No active fallback', 'warning'); return; }
      const result = await tryRestore(pi, ctx);
      ctx.ui.notify(result.message, result.success ? 'info' : 'error');
    },
  });

  pi.registerCommand('router-rate-limit-status', {
    description: 'Show rate limit history and fallback status',
    handler: async (_args, ctx) => {
      const lines = [
        'Rate Limit Status',
        `  Fallback active: ${fallbackState.fallbackActive ? 'YES' : 'no'}`,
        `  Preferred: ${fallbackState.preferredModel || '—'}`,
        `  Events this session: ${rateLimitHistory.length}`,
      ];
      if (rateLimitHistory.length > 0) {
        const last = rateLimitHistory[rateLimitHistory.length - 1];
        lines.push(`  Last: ${last.provider}/${last.model}`);
        if (last.retryAfter) lines.push(`  Retry-after: ${last.retryAfter}s`);
      }
      ctx.ui.notify(lines.join('\n'), 'info');
    },
  });

  // Status bar indicator
  pi.on('model_select', async (_event, ctx) => {
    if (fallbackState.fallbackActive) ctx.ui.setStatus('router-fallback', '🏠 fallback');
    else ctx.ui.setStatus('router-fallback', '');
  });

  console.log('[router] rate-limit-fallback: enabled');
}
