import { watch, type FSWatcher } from 'chokidar';
import { extname } from 'node:path';
import { eventBus, createLogger, type IngestConfig } from '@cortex/core';

const logger = createLogger('ingest:watcher');

export interface WatcherOptions {
  dirs: string[];
  exclude: string[];
  fileTypes: string[];
  debounceMs: number;
  followSymlinks: boolean;
  maxFileSize: number;
  ignoreInitial?: boolean;
}

export type FileChangeHandler = (path: string, changeType: 'add' | 'change' | 'unlink') => void;

export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private options: WatcherOptions;
  private handler: FileChangeHandler | null = null;
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private compiledExcludePatterns: Array<{ pattern: RegExp; isGlob: boolean } | string>;

  constructor(options: WatcherOptions) {
    this.options = options;
    // Pre-compile exclude patterns once instead of on every file event
    this.compiledExcludePatterns = options.exclude.map((pattern) => {
      if (pattern.includes('*')) {
        const re = new RegExp(
          '^' + pattern.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^/\\\\]*') + '$'
        );
        return { pattern: re, isGlob: true };
      }
      return pattern;
    });
  }

  static fromConfig(config: IngestConfig): FileWatcher {
    return new FileWatcher({
      dirs: config.watchDirs,
      exclude: config.exclude,
      fileTypes: config.fileTypes,
      debounceMs: config.debounceMs,
      followSymlinks: config.followSymlinks,
      maxFileSize: config.maxFileSize,
    });
  }

  onFileChange(handler: FileChangeHandler): void {
    this.handler = handler;
  }

  start(): void {
    if (this.watcher) return;

    const ignored = this.buildIgnorePatterns();

    this.watcher = watch(this.options.dirs, {
      ignored,
      persistent: true,
      ignoreInitial: this.options.ignoreInitial ?? false,
      followSymlinks: this.options.followSymlinks,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    });

    this.watcher.on('add', (path: string) => this.handleEvent(path, 'add'));
    this.watcher.on('change', (path: string) => this.handleEvent(path, 'change'));
    this.watcher.on('unlink', (path: string) => this.handleEvent(path, 'unlink'));
    this.watcher.on('error', (error: unknown) => {
      logger.error('Watcher error', { error: error instanceof Error ? error.message : String(error) });
    });
    this.watcher.on('ready', () => {
      logger.info('File watcher ready', { dirs: this.options.dirs });
    });
  }

  async stop(): Promise<void> {
    if (!this.watcher) return;

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    await this.watcher.close();
    this.watcher = null;
    logger.info('File watcher stopped');
  }

  private handleEvent(path: string, changeType: 'add' | 'change' | 'unlink'): void {
    // Secondary exclude guard — chokidar's ignored RegExp is unreliable on Windows
    if (this.isExcluded(path)) return;

    // Check file extension
    const ext = extname(path).slice(1).toLowerCase();
    if (this.options.fileTypes.length > 0 && !this.options.fileTypes.includes(ext)) {
      return;
    }

    // Debounce: cancel previous timer for this path
    const existing = this.debounceTimers.get(path);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(path);

      // Emit event
      eventBus.emit({
        type: 'file.changed',
        payload: { path, changeType },
        timestamp: new Date().toISOString(),
        source: 'ingest:watcher',
      });

      // Call handler
      if (this.handler) {
        try {
          this.handler(path, changeType);
        } catch (err) {
          logger.error('File change handler error', {
            path,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }, this.options.debounceMs);

    this.debounceTimers.set(path, timer);
  }

  private isExcluded(filePath: string): boolean {
    const parts = filePath.split(/[\\/]/);
    for (const compiled of this.compiledExcludePatterns) {
      if (typeof compiled === 'string') {
        if (parts.some((p) => p === compiled)) return true;
      } else {
        if (parts.some((p) => compiled.pattern.test(p))) return true;
      }
    }
    return false;
  }

  private buildIgnorePatterns(): Array<string | RegExp> {
    const patterns: Array<string | RegExp> = [];

    for (const pattern of this.options.exclude) {
      if (pattern.includes('*')) {
        // Glob pattern → convert to regex
        const regexStr = pattern
          .replace(/\./g, '\\.')
          .replace(/\*\*/g, '___GLOBSTAR___')
          .replace(/\*/g, '[^/]*')
          .replace(/___GLOBSTAR___/g, '.*');
        patterns.push(new RegExp(regexStr));
      } else if (pattern.includes('.')) {
        // File name pattern (e.g., 'package-lock.json') — match anywhere in path
        patterns.push(new RegExp(`(^|[\\\\/])${escapeRegex(pattern)}$`));
      } else {
        // Directory name (e.g., 'node_modules', 'dist', '.git') — match the
        // directory anywhere in the path so nested occurrences are excluded too
        patterns.push(new RegExp(`(^|[\\\\/])${escapeRegex(pattern)}([\\\\/]|$)`));
      }
    }

    return patterns;
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
