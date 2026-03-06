const keychain = require('./keychain');

/**
 * Get a key value by name.
 * @param {string} name - Key name (e.g. "openrouter" or "openrouter/main")
 * @returns {string} The key value
 */
function kv(name) {
  return keychain.get(name);
}

kv.init = keychain.init;
kv.unlock = keychain.unlock;
kv.changePassword = keychain.changePassword;
kv.isInitialized = keychain.isInitialized;
kv.isUnlocked = keychain.isUnlocked;
kv.set = keychain.set;
kv.get = keychain.get;
kv.list = keychain.list;
kv.rm = keychain.rm;
kv.rmGroup = keychain.rmGroup;
kv.groups = keychain.groups;
kv.env = keychain.env;

module.exports = { kv };
