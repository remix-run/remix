# UI Demo

A small Remix app for browsing and running `@remix-run/ui` demos.

## Run It

```sh
pnpm -C packages/ui/demo dev
```

Then open `http://localhost:44100`.

## How Demos Are Found

The index scans `packages/ui` for `*.demo.ts` and `*.demo.tsx` files on every request.
Each demo is available at `/demo/*filename`, where `*filename` is the demo file path
relative to `packages/ui`.

Use JSDoc metadata in the demo file comment to customize behavior. For demos that
should only run in the browser, add `@ssr false` to disable server rendering for
that demo route while still hydrating from the browser asset bundle.
