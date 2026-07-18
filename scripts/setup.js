#!/usr/bin/env node
'use strict';
// Smart first-run setup for claude-usage-widget.
//   - makes sure node_modules is installed
//   - creates a local .env from .env.example (never overwrites an existing one)
//   - reports which providers are ready to use right now
// Run with:  npm run setup

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENV = path.join(ROOT, '.env');
const ENV_EXAMPLE = path.join(ROOT, '.env.example');
const NODE_MODULES = path.join(ROOT, 'node_modules');
const CLAUDE_CRED = path.join(os.homedir(), '.claude', '.credentials.json');

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

function parseDotenv(p) {
  let raw;
  try { raw = fs.readFileSync(p, 'utf8'); } catch { return {}; }
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function status(label, ok, hint) {
  const mark = ok ? green('✓ ready') : yellow('— not set');
  console.log(`  ${mark}  ${label}`);
  if (!ok && hint) console.log(dim(`        ${hint}`));
}

console.log(bold('\nclaude-usage-widget — setup\n'));

// 1) dependencies
if (fs.existsSync(NODE_MODULES)) {
  console.log(`  ${green('✓ ready')}  dependencies installed`);
} else {
  console.log(`  ${yellow('! missing')}  dependencies — run ${bold('npm install')} first`);
}

// 2) .env
if (!fs.existsSync(ENV)) {
  if (fs.existsSync(ENV_EXAMPLE)) {
    fs.copyFileSync(ENV_EXAMPLE, ENV);
    console.log(`  ${green('✓ created')}  .env (copied from .env.example)`);
  } else {
    console.log(`  ${yellow('! missing')}  .env.example — create .env manually with ZAI_API_KEY=`);
  }
} else {
  console.log(`  ${green('✓ exists')}   .env`);
}

// 3) provider readiness
const envVals = parseDotenv(ENV);
const zaiKey = (process.env.ZAI_API_KEY || envVals.ZAI_API_KEY || '').trim();
const hasClaude = fs.existsSync(CLAUDE_CRED);

console.log(bold('\nProviders'));
status('Claude', hasClaude,
  'no ~/.claude/.credentials.json — sign in with Claude Code, or run in Z.AI-only mode');
status('Z.AI', !!zaiKey,
  `open ${bold(ENV)} and set ZAI_API_KEY=… , or run in Claude-only mode`);

console.log(bold('\nModes (toggle from the tray → Providers)'));
const both = hasClaude && !!zaiKey;
console.log(`  ${both ? green('ready') : dim('ready*')}    Both (Claude + Z.AI)`);
console.log(`  ${hasClaude ? green('ready') : red('no')}      Claude only`);
console.log(`  ${zaiKey ? green('ready') : red('no')}      Z.AI only`);
if (!both) console.log(dim('  * add the missing piece above to unlock this mode'));

console.log(bold('\nNext'));
console.log(`  npm start            ${dim('# launch the widget')}`);
console.log(`  start-overlay.vbs    ${dim('# launch with no console window')}`);
console.log(`  Ctrl+Shift+U         ${dim('# show / hide the overlay')}`);
if (!zaiKey) console.log(yellow(`\n  → edit ${ENV} and add your ZAI_API_KEY to enable Z.AI.\n`));
console.log('');
