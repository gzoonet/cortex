import { resolve, dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { loadConfig, createLogger } from '@cortex/core';
function findPkgRoot(startDir) {
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
const logger = createLogger('cli:serve');
export function registerServeCommand(program) {
    program
        .command('serve')
        .description('Start the Cortex API server + web dashboard')
        .option('--port <port>', 'Port to listen on (default: 3710)', '3710')
        .option('--host <host>', 'Host to bind to (default: 127.0.0.1)', '127.0.0.1')
        .option('--no-watch', 'Disable file watcher')
        .action(async (opts) => {
        const globals = program.opts();
        await runServe(opts, globals);
    });
}
async function runServe(opts, globals) {
    try {
        const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
        // Try to find the web dashboard dist
        let webDistPath;
        const pkgRoot = findPkgRoot(import.meta.dirname);
        try {
            const webPkgPath = resolve(pkgRoot, 'packages/web/dist');
            const { existsSync } = await import('node:fs');
            if (existsSync(webPkgPath)) {
                webDistPath = webPkgPath;
            }
        }
        catch {
            // Web dashboard not built yet — that's fine
        }
        const { startServer } = await import('@cortex/server');
        await startServer({
            config,
            port: Number(opts.port),
            host: opts.host,
            enableWatch: opts.watch,
            webDistPath,
        });
    }
    catch (err) {
        logger.error('Server failed to start', { error: err instanceof Error ? err.message : String(err) });
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}
//# sourceMappingURL=serve.js.map