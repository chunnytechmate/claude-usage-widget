'use strict';
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Resolved lazily: app.getPath() is only valid once Electron has initialized.
function configPath() {
  return path.join(app.getPath('userData'), 'overlay-config.json');
}

const DEFAULTS = {
  bounds: null,          // {x, y} saved window position (used only when not docked)
  opacity: 0.95,         // 0.3 - 1.0
  clickThrough: false,   // let clicks pass through to windows behind
  alwaysOnTop: true,
  pollSeconds: 180,
  launchOnStartup: false,
  collapsed: false,      // widget folded down to just its title bar
  taskbarMode: true,     // dock to bottom-right just above the Windows taskbar
  // Providers — toggle each from the tray ("Providers" submenu):
  //   Both / Claude only / Z.AI only. A provider that's off isn't fetched at all.
  claudeEnabled: true,
  zaiEnabled: true,
  // Z.AI key sources (resolved in priority order in src/zai.js):
  //   1) ZAI_API_KEY env var   2) zaiApiKey here   3) the widget's own .env file.
  // Leave zaiEnvPath null to read <project>/.env, or point it at any .env you keep.
  zaiApiKey: null,
  zaiEnvPath: null,
};

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    return { ...DEFAULTS, ...data };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(cfg) {
  try {
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
  } catch (e) {
    console.error('Failed to save config:', e.message);
  }
}

module.exports = { load, save, configPath, DEFAULTS };
