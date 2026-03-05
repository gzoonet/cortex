const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// Collect all non-workspace dependencies across all packages
const externals = new Set();
const pkgDirs = fs.readdirSync(path.join(root, 'packages'));
for (const dir of pkgDirs) {
  const p = path.join(root, 'packages', dir, 'package.json');
  if (fs.existsSync(p)) {
    const sub = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const dep of Object.keys(sub.dependencies || {})) {
      if (!dep.startsWith('@cortex/')) externals.add(dep);
    }
  }
}

const externalArgs = [];
for (const dep of externals) {
  externalArgs.push('--external:' + dep);
}

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });

execFileSync('npx', [
  'esbuild',
  'packages/mcp/dist/index.js',
  '--bundle',
  '--platform=node',
  '--target=node20',
  '--format=esm',
  '--outfile=dist/cortex-mcp.mjs',
  ...externalArgs,
], { cwd: root, stdio: 'inherit', shell: true });

// Ensure shebang is present
const bundlePath = path.join(root, 'dist', 'cortex-mcp.mjs');
let content = fs.readFileSync(bundlePath, 'utf-8');
content = content.replace(/^#!.*\n/, '');
fs.writeFileSync(bundlePath, '#!/usr/bin/env node\n' + content);

console.log('\nMCP bundle created at dist/cortex-mcp.mjs');
console.log('Size:', (fs.statSync(bundlePath).size / 1024).toFixed(0), 'KB');
