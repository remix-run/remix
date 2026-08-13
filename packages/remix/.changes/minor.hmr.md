Beta.6 adds an integrated full-stack hot module replacement workflow. Run `npm run hmr` in a newly generated project to reload server modules and update compatible UI components in place while preserving their state.

New projects include the script and a complete `hmr.ts` runner. The core setup looks like this:

```json
{
  "scripts": {
    "hmr": "NODE_ENV=development node hmr.ts"
  }
}
```

```ts
// hmr.ts (excerpt)
import { run } from 'remix/node-hmr'

const hmrRunner = run('server.ts', {
  nodeArgs: ['--import', 'remix/node-tsx', '--import', 'remix/ui-hmr/node'],
  browserHmrChannel: { port: 44101 },
})
```

`remix/node-hmr`, `remix/ui-hmr`, and `remix/assets` coordinate server and browser updates through the standard `import.meta.hot` API. Browser-reachable source is scaffolded in colocated `public/` directories so the server/browser boundary remains explicit.
