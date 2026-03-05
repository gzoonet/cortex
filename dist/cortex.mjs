#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// packages/core/dist/types/llm.js
var LLMTask;
var init_llm = __esm({
  "packages/core/dist/types/llm.js"() {
    "use strict";
    (function(LLMTask2) {
      LLMTask2["ENTITY_EXTRACTION"] = "entity_extraction";
      LLMTask2["RELATIONSHIP_INFERENCE"] = "relationship_inference";
      LLMTask2["EMBEDDING_GENERATION"] = "embedding_generation";
      LLMTask2["CONVERSATIONAL_QUERY"] = "conversational_query";
      LLMTask2["CONTRADICTION_DETECTION"] = "contradiction_detection";
      LLMTask2["CONTEXT_RANKING"] = "context_ranking";
    })(LLMTask || (LLMTask = {}));
  }
});

// packages/core/dist/types/index.js
var init_types = __esm({
  "packages/core/dist/types/index.js"() {
    "use strict";
    init_llm();
  }
});

// packages/core/dist/errors/cortex-error.js
var CortexError, LLM_PROVIDER_UNAVAILABLE, LLM_EXTRACTION_FAILED, LLM_RATE_LIMITED, LLM_BUDGET_EXHAUSTED, LLM_AUTH_FAILED, LLM_TIMEOUT, GRAPH_DB_ERROR, GRAPH_ENTITY_NOT_FOUND, CONFIG_INVALID, CONFIG_MISSING;
var init_cortex_error = __esm({
  "packages/core/dist/errors/cortex-error.js"() {
    "use strict";
    CortexError = class extends Error {
      code;
      severity;
      layer;
      context;
      recoveryAction;
      retryable;
      httpStatus;
      name = "CortexError";
      constructor(code, severity, layer, message, context, recoveryAction, retryable = false, httpStatus) {
        super(message);
        this.code = code;
        this.severity = severity;
        this.layer = layer;
        this.context = context;
        this.recoveryAction = recoveryAction;
        this.retryable = retryable;
        this.httpStatus = httpStatus;
      }
    };
    LLM_PROVIDER_UNAVAILABLE = "LLM_PROVIDER_UNAVAILABLE";
    LLM_EXTRACTION_FAILED = "LLM_EXTRACTION_FAILED";
    LLM_RATE_LIMITED = "LLM_RATE_LIMITED";
    LLM_BUDGET_EXHAUSTED = "LLM_BUDGET_EXHAUSTED";
    LLM_AUTH_FAILED = "LLM_AUTH_FAILED";
    LLM_TIMEOUT = "LLM_TIMEOUT";
    GRAPH_DB_ERROR = "GRAPH_DB_ERROR";
    GRAPH_ENTITY_NOT_FOUND = "GRAPH_ENTITY_NOT_FOUND";
    CONFIG_INVALID = "CONFIG_INVALID";
    CONFIG_MISSING = "CONFIG_MISSING";
  }
});

// packages/core/dist/events/event-bus.js
var EventBus, eventBus;
var init_event_bus = __esm({
  "packages/core/dist/events/event-bus.js"() {
    "use strict";
    EventBus = class {
      handlers = /* @__PURE__ */ new Map();
      emit(event) {
        const typeHandlers = this.handlers.get(event.type);
        if (!typeHandlers)
          return;
        for (const handler of typeHandlers) {
          try {
            handler(event);
          } catch {
          }
        }
      }
      on(type, handler) {
        if (!this.handlers.has(type)) {
          this.handlers.set(type, /* @__PURE__ */ new Set());
        }
        this.handlers.get(type).add(handler);
        return () => this.off(type, handler);
      }
      off(type, handler) {
        const typeHandlers = this.handlers.get(type);
        if (!typeHandlers)
          return;
        typeHandlers.delete(handler);
        if (typeHandlers.size === 0) {
          this.handlers.delete(type);
        }
      }
      once(type, handler) {
        const wrappedHandler = (event) => {
          this.off(type, wrappedHandler);
          handler(event);
        };
        this.on(type, wrappedHandler);
      }
    };
    eventBus = new EventBus();
  }
});

// packages/core/dist/config/schema.js
import { z } from "zod";
var ingestConfigSchema, graphConfigSchema, llmBudgetSchema, llmCacheSchema, llmLocalSchema, llmCloudSchema, llmConfigSchema, privacyConfigSchema, serverConfigSchema, loggingConfigSchema, cortexConfigSchema;
var init_schema = __esm({
  "packages/core/dist/config/schema.js"() {
    "use strict";
    ingestConfigSchema = z.object({
      watchDirs: z.array(z.string()).default(["."]),
      exclude: z.array(z.string()).default([
        "node_modules",
        "dist",
        "build",
        "out",
        ".git",
        "*.min.js",
        "*.min.css",
        "*.map",
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
        "__pycache__",
        "*.pyc",
        ".DS_Store",
        "Thumbs.db"
      ]),
      fileTypes: z.array(z.string()).default(["md", "ts", "tsx", "js", "jsx", "json", "yaml", "yml"]),
      maxFileSize: z.number().positive().default(10485760),
      maxFilesPerDir: z.number().positive().default(1e4),
      maxTotalFiles: z.number().positive().default(5e4),
      debounceMs: z.number().nonnegative().default(500),
      parseTimeoutMs: z.number().positive().default(3e4),
      batchSize: z.number().positive().default(5),
      followSymlinks: z.boolean().default(false),
      confirmCost: z.boolean().default(true)
    });
    graphConfigSchema = z.object({
      dbPath: z.string().default("~/.cortex/cortex.db"),
      vectorDbPath: z.string().default("~/.cortex/vector.lance"),
      walMode: z.boolean().default(true),
      backupOnStartup: z.boolean().default(true),
      integrityCheckInterval: z.enum(["daily", "weekly", "monthly", "never"]).default("weekly"),
      softDelete: z.boolean().default(true),
      mergeConfidenceThreshold: z.number().min(0).max(1).default(0.95)
    });
    llmBudgetSchema = z.object({
      monthlyLimitUsd: z.number().nonnegative().default(25),
      warningThresholds: z.array(z.number().min(0).max(1)).default([0.5, 0.8, 0.9]),
      enforcementAction: z.enum(["warn", "fallback-local", "stop"]).default("fallback-local")
    });
    llmCacheSchema = z.object({
      enabled: z.boolean().default(true),
      ttlDays: z.number().positive().default(7),
      maxSizeMb: z.number().positive().default(500)
    });
    llmLocalSchema = z.object({
      provider: z.string().default("ollama"),
      host: z.string().url().default("http://localhost:11434"),
      model: z.string().default("mistral:7b-instruct-q5_K_M"),
      embeddingModel: z.string().default("nomic-embed-text"),
      numCtx: z.number().positive().default(8192),
      numGpu: z.number().default(-1),
      timeoutMs: z.number().positive().default(9e4),
      // 90 seconds
      keepAlive: z.string().default("5m")
    });
    llmCloudSchema = z.object({
      provider: z.string().default("anthropic"),
      baseUrl: z.string().url().optional(),
      apiKeySource: z.string().default("env:CORTEX_ANTHROPIC_API_KEY"),
      models: z.object({
        primary: z.string().default("claude-sonnet-4-5-20250929"),
        fast: z.string().default("claude-haiku-4-5-20251001")
      }).default({}),
      timeoutMs: z.number().positive().default(6e4),
      maxRetries: z.number().nonnegative().default(3),
      promptCaching: z.boolean().default(true)
    });
    llmConfigSchema = z.object({
      mode: z.enum(["cloud-first", "hybrid", "local-first", "local-only"]).default("cloud-first"),
      taskRouting: z.record(z.string(), z.enum(["auto", "local", "cloud"])).default({
        entity_extraction: "auto",
        relationship_inference: "auto",
        contradiction_detection: "local",
        conversational_query: "auto",
        context_ranking: "auto",
        embedding_generation: "local"
      }),
      temperature: z.record(z.string(), z.number().min(0).max(2)).default({
        extraction: 0.1,
        chat: 0.7,
        ranking: 0.1,
        proactive: 0.5
      }),
      maxContextTokens: z.number().positive().default(5e4),
      cache: llmCacheSchema.default({}),
      budget: llmBudgetSchema.default({}),
      local: llmLocalSchema.default({}),
      cloud: llmCloudSchema.default({})
    });
    privacyConfigSchema = z.object({
      defaultLevel: z.enum(["standard", "sensitive", "restricted"]).default("standard"),
      directoryOverrides: z.record(z.string(), z.enum(["standard", "sensitive", "restricted"])).default({}),
      autoClassify: z.boolean().default(true),
      logTransmissions: z.boolean().default(true),
      showTransmissionIndicator: z.boolean().default(true),
      secretPatterns: z.array(z.string()).default([
        "(?i)(api[_-]?key|secret[_-]?key|access[_-]?token)\\s*[:=]\\s*[\\w\\-]{20,}",
        "AKIA[0-9A-Z]{16}",
        "sk-ant-[a-zA-Z0-9\\-]{40,}",
        "ghp_[a-zA-Z0-9]{36}",
        "(?i)password\\s*[:=]\\s*\\S{8,}"
      ])
    });
    serverConfigSchema = z.object({
      port: z.number().int().min(1).max(65535).default(3710),
      host: z.string().default("127.0.0.1"),
      cors: z.array(z.string()).default(["http://localhost:5173"])
    });
    loggingConfigSchema = z.object({
      level: z.enum(["debug", "info", "warn", "error"]).default("info"),
      file: z.string().default("~/.cortex/logs/cortex.log"),
      structured: z.boolean().default(true),
      maxSizeMb: z.number().positive().default(10),
      maxFiles: z.number().positive().default(5),
      redactPrompts: z.boolean().default(false)
    });
    cortexConfigSchema = z.object({
      $schema: z.string().optional(),
      version: z.string().default("1.0"),
      ingest: ingestConfigSchema.default({}),
      graph: graphConfigSchema.default({}),
      llm: llmConfigSchema.default({}),
      privacy: privacyConfigSchema.default({}),
      server: serverConfigSchema.default({}),
      logging: loggingConfigSchema.default({})
    });
  }
});

// packages/core/dist/config/loader.js
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
function loadDotEnv() {
  const envPath = join(homedir(), ".cortex", ".env");
  if (!existsSync(envPath))
    return;
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#"))
        continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1)
        continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === void 0) {
        process.env[key] = value;
      }
    }
  } catch {
  }
}
function findConfigFile(startDir) {
  const searchPaths = [
    startDir ? resolve(startDir, CONFIG_FILENAME) : null,
    resolve(process.cwd(), CONFIG_FILENAME),
    join(homedir(), ".cortex", CONFIG_FILENAME)
  ].filter((p) => p !== null);
  const envPath = process.env["CORTEX_CONFIG_PATH"];
  if (envPath) {
    searchPaths.unshift(resolve(envPath));
  }
  for (const p of searchPaths) {
    if (existsSync(p))
      return p;
  }
  return null;
}
function readConfigFile(filePath) {
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    throw new CortexError(CONFIG_INVALID, "critical", "config", `Failed to read config file: ${filePath}: ${err instanceof Error ? err.message : String(err)}`, { filePath });
  }
}
function applyEnvOverrides(config8) {
  const env = process.env;
  if (env["CORTEX_LLM_MODE"]) {
    config8.llm = { ...config8.llm, mode: env["CORTEX_LLM_MODE"] };
  }
  if (env["CORTEX_SERVER_PORT"]) {
    config8.server = { ...config8.server, port: parseInt(env["CORTEX_SERVER_PORT"], 10) };
  }
  if (env["CORTEX_DB_PATH"]) {
    config8.graph = { ...config8.graph, dbPath: env["CORTEX_DB_PATH"] };
  }
  if (env["CORTEX_LOG_LEVEL"]) {
    config8.logging = { ...config8.logging, level: env["CORTEX_LOG_LEVEL"] };
  }
  if (env["CORTEX_BUDGET_LIMIT"]) {
    const budget = { ...config8.llm?.budget, monthlyLimitUsd: parseFloat(env["CORTEX_BUDGET_LIMIT"]) };
    config8.llm = { ...config8.llm, budget };
  }
  if (env["CORTEX_OLLAMA_HOST"]) {
    const local = { ...config8.llm?.local, host: env["CORTEX_OLLAMA_HOST"] };
    config8.llm = { ...config8.llm, local };
  }
  return config8;
}
function loadConfig(options = {}) {
  loadDotEnv();
  const { configDir, overrides, requireFile = false } = options;
  let fileConfig = {};
  const configPath = findConfigFile(configDir);
  if (configPath) {
    fileConfig = readConfigFile(configPath);
  } else if (requireFile) {
    throw new CortexError(CONFIG_MISSING, "critical", "config", "No cortex.config.json found. Run `cortex init` to create one.", void 0, "Run `cortex init` to create a configuration file.");
  }
  let merged = { ...fileConfig };
  merged = applyEnvOverrides(merged);
  if (overrides) {
    merged = { ...merged, ...overrides };
  }
  const result = cortexConfigSchema.safeParse(merged);
  if (!result.success) {
    const messages = result.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`);
    throw new CortexError(CONFIG_INVALID, "critical", "config", `Invalid configuration:
${messages.join("\n")}`, { issues: result.error.issues });
  }
  return result.data;
}
function getDefaultConfig() {
  return cortexConfigSchema.parse({});
}
var CONFIG_FILENAME;
var init_loader = __esm({
  "packages/core/dist/config/loader.js"() {
    "use strict";
    init_schema();
    init_cortex_error();
    CONFIG_FILENAME = "cortex.config.json";
  }
});

// packages/core/dist/config/project-registry.js
import { readFileSync as readFileSync2, writeFileSync, existsSync as existsSync2, mkdirSync } from "node:fs";
import { join as join2 } from "node:path";
import { homedir as homedir2 } from "node:os";
import { z as z2 } from "zod";
function ensureRegistryDir() {
  const dir = join2(homedir2(), ".cortex");
  if (!existsSync2(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
function loadProjectRegistry() {
  ensureRegistryDir();
  if (!existsSync2(REGISTRY_PATH)) {
    return { version: "1.0", projects: {} };
  }
  try {
    const raw = readFileSync2(REGISTRY_PATH, "utf-8");
    const data = JSON.parse(raw);
    return projectRegistrySchema.parse(data);
  } catch {
    return { version: "1.0", projects: {} };
  }
}
function saveProjectRegistry(registry) {
  ensureRegistryDir();
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}
function addProject(name, path, configPath) {
  const registry = loadProjectRegistry();
  const entry = {
    name,
    path,
    configPath,
    addedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  registry.projects[name] = entry;
  saveProjectRegistry(registry);
  return entry;
}
function removeProject(name) {
  const registry = loadProjectRegistry();
  if (!registry.projects[name]) {
    return false;
  }
  delete registry.projects[name];
  saveProjectRegistry(registry);
  return true;
}
function getProject(name) {
  const registry = loadProjectRegistry();
  return registry.projects[name] ?? null;
}
function listProjects() {
  const registry = loadProjectRegistry();
  return Object.values(registry.projects);
}
function updateProjectLastWatched(name) {
  const registry = loadProjectRegistry();
  if (registry.projects[name]) {
    registry.projects[name].lastWatched = (/* @__PURE__ */ new Date()).toISOString();
    saveProjectRegistry(registry);
  }
}
var REGISTRY_PATH, projectEntrySchema, projectRegistrySchema;
var init_project_registry = __esm({
  "packages/core/dist/config/project-registry.js"() {
    "use strict";
    REGISTRY_PATH = join2(homedir2(), ".cortex", "projects.json");
    projectEntrySchema = z2.object({
      name: z2.string(),
      path: z2.string(),
      configPath: z2.string().optional(),
      addedAt: z2.string(),
      lastWatched: z2.string().optional()
    });
    projectRegistrySchema = z2.object({
      version: z2.literal("1.0"),
      projects: z2.record(z2.string(), projectEntrySchema)
    });
  }
});

// packages/core/dist/logger.js
function setGlobalLogLevel(level) {
  globalLogLevel = LOG_LEVELS[level];
}
function createLogger(source, level) {
  const effectiveLevel = level ?? process.env["CORTEX_LOG_LEVEL"] ?? "info";
  return new Logger(source, effectiveLevel);
}
var LOG_LEVELS, globalLogLevel, Logger;
var init_logger = __esm({
  "packages/core/dist/logger.js"() {
    "use strict";
    LOG_LEVELS = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    globalLogLevel = null;
    Logger = class _Logger {
      level;
      source;
      constructor(source, level = "info") {
        this.source = source;
        this.level = LOG_LEVELS[level];
      }
      setLevel(level) {
        this.level = LOG_LEVELS[level];
      }
      debug(message, context) {
        this.log("debug", message, context);
      }
      info(message, context) {
        this.log("info", message, context);
      }
      warn(message, context) {
        this.log("warn", message, context);
      }
      error(message, context) {
        this.log("error", message, context);
      }
      child(source) {
        const childLogger = new _Logger(`${this.source}:${source}`);
        childLogger.level = this.level;
        return childLogger;
      }
      log(level, message, context) {
        const effectiveLevel = globalLogLevel ?? this.level;
        if (LOG_LEVELS[level] < effectiveLevel)
          return;
        const entry = {
          level,
          message,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          source: this.source,
          ...context && { context }
        };
        const output = level === "error" || level === "warn" ? process.stderr : process.stdout;
        output.write(JSON.stringify(entry) + "\n");
      }
    };
  }
});

// packages/core/dist/index.js
var init_dist = __esm({
  "packages/core/dist/index.js"() {
    "use strict";
    init_types();
    init_cortex_error();
    init_event_bus();
    init_schema();
    init_loader();
    init_project_registry();
    init_logger();
  }
});

// packages/graph/dist/migrations/001-initial.js
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      root_path TEXT NOT NULL UNIQUE,
      privacy_level TEXT NOT NULL DEFAULT 'standard',
      file_count INTEGER DEFAULT 0,
      entity_count INTEGER DEFAULT 0,
      last_ingested_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      properties TEXT,
      confidence REAL NOT NULL,
      source_file TEXT NOT NULL,
      source_start_line INTEGER,
      source_end_line INTEGER,
      project_id TEXT NOT NULL,
      extracted_by TEXT NOT NULL,
      tags TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      source_entity_id TEXT NOT NULL,
      target_entity_id TEXT NOT NULL,
      description TEXT,
      confidence REAL NOT NULL,
      properties TEXT,
      extracted_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (source_entity_id) REFERENCES entities(id),
      FOREIGN KEY (target_entity_id) REFERENCES entities(id)
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      relative_path TEXT NOT NULL,
      project_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      file_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      last_modified TEXT NOT NULL,
      last_ingested_at TEXT,
      entity_ids TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      parse_error TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS contradictions (
      id TEXT PRIMARY KEY,
      entity_id_a TEXT NOT NULL,
      entity_id_b TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      suggested_resolution TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      resolved_action TEXT,
      resolved_at TEXT,
      detected_at TEXT NOT NULL,
      FOREIGN KEY (entity_id_a) REFERENCES entities(id),
      FOREIGN KEY (entity_id_b) REFERENCES entities(id)
    );

    CREATE TABLE IF NOT EXISTS token_usage (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      task TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      estimated_cost_usd REAL NOT NULL,
      latency_ms INTEGER NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dead_letter_queue (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      error_code TEXT NOT NULL,
      error_message TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      first_failed_at TEXT NOT NULL,
      last_failed_at TEXT NOT NULL,
      next_retry_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
    );

    -- Full-text search
    CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(name, content, summary, tags);

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
    CREATE INDEX IF NOT EXISTS idx_entities_project ON entities(project_id);
    CREATE INDEX IF NOT EXISTS idx_entities_status ON entities(status);
    CREATE INDEX IF NOT EXISTS idx_entities_source ON entities(source_file);
    CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_entity_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_entity_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);
    CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
    CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
    CREATE INDEX IF NOT EXISTS idx_files_hash ON files(content_hash);
    CREATE INDEX IF NOT EXISTS idx_token_usage_month ON token_usage(timestamp);
    CREATE INDEX IF NOT EXISTS idx_dlq_status ON dead_letter_queue(status);

    -- Schema version tracking
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (${MIGRATION_VERSION}, datetime('now'));
  `);
}
var MIGRATION_VERSION;
var init_initial = __esm({
  "packages/graph/dist/migrations/001-initial.js"() {
    "use strict";
    MIGRATION_VERSION = 1;
  }
});

