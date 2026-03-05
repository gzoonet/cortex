import { Command } from 'commander';
import { resolve } from 'node:path';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

const PID_FILE = resolve(homedir(), '.cortex', 'cortex.pid');

function readPid(): number | null {
  try {
    const pid = Number(readFileSync(PID_FILE, 'utf-8').trim());
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function stopServer(): boolean {
  const pid = readPid();
  if (!pid || !isRunning(pid)) {
    if (pid && existsSync(PID_FILE)) unlinkSync(PID_FILE);
    console.log('Cortex is not running.');
    return false;
  }
  process.kill(pid, 'SIGTERM');
  console.log(`Cortex (PID ${pid}) stopped.`);
  try { unlinkSync(PID_FILE); } catch { /* ok */ }
  return true;
}

export function registerStopCommand(program: Command): void {
  program
    .command('stop')
    .description('Stop the running Cortex server')
    .action(() => {
      stopServer();
    });
}

export function registerRestartCommand(program: Command): void {
  program
    .command('restart')
    .description('Restart the Cortex server (stop + serve)')
    .option('--port <port>', 'Port to listen on (default: 3710)', '3710')
    .option('--host <host>', 'Host to bind to (default: 127.0.0.1)', '127.0.0.1')
    .option('--no-watch', 'Disable file watcher')
    .action(async (opts: { port: string; host: string; watch: boolean }) => {
      const pid = readPid();
      if (pid && isRunning(pid)) {
        process.kill(pid, 'SIGTERM');
        console.log(`Stopped Cortex (PID ${pid}).`);
        try { unlinkSync(PID_FILE); } catch { /* ok */ }
        // Wait for process to fully exit and release port
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 500));
        if (!isRunning(pid)) break;
      }
      }
      console.log('Starting Cortex...');
      const serveCmd = program.commands.find(c => c.name() === 'serve');
      if (serveCmd) {
        const args = ['--port', opts.port, '--host', opts.host];
        if (!opts.watch) args.push('--no-watch');
        await serveCmd.parseAsync(args, { from: 'user' });
      }
    });
}
