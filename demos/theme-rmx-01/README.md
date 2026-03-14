# theme-rmx-01

A focused demo for the `@remix-run/theme` package using the built-in `RMX_01` preset.

## What It Shows

- A practical, utilitarian web app theme instead of a marketing landing page look
- Shared semantic tokens applied across buttons, cards, popover-like surfaces, and content areas
- How `theme`, `ui`, and `css()` compose together in Remix component code

## Run It

```sh
pnpm -C demos/theme-rmx-01 install
pnpm -C demos/theme-rmx-01 dev
```

Then open `http://localhost:44100`.

## Screenshot Workflow

The demo includes a Playwright-based review workflow so you can capture the current UI without manually taking screenshots.

```sh
pnpm -C demos/theme-rmx-01 screenshot
```

That script will:

- start the demo server if it is not already running
- capture a screenshot of the page
- save a timestamped image under `demos/theme-rmx-01/.artifacts/screenshots/`
- update `demos/theme-rmx-01/.artifacts/screenshots/latest.png`

For a focused surface-card capture:

```sh
pnpm -C demos/theme-rmx-01 screenshot:card
```

## Key APIs

- `@remix-run/theme` for `RMX_01`, `theme`, and `ui`
- `remix/component/server` for server rendering
- `remix/fetch-router` for request handling

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
