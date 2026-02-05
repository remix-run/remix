# HMR Loader Prototype

This is a working prototype demonstrating server-side HMR using `@remix-run/watch`.

## Quick Start

```bash
pnpm dev
```

Then try:

1. Edit `handler.js` → See HMR (no restart)
2. Edit `middleware.js` → See full restart
3. Make rapid edits → All caught, no lost updates

## Test it

```bash
# Terminal 1: Start the watcher
pnpm dev

# Terminal 2: Test the endpoint
curl http://localhost:3000/test

# Edit handler.js, then test again
curl http://localhost:3000/test
```

## How it works

1. **`remix-watch`** (supervisor) watches files and manages the server process
2. **Node.js loader** transforms route handlers to support HMR
3. **HMR runtime** provides registry and dynamic imports with cache busting
4. **IPC** sends update messages from supervisor → worker

## Files

- `server.js` - Simple HTTP server (HMR-agnostic!)
- `handler.js` - Route handler (HMR boundary)
- `middleware.js` - Infrastructure (triggers restart)
- `watch.config.js` - Configures what triggers HMR vs restart

## Architecture

The beauty of this approach:

- **Application code has zero HMR awareness**
- **Runtime-agnostic** (uses Web APIs only)
- **No client-side dependencies** (this is server-side HMR)
- **Works after restarts** (file watcher survives process changes)

## Comparison to tsx watch

| Feature           | tsx watch | remix-watch |
| ----------------- | --------- | ----------- |
| File watching     | ✅        | ✅          |
| Auto restart      | ✅        | ✅          |
| HMR for routes    | ❌        | ✅          |
| Preserves state   | ❌        | ✅          |
| Selective restart | ❌        | ✅          |
