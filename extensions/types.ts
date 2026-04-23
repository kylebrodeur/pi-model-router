import type { ThinkingLevel } from '@mariozechner/pi-agent-core';

// ─── Feature Toggles (added by fork) ──────────────────────────────────────

export type RouterFeature =
  | 'ollamaSync'
  | 'rateLimitFallback'
  | 'perTurnRouting'
  | 'intentClassifier'
  | 'costBudgeting'
  | 'phaseMemory'
  | 'contextCompression'
  | 'ledgerIntegration'
  | 'agentBusIntegration';

export interface FeatureToggles {
  ollamaSync?: boolean;
  rateLimitFallback?: boolean;
  scopeShim?: boolean;
  respectPiScope?: boolean;
  perTurnRouting?: boolean;
  intentClassifier?: boolean;
  costBudgeting?: boolean;
  phaseMemory?: boolean;
  contextCompression?: boolean;
  /**
   * Log routing decisions to qmd-ledger if available.
   * Progressive: detects pi-qmd-ledger at runtime.
   */
  ledgerIntegration?: boolean;
  /**
   * Publish model changes to pi-agent-bus MessageBus if available.
   * Progressive: detects pi-agent-bus at runtime.
   */
  agentBusIntegration?: boolean;
}

export interface OllamaSyncConfig {
  enabled?: boolean;
  onStartup?: boolean;
  onReload?: boolean;
  addLaunchFlag?: boolean;
  visionKeywords?: string[];
  reasoningKeywords?: string[];
  preferredFamilies?: string[];
  defaultContextWindow?: number;
  largeContextWindow?: number;
}

export interface RateLimitFallbackConfig {
  enabled?: boolean;
  shortDelayThreshold?: number;
  autoFallback?: boolean;
  autoRestore?: boolean;
  restoreCheckInterval?: number;
  fallbackSequence?: string[];
}

// ─── Original Router Types ─────────────────────────────────────────────────

export type RouterTier = 'high' | 'medium' | 'low';
export type RouterPin = RouterTier | 'auto';
export type RouterPhase = 'planning' | 'implementation' | 'lightweight';
export type RouterPinByProfile = Partial<Record<string, RouterTier>>;
export type RouterThinkingByTier = Partial<Record<RouterTier, ThinkingLevel>>;
export type RouterThinkingByProfile = Record<string, RouterThinkingByTier>;

export interface RoutingRule {
  matches: string | string[];
  tier: RouterTier;
  reason?: string;
}

export interface RoutedTierConfig {
  model: string;
  thinking?: ThinkingLevel;
  fallbacks?: string[];
}

export interface RouterProfile {
  high: RoutedTierConfig;
  medium: RoutedTierConfig;
  low: RoutedTierConfig;
}

export interface RouterConfig {
  defaultProfile?: string;
  debug?: boolean;
  classifierModel?: string;
  phaseBias?: number;
  largeContextThreshold?: number;
  maxSessionBudget?: number;
  rules?: RoutingRule[];
  profiles: Record<string, RouterProfile>;
  // ─── Feature toggles (added by fork) ──────────────────────────────
  features?: FeatureToggles;
  ollamaSync?: OllamaSyncConfig;
  rateLimitFallback?: RateLimitFallbackConfig;
}

export interface RoutingDecision {
  profile: string;
  tier: RouterTier;
  phase: RouterPhase;
  targetProvider: string;
  targetModelId: string;
  targetLabel: string;
  reasoning: string;
  thinking: ThinkingLevel;
  timestamp: number;
  isClassifier?: boolean;
  isFallback?: boolean;
  isContextTriggered?: boolean;
  isBudgetForced?: boolean;
  isRuleMatched?: boolean;
}

export interface RouterPersistedState {
  enabled: boolean;
  selectedProfile: string;
  pinTier?: RouterTier;
  pinByProfile?: RouterPinByProfile;
  thinkingByProfile?: RouterThinkingByProfile;
  debugEnabled?: boolean;
  widgetEnabled?: boolean;
  debugHistory?: RoutingDecision[];
  lastPhase?: RouterPhase;
  lastDecision?: RoutingDecision;
  lastNonRouterModel?: string;
  accumulatedCost?: number;
  timestamp: number;
}

export interface ConfigLoadResult {
  config: RouterConfig;
  warnings: string[];
}

export interface ParsedConfigFile {
  config: Partial<RouterConfig>;
  warnings: string[];
}

export interface CustomSessionEntry {
  type: string;
  customType?: string;
  data?: unknown;
}
