/**
 * Scope Shim — work around the lack of ExtensionAPI.setScopedModels().
 *
 * Today: writes `enabledModels` to Pi settings.json directly, then
 * optionally reloads the session so Pi picks up the new scope.
 * Tomorrow: swap `writeSettingsScope()` for `pi.setScopedModels()`
 * when upstream exposes it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAgentDir } from '@mariozechner/pi-coding-agent';
import type { Model } from '@mariozechner/pi-ai';
import type {
  ExtensionAPI,
  ExtensionContext,
} from '@mariozechner/pi-coding-agent';
import type { RouterProfile, RouterConfig } from './types';
import { parseCanonicalModelRef } from './config';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ScopeModelRef {
  modelRef: string;
  thinkingLevel?: string;
}

export interface ScopeSettingsResult {
  enabledModels: string[] | undefined;
  success: boolean;
  message: string;
}

// ─── Derive scope from profile ──────────────────────────────────────────────

/** Derive the full scope from ALL router profiles (deduplicated, in config order). */
export const deriveRouterScope = (config: RouterConfig): ScopeModelRef[] => {
  const seen = new Set<string>();
  const result: ScopeModelRef[] = [];

  for (const [, profile] of Object.entries(config.profiles)) {
    for (const tier of ['high', 'medium', 'low'] as const) {
      const tierConfig = profile[tier];
      const refs = [tierConfig.model, ...(tierConfig.fallbacks ?? [])];
      for (const modelRef of refs) {
        if (!seen.has(modelRef)) {
          seen.add(modelRef);
          result.push({ modelRef, thinkingLevel: tierConfig.thinking });
        }
      }
    }
  }

  return result;
};

/** Resolve scope refs into actual Model objects from the registry. */
export const resolveScopeFromRegistry = (
  scope: ScopeModelRef[],
  ctx: ExtensionContext,
): { model: Model<any>; thinkingLevel?: string }[] => {
  const resolved: { model: Model<any>; thinkingLevel?: string }[] = [];
  for (const entry of scope) {
    try {
      const { provider, modelId } = parseCanonicalModelRef(entry.modelRef);
      const model = ctx.modelRegistry.find(provider, modelId);
      if (model) {
        resolved.push({ model, thinkingLevel: entry.thinkingLevel });
      }
    } catch {
      // skip invalid refs
    }
  }
  return resolved;
};

// ─── Settings.json file operations (shim until upstream API) ──────────────────

const getSettingsPath = (): string => {
  return join(getAgentDir(), 'settings.json');
};

/** Read Pi settings.json as safely as possible. */
const readPiSettings = (): Record<string, unknown> => {
  try {
    const raw = readFileSync(getSettingsPath(), 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore — may not exist or be invalid JSON
  }
  return {};
};

/** Write Pi settings.json atomically. */
const writePiSettings = (settings: Record<string, unknown>): void => {
  writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
};

/**
 * Write the current profile's model refs to Pi settings.json `enabledModels`.
 *
 * This is the **shim** — once upstream exposes:
 *   `pi.setScopedModels(models: ScopedModelEntry[])`
 * replace this entire function with that call.
 */
export const writeSettingsScope = (
  scope: ScopeModelRef[],
  mergeIntoExisting = false,
): ScopeSettingsResult => {
  const patterns = scope.map((s) => s.modelRef);

  try {
    const settings = readPiSettings();

    if (mergeIntoExisting && Array.isArray(settings.enabledModels)) {
      // prepend router's models, then existing (deduplicated)
      const merged = patterns.filter(
        (p) => !(settings.enabledModels as string[]).includes(p),
      );
      settings.enabledModels = [
        ...merged,
        ...(settings.enabledModels as string[]),
      ];
    } else {
      settings.enabledModels = patterns;
    }

    writePiSettings(settings);

    return {
      enabledModels: settings.enabledModels as string[],
      success: true,
      message: `Updated settings.enabledModels with ${patterns.length} model(s). Run /reload or start a new session to apply.`,
    };
  } catch (error) {
    return {
      enabledModels: undefined,
      success: false,
      message: `Failed to write settings.json: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Clear `enabledModels` from Pi settings.json (restores all models).
 */
export const resetSettingsScope = (): ScopeSettingsResult => {
  try {
    const settings = readPiSettings();
    if (settings.enabledModels === undefined) {
      return {
        enabledModels: undefined,
        success: true,
        message: 'No router scope override in settings.json. Nothing to reset.',
      };
    }
    delete settings.enabledModels;
    writePiSettings(settings);
    return {
      enabledModels: undefined,
      success: true,
      message:
        'Cleared settings.enabledModels. Run /reload or start a new session to apply.',
    };
  } catch (error) {
    return {
      enabledModels: undefined,
      success: false,
      message: `Failed to write settings.json: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Read the current `enabledModels` from Pi settings.json.
 */
export const readSettingsScope = (): ScopeSettingsResult => {
  const settings = readPiSettings();
  const enabledModels = Array.isArray(settings.enabledModels)
    ? (settings.enabledModels as string[])
    : undefined;
  return {
    enabledModels,
    success: true,
    message: enabledModels
      ? `Current enabledModels: ${enabledModels.join(', ')}`
      : 'No enabledModels set in settings.json (all models available).',
  };
};

// ─── Future upstream migration (commented, ready to swap) ─────────────────────

/*
When upstream exposes `pi.setScopedModels`:

  export const applyRouterScopeUpstream = (
    pi: ExtensionAPI,
    config: RouterConfig,
    ctx: ExtensionContext,
  ): void => {
    const scope = deriveRouterScope(config);
    const resolved = resolveScopeFromRegistry(scope, ctx);
    // @ts-expect-error — not yet in types
    pi.setScopedModels?.(
      resolved.map(({ model, thinkingLevel }) => ({
        model,
        thinkingLevel: thinkingLevel as ThinkingLevel,
      })),
    );
  };
*/
