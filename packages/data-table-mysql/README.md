# `@remix-run/data-table-mysql`

MySQL adapter for `@remix-run/data-table`.

## Usage

```ts
import { createDatabase } from '@remix-run/data-table'
import { createMysqlDatabaseAdapter } from '@remix-run/data-table-mysql'

let adapter = createMysqlDatabaseAdapter(client)
let db = createDatabase(adapter)
```
