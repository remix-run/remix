# `@remix-run/cloudflare-pages`

## 2.15.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.15.1`

## 2.15.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.15.0`

## 2.14.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.14.0`

## 2.13.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.13.1`

## 2.13.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.13.0`

## 2.12.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.12.1`

## 2.12.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.12.0`

## 2.11.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.11.2`

## 2.11.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.11.1`

## 2.11.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.11.0`

## 2.10.3

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.10.3`

## 2.10.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.10.2`

## 2.10.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.10.1`

## 2.10.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.10.0`

## 2.9.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.9.2`

## 2.9.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.9.1`

## 2.9.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.9.0`

## 2.8.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.8.1`

## 2.8.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.8.0`

## 2.7.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.7.2`

## 2.7.1

### Patch Changes

- Fix breaking change for `@remix-run/cloudflare-pages` ([#8819](https://github.com/remix-run/remix/pull/8819))

  Restore Cloudflare event context fields in `getLoadContext` argument for backwards compatibility.

- Updated dependencies:
  - `@remix-run/cloudflare@2.7.1`

## 2.7.0

### Minor Changes

- Make `getLoadContext` optional for Cloudflare Pages ([#8701](https://github.com/remix-run/remix/pull/8701))

  Defaults to `(context) => ({ env: context })`, which is what we used to have in all the templates.
  This gives parity with the Cloudflare preset for the Remix Vite plugin and keeps our templates leaner.

- Vite: Cloudflare Proxy as a Vite plugin ([#8749](https://github.com/remix-run/remix/pull/8749))

  **This is a breaking change for projects relying on Cloudflare support from the unstable Vite plugin**

  The Cloudflare preset (`unstable_cloudflarePreset`) as been removed and replaced with a new Vite plugin:

  ```diff
   import {
      unstable_vitePlugin as remix,
  -   unstable_cloudflarePreset as cloudflare,
  +   cloudflareDevProxyVitePlugin as remixCloudflareDevProxy,
    } from "@remix-run/dev";
    import { defineConfig } from "vite";

    export default defineConfig({
      plugins: [
  +     remixCloudflareDevProxy(),
  +     remix(),
  -     remix({
  -       presets: [cloudflare()],
  -     }),
      ],
  -   ssr: {
  -     resolve: {
  -       externalConditions: ["workerd", "worker"],
  -     },
  -   },
    });
  ```

  `remixCloudflareDevProxy` must come _before_ the `remix` plugin so that it can override Vite's dev server middleware to be compatible with Cloudflare's proxied environment.

  Because it is a Vite plugin, `remixCloudflareDevProxy` can set `ssr.resolve.externalConditions` to be `workerd`-compatible for you.

  `remixCloudflareDevProxy` accepts a `getLoadContext` function that replaces the old `getRemixDevLoadContext`.
  If you were using a `nightly` version that required `getBindingsProxy` or `getPlatformProxy`, that is no longer required.
  Any options you were passing to `getBindingsProxy` or `getPlatformProxy` should now be passed to `remixCloudflareDevProxy` instead.

  This API also better aligns with future plans to support Cloudflare with a framework-agnostic Vite plugin that makes use of Vite's (experimental) Runtime API.

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.7.0`

## 2.6.0

### Patch Changes

- Vite: Cloudflare Pages support ([#8531](https://github.com/remix-run/remix/pull/8531))

  To get started with Cloudflare, you can use the \[`unstable-vite-cloudflare`]\[template-vite-cloudflare] template:

  ```shellscript nonumber
  npx create-remix@latest --template remix-run/remix/templates/unstable-vite-cloudflare
  ```

  Or read the new docs at [Future > Vite > Cloudflare](https://remix.run/docs/en/main/future/vite#cloudflare) and
  [Future > Vite > Migrating > Migrating Cloudflare Functions](https://remix.run/docs/en/main/future/vite#migrating-cloudflare-functions).

- Updated dependencies:
  - `@remix-run/cloudflare@2.6.0`

## 2.5.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.5.1`

## 2.5.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.5.0`

## 2.4.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.4.1`

## 2.4.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.4.0`

## 2.3.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.3.1`

## 2.3.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.3.0`

## 2.2.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.2.0`

## 2.1.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.1.0`

## 2.0.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.0.1`

## 2.0.0

### Major Changes

- Require Node >=18.0.0 ([#6939](https://github.com/remix-run/remix/pull/6939))
- Drop `@cloudflare/workers-types` v2 & v3 support ([#6925](https://github.com/remix-run/remix/pull/6925))

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@2.0.0`

## 1.19.3

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.19.3`

## 1.19.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.19.2`

## 1.19.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.19.1`

## 1.19.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.19.0`

## 1.18.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.18.1`

## 1.18.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.18.0`

## 1.17.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.17.1`

## 1.17.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.17.0`

## 1.16.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.16.1`

## 1.16.0

### Patch Changes

- feat: support async `getLoadContext` in all adapters ([#6170](https://github.com/remix-run/remix/pull/6170))
- Updated dependencies:
  - `@remix-run/cloudflare@1.16.0`

## 1.15.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.15.0`

## 1.14.3

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.14.3`

## 1.14.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.14.2`

## 1.14.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.14.1`

## 1.14.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.14.0`

## 1.13.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.13.0`

## 1.12.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.12.0`

## 1.11.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.11.1`

## 1.11.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.11.0`

## 1.10.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.10.1`

## 1.10.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.10.0`

## 1.9.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.9.0`

## 1.8.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.8.2`

## 1.8.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.8.1`

## 1.8.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.8.0`

## 1.7.6

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.7.6`

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.7.6-pre.0`

## 1.7.5

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.7.5`

## 1.7.4

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.7.4`

## 1.7.3

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.7.3`

## 1.7.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.7.2`

## 1.7.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.7.1`

## 1.7.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.7.0`

## 1.6.8

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.6.8`

## 1.6.7

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.6.7`

## 1.6.6

### Patch Changes

- Updated dependencies:
  - `@remix-run/cloudflare@1.6.6`

## 1.6.5

### Patch Changes

- Updated dependencies
  - `@remix-run/cloudflare@1.6.5`
