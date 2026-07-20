'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

// Where Claude Code writes one .jsonl transcript per session, grouped by project.
const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const CLAUDE_JSON = path.join(os.homedir(), '.claude.json');

// Read only the tail of large transcripts — the model we want is the most recent
// assistant message's, which always lives near the end of the file.
const TAIL_BYTES = 512 * 1024;

// friendly-label cache: { normalizedModelId -> label } from additionalModelOptionsCache
// (e.g. 'claude-fable-5' -> 'Fable'). Re-read when ~/.claude.json changes.
let labelCache = null;
let labelCacheMtime = 0;

// Strip context-window / variant suffixes so ids compare cleanly:
//   'claude-fable-5[1m]' -> 'claude-fable-5',  'glm-5.2' -> 'glm-5.2'
function norm(id) {
  return String(id || '')
    .toLowerCase()
    .replace(/\[.*?\]$/, '')
    .replace(/-1m$/, '')
    .trim();
}

function readLabelCache() {
  let st;
  try { st = fs.statSync(CLAUDE_JSON); } catch { return labelCache || {}; }
  if (labelCache && st.mtimeMs === labelCacheMtime) return labelCache;
  try {
    const data = JSON.parse(fs.readFileSync(CLAUDE_JSON, 'utf8'));
    const map = {};
    for (const opt of (data.additionalModelOptionsCache || [])) {
      if (opt && opt.value) map[norm(opt.value)] = opt.label || opt.value;
    }
    labelCache = map;
    labelCacheMtime = st.mtimeMs;
    return map;
  } catch {
    labelCache = labelCache || {};
    return labelCache;
  }
}

// Turn a raw model id into something readable: a cached friendly label if we have
// one (e.g. 'claude-fable-5[1m]' -> 'Fable'), otherwise the id with suffixes stripped.
function prettyLabel(id) {
  const labels = readLabelCache();
  const mapped = labels[norm(id)];
  if (mapped) return mapped;
  return String(id).replace(/\[.*?\]$/, '').trim() || String(id);
}

// Newest .jsonl under ~/.claude/projects/*/ by mtime — the session most recently
// written to is the one currently in use.
function newestSessionFile() {
  let projectDirs;
  try { projectDirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true }); }
  catch { return null; }

  let best = null;
  for (const ent of projectDirs) {
    if (!ent.isDirectory()) continue;
    const dir = path.join(PROJECTS_DIR, ent.name);
    let files;
    try { files = fs.readdirSync(dir); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      const full = path.join(dir, f);
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      if (!best || st.mtimeMs > best.mtimeMs) best = { file: full, mtimeMs: st.mtimeMs };
    }
  }
  return best;
}

// Scan the transcript tail (newest line first) for the last record carrying
// message.model. Returns the model id string, or null if none / unreadable.
function lastModelInFile(file) {
  let fd;
  let buf;
  let readTail = false;
  try {
    const size = fs.statSync(file).size;
    const len = Math.min(size, TAIL_BYTES);
    buf = Buffer.alloc(len);
    fd = fs.openSync(file, 'r');
    fs.readSync(fd, buf, 0, len, size - len);
    fs.closeSync(fd);
    fd = null;
    readTail = size > TAIL_BYTES; // we skipped the file's beginning -> first line is partial
  } catch {
    if (fd) { try { fs.closeSync(fd); } catch {} }
    return null;
  }

  const text = buf.toString('utf8');
  // If we read a tail, the first line is likely partial — skip past its newline.
  const firstNl = text.indexOf('\n');
  const startAt = readTail && firstNl !== -1 ? firstNl + 1 : 0;
  const lines = text.slice(startAt).split('\n');

  for (let i = lines.length - 1; i >= 0; i--) {
    const ln = lines[i];
    if (!ln || ln[0] !== '{') continue;
    try {
      const o = JSON.parse(ln);
      if (o && o.message && typeof o.message.model === 'string' && o.message.model) {
        return o.message.model;
      }
    } catch { /* malformed line — skip */ }
  }
  return null;
}

// Detect the model Claude Code is currently using. Never throws: any failure
// (no sessions, unreadable file, no model in transcript) resolves to null so the
// usage strip still renders normally without an active-model pill.
function getActiveModel() {
  try {
    const newest = newestSessionFile();
    if (!newest) return null;
    const id = lastModelInFile(newest.file);
    if (!id) return null;
    return { id, label: prettyLabel(id), norm: norm(id) };
  } catch {
    return null;
  }
}

module.exports = { getActiveModel, norm };
