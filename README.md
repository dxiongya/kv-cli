# kv

Secure API key storage via macOS Keychain. Zero dependencies, two-letter commands.

## Install

```bash
brew install dxiongya/tap/kv
```

Or manually:

```bash
git clone https://github.com/dxiongya/kv-cli.git
ln -s "$(pwd)/kv-cli/bin/kv" /usr/local/bin/kv
```

## Usage

```bash
# Store a key
kv set openai sk-proj-xxxxx

# Store with secure input (value hidden, not in shell history)
kv set openai

# Retrieve → clipboard (auto-clears in 10s)
kv get openai

# Retrieve → print to terminal
kv get openai --print

# Use inline
curl -H "Authorization: Bearer $(kv get openai --print)" https://api.openai.com/...

# List all keys
kv list

# List by prefix
kv list aws/

# Export as environment variables
kv env aws/prod/

# Delete
kv rm openai
```

## Security

- **macOS Keychain** — hardware-backed encryption (Secure Enclave on Apple Silicon)
- **Clipboard auto-clear** — copied values are wiped after 10 seconds
- **Hidden input** — `kv set name` without a value prompts securely (no echo)
- **Pipe-friendly** — `echo "sk-xxx" | kv set name` avoids shell history
- **No files on disk** — all secrets live in Keychain, never written to disk

## License

MIT
