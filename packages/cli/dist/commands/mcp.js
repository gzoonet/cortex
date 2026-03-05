import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import chalk from 'chalk';
function findPackageRoot(startDir) {
    let dir = startDir;
    for (let i = 0; i < 10; i++) {
        try {
            const pkgPath = resolve(dir, 'package.json');
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
            if (pkg.name === 'gzoo-cortex')
                return dir;
        }
        catch { /* keep looking */ }
        const parent = dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return startDir;
}
export function registerMcpCommand(program) {
    program
        .command('mcp')
        .description('Start the Cortex MCP server (stdio transport for Claude Code)')
        .option('--config-dir <path>', 'Directory containing cortex.config.json')
        .action(async (opts) => {
        const globals = program.opts();
        const pkgRoot = findPackageRoot(import.meta.dirname);
        const bundledMcp = resolve(pkgRoot, 'dist/cortex-mcp.mjs');
        const workspaceMcp = resolve(pkgRoot, 'packages/mcp/dist/index.js');
        const mcpEntry = existsSync(bundledMcp) ? bundledMcp : workspaceMcp;
        if (!existsSync(mcpEntry)) {
            console.error(chalk.red('Error: MCP server not built.'));
            console.error(chalk.dim(`Expected: ${mcpEntry}`));
            console.error(chalk.dim('Run npm run build first.'));
            process.exit(1);
        }
        if (process.stdout.isTTY) {
            process.stderr.write(chalk.yellow('\n[cortex mcp] Starting MCP server on stdio.\n') +
                chalk.dim('This process blocks. It is meant to be launched by Claude Code, not run manually.\n') +
                chalk.dim('Register with: claude mcp add cortex --scope user -- node ' + mcpEntry + '\n\n'));
        }
        const env = {
            ...process.env,
            CORTEX_LOG_LEVEL: 'error',
        };
        if (opts.configDir) {
            env['CORTEX_CONFIG_DIR'] = resolve(opts.configDir);
        }
        if (globals.config) {
            env['CORTEX_CONFIG_DIR'] = resolve(globals.config);
        }
        const child = spawn(process.execPath, [mcpEntry], {
            stdio: 'inherit',
            env,
        });
        child.on('exit', (code) => process.exit(code ?? 0));
        child.on('error', (err) => {
            process.stderr.write(`[cortex mcp] Error: ${err.message}\n`);
            process.exit(1);
        });
    });
}
//# sourceMappingURL=mcp.js.map