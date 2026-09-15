# Assets and Browser Modules

Read for browser-source access, module URLs, import maps, deployment caching, or development HMR.

Installed API docs: `src/assets/README.md`, `src/static-middleware/README.md`, and `src/cli/README.md`. HMR also uses `src/node-hmr/README.md` and `src/ui-hmr/README.md`; compatibility for late import maps uses `src/multiple-import-maps-polyfill/README.md`. Read those for option signatures rather than duplicating the app's configuration.

## Start with Existing Setup

Inspect `app/assets.ts`, the asset route in `app/routes.ts` and its controller, the document shell, and `app/actions/public/entry.ts`. A scaffolded app already has these connections:

```text
browser-source file → asset server → public module URL/import map/preloads
                               ↘ render middleware → client-entry metadata
asset route → assets.fetch(request)
document shell → browser runtime entry → run()
```

Keep root `public/` for static files served unchanged by `staticFiles(...)`. Source modules that need compilation and dependency resolution belong in owner-local `app/**/public/` directories and are served by `remix/assets`.

The scaffold's `app/assets.ts` is the single place to extend. The access rules are the part that changes most often:

```ts
// app/assets.ts (excerpt)
export const assets = createAssetServer({
  basePath: '/assets',
  rootDir: process.cwd(),
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  denyFiles: ['app/**/*.test.*'],
  // ...compiler, watch, and HMR options
})

export const scriptEntry = await assets.getScriptEntry('app/actions/public/entry.ts')
```

A new `app/<area>/public/` directory is already allowed by the glob. A new browser-side npm dependency needs its exact name in `allowPackages`.

## Keep Browser Access Narrow

- Treat `allowFiles`, `allowPackages`, and `denyFiles` as access control. Do not broaden them to fix an import error without inspecting what becomes reachable.
- Keep every local dependency of browser source within allowed locations. Allow `app/routes.ts` separately for shared URL generation, and keep that module free of server-only imports.
- Deny colocated test modules with `denyFiles`, including browser tests. Never place secrets, persistence setup, or server request helpers inside public source directories.
- Use file paths/globs in `allowFiles`/`denyFiles` and exact package names in `allowPackages`. Allowed packages also expose their installed dependencies/optional dependencies; inspect that reachability before adding a package. Peer dependencies need explicit allowance.
- `denyFiles` takes precedence. A denied dependency should prompt an ownership check, not a blanket allow rule.
- Set `rootDir` deliberately in a monorepo. `basePath` owns the public asset URL namespace; default mounts map `app` and `node_modules` beneath it. Customize mounts only when those roots are insufficient.

Use `remix assets inspect <url-or-file>` for a denied, missing, or mis-mapped asset and `remix assets` to inspect the reachable surface. Make sure the CLI's asset configuration matches the server's configuration; the CLI README explains sharing `remix.json` through `loadConfig()`.

## Connect Rendering Rather Than Hard-Coding URLs

For an explicit browser script, use `assets.getScriptEntry(...)` to obtain its `href`, `importMap`, and `preloads`. Render `ImportMap` from `remix/ui/server` before modulepreload links and module scripts. Use `getHref()` for non-script assets and `getPreloads()` only for lower-level preload control.

Pass the app's asset server to `render({ assets })`. It resolves `clientEntry(import.meta.url, Component)` IDs with `getScriptEntry()`, includes their import maps and preloads, and applies the UI renderer's export rules.

If a new client entry fails to hydrate, check in order:

1. Its source file and dependencies are allowed and resolve to browser-loadable URLs.
2. Its module exports the expected component name; specify `#ExportName` when necessary.
3. Render middleware has the correct asset server and emits entry markers, import maps, and preloads.
4. The document renders the initial import map before preloads and scripts, then loads the existing runtime entry that calls `run()`.
5. Props are serializable and contain no server objects or secrets.

Do not introduce a custom `resolveClientEntry` merely to bypass missing standard render setup. See [hydration and navigation](hydration-frames-navigation.md) for the runtime side.

## Development HMR

HMR has three cooperating layers. Inspect the existing files before changing any of them:

| Layer               | Owner                         | Responsibility                                                              |
| ------------------- | ----------------------------- | --------------------------------------------------------------------------- |
| Node supervision    | `hmr.ts`, `server.ts`         | Restart/update server modules, report readiness, keep a stable public proxy |
| Browser compilation | `app/assets.ts`               | Use the runner's browser HMR channel and development UI transforms          |
| Browser runtime     | `app/actions/public/entry.ts` | Refresh server-rendered HTML after a server update                          |

For a new or repaired HMR integration:

1. Keep ordinary development and production startup independent of the optional `hmr` script. Do not recreate `hmr.ts` when the scaffold already supplies it.
2. Follow the Node HMR README for `run(...)`, `createHmrReadyFetch(...)`, and readiness reporting after the child server starts listening. Keep the browser event-channel port stable across restarts.
3. Use `--import remix/ui-hmr/node` for server component HMR and `uiHmr()` from `remix/ui-hmr/assets` as a development-only asset loader when that behavior is wanted.
4. Guard child runtime imports with `process.env.REMIX_NODE_HMR`; obtain the asset server's browser channel from `remix/node-hmr/runtime` only inside the supervised child.
5. When supporting browsers without multiple import maps, set `hmr.moduleImporter` to `remix/multiple-import-maps-polyfill` and keep that package imported by the initial browser entry.
6. In the browser entry, handle `server:update` by awaiting `app.ready()` and then `app.frames.top.reload()`, with error handling. Do not call `run()` again for each update.
7. Close the public proxy, HMR runner, and asset watchers on shutdown. Test a real source edit and reconnection when changing this lifecycle.

For direct browser `import.meta.hot` usage, retain `remix/assets/types/hmr` in the app's TypeScript types and use literal dependency specifiers in accept calls. The package README owns the detailed HMR API.

## Deployment

- Disable watching and HMR in production. Use `fingerprint: true` for content-based fingerprints and long-lived immutable caching only with stable on-disk files and `watch: false`.
- Render the initial import map before modulepreload links and module scripts. Keep bare-import resolution uniform within a directory; use import-map scopes when directories need different resolutions.
- Make browser targets, source-map exposure, and minification explicit. Shared compiler options such as `target`, `minify`, and `sourceMaps` are top-level options, not nested under `scripts`.
- Confirm that immutable caching applies only to versioned assets, not private or session-dependent responses.
- Close long-lived asset servers in tests and during app shutdown.
