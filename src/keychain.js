const { execSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const SERVICE_PREFIX = 'kv-cli';
const KV_DIR = path.join(os.homedir(), '.kv');
const KEYCHAIN_PATH = path.join(KV_DIR, 'kv.keychain-db');
const LOCK_TIMEOUT = 28800; // 8 hours

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

// --- Password prompt (sync, hidden input) ---

function promptPassword(msg) {
  // Use stty to hide input (works in all terminals)
  process.stderr.write(msg);
  try {
    execSync('stty -echo', { stdio: ['inherit', 'pipe', 'pipe'] });
    const buf = Buffer.alloc(1024);
    const fd = fs.openSync('/dev/tty', 'r');
    let input = '';
    let n;
    while ((n = fs.readSync(fd, buf, 0, 1)) > 0) {
      const ch = buf.toString('utf-8', 0, n);
      if (ch === '\n' || ch === '\r') break;
      input += ch;
    }
    fs.closeSync(fd);
    process.stderr.write('\n');
    return input;
  } finally {
    execSync('stty echo', { stdio: ['inherit', 'pipe', 'pipe'] });
  }
}

// --- Keychain lifecycle ---

function isInitialized() {
  return fs.existsSync(KEYCHAIN_PATH);
}

function isUnlocked() {
  // Try a harmless operation; if locked it fails
  const result = exec(`security show-keychain-info ${kcPath} 2>&1`);
  return result !== null;
}

function addToSearchList() {
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

function init(password) {
  if (!password) throw new Error('password is required');

  if (!fs.existsSync(KV_DIR)) {
    fs.mkdirSync(KV_DIR, { mode: 0o700 });
  }

  if (isInitialized()) {
    throw new Error('already initialized (~/.kv/kv.keychain-db exists)');
  }

  const pw = shellEscape(password);
  exec(`security create-keychain -p ${pw} ${kcPath}`);
  exec(`security set-keychain-settings -t ${LOCK_TIMEOUT} ${kcPath}`);
  addToSearchList();
}

function unlock(password) {
  if (!isInitialized()) {
    throw new Error('not initialized. Run: kv init');
  }

  if (isUnlocked()) return true;

  if (!password) {
    // Try to prompt if we have a TTY
    if (process.stderr.isTTY) {
      password = promptPassword('\x1b[0;36m🔒 kv locked.\x1b[0m Enter master password: ');
    } else {
      throw new Error('keychain is locked. Run any kv command interactively to unlock.');
    }
  }

  const pw = shellEscape(password);
  const result = exec(`security unlock-keychain -p ${pw} ${kcPath}`);
  if (result === null) {
    throw new Error('wrong password');
  }
  return true;
}

function ensureReady() {
  if (!isInitialized()) {
    throw new Error('not initialized. Run: kv init');
  }
  unlock();
}

function changePassword(oldPassword, newPassword) {
  if (!isInitialized()) {
    throw new Error('not initialized. Run: kv init');
  }
  // Unlock with old password first
  const oldPw = shellEscape(oldPassword);
  const result = exec(`security unlock-keychain -p ${oldPw} ${kcPath}`);
  if (result === null) {
    throw new Error('wrong current password');
  }

  // macOS doesn't have a direct "change keychain password" in CLI,
  // so we delete and recreate, migrating all keys
  const items = getAllItemsInternal();
  const data = {};
  for (const name of items) {
    data[name] = getInternal(name);
  }

  // Delete old keychain
  exec(`security delete-keychain ${kcPath}`);

  // Create new with new password
  const newPw = shellEscape(newPassword);
  exec(`security create-keychain -p ${newPw} ${kcPath}`);
  exec(`security set-keychain-settings -t ${LOCK_TIMEOUT} ${kcPath}`);
  addToSearchList();

  // Restore keys
  const user = shellEscape(os.userInfo().username);
  for (const [name, value] of Object.entries(data)) {
    const svc = shellEscape(service(name));
    const val = shellEscape(value);
    exec(`security add-generic-password -s ${svc} -a ${user} -w ${val} -U ${kcPath}`);
  }

  return items.length;
}

// --- Internal helpers (no ensureReady, used during migration) ---

function getInternal(name) {
  const svc = shellEscape(service(name));
  const user = shellEscape(os.userInfo().username);
  return exec(`security find-generic-password -s ${svc} -a ${user} -w ${kcPath}`);
}

function getAllItemsInternal() {
  const dump = exec(`security dump-keychain ${kcPath}`) || '';
  const regex = new RegExp(`"svce"<blob>="${SERVICE_PREFIX}:([^"]*)"`, 'g');
  const items = new Set();
  let match;
  while ((match = regex.exec(dump)) !== null) {
    items.add(match[1]);
  }
  return [...items].sort();
}

// --- Public API ---

function set(name, value) {
  if (!name) throw new Error('name is required');
  if (!value) throw new Error('value is required');
  ensureReady();

  const svc = shellEscape(service(name));
  const user = shellEscape(os.userInfo().username);
  const val = shellEscape(value);

  exec(`security delete-generic-password -s ${svc} -a ${user} ${kcPath}`);

  const result = exec(
    `security add-generic-password -s ${svc} -a ${user} -w ${val} -U ${kcPath}`
  );

  if (result === null) {
    throw new Error(`failed to store key: ${name}`);
  }
}

function get(name) {
  if (!name) throw new Error('name is required');
  ensureReady();

  const value = getInternal(name);
  if (value === null) {
    throw new Error(`key not found: ${name}`);
  }
  return value;
}

function getAllItems() {
  ensureReady();
  return getAllItemsInternal();
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
  ensureReady();

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

module.exports = {
  init, unlock, changePassword, isInitialized, isUnlocked, promptPassword,
  set, get, list, rm, rmGroup, groups, env, getAllItems,
};
