# @remix-run/tui demos

These demos exercise the new TUI reconciler package.

## Requirements

- Bun `>=1.3.0` (OpenTUI uses Bun FFI)

## Run

- `pnpm --filter @remix-run/tui-demos run counter`
- `pnpm --filter @remix-run/tui-demos run table`
- `pnpm --filter @remix-run/tui-demos run form`

From `packages/tui`, you can also run:

- `pnpm --dir demos run counter`
- `pnpm --dir demos run table`
- `pnpm --dir demos run form`

## Notes

- Demos use `@remix-run/tui` and create an OpenTUI root at runtime.
- Press `Ctrl+C` to exit any demo cleanly.
