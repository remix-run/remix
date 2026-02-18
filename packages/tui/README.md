# @remix-run/tui

`@remix-run/tui` provides a terminal host implementation for `@remix-run/reconciler`.

The package keeps the same split as other Remix renderers:

- reconciler owns tree shape/diff and component instances
- NodePolicy owns host tree semantics
- plugins own per-node host meaning

## Status

This package is intentionally minimal and focused on proving the reconciler/NodePolicy/plugin split for terminal rendering.

## Running TUI Demos

OpenTUI-backed demos should be run with Bun:

- `pnpm --filter @remix-run/tui-demos run counter`
- `pnpm --filter @remix-run/tui-demos run table`
- `pnpm --filter @remix-run/tui-demos run form`
