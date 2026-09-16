# assets demo

This demo compiles and serves TypeScript, CSS, images, request transforms, and a Web Worker with `remix/assets`. Document scripts use import maps, while a second asset server rewrites worker imports to their resolved asset URLs.

## Run

```sh
pnpm -C demos/assets dev
```

Then open [http://localhost:44100](http://localhost:44100).

Run `pnpm -C demos/assets typecheck` to validate the demo.
