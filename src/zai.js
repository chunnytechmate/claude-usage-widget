'use strict';
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const ZAI_URL = 'https://api.z.ai/api/monitor/usage/quota/limit';

// Resolve the Z.AI API key, in priority order:
//   1. ZAI_API_KEY environment variable
//   2. an explicit key saved in the widget config (zaiApiKey)
//   3. the widget's own .env file at the project root
//      (or cfg.zaiEnvPath if you point it at another .env)
function defaultEnvPath() {
  // app.getAppPath() is the project root when running from source.
  try { return path.join(app.getAppPath(), '.env'); } catch { return null; }
}

function readDotenvKey(p) {
  let raw;
  try { raw = fs.readFileSync(p, 'utf8'); } catch { return null; }
  const m = raw.match(/^\s*ZAI_API_KEY\s*=\s*(.+?)\s*$/m);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

function readKey(cfg) {
  if (process.env.ZAI_API_KEY) return process.env.ZAI_API_KEY.trim();
  if (cfg && cfg.zaiApiKey) return cfg.zaiApiKey.trim();
  const envPath = (cfg && cfg.zaiEnvPath) || defaultEnvPath();
  if (envPath) {
    const k = readDotenvKey(envPath);
    if (k) return k;
  }
  return null;
}

async function fetchZaiUsage(cfg) {
  const key = readKey(cfg);
  if (!key) {
    const e = new Error('ZAI_API_KEY not found');
    e.noKey = true;
    throw e;
  }
  const res = await fetch(ZAI_URL, {
    method: 'GET',
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`Z.AI endpoint returned ${res.status}`);
    err.status = res.status;
    const retryAfter = Number(res.headers.get('retry-after'));
    if (Number.isFinite(retryAfter) && retryAfter > 0) err.retryAfter = retryAfter;
    throw err;
  }
  const body = await res.json();
  if (body.code && body.code !== 200) {
    throw new Error(`Z.AI: ${body.msg || 'error ' + body.code}`);
  }
  return normalize(body.data || {});
}

function normalize(data) {
  const rows = [];
  const limits = Array.isArray(data.limits) ? data.limits : [];

  const tokens = limits.find((l) => l.type === 'TOKENS_LIMIT');
  if (tokens) {
    rows.push({
      key: 'zai-tokens',
      label: 'Token limit',
      percent: Math.round(tokens.percentage || 0),
      resetsAt: msToIso(tokens.nextResetTime),
      severity: severityFor(tokens.percentage || 0),
    });
  }

  return { ok: true, plan: data.level || null, rows, fetchedAt: Date.now() };
}

function msToIso(ms) {
  if (!ms || typeof ms !== 'number') return null;
  return new Date(ms).toISOString();
}

function severityFor(pct) {
  if (pct >= 90) return 'critical';
  if (pct >= 70) return 'warning';
  return 'normal';
}

module.exports = { fetchZaiUsage, ZAI_URL };
