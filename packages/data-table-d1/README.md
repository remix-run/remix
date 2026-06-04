# data-table-d1

Cloudflare D1 adapter for [`remix/data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table). Use this package when you want `data-table` APIs backed by a D1 database binding.

## Features

- **Native D1 Binding Integration**: Works with Cloudflare Workers `D1Database` bindings
- **SQLite-Compatible SQL**: Uses D1's SQLite-compatible query surface
- **Adapter-Owned Compiler**: SQL compilation lives in this adapter so D1 behavior can evolve independently from the SQLite adapter
- **D1 Capabilities Enabled By Default**:
  - `returning: true`
  - `savepoints: false`
  - `upsert: true`
  - `transactionalDdl: false`
  - `migrationLock: false`

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createDatabase } from 'remix/data-table'
import { createD1DatabaseAdapter } from 'remix/data-table/d1'

export default {
  async fetch(request, env) {
    let db = createDatabase(createD1DatabaseAdapter(env.DB))
    // Use db.query(...), db.create(...), and other data-table APIs here.
    return new Response('OK')
  },
}
```

Import any driver-specific types you need from Cloudflare's generated Worker types.

## Adapter Capabilities

`data-table-d1` reports this capability set by default:

- `returning: true`
- `savepoints: false`
- `upsert: true`
- `transactionalDdl: false`
- `migrationLock: false`

## D1 Transactions

Cloudflare D1 supports atomic batches through `env.DB.batch()`. This adapter does not implement `db.transaction()` because `data-table` transactions are interactive callback transactions, while D1 rejects SQL `BEGIN TRANSACTION` and `SAVEPOINT` statements through Worker bindings.

## Related Packages

- [`data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table) - Core query/relations API
- [`data-schema`](https://github.com/remix-run/remix/tree/main/packages/data-schema) - Schema parsing and validation
- [`data-table-postgres`](https://github.com/remix-run/remix/tree/main/packages/data-table-postgres) - PostgreSQL adapter
- [`data-table-mysql`](https://github.com/remix-run/remix/tree/main/packages/data-table-mysql) - MySQL adapter
- [`data-table-sqlite`](https://github.com/remix-run/remix/tree/main/packages/data-table-sqlite) - SQLite adapter

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