// packages/graph/dist/sqlite-store.js
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { copyFileSync, statSync, mkdirSync as mkdirSync3 } from "node:fs";
import { dirname } from "node:path";
import { homedir as homedir4 } from "node:os";
function resolveHomePath(p) {
  return p.startsWith("~") ? p.replace("~", homedir4()) : p;
}
function now() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function rowToContradiction(row) {
  return {
    id: row.id,
    entityIds: [row.entity_id_a, row.entity_id_b],
    description: row.description,
    severity: row.severity,
    suggestedResolution: row.suggested_resolution ?? void 0,
    status: row.status,
    resolvedAction: row.resolved_action ?? void 0,
    resolvedAt: row.resolved_at ?? void 0,
    detectedAt: row.detected_at
  };
}
function rowToEntity(row) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    content: row.content,
    summary: row.summary ?? void 0,
    properties: row.properties ? JSON.parse(row.properties) : {},
    confidence: row.confidence,
    sourceFile: row.source_file,
    sourceRange: row.source_start_line != null && row.source_end_line != null ? { startLine: row.source_start_line, endLine: row.source_end_line } : void 0,
    projectId: row.project_id,
    extractedBy: JSON.parse(row.extracted_by),
    tags: row.tags ? JSON.parse(row.tags) : [],
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function rowToRelationship(row) {
  return {
    id: row.id,
    type: row.type,
    sourceEntityId: row.source_entity_id,
    targetEntityId: row.target_entity_id,
    description: row.description ?? void 0,
    confidence: row.confidence,
    properties: row.properties ? JSON.parse(row.properties) : {},
    extractedBy: JSON.parse(row.extracted_by),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function rowToFile(row) {
  return {
    id: row.id,
    path: row.path,
    relativePath: row.relative_path,
    projectId: row.project_id,
    contentHash: row.content_hash,
    fileType: row.file_type,
    sizeBytes: row.size_bytes,
    lastModified: row.last_modified,
    lastIngestedAt: row.last_ingested_at ?? void 0,
    entityIds: row.entity_ids ? JSON.parse(row.entity_ids) : [],
    status: row.status,
    parseError: row.parse_error ?? void 0
  };
}
function rowToProject(row) {
  return {
    id: row.id,
    name: row.name,
    rootPath: row.root_path,
    privacyLevel: row.privacy_level,
    fileCount: row.file_count,
    entityCount: row.entity_count,
    lastIngestedAt: row.last_ingested_at ?? void 0,
    createdAt: row.created_at
  };
}
var SQLiteStore;
var init_sqlite_store = __esm({
  "packages/graph/dist/sqlite-store.js"() {
    "use strict";
    init_dist();
    init_initial();
    SQLiteStore = class {
      db;
      dbPath;
      constructor(options = {}) {
        const { dbPath = "~/.cortex/cortex.db", walMode = true, backupOnStartup = true } = options;
        this.dbPath = resolveHomePath(dbPath);
        mkdirSync3(dirname(this.dbPath), { recursive: true });
        if (backupOnStartup) {
          this.backupSync();
        }
        this.db = new Database(this.dbPath);
        if (walMode) {
          this.db.pragma("journal_mode = WAL");
        }
        this.db.pragma("foreign_keys = ON");
        this.db.pragma("busy_timeout = 5000");
        this.migrate();
      }
      migrate() {
        try {
          up(this.db);
        } catch (err) {
          throw new CortexError(GRAPH_DB_ERROR, "critical", "graph", `Migration failed: ${err instanceof Error ? err.message : String(err)}`, void 0, "Delete the database and restart.");
        }
      }
      backupSync() {
        try {
          const stat = statSync(this.dbPath);
          if (stat.isFile()) {
            const backupPath = `${this.dbPath}.backup`;
            copyFileSync(this.dbPath, backupPath);
          }
        } catch {
        }
      }
      close() {
        this.db.close();
      }
      // --- Entities ---
      async createEntity(entity) {
        const id = randomUUID();
        const ts = now();
        this.db.prepare(`
      INSERT INTO entities (
        id, type, name, content, summary, properties, confidence,
        source_file, source_start_line, source_end_line,
        project_id, extracted_by, tags, status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `).run(id, entity.type, entity.name, entity.content, entity.summary ?? null, JSON.stringify(entity.properties), entity.confidence, entity.sourceFile, entity.sourceRange?.startLine ?? null, entity.sourceRange?.endLine ?? null, entity.projectId, JSON.stringify(entity.extractedBy), JSON.stringify(entity.tags), entity.status, ts, ts);
        this.db.prepare(`
      INSERT INTO entities_fts (rowid, name, content, summary, tags)
      VALUES (
        (SELECT rowid FROM entities WHERE id = ?),
        ?, ?, ?, ?
      )
    `).run(id, entity.name, entity.content, entity.summary ?? "", entity.tags.join(" "));
        return { ...entity, id, createdAt: ts, updatedAt: ts };
      }
      async getEntity(id) {
        const row = this.db.prepare("SELECT * FROM entities WHERE id = ? AND deleted_at IS NULL").get(id);
        return row ? rowToEntity(row) : null;
      }
      async updateEntity(id, updates) {
        const existing = await this.getEntity(id);
        if (!existing) {
          throw new CortexError(GRAPH_ENTITY_NOT_FOUND, "low", "graph", `Entity not found: ${id}`, { entityId: id });
        }
        const merged = { ...existing, ...updates, updatedAt: now() };
        this.db.prepare(`
      UPDATE entities SET
        type = ?, name = ?, content = ?, summary = ?,
        properties = ?, confidence = ?,
        source_file = ?, source_start_line = ?, source_end_line = ?,
        extracted_by = ?, tags = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(merged.type, merged.name, merged.content, merged.summary ?? null, JSON.stringify(merged.properties), merged.confidence, merged.sourceFile, merged.sourceRange?.startLine ?? null, merged.sourceRange?.endLine ?? null, JSON.stringify(merged.extractedBy), JSON.stringify(merged.tags), merged.status, merged.updatedAt, id);
        this.db.prepare(`
      UPDATE entities_fts SET name = ?, content = ?, summary = ?, tags = ?
      WHERE rowid = (SELECT rowid FROM entities WHERE id = ?)
    `).run(merged.name, merged.content, merged.summary ?? "", merged.tags.join(" "), id);
        return merged;
      }
      async deleteEntity(id, soft = true) {
        if (soft) {
          this.db.prepare("UPDATE entities SET deleted_at = ?, status = ? WHERE id = ?").run(now(), "deleted", id);
        } else {
          this.db.prepare("DELETE FROM entities_fts WHERE rowid = (SELECT rowid FROM entities WHERE id = ?)").run(id);
          this.db.prepare("DELETE FROM entities WHERE id = ?").run(id);
        }
      }
      async findEntities(query) {
        const conditions = ["deleted_at IS NULL"];
        const params = [];
        if (query.type) {
          conditions.push("type = ?");
          params.push(query.type);
        }
        if (query.projectId) {
          conditions.push("project_id = ?");
          params.push(query.projectId);
        }
        if (query.status) {
          conditions.push("status = ?");
          params.push(query.status);
        }
        if (query.since) {
          conditions.push("created_at >= ?");
          params.push(query.since);
        }
        if (query.before) {
          conditions.push("created_at < ?");
          params.push(query.before);
        }
        let sql;
        if (query.search) {
          sql = `
        SELECT e.* FROM entities e
        JOIN entities_fts fts ON fts.rowid = e.rowid
        WHERE fts.entities_fts MATCH ? AND ${conditions.join(" AND ")}
        ORDER BY rank
      `;
          params.unshift(query.search);
        } else {
          sql = `
        SELECT * FROM entities
        WHERE ${conditions.join(" AND ")}
        ORDER BY created_at DESC
      `;
        }
        if (query.limit) {
          sql += " LIMIT ?";
          params.push(query.limit);
        }
        if (query.offset) {
          sql += " OFFSET ?";
          params.push(query.offset);
        }
        const rows = this.db.prepare(sql).all(...params);
        return rows.map(rowToEntity);
      }
      // --- Relationships ---
      async createRelationship(rel) {
        const id = randomUUID();
        const ts = now();
        this.db.prepare(`
      INSERT INTO relationships (
        id, type, source_entity_id, target_entity_id,
        description, confidence, properties, extracted_by,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, rel.type, rel.sourceEntityId, rel.targetEntityId, rel.description ?? null, rel.confidence, JSON.stringify(rel.properties), JSON.stringify(rel.extractedBy), ts, ts);
        return { ...rel, id, createdAt: ts, updatedAt: ts };
      }
      async getRelationship(id) {
        const row = this.db.prepare("SELECT * FROM relationships WHERE id = ?").get(id);
        return row ? rowToRelationship(row) : null;
      }
      async getRelationshipsForEntity(entityId, direction = "both") {
        let sql;
        let params;
        if (direction === "out") {
          sql = "SELECT * FROM relationships WHERE source_entity_id = ?";
          params = [entityId];
        } else if (direction === "in") {
          sql = "SELECT * FROM relationships WHERE target_entity_id = ?";
          params = [entityId];
        } else {
          sql = "SELECT * FROM relationships WHERE source_entity_id = ? OR target_entity_id = ?";
          params = [entityId, entityId];
        }
        const rows = this.db.prepare(sql).all(...params);
        return rows.map(rowToRelationship);
      }
      async deleteRelationship(id) {
        this.db.prepare("DELETE FROM relationships WHERE id = ?").run(id);
      }
      deleteBySourcePath(pathPrefix) {
        const normalized = pathPrefix.replace(/\//g, "\\");
        const pattern = normalized.endsWith("%") ? normalized : normalized + "%";
        return this.db.transaction(() => {
          const relResult = this.db.prepare(`
        DELETE FROM relationships
        WHERE source_entity_id IN (SELECT id FROM entities WHERE source_file LIKE ?)
           OR target_entity_id IN (SELECT id FROM entities WHERE source_file LIKE ?)
      `).run(pattern, pattern);
          this.db.prepare(`
        DELETE FROM entities_fts
        WHERE rowid IN (SELECT rowid FROM entities WHERE source_file LIKE ? AND deleted_at IS NULL)
      `).run(pattern);
          const entityResult = this.db.prepare("DELETE FROM entities WHERE source_file LIKE ?").run(pattern);
          const fileResult = this.db.prepare("DELETE FROM files WHERE path LIKE ?").run(pattern);
          return {
            deletedEntities: entityResult.changes,
            deletedRelationships: relResult.changes,
            deletedFiles: fileResult.changes
          };
        })();
      }
      resetDatabase() {
        this.db.transaction(() => {
          this.db.prepare("DELETE FROM contradictions").run();
          this.db.prepare("DELETE FROM relationships").run();
          this.db.prepare("DELETE FROM entities_fts").run();
          this.db.prepare("DELETE FROM entities").run();
          this.db.prepare("DELETE FROM files").run();
        })();
      }
      pruneSoftDeleted() {
        return this.db.transaction(() => {
          const relResult = this.db.prepare(`
        DELETE FROM relationships
        WHERE source_entity_id IN (SELECT id FROM entities WHERE deleted_at IS NOT NULL)
           OR target_entity_id IN (SELECT id FROM entities WHERE deleted_at IS NOT NULL)
      `).run();
          this.db.prepare(`
        DELETE FROM entities_fts
        WHERE rowid IN (SELECT rowid FROM entities WHERE deleted_at IS NOT NULL)
      `).run();
          const entityResult = this.db.prepare("DELETE FROM entities WHERE deleted_at IS NOT NULL").run();
          return {
            deletedEntities: entityResult.changes,
            deletedRelationships: relResult.changes
          };
        })();
      }
      // --- Files ---
      async upsertFile(file) {
        const existing = this.db.prepare("SELECT * FROM files WHERE path = ?").get(file.path);
        if (existing) {
          this.db.prepare(`
        UPDATE files SET
          relative_path = ?, project_id = ?, content_hash = ?,
          file_type = ?, size_bytes = ?, last_modified = ?,
          last_ingested_at = ?, entity_ids = ?, status = ?, parse_error = ?
        WHERE path = ?
      `).run(file.relativePath, file.projectId, file.contentHash, file.fileType, file.sizeBytes, file.lastModified, file.lastIngestedAt ?? null, JSON.stringify(file.entityIds), file.status, file.parseError ?? null, file.path);
          return { ...file, id: existing.id };
        }
        const id = randomUUID();
        this.db.prepare(`
      INSERT INTO files (
        id, path, relative_path, project_id, content_hash,
        file_type, size_bytes, last_modified, last_ingested_at,
        entity_ids, status, parse_error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, file.path, file.relativePath, file.projectId, file.contentHash, file.fileType, file.sizeBytes, file.lastModified, file.lastIngestedAt ?? null, JSON.stringify(file.entityIds), file.status, file.parseError ?? null);
        return { ...file, id };
      }
      async getFile(path) {
        const row = this.db.prepare("SELECT * FROM files WHERE path = ?").get(path);
        return row ? rowToFile(row) : null;
      }
      async getFilesByProject(projectId) {
        const rows = this.db.prepare("SELECT * FROM files WHERE project_id = ?").all(projectId);
        return rows.map(rowToFile);
      }
      // --- Projects ---
      async createProject(project) {
        const id = randomUUID();
        const ts = now();
        this.db.prepare(`
      INSERT INTO projects (
        id, name, root_path, privacy_level,
        file_count, entity_count, last_ingested_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, project.name, project.rootPath, project.privacyLevel, project.fileCount, project.entityCount, project.lastIngestedAt ?? null, ts);
        return { ...project, id, createdAt: ts };
      }
      async getProject(id) {
        const row = this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
        return row ? rowToProject(row) : null;
      }
      async listProjects() {
        const rows = this.db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
        return rows.map(rowToProject);
      }
      // --- Contradictions ---
      async createContradiction(contradiction) {
        const id = randomUUID();
        this.db.prepare(`
      INSERT INTO contradictions (
        id, entity_id_a, entity_id_b, description, severity,
        suggested_resolution, status, resolved_action, resolved_at, detected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, contradiction.entityIds[0], contradiction.entityIds[1], contradiction.description, contradiction.severity, contradiction.suggestedResolution ?? null, contradiction.status, contradiction.resolvedAction ?? null, contradiction.resolvedAt ?? null, contradiction.detectedAt);
        return { ...contradiction, id };
      }
      async findContradictions(query = {}) {
        const conditions = [];
        const params = [];
        if (query.status) {
          conditions.push("status = ?");
          params.push(query.status);
        }
        if (query.entityId) {
          conditions.push("(entity_id_a = ? OR entity_id_b = ?)");
          params.push(query.entityId, query.entityId);
        }
        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        let sql = `SELECT * FROM contradictions ${where} ORDER BY detected_at DESC`;
        if (query.limit) {
          sql += " LIMIT ?";
          params.push(query.limit);
        }
        const rows = this.db.prepare(sql).all(...params);
        return rows.map(rowToContradiction);
      }
      async updateContradiction(id, update) {
        this.db.prepare(`
      UPDATE contradictions SET status = ?, resolved_action = ?, resolved_at = ? WHERE id = ?
    `).run(update.status, update.resolvedAction ?? null, update.resolvedAt ?? null, id);
      }
      // --- Search ---
      async searchEntities(text, limit = 20) {
        const rows = this.db.prepare(`
      SELECT e.* FROM entities e
      JOIN entities_fts fts ON fts.rowid = e.rowid
      WHERE fts.entities_fts MATCH ? AND e.deleted_at IS NULL
      ORDER BY rank
      LIMIT ?
    `).all(text, limit);
        return rows.map(rowToEntity);
      }
      async semanticSearch(_embedding, _limit = 20) {
        return [];
      }
      // --- Stats ---
      async getStats() {
        const entityCount = this.db.prepare("SELECT COUNT(*) as count FROM entities WHERE deleted_at IS NULL AND status != 'deleted'").get().count;
        const relationshipCount = this.db.prepare("SELECT COUNT(*) as count FROM relationships").get().count;
        const fileCount = this.db.prepare("SELECT COUNT(*) as count FROM files").get().count;
        const projectCount = this.db.prepare("SELECT COUNT(*) as count FROM projects").get().count;
        const contradictionCount = this.db.prepare("SELECT COUNT(*) as count FROM contradictions WHERE status = 'active'").get().count;
        let dbSizeBytes = 0;
        try {
          dbSizeBytes = statSync(this.dbPath).size;
        } catch {
        }
        return {
          entityCount,
          relationshipCount,
          fileCount,
          projectCount,
          contradictionCount,
          dbSizeBytes,
          vectorDbSizeBytes: 0
          // Managed by VectorStore
        };
      }
      // --- Report ---
      getReportData() {
        const fileRows = this.db.prepare("SELECT status, COUNT(*) as count FROM files GROUP BY status").all();
        const fileStatus = { ingested: 0, failed: 0, skipped: 0, pending: 0 };
        for (const row of fileRows) {
          if (row.status in fileStatus) {
            fileStatus[row.status] = row.count;
          }
        }
        const failedFiles = this.db.prepare(`SELECT path, relative_path, parse_error FROM files
       WHERE status = 'failed' AND parse_error IS NOT NULL
       ORDER BY path LIMIT 50`).all().map((r) => ({ path: r.path, relativePath: r.relative_path, parseError: r.parse_error }));
        const entityRows = this.db.prepare(`SELECT type, COUNT(*) as count, AVG(confidence) as avg_confidence
       FROM entities WHERE deleted_at IS NULL AND status = 'active'
       GROUP BY type ORDER BY count DESC`).all();
        const entityBreakdown = entityRows.map((r) => ({
          type: r.type,
          count: r.count,
          avgConfidence: r.avg_confidence
        }));
        const supersededCount = this.db.prepare("SELECT COUNT(*) as count FROM entities WHERE status = 'superseded'").get().count;
        const relRows = this.db.prepare("SELECT type, COUNT(*) as count FROM relationships GROUP BY type ORDER BY count DESC").all();
        const relationshipBreakdown = relRows.map((r) => ({ type: r.type, count: r.count }));
        const contrRows = this.db.prepare("SELECT status, severity, COUNT(*) as count FROM contradictions GROUP BY status, severity").all();
        const contradictions = {
          active: 0,
          resolved: 0,
          dismissed: 0,
          highSeverity: 0,
          mediumSeverity: 0,
          lowSeverity: 0
        };
        for (const r of contrRows) {
          if (r.status === "active")
            contradictions.active += r.count;
          if (r.status === "resolved")
            contradictions.resolved += r.count;
          if (r.status === "dismissed")
            contradictions.dismissed += r.count;
          if (r.severity === "high" || r.severity === "critical")
            contradictions.highSeverity += r.count;
          if (r.severity === "medium")
            contradictions.mediumSeverity += r.count;
          if (r.severity === "low")
            contradictions.lowSeverity += r.count;
        }
        const topContrRows = this.db.prepare(`SELECT c.id, c.severity, c.description, ea.name as entity_a, eb.name as entity_b
       FROM contradictions c
       LEFT JOIN entities ea ON c.entity_id_a = ea.id
       LEFT JOIN entities eb ON c.entity_id_b = eb.id
       WHERE c.status = 'active'
       ORDER BY CASE c.severity
         WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3
       END, c.detected_at DESC
       LIMIT 10`).all();
        const topContradictions = topContrRows.map((r) => ({
          id: r.id.slice(0, 8),
          severity: r.severity,
          description: r.description,
          entityA: r.entity_a ?? "unknown",
          entityB: r.entity_b ?? "unknown"
        }));
        const tokenRow = this.db.prepare(`SELECT
        SUM(CAST(JSON_EXTRACT(extracted_by, '$.tokensUsed.input') AS INTEGER)) as total_input,
        SUM(CAST(JSON_EXTRACT(extracted_by, '$.tokensUsed.output') AS INTEGER)) as total_output
       FROM entities WHERE deleted_at IS NULL`).get();
        return {
          generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          fileStatus,
          failedFiles,
          entityBreakdown,
          supersededCount,
          relationshipBreakdown,
          contradictions,
          topContradictions,
          tokenEstimate: {
            totalInput: tokenRow.total_input ?? 0,
            totalOutput: tokenRow.total_output ?? 0
          }
        };
      }
      // --- Maintenance ---
      async backup() {
        const backupPath = `${this.dbPath}.backup-${Date.now()}`;
        await this.db.backup(backupPath);
        return backupPath;
      }
      async integrityCheck() {
        const details = [];
        const orphanedRels = this.db.prepare(`
      SELECT COUNT(*) as count FROM relationships r
      WHERE NOT EXISTS (SELECT 1 FROM entities WHERE id = r.source_entity_id)
         OR NOT EXISTS (SELECT 1 FROM entities WHERE id = r.target_entity_id)
    `).get().count;
        if (orphanedRels > 0) {
          details.push(`Found ${orphanedRels} orphaned relationships`);
        }
        const missingProjects = this.db.prepare(`
      SELECT COUNT(*) as count FROM files f
      WHERE NOT EXISTS (SELECT 1 FROM projects WHERE id = f.project_id)
    `).get().count;
        if (missingProjects > 0) {
          details.push(`Found ${missingProjects} files referencing missing projects`);
        }
        const integrityResult = this.db.pragma("integrity_check");
        const sqliteOk = integrityResult.length === 1 && integrityResult[0].integrity_check === "ok";
        if (!sqliteOk) {
          details.push("SQLite integrity check failed");
        }
        return {
          ok: orphanedRels === 0 && missingProjects === 0 && sqliteOk,
          orphanedRelationships: orphanedRels,
          missingFiles: missingProjects,
          details
        };
      }
      // --- Graph visualization data ---
      getGraphData(options = {}) {
        const limit = options.limit ?? 2e3;
        let entitySql = `SELECT id, name, type, confidence, source_file FROM entities WHERE status = 'active'`;
        const params = [];
        if (options.projectId) {
          entitySql += ` AND project_id = ?`;
          params.push(options.projectId);
        }
        entitySql += ` ORDER BY confidence DESC LIMIT ?`;
        params.push(limit);
        const entityRows = this.db.prepare(entitySql).all(...params);
        const entityIds = new Set(entityRows.map((e) => e.id));
        const relRows = this.db.prepare(`SELECT id, type, source_entity_id, target_entity_id, confidence
       FROM relationships
       LIMIT ?`).all(limit * 2);
        const edges = relRows.filter((r) => entityIds.has(r.source_entity_id) && entityIds.has(r.target_entity_id)).map((r) => ({
          id: r.id,
          source: r.source_entity_id,
          target: r.target_entity_id,
          type: r.type,
          confidence: r.confidence
        }));
        return {
          nodes: entityRows.map((e) => ({
            id: e.id,
            name: e.name,
            type: e.type,
            confidence: e.confidence,
            sourceFile: e.source_file
          })),
          edges
        };
      }
    };
  }
});

// packages/graph/dist/vector-store.js
import { connect } from "@lancedb/lancedb";
import { mkdirSync as mkdirSync4 } from "node:fs";
import { homedir as homedir5 } from "node:os";
function resolveHomePath2(p) {
  return p.startsWith("~") ? p.replace("~", homedir5()) : p;
}
var logger, TABLE_NAME, VectorStore;
var init_vector_store = __esm({
  "packages/graph/dist/vector-store.js"() {
    "use strict";
    init_dist();
    logger = createLogger("graph:vector-store");
    TABLE_NAME = "entity_embeddings";
    VectorStore = class {
      db = null;
      table = null;
      dbPath;
      dimensions;
      constructor(options = {}) {
        this.dbPath = resolveHomePath2(options.dbPath ?? "~/.cortex/vector.lance");
        this.dimensions = options.dimensions ?? 384;
      }
      async initialize() {
        mkdirSync4(this.dbPath, { recursive: true });
        this.db = await connect(this.dbPath);
        try {
          this.table = await this.db.openTable(TABLE_NAME);
        } catch {
          logger.debug("Vector table does not exist yet, will create on first add");
        }
      }
      async ensureTable() {
        if (this.table)
          return this.table;
        if (!this.db)
          throw new Error("VectorStore not initialized");
        this.table = await this.db.createTable(TABLE_NAME, [
          {
            id: "_init",
            entityId: "_init",
            vector: new Array(this.dimensions).fill(0),
            text: ""
          }
        ]);
        await this.table.delete('id = "_init"');
        return this.table;
      }
      async addVectors(records) {
        if (records.length === 0)
          return;
        const table = await this.ensureTable();
        const rows = records.map((r) => ({
          id: r.entityId,
          entityId: r.entityId,
          vector: Array.from(r.vector),
          text: r.text
        }));
        await table.add(rows);
        logger.debug(`Added ${rows.length} vectors`);
      }
      async search(queryVector, limit = 20) {
        if (!this.table)
          return [];
        const results = await this.table.search(Array.from(queryVector)).limit(limit).toArray();
        return results.map((r) => ({
          entityId: r.entityId,
          distance: r._distance,
          text: r.text
        }));
      }
      async deleteByEntityId(entityId) {
        if (!this.table)
          return;
        await this.table.delete(`entityId = "${entityId}"`);
      }
      async count() {
        if (!this.table)
          return 0;
        return await this.table.countRows();
      }
    };
  }
});

// packages/graph/dist/query-engine.js
function estimateTokens(text) {
  return Math.ceil(text.length / AVG_CHARS_PER_TOKEN);
}
var logger2, AVG_CHARS_PER_TOKEN, QueryEngine;
var init_query_engine = __esm({
  "packages/graph/dist/query-engine.js"() {
    "use strict";
    init_dist();
    logger2 = createLogger("graph:query-engine");
    AVG_CHARS_PER_TOKEN = 4;
    QueryEngine = class {
      sqliteStore;
      vectorStore;
      maxContextTokens;
      maxResultEntities;
      ftsWeight;
      vectorWeight;
      constructor(sqliteStore, vectorStore, options = {}) {
        this.sqliteStore = sqliteStore;
        this.vectorStore = vectorStore;
        this.maxContextTokens = options.maxContextTokens ?? 5e4;
        this.maxResultEntities = options.maxResultEntities ?? 30;
        this.ftsWeight = options.ftsWeight ?? 0.4;
        this.vectorWeight = options.vectorWeight ?? 0.6;
      }
      async assembleContext(query, queryEmbedding, projectId) {
        const [ftsResults, vectorResults] = await Promise.all([
          this.ftsSearch(query, projectId),
          queryEmbedding ? this.vectorStore.search(queryEmbedding, 30) : Promise.resolve([])
        ]);
        const rankedEntities = this.mergeAndRank(ftsResults, vectorResults);
        const contextEntities = [];
        let totalTokens = 0;
        const budgetForEntities = Math.floor(this.maxContextTokens * 0.7);
        for (const entity of rankedEntities) {
          if (contextEntities.length >= this.maxResultEntities)
            break;
          const entityTokens = estimateTokens(entity.content) + estimateTokens(entity.name);
          if (totalTokens + entityTokens > budgetForEntities)
            break;
          contextEntities.push(entity);
          totalTokens += entityTokens;
        }
        const entityIds = new Set(contextEntities.map((e) => e.id));
        const relationships = [];
        for (const entity of contextEntities) {
          const rels = await this.sqliteStore.getRelationshipsForEntity(entity.id);
          for (const rel of rels) {
            if (entityIds.has(rel.sourceEntityId) && entityIds.has(rel.targetEntityId)) {
              relationships.push(rel);
            }
          }
        }
        const uniqueRels = [...new Map(relationships.map((r) => [r.id, r])).values()];
        const relTokens = uniqueRels.reduce((sum, r) => sum + estimateTokens(r.description ?? "") + 20, 0);
        logger2.debug("Context assembled", {
          entities: contextEntities.length,
          relationships: uniqueRels.length,
          totalTokensEstimate: totalTokens + relTokens
        });
        return {
          entities: contextEntities,
          relationships: uniqueRels,
          totalTokensEstimate: totalTokens + relTokens
        };
      }
      /**
       * Converts a natural language query to an FTS5-safe keyword query.
       * FTS5 uses AND semantics by default, so "what is the architecture" would
       * require ALL words to match. We strip stop words and use OR semantics so
       * entities matching ANY meaningful keyword are returned.
       */
      buildFtsQuery(query) {
        const stopWords = /* @__PURE__ */ new Set([
          "a",
          "an",
          "the",
          "and",
          "or",
          "but",
          "in",
          "on",
          "at",
          "to",
          "for",
          "of",
          "with",
          "by",
          "from",
          "is",
          "are",
          "was",
          "were",
          "be",
          "been",
          "being",
          "have",
          "has",
          "had",
          "do",
          "does",
          "did",
          "will",
          "would",
          "could",
          "should",
          "may",
          "might",
          "shall",
          "can",
          "need",
          "must",
          "what",
          "which",
          "who",
          "how",
          "why",
          "when",
          "where",
          "that",
          "this",
          "these",
          "those",
          "it",
          "its",
          "me",
          "my",
          "you",
          "your",
          "we",
          "our",
          "they",
          "their",
          "he",
          "she",
          "i",
          "all",
          "any",
          "each",
          "some",
          "no",
          "not",
          "so",
          "yet",
          "use",
          "used",
          "using",
          "about",
          "tell",
          "know",
          "get",
          "got",
          "make",
          "made",
          "see",
          "give",
          "go",
          "come",
          "take"
        ]);
        const keywords = query.replace(/[^a-zA-Z0-9\s]/g, " ").toLowerCase().split(/\s+/).filter((w) => w.length >= 3 && !stopWords.has(w));
        if (keywords.length === 0) {
          return query.replace(/[^a-zA-Z0-9\s]/g, " ").trim();
        }
        return keywords.join(" OR ");
      }
      async ftsSearch(query, projectId) {
        const ftsQuery = this.buildFtsQuery(query);
        try {
          if (projectId) {
            return await this.sqliteStore.findEntities({
              search: ftsQuery,
              projectId,
              limit: 30
            });
          }
          return await this.sqliteStore.searchEntities(ftsQuery, 30);
        } catch (err) {
          logger2.warn("FTS search failed, returning empty results", {
            error: err instanceof Error ? err.message : String(err),
            query: ftsQuery
          });
          return [];
        }
      }
      mergeAndRank(ftsResults, vectorResults) {
        const scores = /* @__PURE__ */ new Map();
        for (let i = 0; i < ftsResults.length; i++) {
          const entity = ftsResults[i];
          const positionScore = 1 - i / Math.max(ftsResults.length, 1);
          scores.set(entity.id, {
            entity,
            score: positionScore * this.ftsWeight
          });
        }
        if (vectorResults.length > 0) {
          const maxDist = Math.max(...vectorResults.map((r) => r.distance), 1);
          for (const vr of vectorResults) {
            const distScore = 1 - vr.distance / maxDist;
            const existing = scores.get(vr.entityId);
            if (existing) {
              existing.score += distScore * this.vectorWeight;
            }
          }
        }
        return [...scores.values()].sort((a, b) => b.score - a.score).map((s) => s.entity);
      }
    };
  }
});

// packages/graph/dist/index.js
var init_dist2 = __esm({
  "packages/graph/dist/index.js"() {
    "use strict";
    init_sqlite_store();
    init_vector_store();
    init_query_engine();
  }
});

// packages/llm/dist/providers/anthropic.js
import Anthropic from "@anthropic-ai/sdk";
var logger3, AnthropicProvider;
var init_anthropic = __esm({
  "packages/llm/dist/providers/anthropic.js"() {
    "use strict";
    init_dist();
    logger3 = createLogger("llm:anthropic");
    AnthropicProvider = class {
      name = "anthropic";
      type = "cloud";
      client;
      primaryModel;
      fastModel;
      promptCaching;
      capabilities = {
        supportedTasks: [
          LLMTask.ENTITY_EXTRACTION,
          LLMTask.RELATIONSHIP_INFERENCE,
          LLMTask.CONTRADICTION_DETECTION,
          LLMTask.CONVERSATIONAL_QUERY,
          LLMTask.CONTEXT_RANKING
        ],
        maxContextTokens: 2e5,
        supportsStructuredOutput: true,
        supportsStreaming: true,
        estimatedTokensPerSecond: 80,
        costPerMillionInputTokens: 3,
        costPerMillionOutputTokens: 15
      };
      constructor(options = {}) {
        const apiKey = options.apiKey ?? process.env["CORTEX_ANTHROPIC_API_KEY"];
        if (!apiKey) {
          throw new CortexError(LLM_AUTH_FAILED, "critical", "llm", "Anthropic API key not found. Set CORTEX_ANTHROPIC_API_KEY environment variable.", void 0, "Set CORTEX_ANTHROPIC_API_KEY or run `cortex init`.", false, 401);
        }
        this.client = new Anthropic({
          apiKey,
          timeout: options.timeoutMs ?? 3e4,
          maxRetries: options.maxRetries ?? 3
        });
        this.primaryModel = options.primaryModel ?? "claude-sonnet-4-5-20250929";
        this.fastModel = options.fastModel ?? "claude-haiku-4-5-20251001";
        this.promptCaching = options.promptCaching ?? true;
      }
      getModel(preference = "primary") {
        return preference === "fast" ? this.fastModel : this.primaryModel;
      }
      async complete(prompt, options) {
        const result = await this.completeWithSystem(void 0, prompt, options);
        return result.content;
      }
      async completeWithSystem(systemPrompt7, userPrompt, options, modelPreference = "primary") {
        const model = this.getModel(modelPreference);
        try {
          const systemMessages = systemPrompt7 ? this.buildSystemMessages(systemPrompt7) : void 0;
          const response = await this.client.messages.create({
            model,
            max_tokens: options?.maxTokens ?? 4096,
            temperature: options?.temperature ?? 0.7,
            ...systemMessages && { system: systemMessages },
            messages: [{ role: "user", content: userPrompt }],
            ...options?.stopSequences?.length && { stop_sequences: options.stopSequences }
          });
          const textBlock = response.content.find((b) => b.type === "text");
          const content = textBlock?.text ?? "";
          return {
            content,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            model
          };
        } catch (err) {
          throw this.mapError(err);
        }
      }
      async completeStructured(prompt, _schema, options) {
        const result = await this.complete(prompt, options);
        return JSON.parse(result);
      }
      async *stream(prompt, options) {
        yield* this.streamWithSystem(void 0, prompt, options);
      }
      async *streamWithSystem(systemPrompt7, userPrompt, options, modelPreference = "primary") {
        const model = this.getModel(modelPreference);
        try {
          const systemMessages = systemPrompt7 ? this.buildSystemMessages(systemPrompt7) : void 0;
          const stream = this.client.messages.stream({
            model,
            max_tokens: options?.maxTokens ?? 4096,
            temperature: options?.temperature ?? 0.7,
            ...systemMessages && { system: systemMessages },
            messages: [{ role: "user", content: userPrompt }],
            ...options?.stopSequences?.length && { stop_sequences: options.stopSequences }
          });
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              yield event.delta.text;
            }
          }
          const finalMessage = await stream.finalMessage();
          return {
            inputTokens: finalMessage.usage.input_tokens,
            outputTokens: finalMessage.usage.output_tokens,
            model
          };
        } catch (err) {
          throw this.mapError(err);
        }
      }
      async embed(_texts) {
        throw new CortexError(LLM_PROVIDER_UNAVAILABLE, "medium", "llm", "Anthropic does not support embeddings. Use local embedding model.");
      }
      async isAvailable() {
        try {
          await this.client.messages.create({
            model: this.fastModel,
            max_tokens: 1,
            messages: [{ role: "user", content: "ping" }]
          });
          return true;
        } catch {
          return false;
        }
      }
      buildSystemMessages(systemPrompt7) {
        if (this.promptCaching) {
          return [{
            type: "text",
            text: systemPrompt7,
            cache_control: { type: "ephemeral" }
          }];
        }
        return [{ type: "text", text: systemPrompt7 }];
      }
      mapError(err) {
        if (err instanceof Anthropic.AuthenticationError) {
          return new CortexError(LLM_AUTH_FAILED, "critical", "llm", "Anthropic API authentication failed. Check your API key.", void 0, "Verify CORTEX_ANTHROPIC_API_KEY is correct.", false, 401);
        }
        if (err instanceof Anthropic.RateLimitError) {
          return new CortexError(LLM_RATE_LIMITED, "medium", "llm", "Anthropic rate limit exceeded.", void 0, "Wait and retry with backoff.", true, 429);
        }
        if (err instanceof Anthropic.APIConnectionTimeoutError) {
          return new CortexError(LLM_TIMEOUT, "medium", "llm", "Anthropic API request timed out.", void 0, "Retry the request.", true, 504);
        }
        if (err instanceof Anthropic.APIError) {
          return new CortexError(LLM_PROVIDER_UNAVAILABLE, "high", "llm", `Anthropic API error: ${err.message}`, { status: err.status }, "Retry or check Anthropic status page.", true, err.status);
        }
        const message = err instanceof Error ? err.message : String(err);
        return new CortexError(LLM_PROVIDER_UNAVAILABLE, "high", "llm", `Anthropic provider error: ${message}`, void 0, "Check network connectivity.", true);
      }
    };
  }
});

// packages/llm/dist/providers/ollama.js
var logger4, OllamaProvider;
var init_ollama = __esm({
  "packages/llm/dist/providers/ollama.js"() {
    "use strict";
    init_dist();
    logger4 = createLogger("llm:ollama");
    OllamaProvider = class {
      name = "ollama";
      type = "local";
      host;
      model;
      embeddingModel;
      numCtx;
      numGpu;
      timeoutMs;
      keepAlive;
      capabilities = {
        supportedTasks: [
          LLMTask.ENTITY_EXTRACTION,
          LLMTask.RELATIONSHIP_INFERENCE,
          LLMTask.CONTRADICTION_DETECTION,
          LLMTask.CONVERSATIONAL_QUERY,
          LLMTask.CONTEXT_RANKING,
          LLMTask.EMBEDDING_GENERATION
        ],
        maxContextTokens: 8192,
        supportsStructuredOutput: true,
        supportsStreaming: true,
        estimatedTokensPerSecond: 30,
        costPerMillionInputTokens: 0,
        costPerMillionOutputTokens: 0
      };
      constructor(options = {}) {
        this.host = options.host ?? process.env["CORTEX_OLLAMA_HOST"] ?? "http://localhost:11434";
        this.model = options.model ?? "mistral:7b-instruct-q5_K_M";
        this.embeddingModel = options.embeddingModel ?? "nomic-embed-text";
        this.numCtx = options.numCtx ?? 8192;
        this.numGpu = options.numGpu ?? -1;
        this.timeoutMs = options.timeoutMs ?? 3e5;
        this.keepAlive = options.keepAlive ?? "5m";
        this.capabilities.maxContextTokens = this.numCtx;
      }
      getModel() {
        return this.model;
      }
      async complete(prompt, options) {
        const result = await this.completeWithSystem(void 0, prompt, options);
        return result.content;
      }
      async completeWithSystem(systemPrompt7, userPrompt, options, _modelPreference = "primary") {
        const numPredict = options?.maxTokens ? Math.min(options.maxTokens, Math.floor(this.numCtx / 2)) : void 0;
        const requestBody = {
          model: this.model,
          prompt: userPrompt,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.7,
            num_ctx: this.numCtx,
            num_gpu: this.numGpu,
            ...numPredict !== void 0 && { num_predict: numPredict },
            ...options?.stopSequences?.length && { stop: options.stopSequences }
          },
          keep_alive: this.keepAlive
        };
        if (systemPrompt7) {
          requestBody.system = systemPrompt7;
        }
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
          const response = await fetch(`${this.host}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API error (${response.status}): ${errorText}`);
          }
          const result = await response.json();
          const inputTokens = result.prompt_eval_count ?? 0;
          const outputTokens = result.eval_count ?? 0;
          logger4.debug("Ollama completion", {
            model: this.model,
            inputTokens,
            outputTokens,
            durationMs: result.total_duration ? Math.round(result.total_duration / 1e6) : void 0
          });
          return {
            content: result.response,
            inputTokens,
            outputTokens,
            model: this.model
          };
        } catch (err) {
          throw this.mapError(err);
        }
      }
      async completeStructured(prompt, _schema, options) {
        const result = await this.complete(prompt, options);
        return JSON.parse(result);
      }
      async *stream(prompt, options) {
        yield* this.streamWithSystem(void 0, prompt, options);
      }
      async *streamWithSystem(systemPrompt7, userPrompt, options, _modelPreference = "primary") {
        const streamNumPredict = options?.maxTokens ? Math.min(options.maxTokens, Math.floor(this.numCtx / 2)) : void 0;
        const requestBody = {
          model: this.model,
          prompt: userPrompt,
          stream: true,
          options: {
            temperature: options?.temperature ?? 0.7,
            num_ctx: this.numCtx,
            num_gpu: this.numGpu,
            ...streamNumPredict !== void 0 && { num_predict: streamNumPredict },
            ...options?.stopSequences?.length && { stop: options.stopSequences }
          },
          keep_alive: this.keepAlive
        };
        if (systemPrompt7) {
          requestBody.system = systemPrompt7;
        }
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
          const response = await fetch(`${this.host}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API error (${response.status}): ${errorText}`);
          }
          if (!response.body) {
            throw new Error("No response body from Ollama");
          }
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let inputTokens = 0;
          let outputTokens = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done)
              break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter((line) => line.trim());
            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                if (data.response) {
                  yield data.response;
                }
                if (data.done) {
                  inputTokens = data.prompt_eval_count ?? 0;
                  outputTokens = data.eval_count ?? 0;
                }
              } catch {
              }
            }
          }
          return {
            inputTokens,
            outputTokens,
            model: this.model
          };
        } catch (err) {
          throw this.mapError(err);
        }
      }
      async embed(texts) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
          const requestBody = {
            model: this.embeddingModel,
            input: texts
          };
          const response = await fetch(`${this.host}/api/embed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama embed API error (${response.status}): ${errorText}`);
          }
          const result = await response.json();
          logger4.debug("Ollama embeddings", {
            model: this.embeddingModel,
            count: texts.length,
            dimensions: result.embeddings[0]?.length
          });
          return result.embeddings.map((emb) => new Float32Array(emb));
        } catch (err) {
          throw this.mapError(err);
        }
      }
      async isAvailable() {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5e3);
          const response = await fetch(`${this.host}/api/tags`, {
            method: "GET",
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            return false;
          }
          const result = await response.json();
          const hasModel = result.models.some((m) => m.name === this.model || m.model === this.model);
          if (!hasModel) {
            logger4.warn("Ollama model not found", { model: this.model, available: result.models.map((m) => m.name) });
          }
          return true;
        } catch {
          return false;
        }
      }
      async ensureModel() {
        const available = await this.isAvailable();
        if (!available) {
          throw new CortexError(LLM_PROVIDER_UNAVAILABLE, "high", "llm", `Ollama is not running or not reachable at ${this.host}`, void 0, "Start Ollama with `ollama serve` or check the host configuration.", false);
        }
        const response = await fetch(`${this.host}/api/tags`);
        const result = await response.json();
        const hasModel = result.models.some((m) => m.name === this.model || m.model === this.model);
        if (!hasModel) {
          logger4.info("Pulling Ollama model", { model: this.model });
          throw new CortexError(LLM_PROVIDER_UNAVAILABLE, "high", "llm", `Ollama model "${this.model}" is not installed.`, { model: this.model }, `Run: ollama pull ${this.model}`, false);
        }
      }
      async listModels() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5e3);
        try {
          const response = await fetch(`${this.host}/api/tags`, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!response.ok)
            return [];
          const result = await response.json();
          return result.models.map((m) => ({ name: m.name, sizeBytes: m.size, modifiedAt: m.modified_at }));
        } catch {
          clearTimeout(timeoutId);
          return [];
        }
      }
      getHost() {
        return this.host;
      }
      getNumCtx() {
        return this.numCtx;
      }
      getNumGpu() {
        return this.numGpu;
      }
      getEmbeddingModel() {
        return this.embeddingModel;
      }
      mapError(err) {
        if (err instanceof CortexError) {
          return err;
        }
        if (err instanceof Error) {
          if (err.name === "AbortError") {
            return new CortexError(LLM_TIMEOUT, "medium", "llm", `Ollama request timed out after ${this.timeoutMs}ms`, { timeoutMs: this.timeoutMs }, "Increase timeout or check if model is loaded.", true, 504);
          }
          if (err.message.includes("ECONNREFUSED") || err.message.includes("fetch failed")) {
            return new CortexError(LLM_PROVIDER_UNAVAILABLE, "high", "llm", `Cannot connect to Ollama at ${this.host}`, { host: this.host }, "Start Ollama with `ollama serve` or check the host configuration.", false);
          }
          return new CortexError(LLM_PROVIDER_UNAVAILABLE, "high", "llm", `Ollama provider error: ${err.message}`, void 0, "Check Ollama logs for details.", true);
        }
        return new CortexError(LLM_PROVIDER_UNAVAILABLE, "high", "llm", `Ollama provider error: ${String(err)}`, void 0, "Check Ollama logs for details.", true);
      }
    };
  }
});

// packages/llm/dist/providers/openai-compatible.js
import OpenAI from "openai";
var logger5, OpenAICompatibleProvider;
var init_openai_compatible = __esm({
  "packages/llm/dist/providers/openai-compatible.js"() {
    "use strict";
    init_dist();
    logger5 = createLogger("llm:openai-compatible");
    OpenAICompatibleProvider = class {
      name = "openai-compatible";
      type = "cloud";
      client;
      primaryModel;
      fastModel;
      isGemini;
      capabilities = {
        supportedTasks: [
          LLMTask.ENTITY_EXTRACTION,
          LLMTask.RELATIONSHIP_INFERENCE,
          LLMTask.CONTRADICTION_DETECTION,
          LLMTask.CONVERSATIONAL_QUERY,
          LLMTask.CONTEXT_RANKING
        ],
        maxContextTokens: 128e3,
        supportsStructuredOutput: true,
        supportsStreaming: true,
        estimatedTokensPerSecond: 80,
        // Set to 0 — pricing varies by provider; budget tracking is approximate
        costPerMillionInputTokens: 0,
        costPerMillionOutputTokens: 0
      };
      constructor(options) {
        if (!options.apiKey) {
          throw new CortexError(LLM_AUTH_FAILED, "critical", "llm", "OpenAI-compatible API key not found. Check llm.cloud.apiKeySource in your config.", void 0, "Set the environment variable specified in llm.cloud.apiKeySource.", false, 401);
        }
        this.client = new OpenAI({
          apiKey: options.apiKey,
          baseURL: options.baseUrl,
          timeout: options.timeoutMs ?? 6e4,
          maxRetries: options.maxRetries ?? 3
        });
        this.primaryModel = options.primaryModel ?? "gpt-4o";
        this.fastModel = options.fastModel ?? "gpt-4o-mini";
        this.isGemini = options.baseUrl.includes("generativelanguage.googleapis.com");
        logger5.info("OpenAI-compatible provider initialized", {
          baseUrl: options.baseUrl,
          primaryModel: this.primaryModel,
          fastModel: this.fastModel
        });
      }
      getModel(preference = "primary") {
        return preference === "fast" ? this.fastModel : this.primaryModel;
      }
      /** Gemini uses max_completion_tokens; others use max_tokens */
      tokenLimitParams(maxTokens) {
        return this.isGemini ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens };
      }
      async complete(prompt, options) {
        const result = await this.completeWithSystem(void 0, prompt, options);
        return result.content;
      }
      async completeWithSystem(systemPrompt7, userPrompt, options, modelPreference = "primary") {
        const model = this.getModel(modelPreference);
        try {
          const messages = [];
          if (systemPrompt7) {
            messages.push({ role: "system", content: systemPrompt7 });
          }
          messages.push({ role: "user", content: userPrompt });
          const response = await this.client.chat.completions.create({
            model,
            ...this.tokenLimitParams(options?.maxTokens ?? 4096),
            temperature: options?.temperature ?? 0.7,
            messages,
            ...options?.stopSequences?.length && { stop: options.stopSequences }
          });
          const content = response.choices[0]?.message?.content ?? "";
          return {
            content,
            inputTokens: response.usage?.prompt_tokens ?? 0,
            outputTokens: response.usage?.completion_tokens ?? 0,
            model
          };
        } catch (err) {
          throw this.mapError(err);
        }
      }
      async completeStructured(prompt, _schema, options) {
        const result = await this.complete(prompt, options);
        return JSON.parse(result);
      }
      async *stream(prompt, options) {
        yield* this.streamWithSystem(void 0, prompt, options);
      }
      async *streamWithSystem(systemPrompt7, userPrompt, options, modelPreference = "primary") {
        const model = this.getModel(modelPreference);
        try {
          const messages = [];
          if (systemPrompt7) {
            messages.push({ role: "system", content: systemPrompt7 });
          }
          messages.push({ role: "user", content: userPrompt });
          const stream = await this.client.chat.completions.create({
            model,
            ...this.tokenLimitParams(options?.maxTokens ?? 4096),
            temperature: options?.temperature ?? 0.7,
            messages,
            stream: true,
            stream_options: { include_usage: true },
            ...options?.stopSequences?.length && { stop: options.stopSequences }
          });
          let inputTokens = 0;
          let outputTokens = 0;
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              yield delta;
            }
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens;
              outputTokens = chunk.usage.completion_tokens;
            }
          }
          return { inputTokens, outputTokens, model };
        } catch (err) {
          throw this.mapError(err);
        }
      }
      async embed(_texts) {
        throw new CortexError(LLM_PROVIDER_UNAVAILABLE, "medium", "llm", "OpenAI-compatible provider does not handle embeddings. Use local embedding model.");
      }
      async isAvailable() {
        try {
          await this.client.chat.completions.create({
            model: this.fastModel,
            ...this.tokenLimitParams(1),
            messages: [{ role: "user", content: "ping" }]
          });
          return true;
        } catch {
          return false;
        }
      }
      mapError(err) {
        if (err instanceof OpenAI.AuthenticationError) {
          return new CortexError(LLM_AUTH_FAILED, "critical", "llm", "OpenAI-compatible API authentication failed. Check your API key.", void 0, "Verify the environment variable in llm.cloud.apiKeySource is correct.", false, 401);
        }
        if (err instanceof OpenAI.RateLimitError) {
          return new CortexError(LLM_RATE_LIMITED, "medium", "llm", "OpenAI-compatible API rate limit exceeded.", void 0, "Wait and retry with backoff.", true, 429);
        }
        if (err instanceof OpenAI.APIConnectionTimeoutError) {
          return new CortexError(LLM_TIMEOUT, "medium", "llm", "OpenAI-compatible API request timed out.", void 0, "Retry the request or increase llm.cloud.timeoutMs.", true, 504);
        }
        if (err instanceof OpenAI.APIError) {
          const body = typeof err.error === "object" ? JSON.stringify(err.error) : String(err.error ?? "");
          logger5.debug("API error details", { status: err.status, body, headers: err.headers });
          return new CortexError(LLM_PROVIDER_UNAVAILABLE, "high", "llm", `OpenAI-compatible API error: ${err.status} ${err.message}${body ? ` \u2014 ${body}` : ""}`, { status: err.status }, "Retry or check your provider status page.", true, err.status);
        }
        const message = err instanceof Error ? err.message : String(err);
        return new CortexError(LLM_PROVIDER_UNAVAILABLE, "high", "llm", `OpenAI-compatible provider error: ${message}`, void 0, "Check network connectivity and llm.cloud.baseUrl configuration.", true);
      }
    };
  }
});

// packages/llm/dist/token-tracker.js
function estimateCost(model, inputTokens, outputTokens) {
  const costs = MODEL_COSTS[model] ?? DEFAULT_COST;
  return inputTokens / 1e6 * costs.input + outputTokens / 1e6 * costs.output;
}
var logger6, MODEL_COSTS, DEFAULT_COST, TokenTracker;
var init_token_tracker = __esm({
  "packages/llm/dist/token-tracker.js"() {
    "use strict";
    init_dist();
    logger6 = createLogger("llm:token-tracker");
    MODEL_COSTS = {
      "claude-sonnet-4-5-20250929": { input: 3, output: 15 },
      "claude-haiku-4-5-20251001": { input: 0.8, output: 4 }
    };
    DEFAULT_COST = { input: 3, output: 15 };
    TokenTracker = class {
      records = [];
      monthlyBudgetUsd;
      warningThresholds;
      warningsFired = /* @__PURE__ */ new Set();
      constructor(monthlyBudgetUsd = 25, warningThresholds = [0.5, 0.8, 0.9]) {
        this.monthlyBudgetUsd = monthlyBudgetUsd;
        this.warningThresholds = warningThresholds;
      }
      record(requestId, task, provider, model, inputTokens, outputTokens, latencyMs) {
        const costUsd = estimateCost(model, inputTokens, outputTokens);
        const record = {
          id: crypto.randomUUID(),
          requestId,
          task,
          provider,
          model,
          inputTokens,
          outputTokens,
          estimatedCostUsd: costUsd,
          latencyMs,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
        this.records.push(record);
        this.checkBudget();
        return record;
      }
      checkBudget() {
        const spent = this.getCurrentMonthSpend();
        const usedPercent = this.monthlyBudgetUsd > 0 ? spent / this.monthlyBudgetUsd : 0;
        const ts = (/* @__PURE__ */ new Date()).toISOString();
        for (const threshold of this.warningThresholds) {
          if (usedPercent >= threshold && !this.warningsFired.has(threshold)) {
            this.warningsFired.add(threshold);
            const remaining = this.monthlyBudgetUsd - spent;
            logger6.warn(`Budget warning: ${(usedPercent * 100).toFixed(1)}% used`, {
              spent,
              budget: this.monthlyBudgetUsd,
              remaining
            });
            eventBus.emit({
              type: "budget.warning",
              payload: { usedPercent: Math.round(usedPercent * 100), remainingUsd: remaining },
              timestamp: ts,
              source: "llm:token-tracker"
            });
          }
        }
        if (this.monthlyBudgetUsd > 0 && usedPercent >= 1 && !this.warningsFired.has(1)) {
          this.warningsFired.add(1);
          logger6.warn("Budget exhausted", { spent, budget: this.monthlyBudgetUsd });
          eventBus.emit({
            type: "budget.exhausted",
            payload: { totalSpentUsd: spent },
            timestamp: ts,
            source: "llm:token-tracker"
          });
        }
      }
      getCurrentMonthSpend() {
        const currentMonth = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
        return this.records.filter((r) => r.timestamp.startsWith(currentMonth)).reduce((sum, r) => sum + r.estimatedCostUsd, 0);
      }
      isBudgetExhausted() {
        return this.getCurrentMonthSpend() >= this.monthlyBudgetUsd;
      }
      getBudgetRemaining() {
        return Math.max(0, this.monthlyBudgetUsd - this.getCurrentMonthSpend());
      }
      getRecords() {
        return [...this.records];
      }
      getSummary() {
        const currentMonth = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
        const monthRecords = this.records.filter((r) => r.timestamp.startsWith(currentMonth));
        const costByTask = {};
        const costByProvider = {};
        let totalInput = 0;
        let totalOutput = 0;
        let totalCost = 0;
        for (const r of monthRecords) {
          totalInput += r.inputTokens;
          totalOutput += r.outputTokens;
          totalCost += r.estimatedCostUsd;
          costByTask[r.task] = (costByTask[r.task] ?? 0) + r.estimatedCostUsd;
          costByProvider[r.provider] = (costByProvider[r.provider] ?? 0) + r.estimatedCostUsd;
        }
        return {
          totalCostUsd: totalCost,
          totalInputTokens: totalInput,
          totalOutputTokens: totalOutput,
          requestCount: monthRecords.length,
          costByTask,
          costByProvider
        };
      }
    };
  }
});

// packages/llm/dist/cache.js
import { createHash } from "node:crypto";
var logger7, ResponseCache;
var init_cache = __esm({
  "packages/llm/dist/cache.js"() {
    "use strict";
    init_dist();
    logger7 = createLogger("llm:cache");
    ResponseCache = class {
      cache = /* @__PURE__ */ new Map();
      enabled;
      ttlMs;
      maxEntries;
      constructor(options = {}) {
        this.enabled = options.enabled ?? true;
        this.ttlMs = options.ttlMs ?? 7 * 24 * 60 * 60 * 1e3;
        this.maxEntries = options.maxEntries ?? 1e4;
      }
      buildKey(contentHash, promptId, promptVersion) {
        return createHash("sha256").update(`${contentHash}:${promptId}:${promptVersion}`).digest("hex");
      }
      get(contentHash, promptId, promptVersion) {
        if (!this.enabled)
          return null;
        const key = this.buildKey(contentHash, promptId, promptVersion);
        const entry = this.cache.get(key);
        if (!entry)
          return null;
        if (Date.now() - entry.createdAt > this.ttlMs) {
          this.cache.delete(key);
          return null;
        }
        logger7.debug("Cache hit", { promptId, promptVersion });
        return entry;
      }
      set(contentHash, promptId, promptVersion, response, model, inputTokens, outputTokens) {
        if (!this.enabled)
          return;
        if (this.cache.size >= this.maxEntries) {
          const oldest = [...this.cache.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
          if (oldest) {
            this.cache.delete(oldest[0]);
          }
        }
        const key = this.buildKey(contentHash, promptId, promptVersion);
        this.cache.set(key, {
          response,
          model,
          inputTokens,
          outputTokens,
          createdAt: Date.now()
        });
      }
      clear() {
        this.cache.clear();
      }
      get size() {
        return this.cache.size;
      }
    };
  }
});

// packages/llm/dist/output-parser.js
function extractJson(raw) {
  let cleaned = raw.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
  const startIdx = findJsonStart(cleaned);
  if (startIdx === -1) {
    throw new Error("No JSON found in response");
  }
  const openChar = cleaned[startIdx];
  const closeChar = openChar === "{" ? "}" : "]";
  const endIdx = findMatchingClose(cleaned, startIdx, openChar, closeChar);
  if (endIdx === -1) {
    const repaired = repairTruncatedJson(cleaned.slice(startIdx));
    if (repaired)
      return repaired;
    throw new Error("Unterminated JSON in response");
  }
  cleaned = cleaned.slice(startIdx, endIdx + 1);
  return cleaned;
}
function repairTruncatedJson(truncated) {
  let lastGoodIdx = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  const openStack = [];
  for (let i = 0; i < truncated.length; i++) {
    const ch = truncated[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString)
      continue;
    if (ch === "{" || ch === "[") {
      openStack.push(ch);
      depth++;
    } else if (ch === "}" || ch === "]") {
      openStack.pop();
      depth--;
      if (depth >= 1)
        lastGoodIdx = i;
    } else if (ch === "," && depth >= 1) {
      lastGoodIdx = i - 1;
    }
  }
  if (lastGoodIdx <= 0)
    return null;
  let repaired = truncated.slice(0, lastGoodIdx + 1).trimEnd();
  if (repaired.endsWith(","))
    repaired = repaired.slice(0, -1);
  const remaining = [];
  inString = false;
  escaped = false;
  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString)
      continue;
    if (ch === "{")
      remaining.push("}");
    else if (ch === "[")
      remaining.push("]");
    else if (ch === "}" || ch === "]")
      remaining.pop();
  }
  repaired += remaining.reverse().join("");
  try {
    JSON.parse(repaired);
    return repaired;
  } catch {
    return null;
  }
}
function findJsonStart(s) {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{" || s[i] === "[")
      return i;
  }
  return -1;
}
function findMatchingClose(s, start, open, close) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString)
      continue;
    if (ch === open)
      depth++;
    if (ch === close) {
      depth--;
      if (depth === 0)
        return i;
    }
  }
  return -1;
}
function parseStructuredOutput(raw, schema) {
  const jsonStr = extractJson(raw);
  let parsed = JSON.parse(jsonStr);
  if (Array.isArray(parsed)) {
    parsed = inferObjectWrapper(parsed, schema);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new CortexError(LLM_EXTRACTION_FAILED, "medium", "llm", `Schema validation failed: ${issues}`, { raw: raw.slice(0, 500), issues: result.error.issues }, "Retry with correction prompt", true);
  }
  return result.data;
}
function inferObjectWrapper(arr, schema) {
  const def = schema._def;
  if (def?.typeName === "ZodObject" && typeof def.shape === "function") {
    const shape = def.shape();
    for (const [key, fieldSchema] of Object.entries(shape)) {
      const fieldDef = fieldSchema._def;
      if (fieldDef?.typeName === "ZodArray") {
        return { [key]: arr };
      }
    }
  }
  return { entities: arr };
}
function buildCorrectionPrompt(originalPrompt, failedOutput, error) {
  return `${originalPrompt}

Your previous response was invalid JSON or didn't match the schema.

Previous response (DO NOT repeat this):
${failedOutput.slice(0, 500)}

Error: ${error}

Please return ONLY valid JSON matching the required schema. No explanation.`;
}
var init_output_parser = __esm({
  "packages/llm/dist/output-parser.js"() {
    "use strict";
    init_dist();
  }
});

// packages/llm/dist/router.js
function resolveApiKeySource(source) {
  if (source.startsWith("env:")) {
    return process.env[source.slice(4)];
  }
  return void 0;
}
var logger8, Router;
var init_router = __esm({
  "packages/llm/dist/router.js"() {
    "use strict";
    init_dist();
    init_anthropic();
    init_ollama();
    init_openai_compatible();
    init_token_tracker();
    init_cache();
    init_output_parser();
    logger8 = createLogger("llm:router");
    Router = class {
      cloudProvider = null;
      localProvider = null;
      mode;
      taskRouting;
      tracker;
      cache;
      config;
      constructor(options) {
        const { config: config8 } = options;
        this.config = config8;
        this.mode = config8.llm.mode;
        this.taskRouting = config8.llm.taskRouting;
        if (this.mode !== "local-only") {
          try {
            if (config8.llm.cloud.provider === "openai-compatible") {
              const baseUrl = config8.llm.cloud.baseUrl;
              if (!baseUrl) {
                logger8.warn("openai-compatible provider requires llm.cloud.baseUrl \u2014 skipping cloud");
              } else {
                this.cloudProvider = new OpenAICompatibleProvider({
                  baseUrl,
                  apiKey: options.apiKey ?? resolveApiKeySource(config8.llm.cloud.apiKeySource),
                  primaryModel: config8.llm.cloud.models.primary,
                  fastModel: config8.llm.cloud.models.fast,
                  timeoutMs: config8.llm.cloud.timeoutMs,
                  maxRetries: config8.llm.cloud.maxRetries
                });
              }
            } else {
              this.cloudProvider = new AnthropicProvider({
                apiKey: options.apiKey,
                primaryModel: config8.llm.cloud.models.primary,
                fastModel: config8.llm.cloud.models.fast,
                timeoutMs: config8.llm.cloud.timeoutMs,
                maxRetries: config8.llm.cloud.maxRetries,
                promptCaching: config8.llm.cloud.promptCaching
              });
            }
          } catch (err) {
            if (this.mode === "cloud-first") {
              throw err;
            }
            logger8.warn("Cloud provider unavailable, falling back to local-only", {
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }
        if (this.mode !== "cloud-first" || !this.cloudProvider) {
          this.localProvider = new OllamaProvider({
            host: config8.llm.local.host,
            model: config8.llm.local.model,
            embeddingModel: config8.llm.local.embeddingModel,
            numCtx: config8.llm.local.numCtx,
            numGpu: config8.llm.local.numGpu,
            timeoutMs: config8.llm.local.timeoutMs,
            keepAlive: config8.llm.local.keepAlive
          });
        }
        this.tracker = new TokenTracker(config8.llm.budget.monthlyLimitUsd, config8.llm.budget.warningThresholds);
        this.cache = new ResponseCache({
          enabled: config8.llm.cache.enabled,
          ttlMs: config8.llm.cache.ttlDays * 24 * 60 * 60 * 1e3
        });
        logger8.info("Router initialized", {
          mode: this.mode,
          hasCloud: !!this.cloudProvider,
          hasLocal: !!this.localProvider
        });
      }
      /**
       * Select provider based on mode, task routing, and availability
       */
      async selectProvider(task, forceProvider) {
        const cloudName = () => this.cloudProvider?.name ?? "anthropic";
        if (forceProvider === "cloud") {
          if (!this.cloudProvider) {
            throw new CortexError(LLM_PROVIDER_UNAVAILABLE, "high", "llm", "Cloud provider requested but not available.", { mode: this.mode }, "Set your cloud API key or change LLM mode.", false);
          }
          return { provider: this.cloudProvider, name: cloudName() };
        }
        if (forceProvider === "local") {
          if (!this.localProvider) {
            throw new CortexError(LLM_PROVIDER_UNAVAILABLE, "high", "llm", "Local provider requested but not configured.", { mode: this.mode }, "Change LLM mode to include local provider.", false);
          }
          return { provider: this.localProvider, name: "ollama" };
        }
        const taskRoute = this.taskRouting[task] ?? "auto";
        if (taskRoute === "cloud" && this.cloudProvider) {
          return { provider: this.cloudProvider, name: cloudName() };
        }
        if (taskRoute === "local" && this.localProvider) {
          return { provider: this.localProvider, name: "ollama" };
        }
        switch (this.mode) {
          case "local-only":
            if (!this.localProvider) {
              throw new CortexError(LLM_PROVIDER_UNAVAILABLE, "high", "llm", "Local-only mode but Ollama provider not available.", void 0, "Ensure Ollama is running with `ollama serve`.", false);
            }
            return { provider: this.localProvider, name: "ollama" };
          case "local-first":
            if (this.localProvider && await this.localProvider.isAvailable()) {
              return { provider: this.localProvider, name: "ollama" };
            }
            if (this.cloudProvider) {
              logger8.info("Local provider unavailable, falling back to cloud");
              return { provider: this.cloudProvider, name: cloudName() };
            }
            throw new CortexError(LLM_PROVIDER_UNAVAILABLE, "high", "llm", "No LLM provider available.", { mode: this.mode }, "Start Ollama or configure cloud API key.", false);
          case "hybrid":
            const cheapTasks = [
              LLMTask.ENTITY_EXTRACTION,
              LLMTask.CONTEXT_RANKING,
              LLMTask.EMBEDDING_GENERATION
            ];
            if (cheapTasks.includes(task) && this.localProvider && await this.localProvider.isAvailable()) {
              logger8.debug("Hybrid routing to local provider", { task });
              return { provider: this.localProvider, name: "ollama" };
            }
            if (this.cloudProvider) {
              logger8.debug("Hybrid routing to cloud provider", { task });
              return { provider: this.cloudProvider, name: cloudName() };
            }
            if (this.localProvider) {
              logger8.warn("Cloud provider unavailable in hybrid mode, falling back to local", { task });
              return { provider: this.localProvider, name: "ollama" };
            }
            throw new CortexError(LLM_PROVIDER_UNAVAILABLE, "high", "llm", "No LLM provider available.", { mode: this.mode }, "Configure cloud API key or start Ollama.", false);
          case "cloud-first":
          default:
            if (this.cloudProvider && !this.tracker.isBudgetExhausted()) {
              return { provider: this.cloudProvider, name: cloudName() };
            }
            if (this.localProvider && this.config.llm.budget.enforcementAction === "fallback-local") {
              logger8.info("Budget exhausted or cloud unavailable, falling back to local");
              return { provider: this.localProvider, name: "ollama" };
            }
            if (!this.cloudProvider) {
              throw new CortexError(LLM_PROVIDER_UNAVAILABLE, "high", "llm", "Cloud provider not available.", { mode: this.mode }, "Set your cloud API key or change LLM mode.", false);
            }
            throw new CortexError(LLM_BUDGET_EXHAUSTED, "high", "llm", "Monthly budget exhausted.", { spent: this.tracker.getCurrentMonthSpend() }, "Increase budget, wait for next month, or enable local fallback.", false, 402);
        }
      }
      // Keep legacy provider getter for backward compatibility
      get provider() {
        return this.cloudProvider ?? this.localProvider;
      }
      async complete(request) {
        const { provider, name: providerName } = await this.selectProvider(request.task, request.forceProvider);
        if (request.contentHash) {
          const cached = this.cache.get(request.contentHash, request.promptId, request.promptVersion);
          if (cached) {
            return {
              content: cached.response,
              model: cached.model,
              inputTokens: cached.inputTokens,
              outputTokens: cached.outputTokens,
              cached: true,
              latencyMs: 0,
              costUsd: 0,
              provider: providerName
            };
          }
        }
        const requestId = crypto.randomUUID();
        eventBus.emit({
          type: "llm.request.start",
          payload: { requestId, task: request.task, provider: providerName },
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          source: "llm:router"
        });
        const startMs = performance.now();
        const result = await provider.completeWithSystem(request.systemPrompt, request.userPrompt, {
          temperature: request.temperature,
          maxTokens: request.maxTokens
        }, request.modelPreference ?? "primary");
        const latencyMs = Math.round(performance.now() - startMs);
        const usageRecord = this.tracker.record(requestId, request.task, providerName, result.model, result.inputTokens, result.outputTokens, latencyMs);
        if (request.contentHash) {
          this.cache.set(request.contentHash, request.promptId, request.promptVersion, result.content, result.model, result.inputTokens, result.outputTokens);
        }
        eventBus.emit({
          type: "llm.request.complete",
          payload: {
            requestId,
            task: request.task,
            provider: providerName,
            model: result.model,
            usage: {
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              estimatedCostUsd: usageRecord.estimatedCostUsd
            },
            latencyMs
          },
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          source: "llm:router"
        });
        return {
          content: result.content,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          cached: false,
          latencyMs,
          costUsd: usageRecord.estimatedCostUsd,
          provider: providerName
        };
      }
      async completeStructured(request, schema) {
        const result = await this.complete(request);
        try {
          const data = parseStructuredOutput(result.content, schema);
          if (this.mode === "local-first" && result.provider === "ollama" && this.cloudProvider && !request.forceProvider) {
            const entities = data.entities;
            if (Array.isArray(entities) && entities.length > 0) {
              const confidences = entities.map((e) => typeof e.confidence === "number" ? e.confidence : null).filter((c) => c !== null).sort((a, b) => a - b);
              if (confidences.length > 0) {
                const mid = Math.floor(confidences.length / 2);
                const median = confidences.length % 2 !== 0 ? confidences[mid] : (confidences[mid - 1] + confidences[mid]) / 2;
                if (median < 0.6) {
                  logger8.info("Local confidence below threshold, escalating to cloud", {
                    median: Math.round(median * 100) / 100,
                    task: request.task
                  });
                  const cloudResult = await this.complete({ ...request, forceProvider: "cloud", contentHash: void 0 });
                  const cloudData = parseStructuredOutput(cloudResult.content, schema);
                  return { ...cloudResult, data: cloudData };
                }
              }
            }
          }
          return { ...result, data };
        } catch (firstErr) {
          logger8.warn("Structured output parse failed, retrying with correction", {
            promptId: request.promptId,
            error: firstErr instanceof Error ? firstErr.message : String(firstErr)
          });
          const correctedPrompt = buildCorrectionPrompt(request.userPrompt, result.content, firstErr instanceof Error ? firstErr.message : String(firstErr));
          const retryResult = await this.complete({
            ...request,
            userPrompt: correctedPrompt,
            contentHash: void 0
            // Don't cache correction attempts
          });
          const data = parseStructuredOutput(retryResult.content, schema);
          return { ...retryResult, data };
        }
      }
      async *stream(request) {
        const { provider, name: providerName } = await this.selectProvider(request.task, request.forceProvider);
        const requestId = crypto.randomUUID();
        eventBus.emit({
          type: "llm.request.start",
          payload: { requestId, task: request.task, provider: providerName },
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          source: "llm:router"
        });
        const startMs = performance.now();
        let fullContent = "";
        const gen = provider.streamWithSystem(request.systemPrompt, request.userPrompt, {
          temperature: request.temperature,
          maxTokens: request.maxTokens
        }, request.modelPreference ?? "primary");
        let streamResult;
        while (true) {
          const { value, done } = await gen.next();
          if (done) {
            streamResult = value;
            break;
          }
          fullContent += value;
          yield value;
        }
        const latencyMs = Math.round(performance.now() - startMs);
        const tokens = streamResult ?? { inputTokens: 0, outputTokens: 0, model: provider.getModel() };
        const usageRecord = this.tracker.record(requestId, request.task, providerName, tokens.model, tokens.inputTokens, tokens.outputTokens, latencyMs);
        eventBus.emit({
          type: "llm.request.complete",
          payload: {
            requestId,
            task: request.task,
            provider: providerName,
            model: tokens.model,
            usage: {
              inputTokens: tokens.inputTokens,
              outputTokens: tokens.outputTokens,
              estimatedCostUsd: usageRecord.estimatedCostUsd
            },
            latencyMs
          },
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          source: "llm:router"
        });
        return {
          content: fullContent,
          model: tokens.model,
          inputTokens: tokens.inputTokens,
          outputTokens: tokens.outputTokens,
          cached: false,
          latencyMs,
          costUsd: usageRecord.estimatedCostUsd,
          provider: providerName
        };
      }
      getTracker() {
        return this.tracker;
      }
      getCache() {
        return this.cache;
      }
      getLocalProvider() {
        return this.localProvider;
      }
      getCloudProvider() {
        return this.cloudProvider;
      }
      getMode() {
        return this.mode;
      }
      async isAvailable() {
        switch (this.mode) {
          case "local-only":
            return this.localProvider?.isAvailable() ?? false;
          case "cloud-first":
            return this.cloudProvider?.isAvailable() ?? false;
          default:
            const localAvailable = await this.localProvider?.isAvailable() ?? false;
            const cloudAvailable = await this.cloudProvider?.isAvailable() ?? false;
            return localAvailable || cloudAvailable;
        }
      }
    };
  }
});

// packages/llm/dist/prompts/entity-extraction.js
var entity_extraction_exports = {};
__export(entity_extraction_exports, {
  PROMPT_ID: () => PROMPT_ID,
  PROMPT_VERSION: () => PROMPT_VERSION,
  buildUserPrompt: () => buildUserPrompt,
  config: () => config,
  outputSchema: () => outputSchema,
  systemPrompt: () => systemPrompt
});
import { z as z3 } from "zod";
function buildUserPrompt(vars) {
  return `Extract entities from this content.
File: ${vars.filePath}
Project: ${vars.projectName}
File type: ${vars.fileType}

---CONTENT START---
${vars.content}
---CONTENT END---

Return a JSON object with an "entities" array (maximum 20 entities per response). For each entity:
- type: one of Decision, Requirement, Pattern, Component, Dependency, Interface, Constraint, ActionItem, Risk, Note
- name: concise identifier (3-8 words)
- content: the relevant text from the source (minimum 10 characters)
- summary: 1-2 sentence summary
- confidence: 0.0-1.0 (how confident you are this is a real entity)
- tags: relevant keywords
- properties: type-specific metadata (e.g., for Decision: {rationale, alternatives, date})

IMPORTANT: Focus on high-value entities only. For dependency lists (package.json, requirements.txt, go.mod), extract only the primary infrastructure/framework dependencies (e.g., the database driver, the main framework, the auth library) \u2014 NOT every single package. Group trivial dev tools into a single Note entity if needed.

Example format: {"entities": [{"type": "Decision", "name": "Use PostgreSQL", "content": "We decided to use PostgreSQL for the main database", "summary": "Team chose PostgreSQL.", "confidence": 0.9, "tags": ["database"], "properties": {}}]}

If no meaningful entities exist, return: {"entities": []}`;
}
function coerceEntityType(val) {
  if (VALID_TYPES.includes(val)) {
    return val;
  }
  if (/rule|lint|option|setting|config/i.test(val))
    return "Constraint";
  if (/action|task|todo/i.test(val))
    return "ActionItem";
  if (/component|module|class|service/i.test(val))
    return "Component";
  if (/depend|import|library|package/i.test(val))
    return "Dependency";
  if (/require|must|shall|need/i.test(val))
    return "Requirement";
  return "Note";
}
var PROMPT_ID, PROMPT_VERSION, systemPrompt, VALID_TYPES, outputSchema, config;
var init_entity_extraction = __esm({
  "packages/llm/dist/prompts/entity-extraction.js"() {
    "use strict";
    init_dist();
    PROMPT_ID = "entity_extraction";
    PROMPT_VERSION = "1.0.0";
    systemPrompt = `You are a knowledge extraction engine for a software development context.
Extract structured entities from the provided content. Each entity represents
a discrete piece of knowledge: a decision made, a requirement stated, a pattern
used, a component described, a dependency identified, an interface defined, a
constraint established, an action item assigned, a risk identified, or a note
recorded.

Return ONLY valid JSON matching the provided schema. No markdown, no explanation.`;
    VALID_TYPES = [
      "Decision",
      "Requirement",
      "Pattern",
      "Component",
      "Dependency",
      "Interface",
      "Constraint",
      "ActionItem",
      "Risk",
      "Note"
    ];
    outputSchema = z3.object({
      entities: z3.array(z3.object({
        type: z3.enum(VALID_TYPES).catch((ctx) => coerceEntityType(String(ctx.input))),
        name: z3.string().min(3).max(100),
        content: z3.string().min(10),
        summary: z3.string().max(300),
        confidence: z3.number().min(0).max(1),
        tags: z3.array(z3.string()),
        properties: z3.record(z3.unknown())
      }))
    });
    config = {
      provider: "cloud",
      model: "fast",
      temperature: 0.1,
      maxTokens: 8192,
      task: LLMTask.ENTITY_EXTRACTION
    };
  }
});

// packages/llm/dist/prompts/relationship-inference.js
var relationship_inference_exports = {};
__export(relationship_inference_exports, {
  PROMPT_ID: () => PROMPT_ID2,
  PROMPT_VERSION: () => PROMPT_VERSION2,
  buildUserPrompt: () => buildUserPrompt2,
  config: () => config2,
  outputSchema: () => outputSchema2,
  systemPrompt: () => systemPrompt2
});
import { z as z4 } from "zod";
function buildUserPrompt2(vars) {
  const entityList = vars.entities.map((e) => `[${e.id}] ${e.type}: ${e.name}
  Summary: ${e.summary ?? "N/A"}
  Source: ${e.sourceFile}`).join("\n\n");
  return `Identify relationships between these entities.

ENTITIES:
${entityList}

For each relationship found:
- type: one of the valid relationship types
- sourceEntityId: the ID of the "from" entity
- targetEntityId: the ID of the "to" entity
- description: why this relationship exists (1 sentence)
- confidence: 0.0-1.0

Respond with ONLY this JSON structure:
{"relationships": [{"type": "...", "sourceEntityId": "...", "targetEntityId": "...", "description": "...", "confidence": 0.9}]}

If no relationships exist, respond: {"relationships": []}`;
}
var PROMPT_ID2, PROMPT_VERSION2, systemPrompt2, outputSchema2, config2;
var init_relationship_inference = __esm({
  "packages/llm/dist/prompts/relationship-inference.js"() {
    "use strict";
    init_dist();
    PROMPT_ID2 = "relationship_inference";
    PROMPT_VERSION2 = "1.0.0";
    systemPrompt2 = `You are a knowledge graph relationship engine. Given a set of entities, identify
meaningful relationships between them. Relationships must be factual and
grounded in the content, not speculative.

Valid relationship types:
- depends_on: A requires B to function
- implements: A is an implementation of B
- contradicts: A conflicts with B
- evolved_from: A is a newer version/evolution of B
- relates_to: A and B are connected (general)
- uses: A uses/consumes B
- constrains: A places limits on B
- resolves: A addresses/solves B
- documents: A describes/documents B
- derived_from: A was created based on B

IMPORTANT: Return ONLY valid JSON with this EXACT structure:
{"relationships": [...]}

If no relationships found, return: {"relationships": []}
No markdown, no code fences, no explanations. Just JSON.`;
    outputSchema2 = z4.object({
      relationships: z4.array(z4.object({
        type: z4.enum([
          "depends_on",
          "implements",
          "contradicts",
          "evolved_from",
          "relates_to",
          "uses",
          "constrains",
          "resolves",
          "documents",
          "derived_from"
        ]),
        sourceEntityId: z4.string(),
        targetEntityId: z4.string(),
        description: z4.string(),
        confidence: z4.number().min(0).max(1)
      }))
    });
    config2 = {
      provider: "cloud",
      model: "fast",
      temperature: 0.1,
      maxTokens: 8192,
      task: LLMTask.RELATIONSHIP_INFERENCE
    };
  }
});

// packages/llm/dist/prompts/merge-detection.js
var merge_detection_exports = {};
__export(merge_detection_exports, {
  PROMPT_ID: () => PROMPT_ID3,
  PROMPT_VERSION: () => PROMPT_VERSION3,
  buildUserPrompt: () => buildUserPrompt3,
  config: () => config3,
  outputSchema: () => outputSchema3,
  systemPrompt: () => systemPrompt3
});
import { z as z5 } from "zod";
function buildUserPrompt3(vars) {
  return `Are these two entities the same thing described differently?

Entity A: [${vars.a.type}] ${vars.a.name}
  Content: ${vars.a.summary ?? "N/A"}
  Source: ${vars.a.sourceFile}

Entity B: [${vars.b.type}] ${vars.b.name}
  Content: ${vars.b.summary ?? "N/A"}
  Source: ${vars.b.sourceFile}

Return JSON: { "shouldMerge": boolean, "confidence": 0.0-1.0, "reason": "..." }`;
}
var PROMPT_ID3, PROMPT_VERSION3, systemPrompt3, outputSchema3, config3;
var init_merge_detection = __esm({
  "packages/llm/dist/prompts/merge-detection.js"() {
    "use strict";
    init_dist();
    PROMPT_ID3 = "merge_detection";
    PROMPT_VERSION3 = "1.0.0";
    systemPrompt3 = `You determine if two entities represent the same concept described differently. Return ONLY valid JSON.`;
    outputSchema3 = z5.object({
      shouldMerge: z5.boolean(),
      confidence: z5.number().min(0).max(1),
      reason: z5.string()
    });
    config3 = {
      provider: "cloud",
      model: "fast",
      temperature: 0.1,
      maxTokens: 500,
      task: LLMTask.ENTITY_EXTRACTION
    };
  }
});

// packages/llm/dist/prompts/contradiction-detection.js
var contradiction_detection_exports = {};
__export(contradiction_detection_exports, {
  PROMPT_ID: () => PROMPT_ID4,
  PROMPT_VERSION: () => PROMPT_VERSION4,
  buildUserPrompt: () => buildUserPrompt4,
  config: () => config4,
  outputSchema: () => outputSchema4,
  systemPrompt: () => systemPrompt4
});
import { z as z6 } from "zod";
function buildUserPrompt4(vars) {
  return `Do these two entities DIRECTLY contradict each other?

Entity A: [${vars.a.type}] ${vars.a.name}
  Content: ${vars.a.content}
  Source: ${vars.a.sourceFile}

Entity B: [${vars.b.type}] ${vars.b.name}
  Content: ${vars.b.content}
  Source: ${vars.b.sourceFile}

RULES \u2014 return isContradiction=false if:
- The entities are about different topics or concerns (most pairs)
- One entity doesn't affect or conflict with the other
- They are independent requirements that can both be satisfied simultaneously

Only return isContradiction=true if BOTH entities are about the SAME specific topic AND they make conflicting claims that cannot both be true.

Return JSON:
{
  "isContradiction": boolean,
  "severity": "low" | "medium" | "high",
  "description": "what specifically conflicts and why",
  "suggestedResolution": "how to resolve this"
}`;
}
var PROMPT_ID4, PROMPT_VERSION4, systemPrompt4, outputSchema4, config4;
var init_contradiction_detection = __esm({
  "packages/llm/dist/prompts/contradiction-detection.js"() {
    "use strict";
    init_dist();
    PROMPT_ID4 = "contradiction_detection";
    PROMPT_VERSION4 = "1.0.0";
    systemPrompt4 = `You detect contradictions between knowledge entities. Return ONLY valid JSON.`;
    outputSchema4 = z6.object({
      isContradiction: z6.boolean(),
      severity: z6.enum(["low", "medium", "high"]),
      description: z6.string(),
      suggestedResolution: z6.string()
    });
    config4 = {
      provider: "cloud",
      model: "fast",
      temperature: 0.1,
      maxTokens: 1e3,
      task: LLMTask.CONTRADICTION_DETECTION
    };
  }
});

// packages/llm/dist/prompts/conversational-query.js
var conversational_query_exports = {};
__export(conversational_query_exports, {
  PROMPT_ID: () => PROMPT_ID5,
  PROMPT_VERSION: () => PROMPT_VERSION5,
  buildUserPrompt: () => buildUserPrompt5,
  config: () => config5,
  systemPrompt: () => systemPrompt5
});
function buildUserPrompt5(vars) {
  const parts = [];
  if (vars.graphSummary) {
    parts.push(`Graph stats:
${vars.graphSummary}`);
  }
  if (vars.contextEntities.length > 0) {
    const context = vars.contextEntities.map((e) => {
      const file = e.sourceFile.replace(/\\/g, "/").split("/").pop() ?? e.sourceFile;
      const rels = e.relationships.length > 0 ? `
  Relations: ${e.relationships.map((r) => r.type).join(", ")}` : "";
      return `[${e.type}] ${e.name}
  ${e.content}
  (${file})${rels}`;
    }).join("\n\n");
    parts.push(`Relevant entities:
${context}`);
  }
  return `${parts.join("\n\n")}

Question: ${vars.userQuery}`;
}
var PROMPT_ID5, PROMPT_VERSION5, systemPrompt5, config5;
var init_conversational_query = __esm({
  "packages/llm/dist/prompts/conversational-query.js"() {
    "use strict";
    init_dist();
    PROMPT_ID5 = "conversational_query";
    PROMPT_VERSION5 = "1.0.0";
    systemPrompt5 = `You are Cortex, a knowledge assistant. Answer questions using the provided context from the user's knowledge graph.
Be concise and specific. Refer to decisions, patterns, and components by name.
Mention the source file when citing a fact. If the context lacks enough information, say so briefly.`;
    config5 = {
      provider: "cloud",
      model: "primary",
      temperature: 0.7,
      maxTokens: 600,
      task: LLMTask.CONVERSATIONAL_QUERY,
      stream: true
    };
  }
});

// packages/llm/dist/prompts/context-ranking.js
import { z as z7 } from "zod";
var outputSchema5, config6;
var init_context_ranking = __esm({
  "packages/llm/dist/prompts/context-ranking.js"() {
    "use strict";
    init_dist();
    outputSchema5 = z7.object({
      rankedIds: z7.array(z7.string()),
      excludeIds: z7.array(z7.string())
    });
    config6 = {
      provider: "cloud",
      model: "fast",
      temperature: 0.1,
      maxTokens: 500,
      task: LLMTask.CONTEXT_RANKING
    };
  }
});

// packages/llm/dist/prompts/follow-up-generation.js
var follow_up_generation_exports = {};
__export(follow_up_generation_exports, {
  PROMPT_ID: () => PROMPT_ID6,
  PROMPT_VERSION: () => PROMPT_VERSION6,
  buildUserPrompt: () => buildUserPrompt6,
  config: () => config7,
  outputSchema: () => outputSchema6,
  systemPrompt: () => systemPrompt6
});
import { z as z8 } from "zod";
function buildUserPrompt6(vars) {
  return `Suggest 2-3 follow-up questions based on this exchange.

Question: ${vars.userQuery}
Answer: ${vars.answerSummary}

Respond with ONLY this JSON, no other text:
{"followUps":["<question 1>","<question 2>","<question 3>"]}`;
}
var PROMPT_ID6, PROMPT_VERSION6, systemPrompt6, outputSchema6, config7;
var init_follow_up_generation = __esm({
  "packages/llm/dist/prompts/follow-up-generation.js"() {
    "use strict";
    init_dist();
    PROMPT_ID6 = "follow_up_generation";
    PROMPT_VERSION6 = "1.0.0";
    systemPrompt6 = `You suggest follow-up questions based on a Q&A exchange. Return ONLY valid JSON.`;
    outputSchema6 = z8.object({
      followUps: z8.array(z8.string()).min(1).max(5)
    });
    config7 = {
      provider: "cloud",
      model: "fast",
      temperature: 0.8,
      maxTokens: 300,
      task: LLMTask.CONVERSATIONAL_QUERY
    };
  }
});

// packages/llm/dist/index.js
var init_dist3 = __esm({
  "packages/llm/dist/index.js"() {
    "use strict";
    init_router();
    init_anthropic();
    init_ollama();
    init_openai_compatible();
    init_token_tracker();
    init_cache();
    init_output_parser();
    init_entity_extraction();
    init_relationship_inference();
    init_merge_detection();
    init_contradiction_detection();
    init_conversational_query();
    init_context_ranking();
    init_follow_up_generation();
  }
});

// packages/ingest/dist/parsers/markdown.js
import { unified } from "unified";
import remarkParse from "remark-parse";
function getLineRange(node) {
  return {
    startLine: node.position?.start.line ?? 1,
    endLine: node.position?.end.line ?? 1
  };
}
function extractText(node) {
  if ("value" in node)
    return node.value;
  if ("children" in node) {
    return node.children.map(extractText).join("");
  }
  return "";
}
var MarkdownParser;
var init_markdown = __esm({
  "packages/ingest/dist/parsers/markdown.js"() {
    "use strict";
    MarkdownParser = class {
      supportedExtensions = ["md", "mdx"];
      async parse(content, filePath) {
        const tree = unified().use(remarkParse).parse(content);
        const sections = [];
        let currentHeading;
        for (const node of tree.children) {
          const lines = getLineRange(node);
          switch (node.type) {
            case "heading": {
              const text = extractText(node);
              currentHeading = text;
              sections.push({
                type: "heading",
                title: text,
                content: text,
                startLine: lines.startLine,
                endLine: lines.endLine,
                metadata: { depth: node.depth }
              });
              break;
            }
            case "paragraph": {
              const text = extractText(node);
              sections.push({
                type: "paragraph",
                title: currentHeading,
                content: text,
                startLine: lines.startLine,
                endLine: lines.endLine
              });
              break;
            }
            case "code": {
              sections.push({
                type: "code",
                title: currentHeading,
                content: node.value,
                language: node.lang ?? void 0,
                startLine: lines.startLine,
                endLine: lines.endLine,
                metadata: { lang: node.lang }
              });
              break;
            }
            case "list": {
              const items = node.children.map((item) => extractText(item)).join("\n");
              sections.push({
                type: "list",
                title: currentHeading,
                content: items,
                startLine: lines.startLine,
                endLine: lines.endLine,
                metadata: { ordered: node.ordered }
              });
              break;
            }
            case "blockquote": {
              const text = node.children.map(extractText).join("\n");
              sections.push({
                type: "paragraph",
                title: currentHeading,
                content: text,
                startLine: lines.startLine,
                endLine: lines.endLine,
                metadata: { blockquote: true }
              });
              break;
            }
            case "table": {
              const rows = node.children.map((row) => row.children.map(extractText).join(" | "));
              sections.push({
                type: "paragraph",
                title: currentHeading,
                content: rows.join("\n"),
                startLine: lines.startLine,
                endLine: lines.endLine,
                metadata: { table: true }
              });
              break;
            }
            default:
              break;
          }
        }
        return {
          sections,
          metadata: {
            filePath,
            format: "markdown",
            sectionCount: sections.length
          }
        };
      }
    };
  }
});

// packages/ingest/dist/parsers/typescript.js
import TreeSitter from "tree-sitter";
import TreeSitterTypeScript from "tree-sitter-typescript";
function createParser(language) {
  const parser = new TreeSitter();
  parser.setLanguage(language);
  return parser;
}
function nodeText(node, source) {
  return source.slice(node.startIndex, node.endIndex);
}
function extractName(node, source) {
  const nameNode = node.childForFieldName("name");
  if (nameNode)
    return nodeText(nameNode, source);
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === "variable_declarator") {
      const varName = child.childForFieldName("name");
      if (varName)
        return nodeText(varName, source);
    }
  }
  return void 0;
}
var tsLanguage, tsxLanguage, TypeScriptParser;
var init_typescript = __esm({
  "packages/ingest/dist/parsers/typescript.js"() {
    "use strict";
    tsLanguage = TreeSitterTypeScript.typescript;
    tsxLanguage = TreeSitterTypeScript.tsx;
    TypeScriptParser = class {
      supportedExtensions = ["ts", "tsx", "js", "jsx"];
      tsParser;
      tsxParser;
      constructor() {
        this.tsParser = createParser(tsLanguage);
        this.tsxParser = createParser(tsxLanguage);
      }
      async parse(content, filePath) {
        const isTsx = filePath.endsWith(".tsx") || filePath.endsWith(".jsx");
        const parser = isTsx ? this.tsxParser : this.tsParser;
        const tree = parser.parse(content);
        const sections = [];
        this.walkNode(tree.rootNode, content, sections);
        return {
          sections,
          metadata: {
            filePath,
            format: isTsx ? "tsx" : "typescript",
            sectionCount: sections.length
          }
        };
      }
      walkNode(node, source, sections) {
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (!child)
            continue;
          switch (child.type) {
            case "function_declaration":
            case "generator_function_declaration":
              sections.push({
                type: "function",
                title: extractName(child, source),
                content: nodeText(child, source),
                startLine: child.startPosition.row + 1,
                endLine: child.endPosition.row + 1
              });
              break;
            case "class_declaration":
              sections.push({
                type: "class",
                title: extractName(child, source),
                content: nodeText(child, source),
                startLine: child.startPosition.row + 1,
                endLine: child.endPosition.row + 1
              });
              break;
            case "interface_declaration":
            case "type_alias_declaration":
              sections.push({
                type: "interface",
                title: extractName(child, source),
                content: nodeText(child, source),
                startLine: child.startPosition.row + 1,
                endLine: child.endPosition.row + 1
              });
              break;
            case "enum_declaration":
              sections.push({
                type: "interface",
                title: extractName(child, source),
                content: nodeText(child, source),
                startLine: child.startPosition.row + 1,
                endLine: child.endPosition.row + 1,
                metadata: { kind: "enum" }
              });
              break;
            case "export_statement": {
              const declaration = child.childForFieldName("declaration");
              if (declaration) {
                this.walkExportedNode(declaration, child, source, sections);
              } else {
                sections.push({
                  type: "export",
                  content: nodeText(child, source),
                  startLine: child.startPosition.row + 1,
                  endLine: child.endPosition.row + 1
                });
              }
              break;
            }
            case "lexical_declaration": {
              const text = nodeText(child, source);
              if (text.length > 50) {
                sections.push({
                  type: "export",
                  title: extractName(child, source),
                  content: text,
                  startLine: child.startPosition.row + 1,
                  endLine: child.endPosition.row + 1
                });
              }
              break;
            }
            case "comment":
              sections.push({
                type: "comment",
                content: nodeText(child, source),
                startLine: child.startPosition.row + 1,
                endLine: child.endPosition.row + 1
              });
              break;
            case "import_statement":
              break;
            default:
              if (child.childCount > 0) {
                this.walkNode(child, source, sections);
              }
              break;
          }
        }
      }
      walkExportedNode(declaration, exportNode, source, sections) {
        const fullText = nodeText(exportNode, source);
        const name = extractName(declaration, source);
        switch (declaration.type) {
          case "function_declaration":
          case "generator_function_declaration":
            sections.push({
              type: "function",
              title: name,
              content: fullText,
              startLine: exportNode.startPosition.row + 1,
              endLine: exportNode.endPosition.row + 1,
              metadata: { exported: true }
            });
            break;
          case "class_declaration":
            sections.push({
              type: "class",
              title: name,
              content: fullText,
              startLine: exportNode.startPosition.row + 1,
              endLine: exportNode.endPosition.row + 1,
              metadata: { exported: true }
            });
            break;
          case "interface_declaration":
          case "type_alias_declaration":
            sections.push({
              type: "interface",
              title: name,
              content: fullText,
              startLine: exportNode.startPosition.row + 1,
              endLine: exportNode.endPosition.row + 1,
              metadata: { exported: true }
            });
            break;
          default:
            sections.push({
              type: "export",
              title: name,
              content: fullText,
              startLine: exportNode.startPosition.row + 1,
              endLine: exportNode.endPosition.row + 1,
              metadata: { exported: true }
            });
            break;
        }
      }
    };
  }
});

// packages/ingest/dist/parsers/json-parser.js
function stripJsonComments(text) {
  let result = "";
  let i = 0;
  let inString = false;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && (i === 0 || text[i - 1] !== "\\")) {
      inString = !inString;
      result += ch;
      i++;
      continue;
    }
    if (inString) {
      result += ch;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        result += text[i] === "\n" ? "\n" : " ";
        i++;
      }
      i += 2;
      continue;
    }
    if (ch === "/" && next === "/") {
      i += 2;
      while (i < text.length && text[i] !== "\n")
        i++;
      continue;
    }
    result += ch;
    i++;
  }
  result = result.replace(/,\s*([\]\}])/g, "$1");
  return result;
}
function parseJsonOrJsonc(content) {
  try {
    return JSON.parse(content);
  } catch {
    return JSON.parse(stripJsonComments(content));
  }
}
var JsonParser;
var init_json_parser = __esm({
  "packages/ingest/dist/parsers/json-parser.js"() {
    "use strict";
    JsonParser = class {
      supportedExtensions = ["json"];
      async parse(content, filePath) {
        const parsed = parseJsonOrJsonc(content);
        const sections = [];
        if (typeof parsed !== "object" || parsed === null) {
          sections.push({
            type: "unknown",
            content,
            startLine: 1,
            endLine: content.split("\n").length
          });
          return { sections, metadata: { filePath, format: "json" } };
        }
        const obj = parsed;
        const lines = content.split("\n");
        for (const [key, value] of Object.entries(obj)) {
          const valueStr = JSON.stringify(value, null, 2);
          const keyPattern = `"${key}"`;
          let startLine = 1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(keyPattern)) {
              startLine = i + 1;
              break;
            }
          }
          const valueLines = valueStr.split("\n").length;
          sections.push({
            type: "property",
            title: key,
            content: `${key}: ${valueStr}`,
            startLine,
            endLine: startLine + valueLines - 1,
            metadata: {
              key,
              valueType: Array.isArray(value) ? "array" : typeof value
            }
          });
        }
        const metadata = {
          filePath,
          format: "json",
          sectionCount: sections.length
        };
        if (filePath.endsWith("package.json")) {
          metadata.packageName = obj["name"];
          metadata.packageVersion = obj["version"];
        } else if (filePath.endsWith("tsconfig.json") || filePath.endsWith("tsconfig.base.json")) {
          metadata.tsconfigType = "typescript-config";
        }
        return { sections, metadata };
      }
    };
  }
});

// packages/ingest/dist/parsers/yaml-parser.js
import { parse as parseYaml } from "yaml";
var YamlParser;
var init_yaml_parser = __esm({
  "packages/ingest/dist/parsers/yaml-parser.js"() {
    "use strict";
    YamlParser = class {
      supportedExtensions = ["yaml", "yml"];
      async parse(content, filePath) {
        const parsed = parseYaml(content);
        const sections = [];
        if (typeof parsed !== "object" || parsed === null) {
          sections.push({
            type: "unknown",
            content,
            startLine: 1,
            endLine: content.split("\n").length
          });
          return { sections, metadata: { filePath, format: "yaml" } };
        }
        const obj = parsed;
        const lines = content.split("\n");
        for (const [key, value] of Object.entries(obj)) {
          const valueStr = typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
          let startLine = 1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith(`${key}:`) || lines[i].startsWith(`${key} :`)) {
              startLine = i + 1;
              break;
            }
          }
          sections.push({
            type: "property",
            title: key,
            content: `${key}: ${valueStr}`,
            startLine,
            endLine: startLine + valueStr.split("\n").length - 1,
            metadata: {
              key,
              valueType: Array.isArray(value) ? "array" : typeof value
            }
          });
        }
        return {
          sections,
          metadata: {
            filePath,
            format: "yaml",
            sectionCount: sections.length
          }
        };
      }
    };
  }
});

// packages/ingest/dist/parsers/conversation.js
function isConversationJson(content) {
  try {
    const obj = JSON.parse(content);
    if (Array.isArray(obj) && obj.length > 0) {
      const first = obj[0];
      return Array.isArray(first?.mapping) || typeof first?.mapping === "object" || Array.isArray(first?.messages);
    }
    if (Array.isArray(obj?.conversations))
      return true;
    if (Array.isArray(obj?.messages) && obj.messages[0]?.role !== void 0)
      return true;
    return false;
  } catch {
    return false;
  }
}
function isConversationMarkdown(content) {
  const lines = content.split("\n");
  const headings = [];
  for (const line of lines) {
    const m = line.match(/^#{1,3}\s+(.+)$/);
    if (m) {
      headings.push(m[1].trim());
      if (headings.length >= 2)
        break;
    }
  }
  if (headings.length < 2)
    return false;
  return HUMAN_PATTERN.test(headings[0]) && ASSISTANT_PATTERN.test(headings[1]);
}
function parseConversationJson(content) {
  const obj = JSON.parse(content);
  const sections = [];
  let messages = [];
  if (Array.isArray(obj)) {
    const first = obj[0];
    if (first?.mapping && typeof first.mapping === "object") {
      for (const node of Object.values(first.mapping)) {
        const msg = node?.message;
        if (!msg?.author?.role || !msg.content?.parts)
          continue;
        const text = msg.content.parts.join("\n").trim();
        if (text)
          messages.push({ role: msg.author.role, content: text });
      }
    } else if (Array.isArray(first?.messages)) {
      messages = first.messages;
    }
  } else if (Array.isArray(obj?.conversations)) {
    messages = obj.conversations[0]?.messages ?? [];
  } else if (Array.isArray(obj?.messages)) {
    messages = obj.messages;
  }
  let lineNum = 1;
  for (const msg of messages) {
    const role = (msg.role ?? msg.author?.role ?? "unknown").toLowerCase();
    if (role === "system")
      continue;
    const text = typeof msg.content === "string" ? msg.content : msg.text ?? JSON.stringify(msg.content);
    if (!text || text.trim().length < 50)
      continue;
    const endLine = lineNum + text.split("\n").length;
    sections.push({
      type: "paragraph",
      title: role === "user" ? "Human" : "Assistant",
      content: text.trim(),
      startLine: lineNum,
      endLine,
      metadata: { role, speaker: role === "user" ? "human" : "assistant" }
    });
    lineNum = endLine + 1;
  }
  return sections;
}
function parseConversationMarkdown(content) {
  const sections = [];
  const lines = content.split("\n");
  let currentRole = null;
  let blockStart = 0;
  const blockLines = [];
  const flush = (endLine) => {
    if (!currentRole || blockLines.length === 0)
      return;
    const text = blockLines.join("\n").trim();
    if (text.length >= 50) {
      sections.push({
        type: "paragraph",
        title: currentRole,
        content: text,
        startLine: blockStart,
        endLine,
        metadata: {
          role: HUMAN_PATTERN.test(currentRole) ? "user" : "assistant",
          speaker: HUMAN_PATTERN.test(currentRole) ? "human" : "assistant"
        }
      });
    }
    blockLines.length = 0;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      flush(i);
      currentRole = headingMatch[1].trim();
      blockStart = i + 2;
    } else if (currentRole) {
      blockLines.push(line);
    }
  }
  flush(lines.length);
  return sections;
}
var HUMAN_PATTERN, ASSISTANT_PATTERN, ConversationParser;
var init_conversation = __esm({
  "packages/ingest/dist/parsers/conversation.js"() {
    "use strict";
    HUMAN_PATTERN = /^(Human|User|Me)$/i;
    ASSISTANT_PATTERN = /^(Assistant|Claude|ChatGPT|GPT)$/i;
    ConversationParser = class {
      supportedExtensions = ["json", "md"];
      async parse(content, filePath) {
        const isJson = filePath.endsWith(".json") || filePath.endsWith(".JSON");
        const sections = isJson ? parseConversationJson(content) : parseConversationMarkdown(content);
        return {
          sections,
          metadata: {
            format: isJson ? "conversation-json" : "conversation-markdown",
            messageCount: sections.length
          }
        };
      }
    };
  }
});

// packages/ingest/dist/parsers/index.js
function getParser(extension, filePath, content) {
  const ext = extension.toLowerCase();
  if (content !== void 0 && filePath !== void 0) {
    if (ext === "json" && isConversationJson(content))
      return conversationParser;
    if ((ext === "md" || ext === "mdx") && isConversationMarkdown(content))
      return conversationParser;
  }
  return PARSER_REGISTRY.get(ext);
}
function getSupportedExtensions() {
  return [...PARSER_REGISTRY.keys()];
}
var markdownParser, typescriptParser, jsonParser, yamlParser, conversationParser, PARSER_REGISTRY;
var init_parsers = __esm({
  "packages/ingest/dist/parsers/index.js"() {
    "use strict";
    init_markdown();
    init_typescript();
    init_json_parser();
    init_yaml_parser();
    init_conversation();
    markdownParser = new MarkdownParser();
    typescriptParser = new TypeScriptParser();
    jsonParser = new JsonParser();
    yamlParser = new YamlParser();
    conversationParser = new ConversationParser();
    PARSER_REGISTRY = /* @__PURE__ */ new Map([
      ["md", markdownParser],
      ["mdx", markdownParser],
      ["ts", typescriptParser],
      ["tsx", typescriptParser],
      ["js", typescriptParser],
      ["jsx", typescriptParser],
      ["json", jsonParser],
      ["yaml", yamlParser],
      ["yml", yamlParser]
    ]);
  }
});

// packages/ingest/dist/chunker.js
function estimateTokens2(text) {
  return Math.ceil(text.length / AVG_CHARS_PER_TOKEN2);
}
function chunkSections(sections, options = {}) {
  const maxTokens = options.maxTokens ?? 2e3;
  const overlapTokens = options.overlapTokens ?? 200;
  const maxChars = maxTokens * AVG_CHARS_PER_TOKEN2;
  const overlapChars = overlapTokens * AVG_CHARS_PER_TOKEN2;
  if (sections.length === 0)
    return [];
  const chunks = [];
  let currentContent = "";
  let currentStartLine = sections[0].startLine;
  let currentEndLine = sections[0].startLine;
  let currentTitles = [];
  let overlapBuffer = "";
  for (const section of sections) {
    const sectionText = section.title ? `## ${section.title}
${section.content}` : section.content;
    const sectionTokens = estimateTokens2(sectionText);
    if (sectionTokens > maxTokens) {
      if (currentContent.length > 0) {
        chunks.push(buildChunk(currentContent, currentStartLine, currentEndLine, currentTitles, chunks.length));
        overlapBuffer = currentContent.slice(-overlapChars);
        currentContent = "";
        currentTitles = [];
      }
      const subChunks = splitLargeText(sectionText, maxChars, overlapChars, section, chunks.length);
      chunks.push(...subChunks);
      overlapBuffer = subChunks.length > 0 ? subChunks[subChunks.length - 1].content.slice(-overlapChars) : "";
      currentStartLine = section.endLine + 1;
      currentEndLine = section.endLine;
      continue;
    }
    const combined = currentContent + (currentContent ? "\n\n" : "") + sectionText;
    if (estimateTokens2(combined) > maxTokens && currentContent.length > 0) {
      chunks.push(buildChunk(currentContent, currentStartLine, currentEndLine, currentTitles, chunks.length));
      overlapBuffer = currentContent.slice(-overlapChars);
      currentContent = overlapBuffer + "\n\n" + sectionText;
      currentStartLine = section.startLine;
      currentEndLine = section.endLine;
      currentTitles = section.title ? [section.title] : [];
    } else {
      if (currentContent.length === 0 && overlapBuffer.length > 0) {
        currentContent = overlapBuffer + "\n\n" + sectionText;
      } else {
        currentContent = combined;
      }
      if (currentContent === sectionText || currentContent === combined) {
        if (chunks.length === 0)
          currentStartLine = section.startLine;
      }
      currentEndLine = section.endLine;
      if (section.title && !currentTitles.includes(section.title)) {
        currentTitles.push(section.title);
      }
    }
  }
  if (currentContent.trim().length > 0) {
    chunks.push(buildChunk(currentContent, currentStartLine, currentEndLine, currentTitles, chunks.length));
  }
  return chunks;
}
function buildChunk(content, startLine, endLine, titles, index) {
  return {
    content: content.trim(),
    startLine,
    endLine,
    sectionTitles: [...titles],
    tokenEstimate: estimateTokens2(content),
    index
  };
}
function splitLargeText(text, maxChars, overlapChars, section, startIndex) {
  const chunks = [];
  const lines = text.split("\n");
  let currentChunk = "";
  let chunkStartLine = section.startLine;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = currentChunk + (currentChunk ? "\n" : "") + line;
    if (next.length > maxChars && currentChunk.length > 0) {
      const lineOffset = section.startLine + i;
      chunks.push(buildChunk(currentChunk, chunkStartLine, lineOffset - 1, section.title ? [section.title] : [], startIndex + chunks.length));
      const overlap = currentChunk.slice(-overlapChars);
      currentChunk = overlap + "\n" + line;
      chunkStartLine = lineOffset;
    } else {
      currentChunk = next;
    }
  }
  if (currentChunk.trim().length > 0) {
    chunks.push(buildChunk(currentChunk, chunkStartLine, section.endLine, section.title ? [section.title] : [], startIndex + chunks.length));
  }
  return chunks;
}
var AVG_CHARS_PER_TOKEN2;
var init_chunker = __esm({
  "packages/ingest/dist/chunker.js"() {
    "use strict";
    AVG_CHARS_PER_TOKEN2 = 4;
  }
});

// packages/ingest/dist/watcher.js
import { watch } from "chokidar";
import { extname } from "node:path";
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
var logger9, FileWatcher;
var init_watcher = __esm({
  "packages/ingest/dist/watcher.js"() {
    "use strict";
    init_dist();
    logger9 = createLogger("ingest:watcher");
    FileWatcher = class _FileWatcher {
      watcher = null;
      options;
      handler = null;
      debounceTimers = /* @__PURE__ */ new Map();
      constructor(options) {
        this.options = options;
      }
      static fromConfig(config8) {
        return new _FileWatcher({
          dirs: config8.watchDirs,
          exclude: config8.exclude,
          fileTypes: config8.fileTypes,
          debounceMs: config8.debounceMs,
          followSymlinks: config8.followSymlinks,
          maxFileSize: config8.maxFileSize
        });
      }
      onFileChange(handler) {
        this.handler = handler;
      }
      start() {
        if (this.watcher)
          return;
        const ignored = this.buildIgnorePatterns();
        this.watcher = watch(this.options.dirs, {
          ignored,
          persistent: true,
          ignoreInitial: this.options.ignoreInitial ?? false,
          followSymlinks: this.options.followSymlinks,
          awaitWriteFinish: {
            stabilityThreshold: 200,
            pollInterval: 100
          }
        });
        this.watcher.on("add", (path) => this.handleEvent(path, "add"));
        this.watcher.on("change", (path) => this.handleEvent(path, "change"));
        this.watcher.on("unlink", (path) => this.handleEvent(path, "unlink"));
        this.watcher.on("error", (error) => {
          logger9.error("Watcher error", { error: error instanceof Error ? error.message : String(error) });
        });
        this.watcher.on("ready", () => {
          logger9.info("File watcher ready", { dirs: this.options.dirs });
        });
      }
      async stop() {
        if (!this.watcher)
          return;
        for (const timer of this.debounceTimers.values()) {
          clearTimeout(timer);
        }
        this.debounceTimers.clear();
        await this.watcher.close();
        this.watcher = null;
        logger9.info("File watcher stopped");
      }
      handleEvent(path, changeType) {
        if (this.isExcluded(path))
          return;
        const ext = extname(path).slice(1).toLowerCase();
        if (this.options.fileTypes.length > 0 && !this.options.fileTypes.includes(ext)) {
          return;
        }
        const existing = this.debounceTimers.get(path);
        if (existing) {
          clearTimeout(existing);
        }
        const timer = setTimeout(() => {
          this.debounceTimers.delete(path);
          eventBus.emit({
            type: "file.changed",
            payload: { path, changeType },
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            source: "ingest:watcher"
          });
          if (this.handler) {
            try {
              this.handler(path, changeType);
            } catch (err) {
              logger9.error("File change handler error", {
                path,
                error: err instanceof Error ? err.message : String(err)
              });
            }
          }
        }, this.options.debounceMs);
        this.debounceTimers.set(path, timer);
      }
      isExcluded(filePath) {
        const parts = filePath.split(/[\\/]/);
        for (const pattern of this.options.exclude) {
          if (pattern.includes("*")) {
            const re = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*\*/g, ".*").replace(/\*/g, "[^/\\\\]*") + "$");
            if (parts.some((p) => re.test(p)))
              return true;
          } else {
            if (parts.some((p) => p === pattern))
              return true;
          }
        }
        return false;
      }
      buildIgnorePatterns() {
        const patterns = [];
        for (const pattern of this.options.exclude) {
          if (pattern.includes("*")) {
            const regexStr = pattern.replace(/\./g, "\\.").replace(/\*\*/g, "___GLOBSTAR___").replace(/\*/g, "[^/]*").replace(/___GLOBSTAR___/g, ".*");
            patterns.push(new RegExp(regexStr));
          } else if (pattern.includes(".")) {
            patterns.push(new RegExp(`(^|[\\\\/])${escapeRegex(pattern)}$`));
          } else {
            patterns.push(new RegExp(`(^|[\\\\/])${escapeRegex(pattern)}([\\\\/]|$)`));
          }
        }
        return patterns;
      }
    };
  }
});

// packages/ingest/dist/post-ingest.js
async function runMergeDetection(entities, sourceFile, store, router, mergeConfidenceThreshold) {
  if (!router.getLocalProvider()) {
    return;
  }
  for (const entity of entities) {
    let candidates;
    try {
      candidates = await store.searchEntities(entity.name, 5);
    } catch {
      continue;
    }
    const others = candidates.filter((c) => c.id !== entity.id && c.sourceFile !== sourceFile && c.status !== "superseded" && c.type === entity.type);
    for (const candidate of others) {
      try {
        const result = await router.completeStructured({
          systemPrompt: merge_detection_exports.systemPrompt,
          userPrompt: merge_detection_exports.buildUserPrompt({
            a: { type: entity.type, name: entity.name, summary: entity.summary, sourceFile: entity.sourceFile },
            b: { type: candidate.type, name: candidate.name, summary: candidate.summary, sourceFile: candidate.sourceFile }
          }),
          promptId: merge_detection_exports.PROMPT_ID,
          promptVersion: merge_detection_exports.PROMPT_VERSION,
          task: LLMTask.ENTITY_EXTRACTION,
          temperature: merge_detection_exports.config.temperature,
          maxTokens: merge_detection_exports.config.maxTokens,
          forceProvider: "local"
        }, merge_detection_exports.outputSchema);
        if (result.data.shouldMerge && result.data.confidence >= mergeConfidenceThreshold) {
          await store.updateEntity(candidate.id, { status: "superseded" });
          eventBus.emit({
            type: "entity.merged",
            payload: { survivorId: entity.id, mergedId: candidate.id },
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            source: "ingest:post-ingest"
          });
          logger10.info("Entity merged", {
            survivor: entity.name,
            merged: candidate.name,
            confidence: result.data.confidence,
            reason: result.data.reason
          });
        }
      } catch (err) {
        logger10.debug("Merge detection failed for pair", {
          entity: entity.name,
          candidate: candidate.name,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
  }
}
async function runContradictionDetection(entities, sourceFile, projectId, privacyLevel, store, router, checkedEntityPairs = /* @__PURE__ */ new Set()) {
  if (privacyLevel === "restricted") {
    return;
  }
  const privacyForce = privacyLevel === "sensitive" ? { forceProvider: "local" } : {};
  const contradictedFilePairs = /* @__PURE__ */ new Set();
  for (const entity of entities) {
    let candidates;
    try {
      candidates = await store.searchEntities(entity.name, 5);
    } catch {
      continue;
    }
    const others = candidates.filter((c) => c.id !== entity.id && c.sourceFile !== sourceFile && c.status !== "superseded" && c.type === entity.type);
    for (const candidate of others) {
      const filePairKey = [entity.sourceFile, candidate.sourceFile].sort().join("\0");
      if (contradictedFilePairs.has(filePairKey))
        continue;
      const entityPairKey = [entity.id, candidate.id].sort().join("\0");
      if (checkedEntityPairs.has(entityPairKey))
        continue;
      checkedEntityPairs.add(entityPairKey);
      try {
        const result = await router.completeStructured({
          systemPrompt: contradiction_detection_exports.systemPrompt,
          userPrompt: contradiction_detection_exports.buildUserPrompt({
            a: {
              type: entity.type,
              name: entity.name,
              content: entity.summary ?? entity.content,
              createdAt: entity.createdAt,
              sourceFile: entity.sourceFile
            },
            b: {
              type: candidate.type,
              name: candidate.name,
              content: candidate.summary ?? candidate.content,
              createdAt: candidate.createdAt,
              sourceFile: candidate.sourceFile
            }
          }),
          promptId: contradiction_detection_exports.PROMPT_ID,
          promptVersion: contradiction_detection_exports.PROMPT_VERSION,
          task: LLMTask.CONTRADICTION_DETECTION,
          temperature: contradiction_detection_exports.config.temperature,
          maxTokens: contradiction_detection_exports.config.maxTokens,
          ...privacyForce
        }, contradiction_detection_exports.outputSchema);
        if (result.data.isContradiction) {
          contradictedFilePairs.add(filePairKey);
          const contradiction = await store.createContradiction({
            entityIds: [entity.id, candidate.id],
            description: result.data.description,
            severity: result.data.severity,
            suggestedResolution: result.data.suggestedResolution,
            status: "active",
            detectedAt: (/* @__PURE__ */ new Date()).toISOString()
          });
          eventBus.emit({
            type: "contradiction.detected",
            payload: { contradiction },
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            source: "ingest:post-ingest"
          });
          logger10.info("Contradiction detected", {
            entityA: entity.name,
            entityB: candidate.name,
            severity: result.data.severity
          });
        }
      } catch (err) {
        logger10.debug("Contradiction detection failed for pair", {
          entity: entity.name,
          candidate: candidate.name,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
  }
}
var logger10;
var init_post_ingest = __esm({
  "packages/ingest/dist/post-ingest.js"() {
    "use strict";
    init_dist();
    init_dist3();
    logger10 = createLogger("ingest:post-ingest");
  }
});

// packages/ingest/dist/pipeline.js
import { readFileSync as readFileSync4, statSync as statSync2 } from "node:fs";
import { relative, extname as extname2 } from "node:path";
import { createHash as createHash2 } from "node:crypto";
var logger11, IngestionPipeline;
var init_pipeline = __esm({
  "packages/ingest/dist/pipeline.js"() {
    "use strict";
    init_dist();
    init_dist3();
    init_parsers();
    init_chunker();
    init_post_ingest();
    logger11 = createLogger("ingest:pipeline");
    IngestionPipeline = class {
      router;
      store;
      options;
      // Shared across all ingestFile calls — prevents the same entity pair from being
      // evaluated twice when multiple files ingest in the same batch.
      checkedContradictionPairs = /* @__PURE__ */ new Set();
      constructor(router, store, options) {
        this.router = router;
        this.store = store;
        this.options = options;
      }
      async ingestFile(filePath) {
        const ext = extname2(filePath).slice(1).toLowerCase();
        if (!getParser(ext)) {
          logger11.debug("Unsupported file type, skipping", { filePath, ext });
          return { fileId: "", entityIds: [], relationshipIds: [], status: "skipped" };
        }
        let stat;
        try {
          stat = statSync2(filePath);
        } catch {
          return { fileId: "", entityIds: [], relationshipIds: [], status: "failed", error: "File not found" };
        }
        if (stat.size > this.options.maxFileSize) {
          logger11.warn("File too large, skipping", { filePath, size: stat.size, max: this.options.maxFileSize });
          return { fileId: "", entityIds: [], relationshipIds: [], status: "skipped", error: "File too large" };
        }
        let content;
        try {
          content = readFileSync4(filePath, "utf-8");
        } catch (err) {
          return {
            fileId: "",
            entityIds: [],
            relationshipIds: [],
            status: "failed",
            error: `Read error: ${err instanceof Error ? err.message : String(err)}`
          };
        }
        const parser = getParser(ext, filePath, content);
        const contentHash = createHash2("sha256").update(content).digest("hex");
        const existingFile = await this.store.getFile(filePath);
        if (existingFile && existingFile.contentHash === contentHash && existingFile.status === "ingested") {
          logger11.debug("File unchanged, skipping", { filePath });
          return {
            fileId: existingFile.id,
            entityIds: existingFile.entityIds,
            relationshipIds: [],
            status: "ingested"
          };
        }
        const relativePath = relative(this.options.projectRoot, filePath);
        try {
          logger11.debug("Parsing file", { filePath, ext });
          const parseResult = await parser.parse(content, filePath);
          const chunks = chunkSections(parseResult.sections);
          logger11.debug("Chunked file", { filePath, chunks: chunks.length });
          const allEntities = [];
          let extractionErrors = 0;
          for (const chunk of chunks) {
            const { entities, hadError } = await this.extractEntities(chunk, filePath, ext);
            if (hadError)
              extractionErrors++;
            allEntities.push(...entities);
          }
          if (allEntities.length === 0 && extractionErrors > 0 && chunks.length > 0) {
            throw new CortexError(LLM_EXTRACTION_FAILED, "high", "llm", `Entity extraction failed for all ${chunks.length} chunk(s) in ${filePath}`);
          }
          const deduped = this.deduplicateEntities(allEntities);
          logger11.debug("Extracted entities", { filePath, raw: allEntities.length, deduped: deduped.length });
          const storedEntities = [];
          for (const entity of deduped) {
            const stored = await this.store.createEntity(entity);
            storedEntities.push(stored);
            eventBus.emit({
              type: "entity.created",
              payload: { entity: stored },
              timestamp: (/* @__PURE__ */ new Date()).toISOString(),
              source: "ingest:pipeline"
            });
          }
          await runMergeDetection(storedEntities, filePath, this.store, this.router, this.options.mergeConfidenceThreshold);
          await runContradictionDetection(storedEntities, filePath, this.options.projectId, this.options.projectPrivacyLevel, this.store, this.router, this.checkedContradictionPairs);
          const relationshipIds = [];
          if (storedEntities.length >= 2) {
            const rels = await this.inferRelationships(storedEntities);
            relationshipIds.push(...rels);
          }
          const entityIds = storedEntities.map((e) => e.id);
          const fileRecord = await this.store.upsertFile({
            path: filePath,
            relativePath,
            projectId: this.options.projectId,
            contentHash,
            fileType: ext,
            sizeBytes: stat.size,
            lastModified: stat.mtime.toISOString(),
            lastIngestedAt: (/* @__PURE__ */ new Date()).toISOString(),
            entityIds,
            status: "ingested"
          });
          eventBus.emit({
            type: "file.ingested",
            payload: { fileId: fileRecord.id, entityIds, relationshipIds },
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            source: "ingest:pipeline"
          });
          logger11.info("File ingested", {
            filePath: relativePath,
            entities: entityIds.length,
            relationships: relationshipIds.length
          });
          return { fileId: fileRecord.id, entityIds, relationshipIds, status: "ingested" };
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          logger11.error("Ingestion failed", { filePath, error: errorMsg });
          await this.store.upsertFile({
            path: filePath,
            relativePath,
            projectId: this.options.projectId,
            contentHash,
            fileType: ext,
            sizeBytes: stat.size,
            lastModified: stat.mtime.toISOString(),
            entityIds: [],
            status: "failed",
            parseError: errorMsg
          });
          return { fileId: "", entityIds: [], relationshipIds: [], status: "failed", error: errorMsg };
        }
      }
      async extractEntities(chunk, filePath, fileType) {
        const contentHash = createHash2("sha256").update(chunk.content).digest("hex");
        const privacyOverride = this.options.projectPrivacyLevel !== "standard" ? { forceProvider: "local" } : {};
        try {
          const result = await this.router.completeStructured({
            systemPrompt: entity_extraction_exports.systemPrompt,
            userPrompt: entity_extraction_exports.buildUserPrompt({
              filePath,
              projectName: this.options.projectName,
              fileType,
              content: chunk.content
            }),
            promptId: entity_extraction_exports.PROMPT_ID,
            promptVersion: entity_extraction_exports.PROMPT_VERSION,
            task: LLMTask.ENTITY_EXTRACTION,
            modelPreference: entity_extraction_exports.config.model,
            temperature: entity_extraction_exports.config.temperature,
            maxTokens: entity_extraction_exports.config.maxTokens,
            contentHash,
            ...privacyOverride
          }, entity_extraction_exports.outputSchema);
          return {
            entities: result.data.entities.map((e) => ({
              type: e.type,
              name: e.name,
              content: e.content,
              summary: e.summary,
              properties: e.properties,
              confidence: e.confidence,
              sourceFile: filePath,
              sourceRange: { startLine: chunk.startLine, endLine: chunk.endLine },
              projectId: this.options.projectId,
              extractedBy: {
                promptId: entity_extraction_exports.PROMPT_ID,
                promptVersion: entity_extraction_exports.PROMPT_VERSION,
                model: result.model,
                provider: result.provider,
                tokensUsed: { input: result.inputTokens, output: result.outputTokens },
                timestamp: (/* @__PURE__ */ new Date()).toISOString()
              },
              tags: e.tags,
              status: "active"
            })),
            hadError: false
          };
        } catch (err) {
          logger11.warn("Entity extraction failed for chunk", {
            filePath,
            chunk: chunk.index,
            error: err instanceof Error ? err.message : String(err)
          });
          return { entities: [], hadError: true };
        }
      }
      async inferRelationships(entities) {
        const privacyOverride = this.options.projectPrivacyLevel !== "standard" ? { forceProvider: "local" } : {};
        try {
          const result = await this.router.completeStructured({
            systemPrompt: relationship_inference_exports.systemPrompt,
            userPrompt: relationship_inference_exports.buildUserPrompt({
              entities: entities.map((e) => ({
                id: e.id,
                type: e.type,
                name: e.name,
                summary: e.summary,
                sourceFile: e.sourceFile
              }))
            }),
            promptId: relationship_inference_exports.PROMPT_ID,
            promptVersion: relationship_inference_exports.PROMPT_VERSION,
            task: LLMTask.RELATIONSHIP_INFERENCE,
            modelPreference: relationship_inference_exports.config.model,
            temperature: relationship_inference_exports.config.temperature,
            maxTokens: relationship_inference_exports.config.maxTokens,
            ...privacyOverride
          }, relationship_inference_exports.outputSchema);
          const entityIdSet = new Set(entities.map((e) => e.id));
          const relationshipIds = [];
          for (const rel of result.data.relationships) {
            if (!entityIdSet.has(rel.sourceEntityId) || !entityIdSet.has(rel.targetEntityId)) {
              continue;
            }
            const stored = await this.store.createRelationship({
              type: rel.type,
              sourceEntityId: rel.sourceEntityId,
              targetEntityId: rel.targetEntityId,
              description: rel.description,
              confidence: rel.confidence,
              properties: {},
              extractedBy: {
                promptId: relationship_inference_exports.PROMPT_ID,
                promptVersion: relationship_inference_exports.PROMPT_VERSION,
                model: result.model,
                provider: result.provider,
                tokensUsed: { input: result.inputTokens, output: result.outputTokens },
                timestamp: (/* @__PURE__ */ new Date()).toISOString()
              }
            });
            relationshipIds.push(stored.id);
            eventBus.emit({
              type: "relationship.created",
              payload: { relationship: stored },
              timestamp: (/* @__PURE__ */ new Date()).toISOString(),
              source: "ingest:pipeline"
            });
          }
          return relationshipIds;
        } catch (err) {
          logger11.warn("Relationship inference failed", {
            error: err instanceof Error ? err.message : String(err)
          });
          return [];
        }
      }
      deduplicateEntities(entities) {
        const seen = /* @__PURE__ */ new Map();
        for (const entity of entities) {
          const key = `${entity.type}:${entity.name.toLowerCase()}`;
          const existing = seen.get(key);
          if (!existing || entity.confidence > existing.confidence) {
            seen.set(key, entity);
          }
        }
        return [...seen.values()];
      }
    };
  }
});

// packages/ingest/dist/index.js
var dist_exports = {};
__export(dist_exports, {
  ConversationParser: () => ConversationParser,
  FileWatcher: () => FileWatcher,
  IngestionPipeline: () => IngestionPipeline,
  JsonParser: () => JsonParser,
  MarkdownParser: () => MarkdownParser,
  TypeScriptParser: () => TypeScriptParser,
  YamlParser: () => YamlParser,
  chunkSections: () => chunkSections,
  getParser: () => getParser,
  getSupportedExtensions: () => getSupportedExtensions,
  isConversationJson: () => isConversationJson,
  isConversationMarkdown: () => isConversationMarkdown
});
var init_dist4 = __esm({
  "packages/ingest/dist/index.js"() {
    "use strict";
    init_parsers();
    init_markdown();
    init_typescript();
    init_json_parser();
    init_yaml_parser();
    init_conversation();
    init_chunker();
    init_watcher();
    init_pipeline();
  }
});

// packages/server/dist/routes/entities.js
import { Router as Router2 } from "express";
function createEntityRoutes(bundle) {
  const router = Router2();
  const { store } = bundle;
  router.get("/", async (req, res) => {
    try {
      const { type, project, search, limit = "50", offset = "0", status = "active" } = req.query;
      if (search && typeof search === "string") {
        const results = await store.searchEntities(search, Number(limit));
        res.json({ success: true, data: results, meta: { total: results.length, limit: Number(limit), offset: 0 } });
        return;
      }
      const entities = await store.findEntities({
        type,
        projectId: project,
        status,
        limit: Number(limit),
        offset: Number(offset)
      });
      res.json({ success: true, data: entities, meta: { limit: Number(limit), offset: Number(offset) } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });
  router.get("/:id", async (req, res) => {
    try {
      const entity = await store.getEntity(req.params.id);
      if (!entity) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Entity not found" } });
        return;
      }
      res.json({ success: true, data: entity });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });
  router.get("/:id/relationships", async (req, res) => {
    try {
      const { direction = "both" } = req.query;
      const relationships = await store.getRelationshipsForEntity(req.params.id, direction);
      res.json({ success: true, data: relationships });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });
  return router;
}
var init_entities = __esm({
  "packages/server/dist/routes/entities.js"() {
    "use strict";
  }
});

// packages/server/dist/routes/relationships.js
import { Router as Router3 } from "express";
function createRelationshipRoutes(bundle) {
  const router = Router3();
  const { store } = bundle;
  router.get("/", async (req, res) => {
    try {
      const { type, sourceId, targetId, limit = "100" } = req.query;
      if (sourceId && typeof sourceId === "string") {
        const rels = await store.getRelationshipsForEntity(sourceId, "out");
        const filtered = type ? rels.filter((r) => r.type === type) : rels;
        res.json({ success: true, data: filtered.slice(0, Number(limit)) });
        return;
      }
      if (targetId && typeof targetId === "string") {
        const rels = await store.getRelationshipsForEntity(targetId, "in");
        const filtered = type ? rels.filter((r) => r.type === type) : rels;
        res.json({ success: true, data: filtered.slice(0, Number(limit)) });
        return;
      }
      res.json({
        success: true,
        data: [],
        meta: { message: "Provide sourceId or targetId to query relationships" }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });
  router.get("/:id", async (req, res) => {
    try {
      const rel = await store.getRelationship(req.params.id);
      if (!rel) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Relationship not found" } });
        return;
      }
      res.json({ success: true, data: rel });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });
  return router;
}
var init_relationships = __esm({
  "packages/server/dist/routes/relationships.js"() {
    "use strict";
  }
});

// packages/server/dist/routes/projects.js
import { Router as Router4 } from "express";
function createProjectRoutes(bundle) {
  const router = Router4();
  const { store } = bundle;
  router.get("/", async (_req, res) => {
    try {
      const projects = await store.listProjects();
      res.json({ success: true, data: projects });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });
  router.get("/:id", async (req, res) => {
    try {
      const project = await store.getProject(req.params.id);
      if (!project) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Project not found" } });
        return;
      }
      res.json({ success: true, data: project });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });
  return router;
}
var init_projects = __esm({
  "packages/server/dist/routes/projects.js"() {
    "use strict";
  }
});

// packages/server/dist/routes/query.js
import { Router as Router5 } from "express";
function createQueryRoutes(bundle) {
  const router = Router5();
  const { queryEngine, router: llmRouter } = bundle;
  router.post("/", async (req, res) => {
    try {
      const { query, projectId, stream = false } = req.body;
      if (!query || typeof query !== "string") {
        res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "query is required" } });
        return;
      }
      const context = await queryEngine.assembleContext(query, void 0, projectId);
      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        const systemPrompt8 = buildQuerySystemPrompt(context);
        const gen = llmRouter.stream({
          systemPrompt: systemPrompt8,
          userPrompt: query,
          promptId: "conversational_query",
          promptVersion: "1.0",
          task: LLMTask.CONVERSATIONAL_QUERY,
          modelPreference: "primary",
          temperature: 0.7
        });
        for await (const chunk of gen) {
          res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk })}

`);
        }
        res.write(`data: ${JSON.stringify({ type: "sources", entities: context.entities.slice(0, 10) })}

`);
        res.write(`data: ${JSON.stringify({ type: "complete" })}

`);
        res.end();
        return;
      }
      const systemPrompt7 = buildQuerySystemPrompt(context);
      const result = await llmRouter.complete({
        systemPrompt: systemPrompt7,
        userPrompt: query,
        promptId: "conversational_query",
        promptVersion: "1.0",
        task: LLMTask.CONVERSATIONAL_QUERY,
        modelPreference: "primary",
        temperature: 0.7
      });
      res.json({
        success: true,
        data: {
          answer: result.content,
          sources: context.entities.slice(0, 10),
          relationships: context.relationships,
          model: result.model,
          tokens: { input: result.inputTokens, output: result.outputTokens }
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "QUERY_FAILED", message: String(err) } });
    }
  });
  return router;
}
function buildQuerySystemPrompt(context) {
  const entityContext = context.entities.map((e, i) => `[${i + 1}] ${e.type}: ${e.name}
${e.summary ?? e.content}`).join("\n\n");
  return `You are Cortex, a knowledge graph assistant. Answer questions using ONLY the context below. Cite sources as [N].

## Knowledge Context
${entityContext || "No relevant entities found."}

## Instructions
- Answer concisely and accurately based on the context
- Cite sources using [N] notation
- If the context doesn't contain enough information, say so
- Suggest follow-up questions the user might ask`;
}
var init_query = __esm({
  "packages/server/dist/routes/query.js"() {
    "use strict";
    init_dist();
  }
});

// packages/server/dist/routes/contradictions.js
import { Router as Router6 } from "express";
function createContradictionRoutes(bundle) {
  const router = Router6();
  const { store } = bundle;
  router.get("/", async (req, res) => {
    try {
      const { status, severity, limit = "50" } = req.query;
      const contradictions = await store.findContradictions({
        status,
        limit: Number(limit)
      });
      const filtered = severity ? contradictions.filter((c) => c.severity === severity) : contradictions;
      const enriched = await Promise.all(filtered.map(async (c) => {
        const entityA = await store.getEntity(c.entityIds[0]);
        const entityB = await store.getEntity(c.entityIds[1]);
        return {
          ...c,
          entityA: entityA ? { id: entityA.id, name: entityA.name, type: entityA.type, summary: entityA.summary } : null,
          entityB: entityB ? { id: entityB.id, name: entityB.name, type: entityB.type, summary: entityB.summary } : null
        };
      }));
      res.json({ success: true, data: enriched, meta: { total: enriched.length } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });
  router.post("/:id/resolve", async (req, res) => {
    try {
      const { action } = req.body;
      const validActions = ["supersede", "dismiss", "keep_old", "both_valid"];
      if (!action || !validActions.includes(action)) {
        res.status(400).json({
          success: false,
          error: { code: "BAD_REQUEST", message: `action must be one of: ${validActions.join(", ")}` }
        });
        return;
      }
      await store.updateContradiction(req.params.id, {
        status: "resolved",
        resolvedAction: action,
        resolvedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({ success: true, data: { id: req.params.id, status: "resolved", action } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });
  return router;
}
var init_contradictions = __esm({
  "packages/server/dist/routes/contradictions.js"() {
    "use strict";
  }
});

// packages/server/dist/routes/status.js
import { Router as Router7 } from "express";
import { readFileSync as readFileSync9 } from "node:fs";
import { resolve as resolve18, dirname as dirname4 } from "node:path";
import { fileURLToPath } from "node:url";
function createStatusRoutes(bundle) {
  const router = Router7();
  const { store, router: llmRouter } = bundle;
  router.get("/status", async (_req, res) => {
    try {
      const stats = await store.getStats();
      const available = await llmRouter.isAvailable();
      const mode = llmRouter.getMode();
      res.json({
        success: true,
        data: {
          version: _version,
          graph: {
            entityCount: stats.entityCount,
            relationshipCount: stats.relationshipCount,
            fileCount: stats.fileCount,
            projectCount: stats.projectCount,
            contradictionCount: stats.contradictionCount,
            dbSizeBytes: stats.dbSizeBytes
          },
          llm: {
            mode,
            available
          }
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });
  router.get("/graph", (req, res) => {
    try {
      const { project, limit = "2000" } = req.query;
      const data = store.getGraphData({
        projectId: project,
        limit: Number(limit)
      });
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });
  router.get("/report", (_req, res) => {
    try {
      const data = store.getReportData();
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });
  return router;
}
var _version;
var init_status = __esm({
  "packages/server/dist/routes/status.js"() {
    "use strict";
    _version = "unknown";
    try {
      let dir = typeof __dirname !== "undefined" ? __dirname : dirname4(fileURLToPath(import.meta.url));
      for (let i = 0; i < 6; i++) {
        try {
          const pkg = JSON.parse(readFileSync9(resolve18(dir, "package.json"), "utf-8"));
          if (pkg.name === "gzoo-cortex" && pkg.version) {
            _version = pkg.version;
            break;
          }
        } catch {
        }
        dir = resolve18(dir, "..");
      }
    } catch {
    }
  }
});

// packages/server/dist/ws/event-relay.js
import { WebSocketServer, WebSocket } from "ws";
function createEventRelay(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const unsubscribers = [];
  wss.on("connection", (ws) => {
    logger26.debug("WebSocket client connected");
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        logger26.debug("WebSocket message received", { type: msg.type });
      } catch {
      }
    });
    ws.on("close", () => {
      logger26.debug("WebSocket client disconnected");
    });
  });
  for (const eventType of RELAYED_EVENTS) {
    const unsub = eventBus.on(eventType, (event) => {
      const message = JSON.stringify({
        type: "event",
        channel: eventType,
        event: {
          type: event.type,
          payload: event.payload,
          timestamp: event.timestamp,
          source: event.source
        }
      });
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    });
    unsubscribers.push(unsub);
  }
  const broadcast = (type, payload) => {
    const message = JSON.stringify({ type: "event", channel: type, event: { type, payload, timestamp: (/* @__PURE__ */ new Date()).toISOString() } });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  };
  const close = () => {
    for (const unsub of unsubscribers)
      unsub();
    wss.close();
  };
  logger26.info("Event relay initialized", { events: RELAYED_EVENTS.length });
  return { wss, broadcast, close };
}
var logger26, RELAYED_EVENTS;
var init_event_relay = __esm({
  "packages/server/dist/ws/event-relay.js"() {
    "use strict";
    init_dist();
    logger26 = createLogger("server:ws");
    RELAYED_EVENTS = [
      "entity.created",
      "relationship.created",
      "file.ingested",
      "entity.merged",
      "contradiction.detected",
      "budget.warning",
      "budget.exhausted",
      "llm.request.start",
      "llm.request.complete"
    ];
  }
});

// packages/server/dist/index.js
var dist_exports2 = {};
__export(dist_exports2, {
  startServer: () => startServer
});
import express from "express";
import { createServer } from "node:http";
import { resolve as resolve19 } from "node:path";
import cors from "cors";
function createBundle(config8) {
  const store = new SQLiteStore({ dbPath: config8.graph.dbPath, backupOnStartup: false });
  const vectorStore = new VectorStore();
  const queryEngine = new QueryEngine(store, vectorStore);
  const router = new Router({ config: config8 });
  return { store, queryEngine, router };
}
async function startServer(options) {
  const { config: config8, enableWatch = true } = options;
  const port = options.port ?? config8.server?.port ?? 3710;
  const host = options.host ?? config8.server?.host ?? "127.0.0.1";
  const bundle = createBundle(config8);
  const app = express();
  const server = createServer(app);
  app.use(cors({ origin: config8.server?.cors ?? ["http://localhost:*", "http://127.0.0.1:*"] }));
  app.use(express.json());
  const api = express.Router();
  api.use("/entities", createEntityRoutes(bundle));
  api.use("/relationships", createRelationshipRoutes(bundle));
  api.use("/projects", createProjectRoutes(bundle));
  api.use("/query", createQueryRoutes(bundle));
  api.use("/contradictions", createContradictionRoutes(bundle));
  api.use("/", createStatusRoutes(bundle));
  app.use("/api/v1", api);
  const relay = createEventRelay(server);
  logger27.info("WebSocket relay attached", { path: "/ws" });
  if (options.webDistPath) {
    const webDist = resolve19(options.webDistPath);
    app.use(express.static(webDist));
    app.get("*", (_req, res) => {
      res.sendFile(resolve19(webDist, "index.html"));
    });
    logger27.info("Serving web dashboard", { path: webDist });
  }
  if (enableWatch) {
    try {
      const { FileWatcher: FileWatcher2, IngestionPipeline: IngestionPipeline2 } = await Promise.resolve().then(() => (init_dist4(), dist_exports));
      const projects = await bundle.store.listProjects();
      if (projects.length > 0) {
        for (const project of projects) {
          const pipeline = new IngestionPipeline2(bundle.router, bundle.store, {
            projectId: project.id,
            projectName: project.name,
            projectRoot: project.rootPath,
            maxFileSize: config8.ingest.maxFileSize,
            batchSize: config8.ingest.batchSize,
            projectPrivacyLevel: project.privacyLevel,
            mergeConfidenceThreshold: 0.85
          });
          const watcher = new FileWatcher2({
            dirs: [project.rootPath],
            exclude: config8.ingest.exclude,
            fileTypes: config8.ingest.fileTypes,
            debounceMs: config8.ingest.debounceMs,
            followSymlinks: config8.ingest.followSymlinks,
            maxFileSize: config8.ingest.maxFileSize,
            ignoreInitial: true
            // Don't re-ingest existing files on server start
          });
          watcher.onFileChange(async (filePath, changeType) => {
            if (changeType === "add" || changeType === "change") {
              await pipeline.ingestFile(filePath);
            }
          });
          watcher.start();
          logger27.info("Watching project", { name: project.name, path: project.rootPath });
        }
      } else {
        logger27.warn("No projects registered \u2014 file watcher not started. Run `cortex init` first.");
      }
    } catch (err) {
      logger27.warn("File watcher failed to start", {
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  server.listen(port, host, () => {
    logger27.info(`Cortex server running at http://${host}:${port}`);
    console.log(`
  Cortex server running at http://${host}:${port}`);
    console.log(`  API:       http://${host}:${port}/api/v1`);
    console.log(`  WebSocket: ws://${host}:${port}/ws`);
    if (options.webDistPath) {
      console.log(`  Dashboard: http://${host}:${port}/`);
    }
    if (enableWatch) {
      console.log(`  Watcher:   active`);
    }
    console.log("");
  });
  const shutdown = () => {
    logger27.info("Shutting down...");
    relay.close();
    server.close();
    bundle.store.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
var logger27;
var init_dist5 = __esm({
  "packages/server/dist/index.js"() {
    "use strict";
    init_dist();
    init_dist2();
    init_dist3();
    init_entities();
    init_relationships();
    init_projects();
    init_query();
    init_contradictions();
    init_status();
    init_event_relay();
    logger27 = createLogger("server");
  }
});

// packages/cli/dist/index.js
import { Command } from "commander";

// packages/cli/dist/commands/init.js
init_dist();
import { writeFileSync as writeFileSync2, existsSync as existsSync3, mkdirSync as mkdirSync2, readFileSync as readFileSync3 } from "node:fs";
import { resolve as resolve2, join as join3 } from "node:path";
import { homedir as homedir3 } from "node:os";
import inquirer from "inquirer";
import chalk from "chalk";
function registerInitCommand(program2) {
  program2.command("init").description("Interactive setup wizard \u2014 creates cortex.config.json").option("--mode <mode>", "LLM routing mode (cloud-first, hybrid, local-first, local-only)").option("--non-interactive", "Use defaults, no prompts", false).action(async (opts) => {
    const globals = program2.opts();
    await runInit(opts, globals);
  });
}
var GPU_PRESETS = {
  high: { model: "qwen2.5:14b-instruct-q5_K_M", numCtx: 8192, extractionLocal: true },
  mid: { model: "mistral:7b-instruct-q5_K_M", numCtx: 4096, extractionLocal: false },
  low: { model: "phi3:mini-4k-instruct-q4_K_M", numCtx: 2048, extractionLocal: false }
};
var CLOUD_PRESETS = {
  anthropic: {
    provider: "anthropic",
    baseUrl: void 0,
    apiKeySource: "env:CORTEX_ANTHROPIC_API_KEY",
    envVar: "CORTEX_ANTHROPIC_API_KEY",
    models: { primary: "claude-sonnet-4-5-20250929", fast: "claude-haiku-4-5-20251001" },
    promptCaching: true,
    label: "Anthropic (Claude)",
    hint: "Best quality, higher cost"
  },
  gemini: {
    provider: "openai-compatible",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKeySource: "env:CORTEX_GEMINI_API_KEY",
    envVar: "CORTEX_GEMINI_API_KEY",
    models: { primary: "gemini-2.5-flash", fast: "gemini-2.5-flash" },
    promptCaching: false,
    label: "Google Gemini",
    hint: "Very cheap, good quality"
  },
  groq: {
    provider: "openai-compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeySource: "env:CORTEX_GROQ_API_KEY",
    envVar: "CORTEX_GROQ_API_KEY",
    models: { primary: "llama-3.3-70b-versatile", fast: "llama-3.1-8b-instant" },
    promptCaching: false,
    label: "Groq",
    hint: "Fast inference, free tier available"
  },
  openrouter: {
    provider: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeySource: "env:CORTEX_OPENROUTER_API_KEY",
    envVar: "CORTEX_OPENROUTER_API_KEY",
    models: { primary: "google/gemini-2.0-flash-001", fast: "google/gemini-2.0-flash-lite-001" },
    promptCaching: false,
    label: "OpenRouter",
    hint: "Access to many models via one key"
  }
};
var VRAM_HINT = process.platform === "darwin" ? "(Apple menu \u2192 About This Mac \u2192 More Info \u2192 Graphics)" : process.platform === "linux" ? "(run: nvidia-smi or rocm-smi)" : "(Task Manager \u2192 Performance \u2192 GPU \u2192 Dedicated GPU Memory)";
async function runInit(opts, globals) {
  const config8 = getDefaultConfig();
  if (opts.nonInteractive) {
    if (opts.mode)
      config8.llm.mode = opts.mode;
    writeConfig(config8, globals);
    return;
  }
  if (!globals.quiet)
    console.log(chalk.bold("\nCortex Setup\n"));
  const { hasOllama } = await inquirer.prompt([{
    type: "confirm",
    name: "hasOllama",
    message: "Do you have Ollama installed and running locally?",
    default: false
  }]);
  const { hasApiKey } = await inquirer.prompt([{
    type: "confirm",
    name: "hasApiKey",
    message: "Do you have a cloud LLM API key? (Anthropic, Gemini, Groq, etc.)",
    default: true
  }]);
  let mode;
  if (hasOllama && hasApiKey) {
    mode = "hybrid";
    console.log(chalk.dim("  \u2192 Hybrid mode: GPU for ingestion, Claude for queries"));
  } else if (hasOllama) {
    mode = "local-only";
    console.log(chalk.dim("  \u2192 Local-only mode: everything runs on your GPU"));
  } else {
    mode = "cloud-first";
    console.log(chalk.dim("  \u2192 Cloud mode: everything runs via Claude API"));
  }
  config8.llm.mode = mode;
  const usesLocal = hasOllama;
  const usesCloud = hasApiKey;
  if (usesLocal) {
    console.log("");
    const { vramGb } = await inquirer.prompt([{
      type: "number",
      name: "vramGb",
      message: `How many GB of VRAM does your GPU have? ${VRAM_HINT}`,
      default: 8,
      validate: (v) => v > 0 && Number.isFinite(v) || "Enter a number greater than 0"
    }]);
    const gpuTier = vramGb >= 24 ? "high" : vramGb >= 8 ? "mid" : "low";
    const { useManual } = await inquirer.prompt([{
      type: "confirm",
      name: "useManual",
      message: `Recommended model: ${GPU_PRESETS[gpuTier].model} \u2014 use a different one?`,
      default: false
    }]);
    if (useManual) {
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "model",
          message: "Ollama model name:",
          default: config8.llm.local.model
        },
        {
          type: "number",
          name: "numCtx",
          message: "Context window (lower = less VRAM):",
          default: config8.llm.local.numCtx
        }
      ]);
      config8.llm.local.model = answers.model;
      config8.llm.local.numCtx = answers.numCtx;
    } else {
      const preset = GPU_PRESETS[gpuTier];
      config8.llm.local.model = preset.model;
      config8.llm.local.numCtx = preset.numCtx;
      console.log(chalk.dim(`  \u2192 run: ollama pull ${preset.model}`));
      if (mode === "hybrid") {
        const extractionRoute = preset.extractionLocal ? "local" : "cloud";
        config8.llm.taskRouting = {
          entity_extraction: extractionRoute,
          relationship_inference: extractionRoute,
          contradiction_detection: "local",
          conversational_query: "cloud",
          context_ranking: "local",
          embedding_generation: "local"
        };
        if (!preset.extractionLocal) {
          console.log(chalk.dim("  \u2192 File extraction routed to cloud (more reliable on 7B models)"));
        }
      }
    }
  }
  let selectedPresetKey = "gemini";
  if (usesCloud) {
    console.log("");
    const choices = Object.entries(CLOUD_PRESETS).map(([key, preset2]) => ({
      name: `${preset2.label} \u2014 ${preset2.hint}`,
      value: key
    }));
    const { cloudProvider } = await inquirer.prompt([{
      type: "list",
      name: "cloudProvider",
      message: "Which cloud LLM provider?",
      choices,
      default: "gemini"
    }]);
    selectedPresetKey = cloudProvider;
    const preset = CLOUD_PRESETS[selectedPresetKey];
    config8.llm.cloud.provider = preset.provider;
    if (preset.baseUrl) {
      config8.llm.cloud.baseUrl = preset.baseUrl;
    }
    config8.llm.cloud.apiKeySource = preset.apiKeySource;
    config8.llm.cloud.models = { ...preset.models };
    config8.llm.cloud.promptCaching = preset.promptCaching;
    const envVar = preset.envVar;
    if (process.env[envVar]) {
      console.log(chalk.green(`  \u2713 ${envVar} found in environment`));
    } else {
      const { apiKey } = await inquirer.prompt([{
        type: "password",
        name: "apiKey",
        message: `Paste your ${preset.label} API key:`,
        mask: "*"
      }]);
      if (apiKey.trim()) {
        writeEnvFile(envVar, apiKey.trim());
        process.env[envVar] = apiKey.trim();
        console.log(chalk.green(`  \u2713 Saved to ~/.cortex/.env`));
      } else {
        console.log(chalk.yellow(`  ! No key provided \u2014 set ${envVar} later in ~/.cortex/.env`));
      }
    }
  }
  console.log("");
  const { watchDirs } = await inquirer.prompt([{
    type: "input",
    name: "watchDirs",
    message: "Directories to watch (comma-separated):",
    default: "."
  }]);
  config8.ingest.watchDirs = watchDirs.split(",").map((d) => d.trim());
  if (usesCloud) {
    const { budget } = await inquirer.prompt([{
      type: "number",
      name: "budget",
      message: "Monthly LLM spend limit in USD (0 = no limit):",
      default: 25
    }]);
    config8.llm.budget.monthlyLimitUsd = budget;
  }
  writeConfig(config8, globals);
}
function writeEnvFile(key, value) {
  const cortexDir = join3(homedir3(), ".cortex");
  if (!existsSync3(cortexDir)) {
    mkdirSync2(cortexDir, { recursive: true });
  }
  const envPath = join3(cortexDir, ".env");
  let content = "";
  if (existsSync3(envPath)) {
    content = readFileSync3(envPath, "utf-8");
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
      writeFileSync2(envPath, content, { mode: 384 });
      return;
    }
    if (content.length > 0 && !content.endsWith("\n")) {
      content += "\n";
    }
  } else {
    content = "# Cortex API Keys\n# This file is loaded automatically by Cortex. Do not commit this file.\n\n";
  }
  content += `${key}=${value}
`;
  writeFileSync2(envPath, content, { mode: 384 });
}
function writeConfig(config8, globals) {
  const validated = cortexConfigSchema.parse(config8);
  const cortexDir = join3(homedir3(), ".cortex");
  if (!existsSync3(cortexDir)) {
    mkdirSync2(cortexDir, { recursive: true });
  }
  const configPath = globals.config ? resolve2(globals.config, "cortex.config.json") : join3(cortexDir, "cortex.config.json");
  writeFileSync2(configPath, JSON.stringify(validated, null, 2), { mode: 384 });
  if (!globals.quiet) {
    if (globals.json) {
      console.log(JSON.stringify({ success: true, path: configPath }));
    } else {
      console.log(chalk.green(`
\u2713 Config written to ${configPath}`));
      console.log(chalk.dim("  Run `cortex watch` to start.\n"));
    }
  }
}

// packages/cli/dist/commands/watch.js
init_dist();
init_dist2();
init_dist3();
init_dist4();
import { resolve as resolve3, join as join4 } from "node:path";
import { existsSync as existsSync4 } from "node:fs";
import chalk2 from "chalk";
import ora from "ora";
var logger12 = createLogger("cli:watch");
function registerWatchCommand(program2) {
  program2.command("watch [project]").description("Start file watcher + ingestion pipeline. Optionally specify a registered project name.").option("--no-confirm", "Skip cost confirmation for bulk ingestion").action(async (projectName, opts) => {
    const globals = program2.opts();
    await runWatch(projectName, opts, globals);
  });
}
async function runWatch(projectName, opts, globals) {
  let projectRoot;
  let projectDisplayName = projectName;
  if (projectName) {
    const registeredProject = getProject(projectName);
    if (!registeredProject) {
      console.error(chalk2.red(`Error: Project "${projectName}" is not registered.`));
      console.log(chalk2.dim("Register it with: cortex projects add <name> <path>"));
      console.log(chalk2.dim("Or list registered projects: cortex projects list"));
      process.exit(1);
    }
    projectRoot = registeredProject.path;
    const configPath2 = join4(projectRoot, "cortex.config.json");
    if (!existsSync4(configPath2)) {
      console.error(chalk2.red(`Error: No cortex.config.json found in ${projectRoot}`));
      console.log(chalk2.dim(`Run 'cd ${projectRoot} && cortex init' to create one.`));
      process.exit(1);
    }
    updateProjectLastWatched(projectName);
  }
  const configDir = globals.config ? resolve3(globals.config) : projectRoot;
  const configPath = findConfigFile(configDir);
  if (!globals.quiet) {
    console.log(chalk2.dim(`Config: ${configPath ?? "(none found \u2014 using defaults)"}`));
  }
  const config8 = loadConfig({ configDir });
  if (!globals.verbose) {
    setGlobalLogLevel("error");
  }
  if (!globals.quiet) {
    if (projectDisplayName) {
      console.log(chalk2.bold(`
\u26A1 Cortex Watch: ${chalk2.cyan(projectDisplayName)}
`));
    } else {
      console.log(chalk2.bold("\n\u26A1 Cortex Watch\n"));
    }
  }
  const store = new SQLiteStore({
    dbPath: config8.graph.dbPath,
    walMode: config8.graph.walMode,
    backupOnStartup: config8.graph.backupOnStartup
  });
  const router = new Router({ config: config8 });
  const projects = await store.listProjects();
  let project = projects[0];
  if (!project) {
    project = await store.createProject({
      name: "default",
      rootPath: resolve3(config8.ingest.watchDirs[0] ?? "."),
      privacyLevel: config8.privacy.defaultLevel,
      fileCount: 0,
      entityCount: 0
    });
  }
  const pipeline = new IngestionPipeline(router, store, {
    projectId: project.id,
    projectName: project.name,
    projectRoot: project.rootPath,
    maxFileSize: config8.ingest.maxFileSize,
    batchSize: config8.ingest.batchSize,
    projectPrivacyLevel: project.privacyLevel,
    mergeConfidenceThreshold: config8.graph.mergeConfidenceThreshold
  });
  const watcher = FileWatcher.fromConfig(config8.ingest);
  let ingestedCount = 0;
  let entityCount = 0;
  let errorCount = 0;
  let shuttingDown = false;
  const MAX_CONCURRENT = config8.ingest.batchSize;
  let activeJobs = 0;
  const queue = [];
  const spinner = ora({ isSilent: globals.quiet });
  async function processFile(path) {
    if (shuttingDown)
      return;
    spinner.start(`Ingesting ${path}...`);
    try {
      const result = await pipeline.ingestFile(path);
      if (shuttingDown)
        return;
      if (result.status === "ingested") {
        ingestedCount++;
        entityCount += result.entityIds.length;
        spinner.succeed(`${path} \u2192 ${result.entityIds.length} entities, ${result.relationshipIds.length} relationships`);
      } else if (result.status === "skipped") {
        spinner.info(`${path} \u2014 skipped${result.error ? ` (${result.error})` : ""}`);
      } else {
        errorCount++;
        spinner.fail(`${path} \u2014 failed: ${result.error}`);
      }
    } catch (err) {
      if (shuttingDown)
        return;
      errorCount++;
      spinner.fail(`${path} \u2014 error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  function drainQueue() {
    while (queue.length > 0 && activeJobs < MAX_CONCURRENT && !shuttingDown) {
      const item = queue.shift();
      if (!item)
        break;
      activeJobs++;
      processFile(item.path).catch(() => {
      }).finally(() => {
        activeJobs--;
        drainQueue();
      });
    }
  }
  watcher.onFileChange((path, changeType) => {
    if (shuttingDown)
      return;
    if (changeType === "unlink") {
      logger12.debug("File deleted", { path });
      return;
    }
    queue.push({ path, changeType });
    drainQueue();
  });
  watcher.start();
  eventBus.on("contradiction.detected", (event) => {
    if (globals.quiet)
      return;
    spinner.stop();
    const { contradiction: c } = event.payload;
    const severityColor = c.severity === "critical" ? chalk2.red : c.severity === "high" ? chalk2.yellow : chalk2.dim;
    console.log(severityColor(`
\u26A0 Contradiction [${c.severity}]: ${c.description}`));
    if (c.suggestedResolution) {
      console.log(chalk2.dim(`  Suggestion: ${c.suggestedResolution}`));
    }
    console.log(chalk2.dim(`  Resolve with: cortex resolve ${c.id} --action <action>
`));
  });
  eventBus.on("budget.warning", (event) => {
    if (globals.quiet)
      return;
    spinner.stop();
    const { usedPercent, remainingUsd } = event.payload;
    const color = usedPercent >= 90 ? chalk2.red : chalk2.yellow;
    console.log(color(`
\u{1F4B8} Budget: ${usedPercent}% used ($${remainingUsd.toFixed(2)} remaining)
`));
  });
  eventBus.on("budget.exhausted", (event) => {
    if (globals.quiet)
      return;
    spinner.stop();
    const { totalSpentUsd } = event.payload;
    console.log(chalk2.red(`
\u26D4 Monthly budget exhausted ($${totalSpentUsd.toFixed(2)} spent)`));
    console.log(chalk2.dim("   All tasks are now routing to local Ollama. Run `cortex costs` for details.\n"));
  });
  if (!globals.quiet) {
    console.log(chalk2.dim(`Watching ${config8.ingest.watchDirs.join(", ")} (Ctrl+C to stop)
`));
  }
  const shutdown = () => {
    if (shuttingDown) {
      process.exit(1);
    }
    shuttingDown = true;
    queue.length = 0;
    if (!globals.quiet) {
      spinner.stop();
      console.log(chalk2.dim("\n\nShutting down..."));
      console.log(chalk2.green(`
\u2713 Session: ${ingestedCount} files, ${entityCount} entities, ${errorCount} errors`));
    }
    watcher.stop().catch(() => {
    }).finally(() => {
      try {
        store.close();
      } catch {
      }
      process.exit(0);
    });
    const forceTimer = setTimeout(() => {
      process.exit(0);
    }, 3e3);
    forceTimer.unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", (data) => {
      if (data[0] === 3) {
        shutdown();
      }
    });
  }
  await new Promise(() => {
  });
}

// packages/cli/dist/commands/query.js
init_dist();
init_dist2();
init_dist2();
init_dist2();
init_dist3();
import { resolve as resolve4 } from "node:path";
import chalk3 from "chalk";
var logger13 = createLogger("cli:query");
function registerQueryCommand(program2) {
  program2.command("query <question>").description("Natural language query with citations").option("--project <name>", "Filter to specific project").option("--type <type>", "Filter entity type").option("--since <date>", "Only entities after date").option("--before <date>", "Only entities before date").option("--raw", "Show debug info", false).option("--no-stream", "Wait for full response").action(async (question, opts) => {
    const globals = program2.opts();
    await runQuery(question, opts, globals);
  });
}
async function runQuery(question, opts, globals) {
  const config8 = loadConfig({ configDir: globals.config ? resolve4(globals.config) : void 0 });
  const store = new SQLiteStore({ dbPath: config8.graph.dbPath, backupOnStartup: false });
  const vectorStore = new VectorStore({ dbPath: config8.graph.vectorDbPath });
  await vectorStore.initialize();
  const queryEngine = new QueryEngine(store, vectorStore, { maxContextTokens: config8.llm.maxContextTokens });
  const router = new Router({ config: config8 });
  const [graphStats, projects] = await Promise.all([
    store.getStats(),
    store.listProjects()
  ]);
  const graphSummary = [
    `${graphStats.entityCount} entities, ${graphStats.relationshipCount} relationships, ${graphStats.fileCount} files indexed`,
    projects.length > 0 ? `Projects: ${projects.map((p) => `${p.name} (${p.rootPath})`).join(", ")}` : "No projects configured.",
    projects.some((p) => p.lastIngestedAt) ? `Last ingested: ${projects.map((p) => p.lastIngestedAt).filter(Boolean).sort().pop()}` : ""
  ].filter(Boolean).join("\n");
  const context = await queryEngine.assembleContext(question, void 0, opts.project);
  if (opts.raw) {
    console.log(chalk3.dim(`Context: ${context.entities.length} entities, ${context.relationships.length} rels, ~${context.totalTokensEstimate} tokens
`));
  }
  if (context.entities.length === 0 && graphStats.entityCount === 0) {
    console.log(chalk3.yellow("No entities found. Try ingesting files first with `cortex watch`."));
    store.close();
    return;
  }
  const contextEntities = context.entities.map((e) => {
    const rels = context.relationships.filter((r) => r.sourceEntityId === e.id).map((r) => ({ type: r.type, targetEntityId: r.targetEntityId }));
    return {
      id: e.id,
      type: e.type,
      name: e.name,
      content: e.content,
      sourceFile: e.sourceFile,
      createdAt: e.createdAt,
      relationships: rels
    };
  });
  const userPrompt = conversational_query_exports.buildUserPrompt({ contextEntities, userQuery: question, graphSummary });
  if (opts.stream && !globals.json) {
    const gen = router.stream({
      systemPrompt: conversational_query_exports.systemPrompt,
      userPrompt,
      promptId: conversational_query_exports.PROMPT_ID,
      promptVersion: conversational_query_exports.PROMPT_VERSION,
      task: LLMTask.CONVERSATIONAL_QUERY,
      modelPreference: "primary",
      temperature: conversational_query_exports.config.temperature,
      maxTokens: conversational_query_exports.config.maxTokens
    });
    let fullResponse = "";
    let result;
    while (true) {
      const { value, done } = await gen.next();
      if (done) {
        result = value;
        break;
      }
      process.stdout.write(value);
      fullResponse += value;
    }
    console.log("");
    await showFollowUps(router, question, fullResponse, globals);
    if (opts.raw && result) {
      console.log(chalk3.dim(`
Tokens: ${result.inputTokens} in / ${result.outputTokens} out | Cost: $${result.costUsd.toFixed(4)}`));
    }
  } else {
    const result = await router.complete({
      systemPrompt: conversational_query_exports.systemPrompt,
      userPrompt,
      promptId: conversational_query_exports.PROMPT_ID,
      promptVersion: conversational_query_exports.PROMPT_VERSION,
      task: LLMTask.CONVERSATIONAL_QUERY,
      modelPreference: "primary",
      temperature: conversational_query_exports.config.temperature,
      maxTokens: conversational_query_exports.config.maxTokens
    });
    if (globals.json) {
      console.log(JSON.stringify({
        answer: result.content,
        entities: context.entities.map((e) => ({ id: e.id, type: e.type, name: e.name })),
        cost: result.costUsd
      }));
    } else {
      console.log(result.content);
      await showFollowUps(router, question, result.content, globals);
    }
  }
  store.close();
}
async function showFollowUps(router, question, answer, globals) {
  if (globals.json || globals.quiet)
    return;
  try {
    const result = await router.completeStructured({
      systemPrompt: follow_up_generation_exports.systemPrompt,
      userPrompt: follow_up_generation_exports.buildUserPrompt({
        userQuery: question,
        answerSummary: answer.slice(0, 500)
      }),
      promptId: follow_up_generation_exports.PROMPT_ID,
      promptVersion: follow_up_generation_exports.PROMPT_VERSION,
      task: LLMTask.CONVERSATIONAL_QUERY,
      modelPreference: "fast",
      temperature: follow_up_generation_exports.config.temperature,
      maxTokens: follow_up_generation_exports.config.maxTokens
    }, follow_up_generation_exports.outputSchema);
    console.log(chalk3.dim("\nFollow-ups:"));
    for (const q of result.data.followUps) {
      console.log(chalk3.dim(`  \u2192 ${q}`));
    }
  } catch {
  }
}

// packages/cli/dist/commands/find.js
init_dist();
init_dist2();
import { resolve as resolve5 } from "node:path";
import chalk4 from "chalk";
var logger14 = createLogger("cli:find");
function registerFindCommand(program2) {
  program2.command("find <name>").description("Direct entity lookup with relationship expansion").option("--expand <depth>", "Show N hops of relationships", "0").option("--type <type>", "Filter entity type").action(async (name, opts) => {
    const globals = program2.opts();
    await runFind(name, opts, globals);
  });
}
async function runFind(name, opts, globals) {
  const config8 = loadConfig({ configDir: globals.config ? resolve5(globals.config) : void 0 });
  const store = new SQLiteStore({ dbPath: config8.graph.dbPath, backupOnStartup: false });
  const depth = parseInt(opts.expand, 10) || 0;
  try {
    let entity = await store.getEntity(name);
    if (!entity) {
      const results = await store.searchEntities(name, 20);
      const filtered = opts.type ? results.filter((e) => e.type === opts.type) : results;
      if (filtered.length === 0) {
        if (globals.json) {
          console.log(JSON.stringify({ error: "No entities found", query: name }));
        } else {
          console.log(chalk4.yellow(`No entities found matching "${name}".`));
        }
        store.close();
        return;
      }
      if (filtered.length === 1) {
        entity = filtered[0];
      } else {
        if (globals.json) {
          console.log(JSON.stringify({
            matches: filtered.map((e) => ({ id: e.id, type: e.type, name: e.name }))
          }));
        } else {
          console.log(chalk4.cyan(`Found ${filtered.length} matches for "${name}":
`));
          for (const e of filtered) {
            console.log(`  ${chalk4.dim(e.id.slice(0, 8))}  ${chalk4.bold(e.name)}  ${chalk4.dim(`[${e.type}]`)}`);
          }
          console.log(chalk4.dim("\nUse the full ID to select a specific entity."));
        }
        store.close();
        return;
      }
    }
    if (globals.json) {
      const rels = depth > 0 ? await store.getRelationshipsForEntity(entity.id) : [];
      console.log(JSON.stringify({ entity, relationships: rels }));
    } else {
      displayEntity(entity);
      if (depth > 0) {
        await expandRelationships(store, entity.id, depth, /* @__PURE__ */ new Set([entity.id]));
      }
    }
  } catch (err) {
    logger14.error("Find failed", { error: err instanceof Error ? err.message : String(err) });
    if (globals.json) {
      console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    } else {
      console.error(chalk4.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    }
  }
  store.close();
}
function displayEntity(entity) {
  console.log("");
  console.log(chalk4.bold.cyan(`${entity.name}`) + chalk4.dim(` [${entity.type}]`));
  console.log(chalk4.dim("\u2500".repeat(50)));
  console.log(chalk4.dim(`ID:         ${entity.id}`));
  console.log(chalk4.dim(`Source:     ${entity.sourceFile}`));
  if (entity.sourceRange) {
    console.log(chalk4.dim(`Lines:      ${entity.sourceRange.startLine}\u2013${entity.sourceRange.endLine}`));
  }
  console.log(chalk4.dim(`Confidence: ${(entity.confidence * 100).toFixed(0)}%`));
  console.log(chalk4.dim(`Created:    ${entity.createdAt}`));
  if (entity.summary) {
    console.log("");
    console.log(chalk4.white(entity.summary));
  }
  if (entity.tags.length > 0) {
    console.log("");
    console.log(chalk4.dim("Tags: ") + entity.tags.map((t) => chalk4.cyan(t)).join(", "));
  }
  console.log("");
}
async function expandRelationships(store, entityId, depth, visited) {
  const relationships = await store.getRelationshipsForEntity(entityId);
  if (relationships.length === 0) {
    console.log(chalk4.dim("  No relationships found."));
    return;
  }
  console.log(chalk4.bold("Relationships:"));
  for (const rel of relationships) {
    const isSource = rel.sourceEntityId === entityId;
    const otherEntityId = isSource ? rel.targetEntityId : rel.sourceEntityId;
    const direction = isSource ? "\u2192" : "\u2190";
    const otherEntity = await store.getEntity(otherEntityId);
    const otherName = otherEntity ? otherEntity.name : otherEntityId.slice(0, 8);
    const otherType = otherEntity ? `[${otherEntity.type}]` : "";
    displayRelationship(rel, direction, otherName, otherType);
    if (depth > 1 && !visited.has(otherEntityId)) {
      visited.add(otherEntityId);
      console.log(chalk4.dim(`  ${"\u2500".repeat(40)}`));
      await expandRelationships(store, otherEntityId, depth - 1, visited);
    }
  }
}
function displayRelationship(rel, direction, targetName, targetType) {
  const confidenceColor = rel.confidence >= 0.8 ? chalk4.green : rel.confidence >= 0.5 ? chalk4.yellow : chalk4.red;
  console.log(`  ${direction} ${chalk4.bold(rel.type)} ${chalk4.cyan(targetName)} ${chalk4.dim(targetType)} ${confidenceColor(`${(rel.confidence * 100).toFixed(0)}%`)}`);
  if (rel.description) {
    console.log(chalk4.dim(`    ${rel.description}`));
  }
}

// packages/cli/dist/commands/status.js
init_dist();
init_dist2();
init_dist3();
import { resolve as resolve6 } from "node:path";
import { statSync as statSync3 } from "node:fs";
import chalk5 from "chalk";
var logger15 = createLogger("cli:status");
async function checkOllamaAvailable(host) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3e3);
    const response = await fetch(`${host}/api/tags`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
function registerStatusCommand(program2) {
  program2.command("status").description("System dashboard \u2014 graph stats, LLM status, costs").action(async () => {
    const globals = program2.opts();
    await runStatus(globals);
  });
}
function formatBytes(bytes) {
  if (bytes === 0)
    return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${units[i]}`;
}
async function runStatus(globals) {
  const config8 = loadConfig({ configDir: globals.config ? resolve6(globals.config) : void 0 });
  const store = new SQLiteStore({ dbPath: config8.graph.dbPath, backupOnStartup: false });
  try {
    const stats = await store.getStats();
    const projects = await store.listProjects();
    let vectorSizeBytes = 0;
    try {
      const vectorStat = statSync3(config8.graph.vectorDbPath);
      vectorSizeBytes = vectorStat.size;
    } catch {
    }
    const apiKeySource = config8.llm.cloud.apiKeySource;
    const apiKeyEnvVar = apiKeySource.startsWith("env:") ? apiKeySource.slice(4) : void 0;
    const hasApiKey = apiKeyEnvVar ? Boolean(process.env[apiKeyEnvVar]) : false;
    const mode = config8.llm.mode;
    const ollamaAvailable = mode !== "cloud-first" ? await checkOllamaAvailable(config8.llm.local.host) : false;
    const router = new Router({ config: config8 });
    const tracker = router.getTracker();
    const summary = tracker.getSummary();
    const localTokens = tracker.getRecords().filter((r) => r.provider === "ollama").reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0);
    const HAIKU_RATE_PER_M = 2.4;
    const localSavingsUsd = localTokens / 1e6 * HAIKU_RATE_PER_M;
    const localProvider = router.getLocalProvider();
    if (globals.json) {
      console.log(JSON.stringify({
        graph: {
          entities: stats.entityCount,
          relationships: stats.relationshipCount,
          contradictions: stats.contradictionCount
        },
        projects: projects.map((p) => p.name),
        files: {
          tracked: stats.fileCount
        },
        storage: {
          sqliteBytes: stats.dbSizeBytes,
          vectorBytes: vectorSizeBytes
        },
        llm: {
          mode,
          cloud: {
            provider: config8.llm.cloud.provider,
            available: hasApiKey
          },
          local: {
            provider: "ollama",
            available: ollamaAvailable,
            host: config8.llm.local.host,
            model: config8.llm.local.model,
            numCtx: localProvider?.getNumCtx() ?? config8.llm.local.numCtx
          }
        },
        budget: {
          monthlyLimitUsd: config8.llm.budget.monthlyLimitUsd,
          spentThisMonthUsd: summary.totalCostUsd,
          localSavingsUsd: Math.round(localSavingsUsd * 100) / 100
        }
      }));
      store.close();
      return;
    }
    console.log("");
    console.log(chalk5.bold.cyan("CORTEX STATUS"));
    console.log(chalk5.dim("\u2500".repeat(50)));
    console.log(chalk5.white("Graph:     ") + chalk5.bold(`${stats.entityCount.toLocaleString()}`) + " entities | " + chalk5.bold(`${stats.relationshipCount.toLocaleString()}`) + " relationships | " + chalk5.bold(`${stats.contradictionCount}`) + " contradictions");
    const projectNames = projects.map((p) => p.name).join(", ") || "none";
    console.log(chalk5.white("Projects:  ") + `${projects.length} watched (${projectNames})`);
    console.log(chalk5.white("Files:     ") + `${stats.fileCount} tracked`);
    console.log(chalk5.white("Storage:   ") + `${formatBytes(stats.dbSizeBytes)} (SQLite) | ${formatBytes(vectorSizeBytes)} (vectors)`);
    console.log("");
    const numCtx = localProvider?.getNumCtx() ?? config8.llm.local.numCtx;
    const numGpu = localProvider?.getNumGpu() ?? config8.llm.local.numGpu;
    console.log(chalk5.white("LLM Mode:  ") + mode);
    const cloudLabel = `${config8.llm.cloud.models.primary} / ${config8.llm.cloud.models.fast} (${config8.llm.cloud.provider})`;
    const localLabel = `${config8.llm.local.model} @ ${config8.llm.local.host}`;
    const localDetail = `${numCtx.toLocaleString()} ctx | GPU: ${numGpu === -1 ? "auto" : numGpu} layers | ~30 tok/s est.`;
    if (mode === "cloud-first") {
      const llmStatus = hasApiKey ? chalk5.green("\u2713") : chalk5.red("\u2717");
      console.log(chalk5.white("  Cloud:   ") + `${llmStatus} ${cloudLabel}`);
    } else if (mode === "local-only") {
      const llmStatus = ollamaAvailable ? chalk5.green("\u2713") : chalk5.red("\u2717");
      console.log(chalk5.white("  Local:   ") + `${llmStatus} ${localLabel}`);
      console.log(chalk5.dim(`            ${localDetail}`));
    } else if (mode === "local-first") {
      const localStatus = ollamaAvailable ? chalk5.green("\u2713") : chalk5.red("\u2717");
      const cloudStatus = hasApiKey ? chalk5.green("\u2713") : chalk5.yellow("\u25CB");
      console.log(chalk5.white("  Cloud:   ") + `${cloudStatus} ${cloudLabel}`);
      console.log(chalk5.white("  Local:   ") + `${localStatus} ${localLabel}`);
      if (ollamaAvailable) {
        console.log(chalk5.dim(`            ${localDetail}`));
      }
    } else {
      const localStatus = ollamaAvailable ? chalk5.green("\u2713") : chalk5.yellow("\u25CB");
      const cloudStatus = hasApiKey ? chalk5.green("\u2713") : chalk5.red("\u2717");
      console.log(chalk5.white("  Cloud:   ") + `${cloudStatus} ${cloudLabel}`);
      console.log(chalk5.white("  Local:   ") + `${localStatus} ${localLabel}`);
      if (ollamaAvailable) {
        console.log(chalk5.dim(`            ${localDetail}`));
      }
    }
    console.log("");
    const budgetLimit = config8.llm.budget.monthlyLimitUsd;
    const spentUsd = summary.totalCostUsd;
    const usedPct = budgetLimit > 0 ? (spentUsd / budgetLimit * 100).toFixed(1) : "0.0";
    console.log(chalk5.white("Cost:      ") + `$${spentUsd.toFixed(2)} / $${budgetLimit.toFixed(2)} this month (${usedPct}%)`);
    if (localSavingsUsd > 0) {
      console.log(chalk5.dim(`           Savings from local: ~$${localSavingsUsd.toFixed(2)} est.`));
    }
    console.log("");
    let statusOk = false;
    let statusMsg = "";
    if (mode === "local-only") {
      statusOk = ollamaAvailable;
      statusMsg = ollamaAvailable ? "\u2713 Fully operational" : `\u26A0 Ollama not available at ${config8.llm.local.host}. Run \`ollama serve\`.`;
    } else if (mode === "local-first") {
      statusOk = ollamaAvailable || hasApiKey;
      if (ollamaAvailable) {
        statusMsg = "\u2713 Fully operational (using Ollama)";
      } else if (hasApiKey) {
        statusMsg = "\u26A0 Ollama unavailable, using cloud fallback";
      } else {
        statusMsg = "\u26A0 No LLM available. Start Ollama or set API key.";
      }
    } else if (mode === "hybrid") {
      statusOk = hasApiKey || ollamaAvailable;
      if (hasApiKey && ollamaAvailable) {
        statusMsg = "\u2713 Fully operational (hybrid mode)";
      } else if (hasApiKey) {
        statusMsg = "\u26A0 Ollama unavailable, cloud-only";
      } else if (ollamaAvailable) {
        statusMsg = "\u26A0 API key not set, local-only";
      } else {
        statusMsg = "\u26A0 No LLM available";
      }
    } else {
      statusOk = hasApiKey;
      statusMsg = hasApiKey ? "\u2713 Fully operational" : "\u26A0 API key not set. Run `cortex init` or set " + (apiKeyEnvVar ?? "your cloud API key env var") + ".";
    }
    console.log(chalk5.white("Status:    ") + (statusOk ? chalk5.green(statusMsg) : chalk5.yellow(statusMsg)));
    console.log("");
  } catch (err) {
    logger15.error("Status check failed", { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk5.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
  store.close();
}

// packages/cli/dist/commands/costs.js
init_dist();
init_dist2();
import { resolve as resolve7 } from "node:path";
import chalk6 from "chalk";
var logger16 = createLogger("cli:costs");
function registerCostsCommand(program2) {
  program2.command("costs").description("Detailed cost reporting").option("--period <period>", "Time period: today, week, month, all", "month").option("--by <grouping>", "Group by: task, model, provider, day", "task").option("--csv", "Export as CSV", false).action(async (opts) => {
    const globals = program2.opts();
    await runCosts(opts, globals);
  });
}
function getPeriodStart(period) {
  const now2 = /* @__PURE__ */ new Date();
  switch (period) {
    case "today": {
      const start = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate());
      return start.toISOString();
    }
    case "week": {
      const start = new Date(now2);
      start.setDate(start.getDate() - 7);
      return start.toISOString();
    }
    case "month": {
      const start = new Date(now2.getFullYear(), now2.getMonth(), 1);
      return start.toISOString();
    }
    case "all":
      return void 0;
    default:
      return void 0;
  }
}
async function runCosts(opts, globals) {
  const config8 = loadConfig({ configDir: globals.config ? resolve7(globals.config) : void 0 });
  const store = new SQLiteStore({ dbPath: config8.graph.dbPath, backupOnStartup: false });
  try {
    const periodStart = getPeriodStart(opts.period);
    const rows = getUsageRows(store, periodStart);
    if (rows.length === 0) {
      if (globals.json) {
        console.log(JSON.stringify({ period: opts.period, totalCostUsd: 0, records: [] }));
      } else if (!opts.csv) {
        console.log(chalk6.yellow(`No usage data for period: ${opts.period}`));
      }
      store.close();
      return;
    }
    let totalCost = 0;
    let totalInput = 0;
    let totalOutput = 0;
    const groups = /* @__PURE__ */ new Map();
    for (const row of rows) {
      totalCost += row.estimated_cost_usd;
      totalInput += row.input_tokens;
      totalOutput += row.output_tokens;
      const key = getGroupKey(row, opts.by);
      const existing = groups.get(key) ?? { cost: 0, requests: 0, input: 0, output: 0 };
      existing.cost += row.estimated_cost_usd;
      existing.requests += 1;
      existing.input += row.input_tokens;
      existing.output += row.output_tokens;
      groups.set(key, existing);
    }
    const budgetLimit = config8.llm.budget.monthlyLimitUsd;
    const budgetUsed = totalCost / budgetLimit * 100;
    if (globals.json) {
      const groupData = {};
      for (const [key, val] of groups) {
        groupData[key] = { cost: val.cost, requests: val.requests, inputTokens: val.input, outputTokens: val.output };
      }
      console.log(JSON.stringify({
        period: opts.period,
        totalCostUsd: totalCost,
        totalInputTokens: totalInput,
        totalOutputTokens: totalOutput,
        requestCount: rows.length,
        budgetLimitUsd: budgetLimit,
        budgetUsedPercent: budgetUsed,
        groupBy: opts.by,
        groups: groupData
      }));
      store.close();
      return;
    }
    if (opts.csv) {
      console.log(`${opts.by},cost_usd,requests,input_tokens,output_tokens`);
      const sorted2 = [...groups.entries()].sort((a, b) => b[1].cost - a[1].cost);
      for (const [key, val] of sorted2) {
        console.log(`${key},${val.cost.toFixed(6)},${val.requests},${val.input},${val.output}`);
      }
      store.close();
      return;
    }
    console.log("");
    console.log(chalk6.bold.cyan(`CORTEX COSTS \u2014 ${opts.period}`));
    console.log(chalk6.dim("\u2500".repeat(60)));
    console.log(chalk6.white("Total Cost:    ") + chalk6.bold(`$${totalCost.toFixed(4)}`));
    console.log(chalk6.white("Requests:      ") + rows.length.toLocaleString());
    console.log(chalk6.white("Input Tokens:  ") + totalInput.toLocaleString());
    console.log(chalk6.white("Output Tokens: ") + totalOutput.toLocaleString());
    const budgetColor = budgetUsed >= 90 ? chalk6.red : budgetUsed >= 50 ? chalk6.yellow : chalk6.green;
    console.log(chalk6.white("Budget:        ") + budgetColor(`$${totalCost.toFixed(2)} / $${budgetLimit.toFixed(2)} (${budgetUsed.toFixed(1)}%)`));
    console.log("");
    console.log(chalk6.bold(`By ${opts.by}:`));
    console.log(chalk6.dim("\u2500".repeat(60)));
    const sorted = [...groups.entries()].sort((a, b) => b[1].cost - a[1].cost);
    const maxKeyLen = Math.max(...sorted.map(([k]) => k.length), 10);
    for (const [key, val] of sorted) {
      const pct = totalCost > 0 ? (val.cost / totalCost * 100).toFixed(1) : "0.0";
      const bar = buildBar(val.cost / totalCost, 20);
      console.log(`  ${key.padEnd(maxKeyLen)}  $${val.cost.toFixed(4)}  ${bar}  ${pct}%  (${val.requests} reqs)`);
    }
    console.log("");
  } catch (err) {
    logger16.error("Cost report failed", { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk6.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
  store.close();
}
function getUsageRows(store, periodStart) {
  void store;
  void periodStart;
  return [];
}
function getGroupKey(row, groupBy) {
  switch (groupBy) {
    case "task":
      return row.task;
    case "model":
      return row.model;
    case "provider":
      return row.provider;
    case "day":
      return row.timestamp.slice(0, 10);
    default:
      return row.task;
  }
}
function buildBar(ratio, width) {
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return chalk6.cyan("\u2588".repeat(filled)) + chalk6.dim("\u2591".repeat(empty));
}

// packages/cli/dist/commands/config.js
init_dist();
import { resolve as resolve8, dirname as dirname2 } from "node:path";
import { homedir as homedir6 } from "node:os";
import { readFileSync as readFileSync5, writeFileSync as writeFileSync3, mkdirSync as mkdirSync5 } from "node:fs";
import chalk7 from "chalk";
var logger17 = createLogger("cli:config");
function registerConfigCommand(program2) {
  const configCmd = program2.command("config").description("Read/write/validate configuration (includes exclude subcommand)");
  configCmd.command("get <key>").description("Get a configuration value").action(async (key) => {
    const globals = program2.opts();
    await runConfigGet(key, globals);
  });
  configCmd.command("set <key> <value>").description("Set a configuration value").action(async (key, value) => {
    const globals = program2.opts();
    await runConfigSet(key, value, globals);
  });
  configCmd.command("list").description("Show all non-default values").action(async () => {
    const globals = program2.opts();
    await runConfigList(globals);
  });
  configCmd.command("reset [key]").description("Reset to default (all if no key)").action(async (key) => {
    const globals = program2.opts();
    await runConfigReset(key, globals);
  });
  configCmd.command("validate").description("Validate configuration").action(async () => {
    const globals = program2.opts();
    await runConfigValidate(globals);
  });
  const excludeCmd = configCmd.command("exclude").description("Manage which files and directories are ignored during watching");
  excludeCmd.command("list").description("Show all exclude patterns").action(async () => {
    const globals = program2.opts();
    await runExcludeList(globals);
  });
  excludeCmd.command("add <pattern>").description("Add an exclude pattern (file name, directory name, or glob like *.min.js)").action(async (pattern) => {
    const globals = program2.opts();
    await runExcludeAdd(pattern, globals);
  });
  excludeCmd.command("remove <pattern>").description("Remove an exclude pattern").action(async (pattern) => {
    const globals = program2.opts();
    await runExcludeRemove(pattern, globals);
  });
}
function getNestedValue(obj, path) {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || current === void 0 || typeof current !== "object") {
      return void 0;
    }
    current = current[part];
  }
  return current;
}
function setNestedValue(obj, path, value) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === void 0 || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}
function parseValue(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
function getConfigFilePath(globals) {
  if (globals.config) {
    return resolve8(globals.config, "cortex.config.json");
  }
  const cwdPath = resolve8(process.cwd(), "cortex.config.json");
  try {
    readFileSync5(cwdPath);
    return cwdPath;
  } catch {
    return resolve8(homedir6(), ".cortex", "cortex.config.json");
  }
}
function readConfigFile2(path) {
  try {
    const content = readFileSync5(path, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}
async function runConfigGet(key, globals) {
  try {
    const config8 = loadConfig({ configDir: globals.config ? resolve8(globals.config) : void 0 });
    const value = getNestedValue(config8, key);
    if (value === void 0) {
      if (globals.json) {
        console.log(JSON.stringify({ error: `Key not found: ${key}` }));
      } else {
        console.log(chalk7.yellow(`Key not found: ${key}`));
      }
      return;
    }
    if (globals.json) {
      console.log(JSON.stringify({ key, value }));
    } else {
      const display = typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
      console.log(display);
    }
  } catch (err) {
    logger17.error("Config get failed", { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk7.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}
async function runConfigSet(key, value, globals) {
  try {
    const configPath = getConfigFilePath(globals);
    const raw = readConfigFile2(configPath);
    const parsed = parseValue(value);
    setNestedValue(raw, key, parsed);
    const result = cortexConfigSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
      if (globals.json) {
        console.log(JSON.stringify({ error: "Validation failed", issues: result.error.issues }));
      } else {
        console.error(chalk7.red("Validation failed:\n") + chalk7.yellow(issues));
      }
      return;
    }
    mkdirSync5(dirname2(configPath), { recursive: true });
    writeFileSync3(configPath, JSON.stringify(raw, null, 2) + "\n", "utf-8");
    if (globals.json) {
      console.log(JSON.stringify({ key, value: parsed, saved: true }));
    } else {
      console.log(chalk7.green(`\u2713 Set ${key} = ${JSON.stringify(parsed)}`));
    }
  } catch (err) {
    logger17.error("Config set failed", { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk7.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}
async function runConfigList(globals) {
  try {
    const config8 = loadConfig({ configDir: globals.config ? resolve8(globals.config) : void 0 });
    const defaults = getDefaultConfig();
    if (globals.json) {
      console.log(JSON.stringify(config8));
      return;
    }
    console.log("");
    console.log(chalk7.bold.cyan("CORTEX CONFIGURATION"));
    console.log(chalk7.dim("\u2500".repeat(50)));
    const configFlat = flattenObject(config8);
    const defaultFlat = flattenObject(defaults);
    let hasNonDefault = false;
    for (const [key, value] of Object.entries(configFlat)) {
      const defaultValue = defaultFlat[key];
      const isDefault = JSON.stringify(value) === JSON.stringify(defaultValue);
      if (!isDefault) {
        hasNonDefault = true;
        console.log(chalk7.white(`  ${key}: `) + chalk7.bold(JSON.stringify(value)) + chalk7.dim(` (default: ${JSON.stringify(defaultValue)})`));
      }
    }
    if (!hasNonDefault) {
      console.log(chalk7.dim("  All values are at defaults."));
    }
    console.log("");
  } catch (err) {
    logger17.error("Config list failed", { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk7.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}
async function runConfigReset(key, globals) {
  try {
    const configPath = getConfigFilePath(globals);
    const defaults = getDefaultConfig();
    if (key) {
      const raw = readConfigFile2(configPath);
      const defaultValue = getNestedValue(defaults, key);
      if (defaultValue === void 0) {
        if (globals.json) {
          console.log(JSON.stringify({ error: `Key not found: ${key}` }));
        } else {
          console.log(chalk7.yellow(`Key not found: ${key}`));
        }
        return;
      }
      setNestedValue(raw, key, defaultValue);
      writeFileSync3(configPath, JSON.stringify(raw, null, 2) + "\n", "utf-8");
      if (globals.json) {
        console.log(JSON.stringify({ key, value: defaultValue, reset: true }));
      } else {
        console.log(chalk7.green(`\u2713 Reset ${key} to default: ${JSON.stringify(defaultValue)}`));
      }
    } else {
      writeFileSync3(configPath, JSON.stringify(defaults, null, 2) + "\n", "utf-8");
      if (globals.json) {
        console.log(JSON.stringify({ reset: "all", saved: true }));
      } else {
        console.log(chalk7.green("\u2713 All configuration reset to defaults."));
      }
    }
  } catch (err) {
    logger17.error("Config reset failed", { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk7.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}
async function runConfigValidate(globals) {
  try {
    const configPath = getConfigFilePath(globals);
    const raw = readConfigFile2(configPath);
    const result = cortexConfigSchema.safeParse(raw);
    if (result.success) {
      if (globals.json) {
        console.log(JSON.stringify({ valid: true }));
      } else {
        console.log(chalk7.green("\u2713 Configuration is valid."));
      }
    } else {
      const issues = result.error.issues;
      if (globals.json) {
        console.log(JSON.stringify({ valid: false, issues }));
      } else {
        console.log(chalk7.red("\u2717 Configuration has errors:\n"));
        for (const issue of issues) {
          console.log(chalk7.yellow(`  ${issue.path.join(".")}: ${issue.message}`));
        }
      }
    }
  } catch (err) {
    logger17.error("Config validate failed", { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk7.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}
async function runExcludeList(globals) {
  try {
    const config8 = loadConfig({ configDir: globals.config ? resolve8(globals.config) : void 0 });
    const patterns = config8.ingest.exclude;
    if (globals.json) {
      console.log(JSON.stringify(patterns));
    } else {
      if (patterns.length === 0) {
        console.log(chalk7.dim("No exclude patterns configured."));
      } else {
        console.log(chalk7.bold("Excluded patterns:"));
        for (const p of patterns)
          console.log(`  ${p}`);
      }
    }
  } catch (err) {
    console.error(chalk7.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}
async function runExcludeAdd(pattern, globals) {
  try {
    const configPath = getConfigFilePath(globals);
    const raw = readConfigFile2(configPath);
    const ingest = raw["ingest"] ?? {};
    const current = Array.isArray(ingest["exclude"]) ? ingest["exclude"] : [];
    if (current.includes(pattern)) {
      console.log(chalk7.yellow(`Already excluded: ${pattern}`));
      return;
    }
    ingest["exclude"] = [...current, pattern];
    raw["ingest"] = ingest;
    const result = cortexConfigSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
      console.error(chalk7.red("Validation failed:\n") + chalk7.yellow(issues));
      return;
    }
    mkdirSync5(dirname2(configPath), { recursive: true });
    writeFileSync3(configPath, JSON.stringify(raw, null, 2) + "\n", "utf-8");
    if (globals.json) {
      console.log(JSON.stringify({ added: pattern }));
    } else {
      console.log(chalk7.green(`\u2713 Added exclude: ${pattern}`));
    }
  } catch (err) {
    console.error(chalk7.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}
async function runExcludeRemove(pattern, globals) {
  try {
    const configPath = getConfigFilePath(globals);
    const raw = readConfigFile2(configPath);
    const ingest = raw["ingest"] ?? {};
    const current = Array.isArray(ingest["exclude"]) ? ingest["exclude"] : [];
    if (!current.includes(pattern)) {
      console.log(chalk7.yellow(`Pattern not found: ${pattern}`));
      return;
    }
    ingest["exclude"] = current.filter((p) => p !== pattern);
    raw["ingest"] = ingest;
    const result = cortexConfigSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
      console.error(chalk7.red("Validation failed:\n") + chalk7.yellow(issues));
      return;
    }
    mkdirSync5(dirname2(configPath), { recursive: true });
    writeFileSync3(configPath, JSON.stringify(raw, null, 2) + "\n", "utf-8");
    if (globals.json) {
      console.log(JSON.stringify({ removed: pattern }));
    } else {
      console.log(chalk7.green(`\u2713 Removed exclude: ${pattern}`));
    }
  } catch (err) {
    console.error(chalk7.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}
function registerExcludeCommand(program2) {
  const excludeCmd = program2.command("exclude").description("Manage which files and directories are ignored during watching");
  excludeCmd.command("add <pattern>").description("Add an exclude pattern (directory name, file name, or glob like *.log)").action(async (pattern) => {
    const globals = program2.opts();
    await runExcludeAdd(pattern, globals);
  });
  excludeCmd.command("remove <pattern>").description("Remove an exclude pattern").action(async (pattern) => {
    const globals = program2.opts();
    await runExcludeRemove(pattern, globals);
  });
  excludeCmd.command("list").description("Show all exclude patterns").action(async () => {
    const globals = program2.opts();
    await runExcludeList(globals);
  });
}
function flattenObject(obj, prefix = "") {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

// packages/cli/dist/commands/privacy.js
init_dist();
import { resolve as resolve9 } from "node:path";
import { readFileSync as readFileSync6, writeFileSync as writeFileSync4 } from "node:fs";
import chalk8 from "chalk";
var logger18 = createLogger("cli:privacy");
function registerPrivacyCommand(program2) {
  const privacyCmd = program2.command("privacy").description("Manage privacy classifications");
  privacyCmd.command("set <directory> <level>").description("Set privacy level: standard, sensitive, restricted").action(async (directory, level) => {
    const globals = program2.opts();
    await runPrivacySet(directory, level, globals);
  });
  privacyCmd.command("list").description("Show all directory classifications").action(async () => {
    const globals = program2.opts();
    await runPrivacyList(globals);
  });
  privacyCmd.command("log").description("Show transmission audit log").option("--last <n>", "Number of entries to show", "20").action(async (opts) => {
    const globals = program2.opts();
    await runPrivacyLog(parseInt(opts.last, 10) || 20, globals);
  });
}
function getConfigFilePath2(globals) {
  if (globals.config) {
    return resolve9(globals.config, "cortex.config.json");
  }
  return resolve9(process.cwd(), "cortex.config.json");
}
function readConfigFile3(path) {
  try {
    const content = readFileSync6(path, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}
async function runPrivacySet(directory, level, globals) {
  const validLevels = ["standard", "sensitive", "restricted"];
  if (!validLevels.includes(level)) {
    if (globals.json) {
      console.log(JSON.stringify({ error: `Invalid level: ${level}. Must be: ${validLevels.join(", ")}` }));
    } else {
      console.error(chalk8.red(`Invalid privacy level: ${level}`));
      console.log(chalk8.dim(`Valid levels: ${validLevels.join(", ")}`));
    }
    return;
  }
  try {
    const configPath = getConfigFilePath2(globals);
    const raw = readConfigFile3(configPath);
    if (!raw["privacy"] || typeof raw["privacy"] !== "object") {
      raw["privacy"] = {};
    }
    const privacy = raw["privacy"];
    if (!privacy["directoryOverrides"] || typeof privacy["directoryOverrides"] !== "object") {
      privacy["directoryOverrides"] = {};
    }
    const overrides = privacy["directoryOverrides"];
    const resolvedDir = resolve9(directory);
    overrides[resolvedDir] = level;
    writeFileSync4(configPath, JSON.stringify(raw, null, 2) + "\n", "utf-8");
    if (globals.json) {
      console.log(JSON.stringify({ directory: resolvedDir, level, saved: true }));
    } else {
      console.log(chalk8.green(`\u2713 Set ${resolvedDir} \u2192 ${level}`));
    }
  } catch (err) {
    logger18.error("Privacy set failed", { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk8.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}
async function runPrivacyList(globals) {
  try {
    const config8 = loadConfig({ configDir: globals.config ? resolve9(globals.config) : void 0 });
    const overrides = config8.privacy.directoryOverrides;
    const entries = Object.entries(overrides);
    if (globals.json) {
      console.log(JSON.stringify({
        defaultLevel: config8.privacy.defaultLevel,
        directoryOverrides: overrides
      }));
      return;
    }
    console.log("");
    console.log(chalk8.bold.cyan("PRIVACY CLASSIFICATIONS"));
    console.log(chalk8.dim("\u2500".repeat(50)));
    console.log(chalk8.white(`Default level: ${config8.privacy.defaultLevel}`));
    console.log("");
    if (entries.length === 0) {
      console.log(chalk8.dim("  No directory-specific overrides set."));
      console.log(chalk8.dim("  Use `cortex privacy set <directory> <level>` to add one."));
    } else {
      for (const [dir, level] of entries) {
        const levelColor = level === "restricted" ? chalk8.red : level === "sensitive" ? chalk8.yellow : chalk8.green;
        console.log(`  ${levelColor(level.padEnd(12))} ${dir}`);
      }
    }
    console.log("");
  } catch (err) {
    logger18.error("Privacy list failed", { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk8.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}
async function runPrivacyLog(lastN, globals) {
  void lastN;
  if (globals.json) {
    console.log(JSON.stringify({ entries: [], message: "No transmission log entries yet." }));
  } else {
    console.log("");
    console.log(chalk8.bold.cyan("TRANSMISSION AUDIT LOG"));
    console.log(chalk8.dim("\u2500".repeat(50)));
    console.log(chalk8.dim("  No transmission log entries yet."));
    console.log(chalk8.dim("  Entries will appear after LLM queries are made."));
    console.log("");
  }
}

// packages/cli/dist/commands/contradictions.js
init_dist();
init_dist2();
import { resolve as resolve10 } from "node:path";
import chalk9 from "chalk";
var logger19 = createLogger("cli:contradictions");
function registerContradictionsCommand(program2) {
  program2.command("contradictions").description("List active contradictions").option("--all", "Include resolved/dismissed", false).option("--severity <level>", "Filter by severity: low, medium, high").action(async (opts) => {
    const globals = program2.opts();
    await runContradictions(opts, globals);
  });
}
async function runContradictions(opts, globals) {
  const config8 = loadConfig({ configDir: globals.config ? resolve10(globals.config) : void 0 });
  const store = new SQLiteStore({ dbPath: config8.graph.dbPath, backupOnStartup: false });
  try {
    const contradictions = await getContradictions(store, opts.all, opts.severity);
    if (globals.json) {
      console.log(JSON.stringify({ contradictions }));
      store.close();
      return;
    }
    console.log("");
    console.log(chalk9.bold.cyan("CONTRADICTIONS"));
    console.log(chalk9.dim("\u2500".repeat(60)));
    if (contradictions.length === 0) {
      console.log(chalk9.dim("  No contradictions found."));
      console.log("");
      store.close();
      return;
    }
    for (const c of contradictions) {
      const severityColor = c.severity === "high" ? chalk9.red : c.severity === "medium" ? chalk9.yellow : chalk9.dim;
      const statusIcon = c.status === "active" ? "\u26A0" : "\u2713";
      console.log("");
      console.log(`${statusIcon} ${chalk9.bold(c.id.slice(0, 8))}  ${severityColor(`[${c.severity}]`)}  ${chalk9.dim(c.status)}`);
      console.log(`  ${c.description}`);
      const entity1 = await store.getEntity(c.entityIds[0]);
      const entity2 = await store.getEntity(c.entityIds[1]);
      const name1 = entity1 ? entity1.name : c.entityIds[0].slice(0, 8);
      const name2 = entity2 ? entity2.name : c.entityIds[1].slice(0, 8);
      console.log(chalk9.dim(`  Between: ${name1} \u2194 ${name2}`));
      if (c.suggestedResolution) {
        console.log(chalk9.dim(`  Suggested: ${c.suggestedResolution}`));
      }
      if (c.status === "active") {
        console.log(chalk9.dim(`  Resolve: cortex resolve ${c.id.slice(0, 8)} --action <supersede|dismiss|keep-old|both-valid>`));
      }
    }
    console.log("");
    console.log(chalk9.dim(`Total: ${contradictions.length} contradiction(s)`));
    console.log("");
  } catch (err) {
    logger19.error("Contradictions listing failed", { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk9.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
  store.close();
}
async function getContradictions(store, includeResolved, severity) {
  const results = await store.findContradictions(includeResolved ? {} : { status: "active" });
  if (severity)
    return results.filter((c) => c.severity === severity);
  return results;
}

// packages/cli/dist/commands/resolve.js
init_dist();
init_dist2();
import { resolve as resolve11 } from "node:path";
import chalk10 from "chalk";
var logger20 = createLogger("cli:resolve");
var VALID_ACTIONS = ["supersede", "dismiss", "keep-old", "both-valid"];
function registerResolveCommand(program2) {
  program2.command("resolve <contradiction-id>").description("Resolve a contradiction").requiredOption("--action <action>", "Resolution action: supersede, dismiss, keep-old, both-valid").action(async (contradictionId, opts) => {
    const globals = program2.opts();
    await runResolve(contradictionId, opts.action, globals);
  });
}
function isValidAction(action) {
  return VALID_ACTIONS.includes(action);
}
function actionToDbValue(action) {
  switch (action) {
    case "supersede":
      return "supersede";
    case "dismiss":
      return "dismiss";
    case "keep-old":
      return "keep_old";
    case "both-valid":
      return "both_valid";
  }
}
async function runResolve(contradictionId, action, globals) {
  if (!isValidAction(action)) {
    if (globals.json) {
      console.log(JSON.stringify({
        error: `Invalid action: ${action}`,
        validActions: [...VALID_ACTIONS]
      }));
    } else {
      console.error(chalk10.red(`Invalid action: ${action}`));
      console.log(chalk10.dim(`Valid actions: ${VALID_ACTIONS.join(", ")}`));
    }
    return;
  }
  const config8 = loadConfig({ configDir: globals.config ? resolve11(globals.config) : void 0 });
  const store = new SQLiteStore({ dbPath: config8.graph.dbPath, backupOnStartup: false });
  try {
    const contradiction = await findContradiction(store, contradictionId);
    if (!contradiction) {
      if (globals.json) {
        console.log(JSON.stringify({ error: `Contradiction not found: ${contradictionId}` }));
      } else {
        console.log(chalk10.yellow(`Contradiction not found: ${contradictionId}`));
      }
      store.close();
      return;
    }
    if (contradiction.status !== "active") {
      if (globals.json) {
        console.log(JSON.stringify({
          error: "Contradiction already resolved",
          status: contradiction.status,
          resolvedAction: contradiction.resolvedAction
        }));
      } else {
        console.log(chalk10.yellow(`Contradiction already resolved (${contradiction.status}).`));
      }
      store.close();
      return;
    }
    const resolvedAction = actionToDbValue(action);
    const resolvedAt = (/* @__PURE__ */ new Date()).toISOString();
    const newStatus = action === "dismiss" ? "dismissed" : "resolved";
    await store.updateContradiction(contradiction.id, {
      status: newStatus,
      resolvedAction,
      resolvedAt
    });
    logger20.info("Contradiction resolved", {
      id: contradiction.id,
      action: resolvedAction,
      resolvedAt
    });
    if (globals.json) {
      console.log(JSON.stringify({
        id: contradiction.id,
        action: resolvedAction,
        resolvedAt,
        resolved: true
      }));
    } else {
      console.log(chalk10.green(`\u2713 Resolved contradiction ${contradiction.id.slice(0, 8)} \u2192 ${action}`));
      if (action === "supersede") {
        console.log(chalk10.dim("  The newer entity will take precedence."));
      } else if (action === "dismiss") {
        console.log(chalk10.dim("  Contradiction dismissed."));
      } else if (action === "keep-old") {
        console.log(chalk10.dim("  The older entity will be preserved."));
      } else if (action === "both-valid") {
        console.log(chalk10.dim("  Both entities marked as valid."));
      }
    }
  } catch (err) {
    logger20.error("Resolve failed", { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk10.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
  store.close();
}
async function findContradiction(store, id) {
  const all = await store.findContradictions({});
  return all.find((c) => c.id === id || c.id.startsWith(id)) ?? null;
}

// packages/cli/dist/commands/projects.js
init_dist();
import { resolve as resolve12, join as join5 } from "node:path";
import { existsSync as existsSync5 } from "node:fs";
import chalk11 from "chalk";
var logger21 = createLogger("cli:projects");
function registerProjectsCommand(program2) {
  const projects = program2.command("projects").description("Manage registered projects");
  projects.command("list").alias("ls").description("List all registered projects").action(async () => {
    const globals = program2.opts();
    await runList(globals);
  });
  projects.command("add <name> [path]").description("Register a project (path defaults to current directory)").action(async (name, path) => {
    const globals = program2.opts();
    await runAdd(name, path, globals);
  });
  projects.command("remove <name>").alias("rm").description("Unregister a project").action(async (name) => {
    const globals = program2.opts();
    await runRemove(name, globals);
  });
  projects.command("show <name>").description("Show details of a registered project").action(async (name) => {
    const globals = program2.opts();
    await runShow(name, globals);
  });
}
async function runList(globals) {
  const projects = listProjects();
  if (globals.json) {
    console.log(JSON.stringify(projects, null, 2));
    return;
  }
  if (projects.length === 0) {
    console.log(chalk11.yellow("No projects registered."));
    console.log(chalk11.dim("Register a project with: cortex projects add <name> [path]"));
    return;
  }
  console.log("");
  console.log(chalk11.bold.cyan("REGISTERED PROJECTS"));
  console.log(chalk11.dim("\u2500".repeat(60)));
  for (const project of projects) {
    const configExists = existsSync5(join5(project.path, "cortex.config.json"));
    const statusIcon = configExists ? chalk11.green("\u2713") : chalk11.yellow("\u25CB");
    console.log(`${statusIcon} ${chalk11.bold(project.name)}`);
    console.log(`   Path: ${chalk11.dim(project.path)}`);
    if (project.lastWatched) {
      console.log(`   Last watched: ${chalk11.dim(new Date(project.lastWatched).toLocaleString())}`);
    }
    console.log("");
  }
  console.log(chalk11.dim(`Total: ${projects.length} project(s)`));
}
async function runAdd(name, path, globals) {
  const projectPath = resolve12(path ?? process.cwd());
  if (!existsSync5(projectPath)) {
    console.error(chalk11.red(`Error: Path does not exist: ${projectPath}`));
    process.exit(1);
  }
  const existing = getProject(name);
  if (existing) {
    console.error(chalk11.red(`Error: Project "${name}" is already registered at ${existing.path}`));
    console.log(chalk11.dim("Use a different name or remove the existing project first."));
    process.exit(1);
  }
  const configPath = join5(projectPath, "cortex.config.json");
  const hasConfig = existsSync5(configPath);
  const entry = addProject(name, projectPath, hasConfig ? configPath : void 0);
  if (globals.json) {
    console.log(JSON.stringify(entry, null, 2));
    return;
  }
  console.log(chalk11.green(`\u2713 Project "${name}" registered`));
  console.log(`   Path: ${projectPath}`);
  if (!hasConfig) {
    console.log("");
    console.log(chalk11.yellow("\u26A0 No cortex.config.json found in this directory."));
    console.log(chalk11.dim(`Run 'cd ${projectPath} && cortex init' to create one.`));
  } else {
    console.log("");
    console.log(chalk11.dim(`Start watching with: cortex watch ${name}`));
  }
}
async function runRemove(name, globals) {
  const removed = removeProject(name);
  if (!removed) {
    console.error(chalk11.red(`Error: Project "${name}" is not registered.`));
    process.exit(1);
  }
  if (globals.json) {
    console.log(JSON.stringify({ removed: name }));
    return;
  }
  console.log(chalk11.green(`\u2713 Project "${name}" unregistered`));
  console.log(chalk11.dim("Note: This only removes the registration. Project files are unchanged."));
}
async function runShow(name, globals) {
  const project = getProject(name);
  if (!project) {
    console.error(chalk11.red(`Error: Project "${name}" is not registered.`));
    console.log(chalk11.dim("List registered projects with: cortex projects list"));
    process.exit(1);
  }
  const configPath = join5(project.path, "cortex.config.json");
  const hasConfig = existsSync5(configPath);
  if (globals.json) {
    console.log(JSON.stringify({ ...project, hasConfig }, null, 2));
    return;
  }
  console.log("");
  console.log(chalk11.bold.cyan(`PROJECT: ${project.name}`));
  console.log(chalk11.dim("\u2500".repeat(40)));
  console.log(`Path:         ${project.path}`);
  console.log(`Config:       ${hasConfig ? chalk11.green("Found") : chalk11.yellow("Not found")}`);
  console.log(`Registered:   ${new Date(project.addedAt).toLocaleString()}`);
  if (project.lastWatched) {
    console.log(`Last watched: ${new Date(project.lastWatched).toLocaleString()}`);
  }
  console.log("");
}

// packages/cli/dist/commands/ingest.js
init_dist();
init_dist2();
init_dist3();
init_dist4();
import { resolve as resolve13, isAbsolute, extname as extname3, join as join6 } from "node:path";
import { existsSync as existsSync6, readFileSync as readFileSync7, readdirSync, statSync as statSync4 } from "node:fs";
import chalk12 from "chalk";
var logger22 = createLogger("cli:ingest");
function registerIngestCommand(program2) {
  program2.command("ingest <file-or-glob>").description("One-shot ingestion of a file or glob pattern into the knowledge graph").option("--project <name>", "Project to attach entities to").option("--dry-run", "Show what would be extracted without writing to DB", false).action(async (pattern, opts) => {
    const globals = program2.opts();
    await runIngest(pattern, opts, globals);
  });
}
async function runIngest(pattern, opts, globals) {
  let projectRoot;
  if (opts.project) {
    const reg = getProject(opts.project);
    if (!reg) {
      console.error(chalk12.red(`Error: Project "${opts.project}" is not registered.`));
      console.log(chalk12.dim("Register it with: cortex projects add <name> <path>"));
      process.exit(1);
    }
    projectRoot = reg.path;
  }
  const config8 = loadConfig({ configDir: globals.config ? resolve13(globals.config) : projectRoot });
  const resolvedPattern = isAbsolute(pattern) ? pattern : resolve13(process.cwd(), pattern);
  const filePaths = [];
  if (resolvedPattern.includes("*")) {
    const lastSep = Math.max(resolvedPattern.lastIndexOf("/"), resolvedPattern.lastIndexOf("\\"));
    const dir = lastSep >= 0 ? resolvedPattern.slice(0, lastSep) : process.cwd();
    const filePattern = lastSep >= 0 ? resolvedPattern.slice(lastSep + 1) : resolvedPattern;
    const regex = new RegExp("^" + filePattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
    if (existsSync6(dir)) {
      for (const entry of readdirSync(dir)) {
        if (regex.test(entry)) {
          const full = join6(dir, entry);
          try {
            if (statSync4(full).isFile())
              filePaths.push(full);
          } catch {
          }
        }
      }
    }
  } else {
    if (!existsSync6(resolvedPattern)) {
      console.error(chalk12.red(`Error: File not found: ${resolvedPattern}`));
      process.exit(1);
    }
    filePaths.push(resolvedPattern);
  }
  if (filePaths.length === 0) {
    console.log(chalk12.yellow("No files matched the pattern."));
    process.exit(0);
  }
  if (!globals.quiet) {
    if (opts.dryRun) {
      console.log(chalk12.bold(`
\u{1F50D} Cortex Ingest (dry run) \u2014 ${filePaths.length} file(s)
`));
    } else {
      console.log(chalk12.bold(`
\u26A1 Cortex Ingest \u2014 ${filePaths.length} file(s)
`));
    }
  }
  if (opts.dryRun) {
    let totalSections = 0;
    for (const filePath of filePaths) {
      try {
        const ext = extname3(filePath).slice(1).toLowerCase();
        const content = readFileSync7(filePath, "utf-8");
        const parser = getParser(ext, filePath, content);
        if (!parser) {
          console.log(chalk12.dim(`  \u2212 ${filePath} \u2014 unsupported type`));
          continue;
        }
        const result = await parser.parse(content, filePath);
        totalSections += result.sections.length;
        console.log(chalk12.dim(`  ~ ${filePath} \u2192 ${result.sections.length} sections (est. ${result.sections.length * 3} entities)`));
      } catch (err) {
        console.log(chalk12.red(`  \u2717 ${filePath} \u2014 ${err instanceof Error ? err.message : String(err)}`));
      }
    }
    console.log(chalk12.dim(`
Dry run complete: ~${totalSections * 3} entities estimated across ${filePaths.length} file(s)`));
    return;
  }
  const store = new SQLiteStore({
    dbPath: config8.graph.dbPath,
    walMode: config8.graph.walMode,
    backupOnStartup: false
  });
  const router = new Router({ config: config8 });
  const projects = await store.listProjects();
  let project = projects.find((p) => opts.project ? p.name === opts.project : true);
  if (!project) {
    project = await store.createProject({
      name: opts.project ?? "default",
      rootPath: projectRoot ?? resolve13(config8.ingest.watchDirs[0] ?? "."),
      privacyLevel: config8.privacy.defaultLevel,
      fileCount: 0,
      entityCount: 0
    });
  }
  const pipeline = new IngestionPipeline(router, store, {
    projectId: project.id,
    projectName: project.name,
    projectRoot: project.rootPath,
    maxFileSize: config8.ingest.maxFileSize,
    batchSize: config8.ingest.batchSize,
    projectPrivacyLevel: project.privacyLevel,
    mergeConfidenceThreshold: config8.graph.mergeConfidenceThreshold
  });
  let totalEntities = 0;
  let totalRelationships = 0;
  let errorCount = 0;
  if (globals.json) {
    const results = [];
    for (const filePath of filePaths) {
      const result = await pipeline.ingestFile(filePath);
      results.push({
        file: filePath,
        entities: result.entityIds.length,
        relationships: result.relationshipIds.length,
        status: result.status
      });
      totalEntities += result.entityIds.length;
      totalRelationships += result.relationshipIds.length;
      if (result.status === "failed")
        errorCount++;
    }
    console.log(JSON.stringify({ files: results, total: { entities: totalEntities, relationships: totalRelationships } }));
    store.close();
    return;
  }
  console.log(chalk12.dim(`Ingesting ${filePaths.length} file(s)...
`));
  for (const filePath of filePaths) {
    try {
      const result = await pipeline.ingestFile(filePath);
      if (result.status === "ingested") {
        totalEntities += result.entityIds.length;
        totalRelationships += result.relationshipIds.length;
        console.log(chalk12.green(`  \u2713 ${filePath}`) + chalk12.dim(` \u2192 ${result.entityIds.length} entities, ${result.relationshipIds.length} relationships`));
      } else if (result.status === "skipped") {
        console.log(chalk12.dim(`  \u2212 ${filePath} \u2014 skipped${result.error ? ` (${result.error})` : ""}`));
      } else {
        errorCount++;
        console.log(chalk12.red(`  \u2717 ${filePath} \u2014 failed: ${result.error}`));
      }
    } catch (err) {
      errorCount++;
      logger22.error("Ingest failed", { filePath, error: err instanceof Error ? err.message : String(err) });
      console.log(chalk12.red(`  \u2717 ${filePath} \u2014 error: ${err instanceof Error ? err.message : String(err)}`));
    }
  }
  console.log("");
  console.log(chalk12.bold(`Total: ${totalEntities} entities, ${totalRelationships} relationships ingested`) + (opts.project ? chalk12.dim(` into project "${opts.project}"`) : ""));
  if (errorCount > 0) {
    console.log(chalk12.yellow(`  ${errorCount} file(s) failed`));
  }
  store.close();
  process.exit(errorCount > 0 ? 1 : 0);
}

// packages/cli/dist/commands/models.js
init_dist();
init_dist3();
import { resolve as resolve14 } from "node:path";
import { spawnSync } from "node:child_process";
import chalk13 from "chalk";
var logger23 = createLogger("cli:models");
function registerModelsCommand(program2) {
  const models = program2.command("models").description("Manage Ollama models");
  models.command("list").description("Show available Ollama models and which are configured").action(async () => {
    const globals = program2.opts();
    await runModelsList(globals);
  });
  models.command("pull <model>").description("Pull a model from Ollama registry").action(async (model) => {
    const globals = program2.opts();
    await runModelsPull(model, globals);
  });
  models.command("test").description("Run a quick inference + embedding test to verify Ollama setup").action(async () => {
    const globals = program2.opts();
    await runModelsTest(globals);
  });
  models.command("info").description("Show context window, GPU layers, and performance info for configured model").action(async () => {
    const globals = program2.opts();
    await runModelsInfo(globals);
  });
}
function formatBytes2(bytes) {
  const gb = bytes / 1024 ** 3;
  const mb = bytes / 1024 ** 2;
  if (gb >= 1)
    return `${gb.toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}
async function runModelsList(globals) {
  const config8 = loadConfig({ configDir: globals.config ? resolve14(globals.config) : void 0 });
  const router = new Router({ config: config8 });
  const local = router.getLocalProvider();
  if (!local) {
    console.log(chalk13.yellow("Local provider (Ollama) is not configured in this mode."));
    console.log(chalk13.dim(`Current mode: ${router.getMode()} \u2014 set mode to hybrid, local-first, or local-only`));
    return;
  }
  const host = local.getHost();
  const configuredModel = local.getModel();
  const configuredEmbed = local.getEmbeddingModel();
  const available = await local.isAvailable();
  if (!available) {
    console.error(chalk13.red(`\u2717 Ollama not reachable at ${host}`));
    console.log(chalk13.dim("  Start with: ollama serve"));
    process.exit(1);
  }
  const modelList = await local.listModels();
  if (globals.json) {
    console.log(JSON.stringify({
      host,
      configuredModel,
      configuredEmbeddingModel: configuredEmbed,
      models: modelList
    }));
    return;
  }
  console.log("");
  console.log(chalk13.bold(`Ollama Models (${host})`));
  console.log(chalk13.dim("\u2500".repeat(50)));
  if (modelList.length === 0) {
    console.log(chalk13.dim("  No models installed."));
    console.log(chalk13.dim("  Pull one with: cortex models pull mistral:7b-instruct-q5_K_M"));
  } else {
    for (const m of modelList) {
      const isConfigured = m.name === configuredModel;
      const isEmbed = m.name === configuredEmbed;
      const tag = isConfigured ? chalk13.green("\u2190 configured (primary)") : isEmbed ? chalk13.cyan("\u2190 configured (embeddings)") : "";
      const sizeStr = chalk13.dim(formatBytes2(m.sizeBytes).padEnd(8));
      console.log(`  ${m.name.padEnd(40)} ${sizeStr} ${tag}`);
    }
  }
  console.log("");
  console.log(chalk13.dim(`Tip: Set model with \`cortex config set llm.local.model <model>\``));
  console.log("");
}
async function runModelsPull(model, globals) {
  if (!globals.quiet) {
    console.log(chalk13.bold(`
Pulling model: ${chalk13.cyan(model)}`));
    console.log(chalk13.dim("This may take several minutes for large models...\n"));
  }
  const result = spawnSync("ollama", ["pull", model], { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error(chalk13.red(`
\u2717 Failed to pull model "${model}"`));
    console.log(chalk13.dim("  Make sure Ollama is running: ollama serve"));
    process.exit(result.status ?? 1);
  }
  if (!globals.quiet) {
    console.log(chalk13.green(`
\u2713 Model "${model}" pulled successfully`));
    console.log(chalk13.dim(`  Configure it: cortex config set llm.local.model ${model}`));
  }
}
async function runModelsTest(globals) {
  const config8 = loadConfig({ configDir: globals.config ? resolve14(globals.config) : void 0 });
  const router = new Router({ config: config8 });
  const local = router.getLocalProvider();
  if (!local) {
    console.log(chalk13.yellow("Local provider (Ollama) not configured."));
    process.exit(1);
  }
  const host = local.getHost();
  const model = local.getModel();
  const embedModel = local.getEmbeddingModel();
  if (!globals.quiet && !globals.json) {
    console.log(chalk13.bold("\nTesting Ollama setup...\n"));
  }
  const checks = [];
  let reachable = false;
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 3e3);
    const resp = await fetch(`${host}/api/tags`, { signal: ctrl.signal });
    clearTimeout(tid);
    reachable = resp.ok;
  } catch {
    reachable = false;
  }
  checks.push({ label: `Connection:  ${host} reachable`, ok: reachable });
  let modelLoaded = false;
  if (reachable) {
    const models = await local.listModels();
    modelLoaded = models.some((m) => m.name === model);
  }
  checks.push({ label: `Model:       ${model} loaded`, ok: modelLoaded });
  let inferenceMs = 0;
  let inferenceTokens = 0;
  let inferenceOk = false;
  if (modelLoaded) {
    try {
      const start = performance.now();
      const result = await local.completeWithSystem(void 0, "Hello", { temperature: 0.1, maxTokens: 20 });
      inferenceMs = Math.round(performance.now() - start);
      inferenceTokens = result.outputTokens;
      inferenceOk = true;
    } catch (err) {
      logger23.debug("Inference test failed", { error: err instanceof Error ? err.message : String(err) });
    }
  }
  const tokPerSec = inferenceMs > 0 ? Math.round(inferenceTokens / inferenceMs * 1e3) : 0;
  checks.push({
    label: 'Inference:   "Hello" response',
    ok: inferenceOk,
    detail: inferenceOk ? `${inferenceTokens} tokens in ${inferenceMs}ms (${tokPerSec} tok/s)` : void 0
  });
  let embedOk = false;
  let embedMs = 0;
  let embedDims = 0;
  if (reachable) {
    try {
      const start = performance.now();
      const embeddings = await local.embed(["test"]);
      embedMs = Math.round(performance.now() - start);
      embedDims = embeddings[0]?.length ?? 0;
      embedOk = embedDims > 0;
    } catch (err) {
      logger23.debug("Embedding test failed", { error: err instanceof Error ? err.message : String(err) });
    }
  }
  checks.push({
    label: `Embeddings:  ${embedModel}`,
    ok: embedOk,
    detail: embedOk ? `${embedDims}-dim vector in ${embedMs}ms` : void 0
  });
  const allOk = checks.every((c) => c.ok);
  if (globals.json) {
    console.log(JSON.stringify({ checks: checks.map((c) => ({ ...c })), allOk }));
    process.exit(allOk ? 0 : 4);
  }
  for (const c of checks) {
    const icon = c.ok ? chalk13.green("\u2713") : chalk13.red("\u2717");
    const detail = c.detail ? chalk13.dim(` (${c.detail})`) : "";
    console.log(`  ${icon} ${c.label}${detail}`);
  }
  if (allOk) {
    console.log(chalk13.green("\n  \u2713 Ready for hybrid/local mode\n"));
    process.exit(0);
  } else {
    console.log(chalk13.red("\n  \u2717 Setup incomplete \u2014 check Ollama installation\n"));
    process.exit(4);
  }
}
async function runModelsInfo(globals) {
  const config8 = loadConfig({ configDir: globals.config ? resolve14(globals.config) : void 0 });
  const router = new Router({ config: config8 });
  const local = router.getLocalProvider();
  if (!local) {
    console.log(chalk13.yellow("Local provider (Ollama) not configured."));
    process.exit(1);
  }
  const model = local.getModel();
  const numCtx = local.getNumCtx();
  const numGpu = local.getNumGpu();
  const host = local.getHost();
  if (globals.json) {
    console.log(JSON.stringify({
      model,
      host,
      numCtx,
      numGpu: numGpu === -1 ? "auto" : numGpu,
      estimatedTokensPerSecond: 30
    }));
    return;
  }
  console.log("");
  console.log(chalk13.bold(`Ollama Model Info`));
  console.log(chalk13.dim("\u2500".repeat(40)));
  console.log(`  Model:      ${chalk13.cyan(model)}`);
  console.log(`  Host:       ${host}`);
  console.log(`  Context:    ${numCtx.toLocaleString()} tokens`);
  console.log(`  GPU layers: ${numGpu === -1 ? "auto-detect" : String(numGpu)}`);
  console.log(`  Speed est.: ~30 tok/s`);
  console.log("");
}

// packages/cli/dist/commands/mcp.js
import { spawn } from "node:child_process";
import { resolve as resolve15, dirname as dirname3 } from "node:path";
import { existsSync as existsSync7, readFileSync as readFileSync8 } from "node:fs";
import chalk14 from "chalk";
function findPackageRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    try {
      const pkgPath = resolve15(dir, "package.json");
      const pkg = JSON.parse(readFileSync8(pkgPath, "utf-8"));
      if (pkg.name === "gzoo-cortex")
        return dir;
    } catch {
    }
    const parent = dirname3(dir);
    if (parent === dir)
      break;
    dir = parent;
  }
  return startDir;
}
function registerMcpCommand(program2) {
  program2.command("mcp").description("Start the Cortex MCP server (stdio transport for Claude Code)").option("--config-dir <path>", "Directory containing cortex.config.json").action(async (opts) => {
    const globals = program2.opts();
    const pkgRoot = findPackageRoot(import.meta.dirname);
    const mcpEntry = resolve15(pkgRoot, "packages/mcp/dist/index.js");
    if (!existsSync7(mcpEntry)) {
      console.error(chalk14.red("Error: MCP server not built."));
      console.error(chalk14.dim(`Expected: ${mcpEntry}`));
      console.error(chalk14.dim("Run npm run build first."));
      process.exit(1);
    }
    if (process.stdout.isTTY) {
      process.stderr.write(chalk14.yellow("\n[cortex mcp] Starting MCP server on stdio.\n") + chalk14.dim("This process blocks. It is meant to be launched by Claude Code, not run manually.\n") + chalk14.dim("Register with: claude mcp add cortex --scope user -- node " + mcpEntry + "\n\n"));
    }
    const env = {
      ...process.env,
      CORTEX_LOG_LEVEL: "error"
    };
    if (opts.configDir) {
      env["CORTEX_CONFIG_DIR"] = resolve15(opts.configDir);
    }
    if (globals.config) {
      env["CORTEX_CONFIG_DIR"] = resolve15(globals.config);
    }
    const child = spawn(process.execPath, [mcpEntry], {
      stdio: "inherit",
      env
    });
    child.on("exit", (code) => process.exit(code ?? 0));
    child.on("error", (err) => {
      process.stderr.write(`[cortex mcp] Error: ${err.message}
`);
      process.exit(1);
    });
  });
}

// packages/cli/dist/commands/db.js
init_dist();
init_dist2();
import { resolve as resolve16 } from "node:path";
import chalk15 from "chalk";
var logger24 = createLogger("cli:db");
function registerDbCommand(program2) {
  const dbCmd = program2.command("db").description("Database maintenance");
  dbCmd.command("clean <path>").description("Hard-delete all entities, relationships, and files under a source path").option("--force", "Skip confirmation prompt").action(async (sourcePath, opts) => {
    const globals = program2.opts();
    await runDbClean(sourcePath, opts.force ?? false, globals);
  });
  dbCmd.command("reset").description("Wipe all entities, relationships, and files (keeps projects)").option("--force", "Skip confirmation prompt").action(async (opts) => {
    const globals = program2.opts();
    await runDbReset(opts.force ?? false, globals);
  });
  dbCmd.command("prune").description("Remove soft-deleted entities and relationships that reference them").option("--force", "Skip confirmation prompt").action(async (opts) => {
    const globals = program2.opts();
    await runDbPrune(opts.force ?? false, globals);
  });
}
async function confirm(message, force) {
  if (force || !process.stdin.isTTY)
    return true;
  const { createInterface } = await import("node:readline");
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answer = await new Promise((resolve22) => {
    rl.question(chalk15.yellow(message + " [y/N] "), resolve22);
  });
  rl.close();
  return answer.toLowerCase() === "y";
}
async function runDbClean(sourcePath, force, globals) {
  const config8 = loadConfig({ configDir: globals.config ? resolve16(globals.config) : void 0 });
  const store = new SQLiteStore({ dbPath: config8.graph.dbPath, backupOnStartup: false });
  try {
    const ok = await confirm(`Hard-delete all entities, relationships, and file records under "${sourcePath}"?`, force);
    if (!ok) {
      console.log("Aborted.");
      return;
    }
    const result = store.deleteBySourcePath(sourcePath);
    if (globals.json) {
      console.log(JSON.stringify(result));
    } else if (result.deletedEntities === 0) {
      console.log(chalk15.yellow(`No entities found matching path: ${sourcePath}`));
    } else {
      console.log(chalk15.green(`\u2713 Deleted ${result.deletedEntities} entities, ${result.deletedRelationships} relationships, ${result.deletedFiles} file records`));
    }
  } catch (err) {
    logger24.error("db clean failed", { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk15.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  } finally {
    store.close();
  }
}
async function runDbReset(force, globals) {
  const config8 = loadConfig({ configDir: globals.config ? resolve16(globals.config) : void 0 });
  const store = new SQLiteStore({ dbPath: config8.graph.dbPath, backupOnStartup: false });
  try {
    const stats = await store.getStats();
    if (stats.entityCount === 0 && stats.fileCount === 0) {
      if (globals.json) {
        console.log(JSON.stringify({ reset: true, message: "Database was already empty" }));
      } else {
        console.log(chalk15.dim("Database is already empty."));
      }
      return;
    }
    const ok = await confirm(`Reset database? This will delete ${stats.entityCount} entities, ${stats.relationshipCount} relationships, and ${stats.fileCount} file records. Projects will be kept.`, force);
    if (!ok) {
      console.log("Aborted.");
      return;
    }
    store.resetDatabase();
    if (globals.json) {
      console.log(JSON.stringify({ reset: true }));
    } else {
      console.log(chalk15.green("\u2713 Database reset. All entities, relationships, and files removed. Projects preserved."));
    }
  } catch (err) {
    logger24.error("db reset failed", { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk15.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  } finally {
    store.close();
  }
}
async function runDbPrune(force, globals) {
  const config8 = loadConfig({ configDir: globals.config ? resolve16(globals.config) : void 0 });
  const store = new SQLiteStore({ dbPath: config8.graph.dbPath, backupOnStartup: false });
  try {
    const ok = await confirm("Remove all soft-deleted entities and their relationships?", force);
    if (!ok) {
      console.log("Aborted.");
      return;
    }
    const result = store.pruneSoftDeleted();
    if (globals.json) {
      console.log(JSON.stringify(result));
    } else {
      if (result.deletedEntities === 0) {
        console.log(chalk15.dim("Nothing to prune \u2014 no soft-deleted entities found."));
      } else {
        console.log(chalk15.green(`\u2713 Pruned ${result.deletedEntities} entities and ${result.deletedRelationships} relationships`));
      }
    }
  } catch (err) {
    logger24.error("db prune failed", { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk15.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  } finally {
    store.close();
  }
}

// packages/cli/dist/commands/report.js
init_dist();
init_dist2();
import { resolve as resolve17 } from "node:path";
import chalk16 from "chalk";
var logger25 = createLogger("cli:report");
function registerReportCommand(program2) {
  program2.command("report").description("Post-ingestion summary \u2014 files, entities, relationships, contradictions, token costs").option("--failed", "Show full list of failed files with error messages", false).action(async (opts) => {
    const globals = program2.opts();
    await runReport(opts, globals);
  });
}
async function runReport(opts, globals) {
  const config8 = loadConfig({ configDir: globals.config ? resolve17(globals.config) : void 0 });
  const store = new SQLiteStore({ dbPath: config8.graph.dbPath, backupOnStartup: false });
  try {
    const data = store.getReportData();
    if (globals.json) {
      console.log(JSON.stringify(data, null, 2));
      store.close();
      return;
    }
    console.log("");
    console.log(chalk16.bold.cyan("CORTEX REPORT"));
    console.log(chalk16.dim(`Generated: ${new Date(data.generatedAt).toLocaleString()}`));
    console.log(chalk16.dim("\u2500".repeat(60)));
    const totalFiles = data.fileStatus.ingested + data.fileStatus.failed + data.fileStatus.skipped + data.fileStatus.pending;
    console.log("");
    console.log(chalk16.bold("Files"));
    console.log(`  ${chalk16.green("\u2713")} Ingested  ${String(data.fileStatus.ingested).padStart(5)}   ${chalk16.red("\u2717")} Failed    ${String(data.fileStatus.failed).padStart(5)}   ${chalk16.dim("\u2013")} Skipped   ${String(data.fileStatus.skipped).padStart(5)}   Total ${totalFiles}`);
    if (data.failedFiles.length > 0) {
      if (opts.failed || data.failedFiles.length <= 5) {
        console.log("");
        console.log(chalk16.dim("  Failed files:"));
        for (const f of data.failedFiles) {
          console.log(chalk16.red(`    \u2717 ${f.relativePath}`));
          console.log(chalk16.dim(`      ${f.parseError}`));
        }
      } else {
        console.log(chalk16.dim(`  (${data.failedFiles.length} failed \u2014 run with --failed to see details)`));
      }
    }
    const totalEntities = data.entityBreakdown.reduce((s, r) => s + r.count, 0);
    console.log("");
    console.log(chalk16.bold(`Entities  (${totalEntities} active)`));
    if (data.entityBreakdown.length === 0) {
      console.log(chalk16.dim("  None extracted yet."));
    } else {
      for (const row of data.entityBreakdown) {
        const bar = buildBar2(row.count / totalEntities, 16);
        const conf = (row.avgConfidence * 100).toFixed(0);
        console.log(`  ${row.type.padEnd(14)} ${String(row.count).padStart(5)}  ${bar}  conf ${conf}%`);
      }
    }
    if (data.supersededCount > 0) {
      console.log(chalk16.dim(`  + ${data.supersededCount} superseded (merged duplicates)`));
    }
    const totalRels = data.relationshipBreakdown.reduce((s, r) => s + r.count, 0);
    console.log("");
    console.log(chalk16.bold(`Relationships  (${totalRels} total)`));
    if (data.relationshipBreakdown.length === 0) {
      console.log(chalk16.dim("  None inferred yet."));
    } else {
      for (const row of data.relationshipBreakdown) {
        const bar = buildBar2(totalRels > 0 ? row.count / totalRels : 0, 16);
        console.log(`  ${row.type.padEnd(18)} ${String(row.count).padStart(5)}  ${bar}`);
      }
    }
    const totalContradictions = data.contradictions.active + data.contradictions.resolved + data.contradictions.dismissed;
    console.log("");
    console.log(chalk16.bold(`Contradictions  (${totalContradictions} total)`));
    if (totalContradictions === 0) {
      console.log(chalk16.dim("  None detected."));
    } else {
      console.log(`  ${chalk16.red("Active")}   ${data.contradictions.active}   Resolved  ${data.contradictions.resolved}   Dismissed ${data.contradictions.dismissed}`);
      if (data.contradictions.active > 0) {
        console.log(chalk16.dim(`  Severity: ${data.contradictions.highSeverity} high / ${data.contradictions.mediumSeverity} medium / ${data.contradictions.lowSeverity} low`));
        if (data.topContradictions.length > 0) {
          console.log("");
          for (const c of data.topContradictions) {
            const sevColor = c.severity === "high" || c.severity === "critical" ? chalk16.red : c.severity === "medium" ? chalk16.yellow : chalk16.dim;
            console.log(`  ${sevColor(`[${c.severity}]`)} ${chalk16.white(c.entityA)} ${chalk16.dim("\u2194")} ${chalk16.white(c.entityB)}`);
            console.log(chalk16.dim(`         ${truncate(c.description, 100)}`));
            console.log(chalk16.dim(`         cortex resolve ${c.id} --action <supersede|dismiss|keep-old|both-valid>`));
          }
          if (data.contradictions.active > data.topContradictions.length) {
            console.log(chalk16.dim(`  ... and ${data.contradictions.active - data.topContradictions.length} more. Run \`cortex contradictions\` to see all.`));
          }
        }
      }
    }
    const { totalInput, totalOutput } = data.tokenEstimate;
    console.log("");
    console.log(chalk16.bold("Token Usage  (from stored entity records)"));
    if (totalInput === 0 && totalOutput === 0) {
      console.log(chalk16.dim("  No token data available."));
    } else {
      console.log(`  Input   ${totalInput.toLocaleString().padStart(10)} tokens
  Output  ${totalOutput.toLocaleString().padStart(10)} tokens`);
    }
    console.log("");
    console.log(chalk16.dim("\u2500".repeat(60)));
    console.log(chalk16.dim("Tip: cortex contradictions  |  cortex costs  |  cortex status"));
    console.log("");
  } catch (err) {
    logger25.error("Report failed", { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk16.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
  store.close();
}
function truncate(str, maxLen) {
  const oneLine = str.replace(/\n/g, " ").trim();
  return oneLine.length > maxLen ? oneLine.slice(0, maxLen - 3) + "..." : oneLine;
}
function buildBar2(ratio, width) {
  const filled = Math.round(Math.min(1, ratio) * width);
  const empty = width - filled;
  return chalk16.cyan("\u2588".repeat(filled)) + chalk16.dim("\u2591".repeat(empty));
}

// packages/cli/dist/commands/serve.js
init_dist();
import { resolve as resolve20, dirname as dirname5 } from "node:path";
import { readFileSync as readFileSync10, writeFileSync as writeFileSync5, mkdirSync as mkdirSync6 } from "node:fs";
import { homedir as homedir7 } from "node:os";
function findPkgRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    try {
      const pkgPath = resolve20(dir, "package.json");
      const pkg = JSON.parse(readFileSync10(pkgPath, "utf-8"));
      if (pkg.name === "gzoo-cortex")
        return dir;
    } catch {
    }
    const parent = dirname5(dir);
    if (parent === dir)
      break;
    dir = parent;
  }
  return startDir;
}
var logger28 = createLogger("cli:serve");
function registerServeCommand(program2) {
  program2.command("serve").description("Start the Cortex API server + web dashboard").option("--port <port>", "Port to listen on (default: 3710)", "3710").option("--host <host>", "Host to bind to (default: 127.0.0.1)", "127.0.0.1").option("--no-watch", "Disable file watcher").action(async (opts) => {
    const globals = program2.opts();
    await runServe(opts, globals);
  });
}
async function runServe(opts, globals) {
  try {
    const config8 = loadConfig({ configDir: globals.config ? resolve20(globals.config) : void 0 });
    let webDistPath;
    const pkgRoot = findPkgRoot(import.meta.dirname);
    try {
      const webPkgPath = resolve20(pkgRoot, "packages/web/dist");
      const { existsSync: existsSync9 } = await import("node:fs");
      if (existsSync9(webPkgPath)) {
        webDistPath = webPkgPath;
      }
    } catch {
    }
    const { startServer: startServer2 } = await Promise.resolve().then(() => (init_dist5(), dist_exports2));
    const pidDir = resolve20(homedir7(), ".cortex");
    mkdirSync6(pidDir, { recursive: true });
    writeFileSync5(resolve20(pidDir, "cortex.pid"), String(process.pid));
    await startServer2({
      config: config8,
      port: Number(opts.port),
      host: opts.host,
      enableWatch: opts.watch,
      webDistPath
    });
  } catch (err) {
    logger28.error("Server failed to start", { error: err instanceof Error ? err.message : String(err) });
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// packages/cli/dist/commands/stop.js
import { resolve as resolve21 } from "node:path";
import { readFileSync as readFileSync11, unlinkSync, existsSync as existsSync8 } from "node:fs";
import { homedir as homedir8 } from "node:os";
var PID_FILE = resolve21(homedir8(), ".cortex", "cortex.pid");
function readPid() {
  try {
    const pid = Number(readFileSync11(PID_FILE, "utf-8").trim());
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}
function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function stopServer() {
  const pid = readPid();
  if (!pid || !isRunning(pid)) {
    if (pid && existsSync8(PID_FILE))
      unlinkSync(PID_FILE);
    console.log("Cortex is not running.");
    return false;
  }
  process.kill(pid, "SIGTERM");
  console.log(`Cortex (PID ${pid}) stopped.`);
  try {
    unlinkSync(PID_FILE);
  } catch {
  }
  return true;
}
function registerStopCommand(program2) {
  program2.command("stop").description("Stop the running Cortex server").action(() => {
    stopServer();
  });
}
function registerRestartCommand(program2) {
  program2.command("restart").description("Restart the Cortex server (stop + serve)").option("--port <port>", "Port to listen on (default: 3710)", "3710").option("--host <host>", "Host to bind to (default: 127.0.0.1)", "127.0.0.1").option("--no-watch", "Disable file watcher").action(async (opts) => {
    const pid = readPid();
    if (pid && isRunning(pid)) {
      process.kill(pid, "SIGTERM");
      console.log(`Stopped Cortex (PID ${pid}).`);
      try {
        unlinkSync(PID_FILE);
      } catch {
      }
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (!isRunning(pid))
          break;
      }
    }
    console.log("Starting Cortex...");
    const serveCmd = program2.commands.find((c) => c.name() === "serve");
    if (serveCmd) {
      const args = ["--port", opts.port, "--host", opts.host];
      if (!opts.watch)
        args.push("--no-watch");
      await serveCmd.parseAsync(args, { from: "user" });
    }
  });
}

// packages/cli/dist/index.js
var program = new Command();
program.name("cortex").description("Local-first knowledge orchestrator \u2014 remembers what you decided, why, and where.").version("0.4.1").option("--config <path>", "Config file path").option("--verbose", "Show debug-level output", false).option("--quiet", "Suppress all non-error output", false).option("--json", "Output as JSON (for scripting)", false).option("--no-color", "Disable color output");
registerInitCommand(program);
registerWatchCommand(program);
registerQueryCommand(program);
registerFindCommand(program);
registerStatusCommand(program);
registerCostsCommand(program);
registerConfigCommand(program);
registerExcludeCommand(program);
registerPrivacyCommand(program);
registerContradictionsCommand(program);
registerResolveCommand(program);
registerProjectsCommand(program);
registerIngestCommand(program);
registerModelsCommand(program);
registerMcpCommand(program);
registerDbCommand(program);
registerReportCommand(program);
registerServeCommand(program);
registerStopCommand(program);
registerRestartCommand(program);
program.parse(process.argv);
