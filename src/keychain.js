const { execSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const SERVICE_PREFIX = 'kv-cli';
const KV_DIR = path.join(os.homedir(), '.kv');
const KEYCHAIN_PATH = path.join(KV_DIR, 'kv.keychain-db');
const LOCK_TIMEOUT = 28800; // 8 hours in seconds

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function service(name) {
  return `${SERVICE_PREFIX}:${name}`;
}

function shellEscape(str) {
  return `'${str.replace(/'/g, "'\\''")}'`;
}

const kcPath = shellEscape(KEYCHAIN_PATH);

/**
 * Ensure the kv keychain exists and is unlocked.
 * First time: creates keychain with empty password, adds to search list.
 * Subsequent: unlocks if locked.
 */
function ensureKeychain() {
  if (!fs.existsSync(KV_DIR)) {
    fs.mkdirSync(KV_DIR, { mode: 0o700 });
  }

  if (!fs.existsSync(KEYCHAIN_PATH)) {
    // Create keychain with empty password
    exec(`security create-keychain -p "" ${kcPath}`);
    // Set auto-lock timeout
    exec(`security set-keychain-settings -t ${LOCK_TIMEOUT} ${kcPath}`);
    // Add to search list so dump-keychain can find it
    const existing = exec('security list-keychains -d user') || '';
    const keychains = existing
      .split('\n')
      .map(s => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
    if (!keychains.includes(KEYCHAIN_PATH)) {
      keychains.push(KEYCHAIN_PATH);
      const kcArgs = keychains.map(k => shellEscape(k)).join(' ');
      exec(`security list-keychains -d user -s ${kcArgs}`);
    }
  }

  // Unlock (no-op if already unlocked)
  exec(`security unlock-keychain -p "" ${kcPath}`);
}

function set(name, value) {
  if (!name) throw new Error('name is required');
  if (!value) throw new Error('value is required');
  ensureKeychain();

  const svc = shellEscape(service(name));
  const user = shellEscape(os.userInfo().username);
  const val = shellEscape(value);

  // Delete existing
  exec(`security delete-generic-password -s ${svc} -a ${user} ${kcPath}`);

  // Add new
  const result = exec(
    `security add-generic-password -s ${svc} -a ${user} -w ${val} -U ${kcPath}`
  );

  if (result === null) {
    throw new Error(`failed to store key: ${name}`);
  }
}

function get(name) {
  if (!name) throw new Error('name is required');
  ensureKeychain();

  const svc = shellEscape(service(name));
  const user = shellEscape(os.userInfo().username);

  const value = exec(`security find-generic-password -s ${svc} -a ${user} -w ${kcPath}`);
  if (value === null) {
    throw new Error(`key not found: ${name}`);
  }
  return value;
}

function getAllItems() {
  ensureKeychain();
  const dump = exec(`security dump-keychain ${kcPath}`) || '';
  const regex = new RegExp(`"svce"<blob>="${SERVICE_PREFIX}:([^"]*)"`, 'g');
  const items = new Set();
  let match;
  while ((match = regex.exec(dump)) !== null) {
    items.add(match[1]);
  }
  return [...items].sort();
}

function list(prefix) {
  let items = getAllItems();
  if (prefix) {
    items = items.filter(item => item.startsWith(prefix));
  }
  return items;
}

function rm(name) {
  if (!name) throw new Error('name is required');
  ensureKeychain();

  const svc = shellEscape(service(name));
  const user = shellEscape(os.userInfo().username);

  const result = exec(`security delete-generic-password -s ${svc} -a ${user} ${kcPath}`);
  if (result === null) {
    throw new Error(`key not found: ${name}`);
  }
}

function rmGroup(prefix) {
  const items = list(prefix);
  if (items.length === 0) {
    throw new Error(`no keys matching: ${prefix}`);
  }
  for (const item of items) {
    const svc = shellEscape(service(item));
    const user = shellEscape(os.userInfo().username);
    exec(`security delete-generic-password -s ${svc} -a ${user} ${kcPath}`);
  }
  return items.length;
}

function groups() {
  const items = getAllItems();
  const grouped = {};
  const ungrouped = [];

  for (const item of items) {
    const slash = item.indexOf('/');
    if (slash !== -1) {
      const group = item.substring(0, slash);
      grouped[group] = (grouped[group] || 0) + 1;
    } else {
      ungrouped.push(item);
    }
  }

  return { grouped, ungrouped };
}

function env(prefix) {
  const items = list(prefix);
  if (items.length === 0) {
    throw new Error(`no keys matching prefix: ${prefix}`);
  }

  const result = {};
  for (const item of items) {
    const value = get(item);
    const envName = item
      .replace(prefix, '')
      .replace(/[/-]/g, '_')
      .toUpperCase();
    result[envName] = value;
  }
  return result;
}

module.exports = { set, get, list, rm, rmGroup, groups, env, getAllItems };
