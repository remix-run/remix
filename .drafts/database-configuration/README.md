# Database Configuration

Remix apps define one configured database resource for runtime code, CLI commands, and tests.

```ts
// app/data/database.ts
import { createSqliteDatabase } from 'remix/data-table/sqlite'

export let database = createSqliteDatabase({
  path: 'db/app.sqlite',
})
```

The database resource owns the underlying database configuration. It knows how to connect to and close without making Remix core dynamically choose an adapter.

```ts
type DatabaseResource = AsyncDisposable & {
  connect(): Promise<Database>
  close(): Promise<void>
}
```

`connect()` returns a database client: the typed query API app code uses to read and write data.

```ts
export const db = await database.connect()
```

## File conventions

```text
my-app/
├── app/
│   └── data/
│       ├── database.ts
│       └── schema.ts
└── db/
    ├── migrations/
    └── seed.ts
```

`app/data/database.ts` exports the configured database resource. `app/data/schema.ts` exports the app-facing table definitions. Root `db/` contains operational files like migrations and seeds.

## SQLite

SQLite uses a file-backed database resource by default. It owns the file path and opens a new SQLite client for each `connect()` call. Multiple file-backed clients connect to the same database file, so they have independent transaction state while still sharing committed database state.

SQLite `:memory:` databases are different: each SQLite client gets its own private database. To avoid pretending that multiple clients share state, a `:memory:` SQLite resource should throw if `connect()` is called more than once. Tests or apps that want in-memory SQLite should use a single database client for that resource. Tests that need persistent state across multiple clients should use a temporary file-backed SQLite database.

```ts
import { createSqliteDatabase } from 'remix/data-table/sqlite'

export let database = createSqliteDatabase({
  path: 'db/app.sqlite',
})
```

SQLite defaults to foreign keys, WAL mode, and normal sync. Apps can override first-class pragmas when needed.

```ts
export let database = createSqliteDatabase({
  path: 'db/app.sqlite',
  pragmas: {
    foreignKeys: true,
    journalMode: 'wal',
    synchronous: 'normal',
    busyTimeoutMs: 5_000,
  },
})
```

```ts
type SqliteDatabaseOptions = {
  path: string
  pragmas?: {
    foreignKeys?: boolean
    journalMode?: 'delete' | 'truncate' | 'persist' | 'memory' | 'wal' | 'off'
    synchronous?: 'off' | 'normal' | 'full' | 'extra'
    busyTimeoutMs?: number
  }
}
```

## Postgres

Postgres accepts a URL or split connection fields, but not both. It exposes SSL, pool sizing, and common timeout options.

```ts
import { createPostgresDatabase } from 'remix/data-table/postgres'

export let database = createPostgresDatabase({
  url: process.env.DATABASE_URL!,
  ssl: true,
  pool: {
    max: 10,
    idleTimeoutMs: 30_000,
    connectTimeoutMs: 5_000,
  },
  statementTimeoutMs: 10_000,
})
```

```ts
type SslOptions =
  | boolean
  | {
      ca?: string
      cert?: string
      key?: string
      rejectUnauthorized?: boolean
    }

type PoolOptions = {
  max?: number
  idleTimeoutMs?: number
  connectTimeoutMs?: number
}

type UrlConnectionOptions = {
  url: string
  host?: never
  port?: never
  database?: never
  user?: never
  password?: never
}

type SplitConnectionOptions = {
  url?: never
  host: string
  port?: number
  database: string
  user: string
  password?: string
}

type PostgresDatabaseOptions = (UrlConnectionOptions | SplitConnectionOptions) & {
  ssl?: SslOptions
  pool?: PoolOptions
  statementTimeoutMs?: number
}
```

## MySQL

MySQL accepts a URL or split connection fields, but not both. It exposes SSL, pool sizing, timezone, date/decimal coercion, and multi-statement support for migration scripts.

```ts
import { createMysqlDatabase } from 'remix/data-table/mysql'

export let database = createMysqlDatabase({
  url: process.env.DATABASE_URL!,
  pool: {
    max: 10,
    idleTimeoutMs: 30_000,
    connectTimeoutMs: 5_000,
  },
  timezone: 'Z',
  decimalNumbers: true,
  multipleStatements: true,
})
```

```ts
type MysqlDatabaseOptions = (UrlConnectionOptions | SplitConnectionOptions) & {
  ssl?: SslOptions
  pool?: PoolOptions
  timezone?: string
  decimalNumbers?: boolean
  multipleStatements?: boolean
}
```
