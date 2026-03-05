const { execSync } = require('child_process');
const os = require('os');

const SERVICE_PREFIX = 'kv-cli';

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

function set(name, value) {
  if (!name) throw new Error('name is required');
  if (!value) throw new Error('value is required');

  const svc = shellEscape(service(name));
  const user = shellEscape(os.userInfo().username);
  const val = shellEscape(value);

  // Delete existing
  exec(`security delete-generic-password -s ${svc} -a ${user} 2>/dev/null`);

  // Add new
  const result = exec(
    `security add-generic-password -s ${svc} -a ${user} -w ${val} -T "" -U`
  );

  if (result === null) {
    throw new Error(`failed to store key: ${name}`);
  }
}

function get(name) {
  if (!name) throw new Error('name is required');

  const svc = shellEscape(service(name));
  const user = shellEscape(os.userInfo().username);

  const value = exec(`security find-generic-password -s ${svc} -a ${user} -w`);
  if (value === null) {
    throw new Error(`key not found: ${name}`);
  }
  return value;
}

function getAllItems() {
  const dump = exec('security dump-keychain') || '';
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

  const svc = shellEscape(service(name));
  const user = shellEscape(os.userInfo().username);

  const result = exec(`security delete-generic-password -s ${svc} -a ${user}`);
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
    exec(`security delete-generic-password -s ${svc} -a ${user}`);
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
