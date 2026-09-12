Added a `type: "module"` database adapter to `remix.json`, so `remix db` can drive databases the CLI does not ship an adapter for, such as Turso/libSQL or Cloudflare D1. Previously `db.adapter.type` accepted only `sqlite`, `postgres`, and `mysql`, and third-party databases had to reimplement the command instead.

```jsonc
{
  "db": {
    "adapter": {
      "type": "module",
      "module": "./app/database.ts",
      "export": "createDatabase",
      "connection": { "env": "DATABASE_URL" },
      "options": { "syncInterval": 60 },
    },
  },
}
```

The module exports a factory that receives `{ configDir, connection, options }` and returns a `Database`; the CLI closes it when the command finishes. `export` defaults to the default export, `connection` resolves like other adapters' connection values and is overridden by `--connection-env`, and `options` is passed through unchanged. Relative `module` specifiers resolve from `remix.json` and bare specifiers resolve from the app, so a database package installed by the app is reachable. Type the factory with the new `RemixDbModuleFactory` and `RemixDbModuleContext` exports.

Two new errors report module problems: `RMX_DB_MODULE_NOT_FOUND` when the module cannot be imported, and `RMX_DB_MODULE_FACTORY_REQUIRED` when the named export is not a function.
