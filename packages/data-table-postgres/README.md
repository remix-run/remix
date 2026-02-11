# `@remix-run/data-table-postgres`

PostgreSQL adapter for `@remix-run/data-table`.

## Usage

```ts
import { createDatabase } from '@remix-run/data-table'
import { createPostgresDatabaseAdapter } from '@remix-run/data-table-postgres'

let adapter = createPostgresDatabaseAdapter(client)
let db = createDatabase(adapter)
```
