import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const CLI_PATH = resolve(import.meta.dirname, '../../packages/cli/dist/index.js');

function runCLI(args: string, options: { cwd?: string; env?: Record<string, string> } = {}): string {
  const env = { ...process.env, ...options.env };
  return execSync(`node "${CLI_PATH}" ${args}`, {
    cwd: options.cwd ?? process.cwd(),
    env,
    encoding: 'utf-8',
    timeout: 15000,
  });
}

describe('CLI Integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `cortex-cli-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('cortex --help', () => {
    it('should display help text', () => {
      const output = runCLI('--help');
      expect(output).toContain('cortex');
      expect(output).toContain('init');
      expect(output).toContain('watch');
      expect(output).toContain('query');
      expect(output).toContain('find');
      expect(output).toContain('status');
      expect(output).toContain('costs');
      expect(output).toContain('config');
      expect(output).toContain('privacy');
      expect(output).toContain('contradictions');
      expect(output).toContain('resolve');
    });

    it('should display version', () => {
      const output = runCLI('--version');
      expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('cortex init --non-interactive', () => {
    it('should create a config file', () => {
      runCLI('init --non-interactive', { cwd: tempDir });
      const configPath = join(tempDir, 'cortex.config.json');
      expect(existsSync(configPath)).toBe(true);
    });

    it('should create a valid config with defaults', () => {
      runCLI('init --non-interactive', { cwd: tempDir });
      const configPath = join(tempDir, 'cortex.config.json');
      const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(raw.llm.mode).toBe('cloud-first');
      expect(raw.llm.budget.monthlyLimitUsd).toBeDefined();
    });

    it('should accept --mode flag', () => {
      runCLI('init --non-interactive --mode local-only', { cwd: tempDir });
      const configPath = join(tempDir, 'cortex.config.json');
      const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(raw.llm.mode).toBe('local-only');
    });
  });

  describe('cortex config', () => {
    beforeEach(() => {
      // Create a config file first
      runCLI('init --non-interactive', { cwd: tempDir });
    });

    it('should validate config', () => {
      const output = runCLI('config validate', { cwd: tempDir });
      expect(output).toContain('valid');
    });

    it('should get a config value', () => {
      const output = runCLI('config get llm.mode', { cwd: tempDir });
      expect(output.trim()).toBe('cloud-first');
    });

    it('should set a config value', () => {
      runCLI('config set llm.budget.monthlyLimitUsd 50', { cwd: tempDir });
      const output = runCLI('config get llm.budget.monthlyLimitUsd', { cwd: tempDir });
      expect(output.trim()).toBe('50');
    });
  });

  describe('cortex status --json', () => {
    it('should return valid JSON', () => {
      const output = runCLI('status --json', { cwd: tempDir });
      const data = JSON.parse(output);
      expect(data.graph).toBeDefined();
      expect(data.graph.entities).toBeDefined();
      expect(data.llm).toBeDefined();
      expect(data.storage).toBeDefined();
    });
  });

  describe('cortex costs --json', () => {
    it('should return valid JSON with no data', () => {
      const output = runCLI('costs --json', { cwd: tempDir });
      const data = JSON.parse(output);
      expect(data.totalCostUsd).toBe(0);
    });
  });

  describe('cortex privacy', () => {
    beforeEach(() => {
      runCLI('init --non-interactive', { cwd: tempDir });
    });

    it('should list privacy classifications', () => {
      const output = runCLI('privacy list --json', { cwd: tempDir });
      const data = JSON.parse(output);
      expect(data.defaultLevel).toBe('standard');
      expect(data.directoryOverrides).toBeDefined();
    });
  });

  describe('cortex contradictions', () => {
    it('should return empty list', () => {
      const output = runCLI('contradictions --json', { cwd: tempDir });
      const data = JSON.parse(output);
      expect(data.contradictions).toEqual([]);
    });
  });
});
