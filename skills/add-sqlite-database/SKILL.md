---
name: add-sqlite-database
description: Add SQLite persistence to a Remix app that follows the remix-application-layout skill. Put database artifacts in db/, database setup in app/data/, and request-lifecycle injection in app/middleware/.
---

# Add SQLite to a Remix Application

Use this skill after bootstrapping an app with `remix-application-layout`.

## Additional Layout

Add these paths to the base app structure:

```text
<app-name>/
├── app/
│   ├── controllers/
│   │   └── home.tsx
│   ├── data/
│   │   └── setup.ts
│   └── middleware/
│       └── database.ts
└── db/
    └── db.sqlite
```

Rules:

- Keep database artifacts such as SQLite files and migrations under root `db/`.
- Keep adapter creation and database setup in `app/data/`.
- Keep request-lifecycle injection in `app/middleware/`.
- Route handlers should read `Database` from request context instead of importing `db` directly.

## Workflow

1. Install the SQLite runtime dependency.

```sh
npm i better-sqlite3
```

2. Create `app/data/setup.ts`.

This module owns database setup and exports `db` typed as `Database` from `remix/data-table`.

```ts
import * as path from 'node:path'
import BetterSqlite3 from 'better-sqlite3'
import { createDatabase, type Database } from 'remix/data-table'
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'

let databaseFilePath = path.resolve(import.meta.dirname, '..', '..', 'db', 'db.sqlite')
let sqlite = new BetterSqlite3(databaseFilePath)

sqlite.pragma('foreign_keys = ON')
sqlite.pragma('journal_mode = WAL')

export let db: Database = createDatabase(createSqliteDatabaseAdapter(sqlite))
```

3. Create `app/middleware/database.ts`.

This middleware injects the database into request context for the rest of the app.

```ts
import type { Middleware } from 'remix/fetch-router'
import { Database } from 'remix/data-table'

import { db } from '../data/setup.ts'

type SetDatabaseContextTransform = readonly [readonly [typeof Database, Database]]

export function loadDatabase(): Middleware<'ANY', {}, SetDatabaseContextTransform> {
  return async (context, next) => {
    context.set(Database, db)
    return next()
  }
}
```

4. Register the middleware in `app/router.ts`.

```ts
import { createRouter } from 'remix/fetch-router'

import { loadDatabase } from './middleware/database.ts'

let middleware = [loadDatabase()] as const

export let router = createRouter({ middleware })
```

5. Read the database from request context in a route handler.

Use a route-owned controller or flat leaf action under `app/controllers/`.

```tsx
import type { BuildAction } from 'remix/fetch-router'
import { Database, sql } from 'remix/data-table'

import { routes } from '../routes.ts'
import { Layout } from '../ui/layout.tsx'
import { render } from '../utils/render.tsx'

export let home: BuildAction<'GET', typeof routes.home> = {
  async handler({ get }) {
    let db = get(Database)
    await db.exec(sql`select 1`)

    return render(<HomePage />)
  },
}

function HomePage() {
  return () => (
    <Layout title="Home">
      <h1>My Remix App</h1>
      <p>Database is connected.</p>
    </Layout>
  )
}
```

6. Keep SQLite files out of source control.

Add a rule to `.gitignore`:

```gitignore
db/*.sqlite
```

## Checklist

- [ ] `db/` exists at the project root
- [ ] `app/data/setup.ts` owns SQLite adapter and database setup
- [ ] `app/middleware/database.ts` injects `Database` into request context
- [ ] `app/router.ts` creates the router with `loadDatabase()` middleware
- [ ] Route handlers under `app/controllers/` read `Database` from request context
- [ ] `.gitignore` excludes `db/*.sqlite`
