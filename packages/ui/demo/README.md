# Interface Demos

A small Remix app for browsing and running demos for `@remix-run/ui` primitives and styled components.

## Run It

```sh
pnpm -C packages/ui/demo dev
```

Then open `http://localhost:44100`.

## How Demos Are Found

The index scans `packages/ui/demo/cases` and `packages/ui/src` for `*.demo.ts` and `*.demo.tsx` files on every request.
Each demo is available at `/demo/*filename`, where `*filename` is the demo file path
relative to its demo root.
