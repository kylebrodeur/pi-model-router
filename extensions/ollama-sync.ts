/**
 * Ollama Sync Feature
 *
 * Auto-detects and registers new Ollama models in models.json.
 * NOTE: Pi 0.67+ recommended for full support.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type {
  ExtensionAPI,
  ExtensionContext,
} from '@mariozechner/pi-coding-agent';

// ─── Types ──────────────────────────────────────────────────────────────────

interface OllamaListEntry {
  name: string;
  id: string;
  size: string;
  modified: string;
}

interface ModelsJsonEntry {
  id: string;
  name?: string;
  reasoning?: boolean;
  input?: string[];
  contextWindow?: number;
  maxTokens?: number;
  cost?: { input: number; output: number };
  _launch?: boolean;
}

interface ModelsJson {
  providers: {
    ollama?: {
      api: string;
      apiKey: string;
      baseUrl: string;
      models: ModelsJsonEntry[];
    };
    [key: string]: unknown;
  };
}

// ─── Config ─────────────────────────────────────────────────────────────────

export interface OllamaSyncConfig {
  enabled: boolean;
  onStartup: boolean;
  onReload: boolean;
  addLaunchFlag: boolean;
  visionKeywords: string[];
  reasoningKeywords: string[];
  preferredFamilies: string[];
  defaultContextWindow: number;
  largeContextWindow: number;
}

export const DEFAULT_OLLAMA_CONFIG: OllamaSyncConfig = {
  enabled: true,
  onStartup: true,
  onReload: true,
  addLaunchFlag: false,
  visionKeywords: ['vl', 'vision', 'ocr', 'image'],
  reasoningKeywords: ['thinking', 'reason', 'cascade', 'deepseek'],
  preferredFamilies: ['gemma4', 'qwen3', 'kimi', 'llama3'],
  defaultContextWindow: 128000,
  largeContextWindow: 262144,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const getModelsJsonPath = (): string => {
  return join(homedir(), '.pi', 'agent', 'models.json');
};

const loadModelsJson = (): ModelsJson | null => {
  const path = getModelsJsonPath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
};

const saveModelsJson = (data: ModelsJson): void => {
  writeFileSync(getModelsJsonPath(), JSON.stringify(data, null, 2));
};

const parseOllamaList = (output: string): OllamaListEntry[] => {
  const lines = output.trim().split('\n');
  const models: OllamaListEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(/\s{2,}/);
    if (parts.length >= 3) {
      models.push({
        name: parts[0],
        id: parts[1],
        size: parts[2],
        modified: parts.slice(3).join(' '),
      });
    }
  }
  return models;
};

const inferCapabilities = (
  modelName: string,
  cfg: OllamaSyncConfig,
): Partial<ModelsJsonEntry> => {
  const lower = modelName.toLowerCase();
  const entry: Partial<ModelsJsonEntry> = {
    contextWindow: cfg.defaultContextWindow,
  };

  if (cfg.visionKeywords.some((kw) => lower.includes(kw))) {
    entry.input = ['text', 'image'];
  } else {
    entry.input = ['text'];
  }

  if (cfg.reasoningKeywords.some((kw) => lower.includes(kw))) {
    entry.reasoning = true;
  }

  if (
    lower.includes('kimi') ||
    lower.includes('gemma4') ||
    lower.includes('deepseek')
  ) {
    entry.contextWindow = cfg.largeContextWindow;
  }

  return entry;
};

// ─── Public API ─────────────────────────────────────────────────────────────

export interface OllamaSyncResult {
  added: string[];
  message: string;
  success: boolean;
}

export const performOllamaSync = async (
  pi: ExtensionAPI,
  userConfig: Partial<OllamaSyncConfig>,
): Promise<OllamaSyncResult> => {
  const config = { ...DEFAULT_OLLAMA_CONFIG, ...userConfig };

  let output: string;
  try {
    const result = await pi.exec('ollama', ['list'], { timeout: 10000 });
    if (result.code !== 0) {
      return { added: [], message: 'Ollama not available', success: false };
    }
    output = result.stdout;
  } catch {
    return { added: [], message: 'Ollama not available', success: false };
  }

  const ollamaModels = parseOllamaList(output);
  if (ollamaModels.length === 0) {
    return { added: [], message: 'No Ollama models found', success: true };
  }

  const modelsJson = loadModelsJson();
  if (!modelsJson) {
    return { added: [], message: 'models.json not found', success: false };
  }

  if (!modelsJson.providers.ollama) {
    modelsJson.providers.ollama = {
      api: 'openai-completions',
      apiKey: 'ollama',
      baseUrl: 'http://127.0.0.1:11434/v1',
      models: [],
    };
  }

  const existingIds = new Set(
    modelsJson.providers.ollama.models.map((m) => m.id),
  );
  const added: string[] = [];

  for (const model of ollamaModels) {
    if (!existingIds.has(model.name)) {
      const caps = inferCapabilities(model.name, config);
      const entry: ModelsJsonEntry = { id: model.name, ...caps };

      if (
        config.addLaunchFlag &&
        config.preferredFamilies.some((f) =>
          model.name.toLowerCase().includes(f),
        )
      ) {
        entry._launch = true;
      }

      modelsJson.providers.ollama.models.push(entry);
      added.push(model.name);
    }
  }

  if (added.length > 0) {
    saveModelsJson(modelsJson);
  }

  return {
    added,
    message:
      added.length > 0 ? `Added ${added.length} model(s)` : 'No new models',
    success: true,
  };
};

// ─── Extension Integration ──────────────────────────────────────────────────

export const initializeOllamaSync = (
  pi: ExtensionAPI,
  rawConfig: Record<string, unknown>,
): void => {
  const merged = { ...DEFAULT_OLLAMA_CONFIG };
  for (const key of Object.keys(merged) as Array<keyof typeof merged>) {
    if (rawConfig[key] !== undefined) merged[key] = rawConfig[key] as never;
  }

  if (!merged.enabled) {
    return;
  }

  // Auto-sync on session start/reload
  pi.on('session_start', async (event, ctx) => {
    const shouldSync =
      merged.enabled &&
      ((event.reason === 'startup' && merged.onStartup) ||
        (event.reason === 'reload' && merged.onReload));

    if (shouldSync) {
      const result = await performOllamaSync(pi, merged);
      if (result.success && result.added.length > 0) {
        ctx.ui.notify(`[Router] Added ${result.added.length} model(s)`, 'info');
        ctx.ui.notify(`Run /reload to see: ${result.added.join(', ')}`, 'info');
      } else if (!result.success) {
        ctx.ui.notify(`Ollama sync failed: ${result.message}`, 'warning');
      }
    }
  });
};
