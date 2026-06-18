# Database Migrations

Remix apps can define ordered SQL migrations in code or load them from the file system, then apply them through a connected database.

```ts
// db/migrations.ts
import { createMigrator } from 'remix/data-table/migrations'

export let migrator = createMigrator([
  {
    id: '001_create_users',
    sql: 'create table users (id text primary key, email text not null)',
  },
  {
    id: '002_add_user_name',
    sql: 'alter table users add column name text',
  },
])
```

Apps that prefer SQL files can use the Node loader.

```text
db/migrations/
├── 20260101000000_create_users.sql
└── 20260102000000_add_user_name.sql
```

```ts
// db/migrations.ts
import { createMigrator } from 'remix/data-table/migrations'
import { loadMigrations } from 'remix/data-table/migrations/node'

export let migrator = createMigrator(await loadMigrations('db/migrations'))
```

Apply everything that has not run yet:

```ts
import { database } from '../app/data/database.ts'
import { migrator } from './migrations.ts'

let db = await database.connect()
await migrator.migrate(db)
```

Apply migrations up to a specific migration id:

```ts
await migrator.migrate(db, { to: '001_create_users' })
```

Check migration status before or after applying migrations.

```ts
let status = await migrator.status(db)

// [
//   { id: '001_create_users', status: 'applied' },
//   { id: '002_add_user_name', status: 'pending' },
// ]
```

The CLI can load the app's database resource and migrator, then call the same methods.

```sh
remix db migrate
remix db migrate --to 001_create_users
remix db migrate status
```
