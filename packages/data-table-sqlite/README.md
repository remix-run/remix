# `@remix-run/data-table-sqlite`

SQLite adapter for `@remix-run/data-table`.

## Usage

```ts
import { createDatabase } from '@remix-run/data-table'
import { createSqliteDatabaseAdapter } from '@remix-run/data-table-sqlite'

let adapter = createSqliteDatabaseAdapter(client)
let db = createDatabase(adapter)
```
