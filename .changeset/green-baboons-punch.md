---
"@remix-run/dev": patch
---

Vite: rely on Vite plugin ordering

**This is a breaking change for projects using the unstable Vite plugin.**

The Remix plugin expects to process JavaScript or TypeScript files, so any transpilation from other languages must be done first.
For example, that means putting the MDX plugin _before_ the Remix plugin:

```diff
  import mdx from "@mdx-js/rollup";
  import { unstable_vitePlugin as remix } from "@remix-run/dev";
  import { defineConfig } from "vite";

  export default defineConfig({
    plugins: [
+     mdx(),
      remix()
-     mdx(),
    ],
  });
```

Previously, the Remix plugin misused `enforce: "post"` from Vite's plugin API to ensure that it ran last.
However, this caused other unforeseen issues.
Instead, we now rely on standard Vite semantics for plugin ordering.

The official [Vite React SWC plugin](https://github.com/vitejs/vite-plugin-react-swc/blob/main/src/index.ts#L97-L116) also relies on plugin ordering for MDX.
