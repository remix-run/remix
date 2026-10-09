# UI Demos

A shared gallery for demos owned by `@remix-run/component` and `@remix-run/ui`.

## Run It

```sh
pnpm -C demos/ui dev
```

Then open `http://localhost:44100`.

## How Demos Are Found

The index scans `demos/ui/cases`, `packages/component/src`, and `packages/ui/src/demos`
for `*.demo.ts` and `*.demo.tsx` files on every request. Component and UI demos are
shown in separate sections while sharing the same runner and design shell.
Each demo is available at `/demo/*filename`, where `*filename` is the demo file path
relative to its demo root.
