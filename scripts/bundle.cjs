const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = 'c:/Users/eddy/Documents/AI_Agent/gzoo-cortex';

// Read root package.json to get all dependencies
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
const allDeps = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
];

const externals = allDeps.map(d => '--external:' + d).join(' ');

// Rebuild web dashboard so npm publish always ships fresh assets
// Safe: no user input involved, hardcoded command string
console.log('Building web dashboard...');
execSync('npm run build --workspace=packages/web', { cwd: root, stdio: 'inherit' });

execSync(
  `npx esbuild packages/cli/dist/index.js --bundle --platform=node --target=node20 --format=esm --outfile=dist/cortex.mjs ${externals}`,
  { cwd: root, stdio: 'inherit' }
);

// Prepend shebang (strip any existing)
const bundlePath = path.join(root, 'dist/cortex.mjs');
let content = fs.readFileSync(bundlePath, 'utf-8');
content = content.replace(/^#!.*\n/, '');
fs.writeFileSync(bundlePath, '#!/usr/bin/env node\n' + content);

console.log('\nBundle created at dist/cortex.mjs');
console.log('Size:', (fs.statSync(bundlePath).size / 1024).toFixed(0), 'KB');
