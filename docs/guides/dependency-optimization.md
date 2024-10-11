---
title: Dependency optimization
---

<docs-info>This feature only affects development. It does not impact production builds.</docs-info>

# Dependency optimization

Remix introduced automatic dependency optimization in development behind the `future.v3_optimizeDeps` [Future Flag][future-flags].
This allows you to opt-into this behavior which will become the default in the next major version of Remix - a.k.a. React Router v7 ([1][rr-v7], [2][rr-v7-2]).

In development, Vite aims to [prebundle dependencies][prebundle-dependencies] so that it can efficiently serve up those dependencies on-demand.
To do this, Vite needs to know where to start crawling your app's module graph to look for dependencies.

Previously, Remix did not inform Vite to start dependency detection at route modules nor at the client entry.
That meant that in development, Vite would encounter new dependencies as you navigated around in your app resulting in `504 Outdated Dependency` errors.
Consequently, the development experience could feel janky at times since those errors could cause HMR to break or link navigations to be aborted.
Navigation could also feel sluggish as processing dependencies interactively could sometimes be slow.

For more information, see [Vite's Dep Optimization Options][vite-s-dep-optimization-options].

## Troubleshooting

### `Failed to resolve entry for package`

```txt
✘ [ERROR] Failed to resolve entry for package "<package>". The package may have incorrect main/module/exports specified in its package.json. [plugin vite:dep-pre-bundle]
```

This is usually caused by a misconfigured dependency.
You use [publint][publint] to check if the offending package is misconfigured.
To fix the issue, you'll need to use `npm why` or `pnpm why` to determine which of your direct dependencies to add to `optimizeDeps.exclude`.

For example, let's say your app is running into this error:

```txt
✘ [ERROR] Failed to resolve entry for package "jimp". The package may have incorrect main/module/exports specified in its package.json. [plugin vite:dep-pre-bundle]
```

Sure enough, `publint` reports that the [`jimp` package is misconfigured][jimp-package-is-misconfigured].
Then, you determine that `jimp` is an indirect dependency being pulled in by your `svg2img` direct dependency:

```sh
❯ npm why jimp
jimp@0.16.13
node_modules/jimp
  jimp@"^0.16.1" from svg2img@1.0.0-beta.2
  node_modules/svg2img
    svg2img@"^1.0.0-beta.2" from the root project
```

Finally, you add `svg2img` to `optimizeDeps.exclude`, which should fix the issue:

```ts filename=vite.config.ts
export default defineConfig({
  optimizeDeps: {
    exclude: ["svg2img"],
  },
});
```

[future-flags]: ../guides/api-development-strategy
[rr-v7]: https://remix.run/blog/merging-remix-and-react-router
[rr-v7-2]: https://remix.run/blog/incremental-path-to-react-19
[prebundle-dependencies]: https://vitejs.dev/guide/dep-pre-bundling.html
[vite-s-dep-optimization-options]: https://vitejs.dev/config/dep-optimization-options#dep-optimization-options
[publint]: https://publint.dev
[jimp-package-is-misconfigured]: https://publint.dev/jimp@0.22.12
