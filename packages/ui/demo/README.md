# demo

A focused demo for the `@remix-run/ui` package using the built-in `RMX_01` preset.

## What It Shows

- A practical, utilitarian web app theme instead of a marketing landing page look
- Shared semantic tokens applied across buttons, cards, popover-like surfaces, and content areas
- How `theme`, flat button `*Style` exports, and component-owned namespaces compose together in Remix component code

## Run It

```sh
pnpm -C packages/ui/demo install
pnpm -C packages/ui/demo dev
```

Then open `http://localhost:44100`.

For a one-shot production-style run that also builds the browser assets:

```sh
pnpm -C packages/ui/demo start
```

## Screenshot Workflow

The demo includes a Playwright-based review workflow so you can capture the current UI without manually taking screenshots.

```sh
pnpm -C packages/ui/demo screenshot
```

That script will:

- start the demo server if it is not already running
- capture a screenshot of the page
- save a timestamped image under `packages/ui/demo/.artifacts/screenshots/`
- update `packages/ui/demo/.artifacts/screenshots/latest.png`

For a focused surface-card capture:

```sh
pnpm -C packages/ui/demo screenshot:card
```

## Key APIs

- `@remix-run/ui` entrypoints for `RMX_01`, `theme`, `button`, and component primitives
- `remix/component/server` for server rendering
- `remix/fetch-router` for request handling

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
