import type { LogLevel } from './types/config.js';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let globalLogLevel: number | null = null;

export function setGlobalLogLevel(level: LogLevel): void {
  globalLogLevel = LOG_LEVELS[level];
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  source?: string;
  context?: Record<string, unknown>;
}

export class Logger {
  private level: number;
  private source: string;

  constructor(source: string, level: LogLevel = 'info') {
    this.source = source;
    this.level = LOG_LEVELS[level];
  }

  setLevel(level: LogLevel): void {
    this.level = LOG_LEVELS[level];
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  child(source: string): Logger {
    const childLogger = new Logger(`${this.source}:${source}`);
    childLogger.level = this.level;
    return childLogger;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const effectiveLevel = globalLogLevel ?? this.level;
    if (LOG_LEVELS[level] < effectiveLevel) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      source: this.source,
      ...(context && { context }),
    };

    const output = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
    output.write(JSON.stringify(entry) + '\n');
  }
}

export function createLogger(source: string, level?: LogLevel): Logger {
  const effectiveLevel = level ?? (process.env['CORTEX_LOG_LEVEL'] as LogLevel | undefined) ?? 'info';
  return new Logger(source, effectiveLevel);
}
