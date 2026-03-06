// Types
export * from './types/index.js';

// Errors
export {
  CortexError,
  type ErrorSeverity,
  type ErrorLayer,
  type RetryConfig,
  RETRY_CONFIGS,
  EXIT_CODES,
  // Ingest error codes
  INGEST_PARSE_FAILED,
  INGEST_FILE_TOO_LARGE,
  INGEST_WATCHER_ERROR,
  INGEST_PERMISSION_DENIED,
  INGEST_UNSUPPORTED_TYPE,
  INGEST_ENCODING_ERROR,
  INGEST_TIMEOUT,
  // LLM error codes
  LLM_PROVIDER_UNAVAILABLE,
  LLM_EXTRACTION_FAILED,
  LLM_CONTEXT_OVERFLOW,
  LLM_RATE_LIMITED,
  LLM_BUDGET_EXHAUSTED,
  LLM_AUTH_FAILED,
  LLM_MODEL_NOT_FOUND,
  LLM_TIMEOUT,
  // Graph error codes
  GRAPH_DB_ERROR,
  GRAPH_ENTITY_NOT_FOUND,
  GRAPH_RELATIONSHIP_INVALID,
  GRAPH_VECTOR_ERROR,
  GRAPH_MERGE_CONFLICT,
  GRAPH_INTEGRITY_ERROR,
  // Privacy / Config / Interface error codes
  PRIVACY_VIOLATION,
  PRIVACY_SECRET_DETECTED,
  CONFIG_INVALID,
  CONFIG_MISSING,
  INTERFACE_PORT_IN_USE,
  SERVER_AUTH_REQUIRED,
  SERVER_AUTH_INVALID,
} from './errors/cortex-error.js';

// EventBus
export { EventBus, eventBus } from './events/event-bus.js';

// Config
export { cortexConfigSchema, type CortexConfigInput } from './config/schema.js';
export { loadConfig, getDefaultConfig, findConfigFile, type LoadConfigOptions } from './config/loader.js';

// Project Registry
export {
  loadProjectRegistry,
  saveProjectRegistry,
  addProject,
  removeProject,
  getProject,
  listProjects,
  updateProjectLastWatched,
  findProjectByPath,
  type ProjectEntry,
  type ProjectRegistry,
} from './config/project-registry.js';

// Logger
export { Logger, createLogger, setGlobalLogLevel } from './logger.js';
