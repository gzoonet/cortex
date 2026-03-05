import { z } from 'zod';

export const ingestConfigSchema = z.object({
  watchDirs: z.array(z.string()).default(['.']),
  exclude: z.array(z.string()).default([
    'node_modules', 'dist', 'build', 'out', '.git',
    '*.min.js', '*.min.css', '*.map',
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    '__pycache__', '*.pyc', '.DS_Store', 'Thumbs.db',
  ]),
  fileTypes: z.array(z.string()).default(['md', 'ts', 'tsx', 'js', 'jsx', 'json', 'yaml', 'yml']),
  maxFileSize: z.number().positive().default(10_485_760),
  maxFilesPerDir: z.number().positive().default(10_000),
  maxTotalFiles: z.number().positive().default(50_000),
  debounceMs: z.number().nonnegative().default(500),
  parseTimeoutMs: z.number().positive().default(30_000),
  batchSize: z.number().positive().default(5),
  followSymlinks: z.boolean().default(false),
  confirmCost: z.boolean().default(true),
});

export const graphConfigSchema = z.object({
  dbPath: z.string().default('~/.cortex/cortex.db'),
  vectorDbPath: z.string().default('~/.cortex/vector.lance'),
  walMode: z.boolean().default(true),
  backupOnStartup: z.boolean().default(true),
  integrityCheckInterval: z.enum(['daily', 'weekly', 'monthly', 'never']).default('weekly'),
  softDelete: z.boolean().default(true),
  mergeConfidenceThreshold: z.number().min(0).max(1).default(0.95),
});

export const llmBudgetSchema = z.object({
  monthlyLimitUsd: z.number().nonnegative().default(25),
  warningThresholds: z.array(z.number().min(0).max(1)).default([0.5, 0.8, 0.9]),
  enforcementAction: z.enum(['warn', 'fallback-local', 'stop']).default('fallback-local'),
});

export const llmCacheSchema = z.object({
  enabled: z.boolean().default(true),
  ttlDays: z.number().positive().default(7),
  maxSizeMb: z.number().positive().default(500),
});

export const llmLocalSchema = z.object({
  provider: z.string().default('ollama'),
  host: z.string().url().default('http://localhost:11434'),
  model: z.string().default('mistral:7b-instruct-q5_K_M'),
  embeddingModel: z.string().default('nomic-embed-text'),
  numCtx: z.number().positive().default(8192),
  numGpu: z.number().default(-1),
  timeoutMs: z.number().positive().default(90_000), // 90 seconds
  keepAlive: z.string().default('5m'),
});

export const llmCloudSchema = z.object({
  provider: z.string().default('anthropic'),
  baseUrl: z.string().url().optional(),
  apiKeySource: z.string().default('env:CORTEX_ANTHROPIC_API_KEY'),
  models: z.object({
    primary: z.string().default('claude-sonnet-4-5-20250929'),
    fast: z.string().default('claude-haiku-4-5-20251001'),
  }).default({}),
  timeoutMs: z.number().positive().default(60_000),
  maxRetries: z.number().nonnegative().default(3),
  promptCaching: z.boolean().default(true),
});

export const llmConfigSchema = z.object({
  mode: z.enum(['cloud-first', 'hybrid', 'local-first', 'local-only']).default('cloud-first'),
  taskRouting: z.record(z.string(), z.enum(['auto', 'local', 'cloud'])).default({
    entity_extraction: 'auto',
    relationship_inference: 'auto',
    contradiction_detection: 'local',
    conversational_query: 'auto',
    context_ranking: 'auto',
    embedding_generation: 'local',
  }),
  temperature: z.record(z.string(), z.number().min(0).max(2)).default({
    extraction: 0.1,
    chat: 0.7,
    ranking: 0.1,
    proactive: 0.5,
  }),
  maxContextTokens: z.number().positive().default(50_000),
  cache: llmCacheSchema.default({}),
  budget: llmBudgetSchema.default({}),
  local: llmLocalSchema.default({}),
  cloud: llmCloudSchema.default({}),
});

export const privacyConfigSchema = z.object({
  defaultLevel: z.enum(['standard', 'sensitive', 'restricted']).default('standard'),
  directoryOverrides: z.record(z.string(), z.enum(['standard', 'sensitive', 'restricted'])).default({}),
  autoClassify: z.boolean().default(true),
  logTransmissions: z.boolean().default(true),
  showTransmissionIndicator: z.boolean().default(true),
  secretPatterns: z.array(z.string()).default([
    '(?i)(api[_-]?key|secret[_-]?key|access[_-]?token)\\s*[:=]\\s*[\\w\\-]{20,}',
    'AKIA[0-9A-Z]{16}',
    'sk-ant-[a-zA-Z0-9\\-]{40,}',
    'ghp_[a-zA-Z0-9]{36}',
    '(?i)password\\s*[:=]\\s*\\S{8,}',
  ]),
});

export const serverConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3710),
  host: z.string().default('127.0.0.1'),
  cors: z.array(z.string()).default(['http://localhost:5173']),
});

export const loggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  file: z.string().default('~/.cortex/logs/cortex.log'),
  structured: z.boolean().default(true),
  maxSizeMb: z.number().positive().default(10),
  maxFiles: z.number().positive().default(5),
  redactPrompts: z.boolean().default(false),
});

export const cortexConfigSchema = z.object({
  $schema: z.string().optional(),
  version: z.string().default('1.0'),
  ingest: ingestConfigSchema.default({}),
  graph: graphConfigSchema.default({}),
  llm: llmConfigSchema.default({}),
  privacy: privacyConfigSchema.default({}),
  server: serverConfigSchema.default({}),
  logging: loggingConfigSchema.default({}),
});

export type CortexConfigInput = z.input<typeof cortexConfigSchema>;
