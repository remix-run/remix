# script-server demo

Client-only demo for `remix/script-server` that keeps a single Node process running so you can manually verify watch-mode invalidation.

## What It Demonstrates

- Serving browser-only TypeScript modules from `script-server`
- Running a long-lived dev server without restarting the Node process on source edits
- Picking up normal source edits, dynamic imports, and extensionless relative import changes

## Run It

```sh
pnpm -C demos/script-server dev
```

Then open [http://localhost:44100](http://localhost:44100).

## Manual Watch-Mode Checks

### Source edits

Edit `app/client/entry.ts` or `app/client/lazy-panel.ts`, refresh the page, and confirm the server process stays alive while the client code updates.

### Extensionless import winner changes

The client imports `./live-copy` without a file extension.

1. Start from `app/client/live-copy.js`
2. Add `app/client/live-copy.ts`
3. Refresh the page

The message should switch to the TypeScript file without restarting the server.
