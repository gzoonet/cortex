export type LLMMode = 'cloud-first' | 'hybrid' | 'local-first' | 'local-only';
export type TaskRouting = 'auto' | 'local' | 'cloud';
export type PrivacyLevel = 'standard' | 'sensitive' | 'restricted';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type IntegrityCheckInterval = 'daily' | 'weekly' | 'monthly' | 'never';
export type BudgetEnforcementAction = 'warn' | 'fallback-local' | 'stop';

export interface IngestConfig {
  watchDirs: string[];
  exclude: string[];
  fileTypes: string[];
  maxFileSize: number;
  maxFilesPerDir: number;
  maxTotalFiles: number;
  debounceMs: number;
  parseTimeoutMs: number;
  batchSize: number;
  followSymlinks: boolean;
  confirmCost: boolean;
}

export interface GraphConfig {
  dbPath: string;
  vectorDbPath: string;
  walMode: boolean;
  backupOnStartup: boolean;
  integrityCheckInterval: IntegrityCheckInterval;
  softDelete: boolean;
  mergeConfidenceThreshold: number;
}

export interface LLMBudgetConfig {
  monthlyLimitUsd: number;
  warningThresholds: number[];
  enforcementAction: BudgetEnforcementAction;
}

export interface LLMCacheConfig {
  enabled: boolean;
  ttlDays: number;
  maxSizeMb: number;
}

export interface LLMLocalConfig {
  provider: string;
  host: string;
  model: string;
  embeddingModel: string;
  numCtx: number;
  numGpu: number;
  timeoutMs: number;
  keepAlive: string;
}

export interface LLMCloudConfig {
  provider: string;
  baseUrl?: string;
  apiKeySource: string;
  models: {
    primary: string;
    fast: string;
  };
  timeoutMs: number;
  maxRetries: number;
  promptCaching: boolean;
}

export interface LLMConfig {
  mode: LLMMode;
  taskRouting: Record<string, TaskRouting>;
  temperature: Record<string, number>;
  maxContextTokens: number;
  cache: LLMCacheConfig;
  budget: LLMBudgetConfig;
  local: LLMLocalConfig;
  cloud: LLMCloudConfig;
}

export interface PrivacyConfig {
  defaultLevel: PrivacyLevel;
  directoryOverrides: Record<string, PrivacyLevel>;
  autoClassify: boolean;
  logTransmissions: boolean;
  showTransmissionIndicator: boolean;
  secretPatterns: string[];
}

export interface ServerConfig {
  port: number;
  host: string;
  cors: string[];
}

export interface LoggingConfig {
  level: LogLevel;
  file: string;
  structured: boolean;
  maxSizeMb: number;
  maxFiles: number;
  redactPrompts: boolean;
}

export interface CortexConfig {
  $schema?: string;
  version: string;
  ingest: IngestConfig;
  graph: GraphConfig;
  llm: LLMConfig;
  privacy: PrivacyConfig;
  server: ServerConfig;
  logging: LoggingConfig;
}
