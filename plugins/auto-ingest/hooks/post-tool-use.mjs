#!/usr/bin/env node
/**
 * Cortex Auto-Ingest Hook — PostToolUse handler
 *
 * Fires after Read/Edit/Write/MultiEdit. Extracts the file path from tool input
 * and spawns `cortex ingest <path>` as a detached background process.
 *
 * Rules:
 * - NEVER block Claude's workflow (always exit 0)
 * - NEVER print to stdout (would interfere with JSON-RPC)
 * - Skip unsupported file types, excluded paths, and unchanged files
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { homedir } from 'node:os';

// Supported extensions (must match Cortex PARSER_REGISTRY)
const SUPPORTED_EXTS = new Set([
  '.md', '.mdx', '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml',
]);

// Paths to always skip
const EXCLUDE_PATTERNS = [
  '/node_modules/',
  '/.git/',
  '/dist/',
  '/build/',
  '/.next/',
  '/.nuxt/',
  '/coverage/',
  '/__pycache__/',
  '/vendor/',
  '.lock',
  '-lock.',
  'lock.json',
  '.env',
  '.min.',
  '.map',
  '.d.ts',
];

function main() {
  try {
    // Read tool input from stdin
    let input = '';
    try {
      input = readFileSync(0, 'utf-8');
    } catch {
      process.exit(0);
    }

    let data;
    try {
      data = JSON.parse(input);
    } catch {
      process.exit(0);
    }

    // Extract file path from tool input
    const toolInput = data.tool_input || data.input || {};
    const filePath = toolInput.file_path || toolInput.filePath || toolInput.path;
    if (!filePath || typeof filePath !== 'string') {
      process.exit(0);
    }

    // Check extension
    const ext = extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTS.has(ext)) {
      process.exit(0);
    }

    // Check exclusions
    const lowerPath = filePath.toLowerCase();
    for (const pattern of EXCLUDE_PATTERNS) {
      if (lowerPath.includes(pattern)) {
        process.exit(0);
      }
    }

    // Check file exists
    if (!existsSync(filePath)) {
      process.exit(0);
    }

    // Content hash dedup check
    const cacheDir = join(homedir(), '.cortex');
    const cachePath = join(cacheDir, 'auto-ingest-cache.json');

    let cache = {};
    try {
      if (existsSync(cachePath)) {
        cache = JSON.parse(readFileSync(cachePath, 'utf-8'));
      }
    } catch {
      cache = {};
    }

    let fileContent;
    try {
      fileContent = readFileSync(filePath, 'utf-8');
    } catch {
      process.exit(0);
    }

    const hash = createHash('sha256').update(fileContent).digest('hex').slice(0, 16);
    if (cache[filePath] === hash) {
      // File hasn't changed since last ingest
      process.exit(0);
    }

    // Update cache
    cache[filePath] = hash;
    try {
      if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
      }
      writeFileSync(cachePath, JSON.stringify(cache), 'utf-8');
    } catch {
      // Cache write failed — continue anyway
    }

    // Spawn cortex ingest in background (detached, no stdio)
    const child = spawn('cortex', ['ingest', filePath, '--json'], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, CORTEX_LOG_LEVEL: 'error' },
    });
    child.unref();

  } catch {
    // Never fail — silently exit
  }

  process.exit(0);
}

main();
