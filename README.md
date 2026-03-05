# clave

Secure API key storage via macOS Keychain. Zero dependencies.

> *clave* — Latin/Spanish for "key". The root of *enclave*.

## Install

```bash
# npm
npm install -g clave

# Homebrew
brew install dxiongya/tap/kv

# Manual
git clone https://github.com/dxiongya/kv-cli.git
ln -s "$(pwd)/kv-cli/bin/kv" /usr/local/bin/kv
```

## CLI Usage

```bash
# Store a key
kv set openai sk-proj-xxxxx

# Store with secure input (value hidden, not in shell history)
kv set openai

# Retrieve -> clipboard (auto-clears in 10s)
kv get openai

# Retrieve -> print to terminal
kv get openai --print

# Use inline
curl -H "Authorization: Bearer $(kv get openai --print)" https://api.openai.com/...

# Groups
kv set openrouter/main sk-or-xxx
kv set openrouter/dev sk-or-yyy
kv groups                            # show all groups
kv list openrouter/                  # list keys in a group
kv rm openrouter/ --all              # delete entire group
kv env openrouter/                   # export group as env vars

# List all keys
kv list

# Delete
kv rm openai
```

## Node.js API

```js
const { kv } = require('clave')

// Get a key
const key = kv('openrouter')
const key2 = kv('openrouter/main')

// Set a key
kv.set('openrouter/dev', 'sk-or-yyy')

// List keys
kv.list()                // all keys
kv.list('openrouter/')   // keys in a group

// Groups
kv.groups()
// { grouped: { openrouter: 2 }, ungrouped: ['openai'] }

// Export as env vars
kv.env('openrouter/')
// { MAIN: 'sk-or-xxx', DEV: 'sk-or-yyy' }

// Delete
kv.rm('openai')
kv.rmGroup('openrouter/')  // delete all in group
```

## Security

- **macOS Keychain** — hardware-backed encryption (Secure Enclave on Apple Silicon)
- **Clipboard auto-clear** — copied values are wiped after 10 seconds
- **Hidden input** — `kv set name` without a value prompts securely (no echo)
- **Pipe-friendly** — `echo "sk-xxx" | kv set name` avoids shell history
- **No files on disk** — all secrets live in Keychain, never written to disk

## License

MIT
