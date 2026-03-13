---
name: add-sqlite-database
description: Add a SQLite database to a Remix app.
---

# Add a Database to a New Remix App

Use this skill when you need to add SQLite persistence to a Remix app.

## Additional File Structure

Add these paths to the base app structure:

```text
<app-name>/
├── data/
│   └── db.sqlite
├── lib/
│   ├── render.ts
│   └── db.ts
└── app/
    └── root/
        ├── controller.tsx
        └── HomePage.tsx
```

Notes:

- `data/` is at the project root and is a sibling of `app/`.
- `lib/` is also at the project root and is a sibling of `app/`.
- `data/db.sqlite` is created by SQLite when `lib/db.ts` opens the database file.

## Workflow

1. Install SQLite runtime dependency.

```sh
npm i better-sqlite3
```

2. Create the root `data` directory.

```sh
mkdir -p data
```

3. Create `lib/db.ts` with database setup logic.

This module must export `db` as a `Database` object from `remix/data-table`.

```ts
import * as path from 'node:path'
import BetterSqlite3 from 'better-sqlite3'
import { createDatabase, type Database } from 'remix/data-table'
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'

let databaseFilePath = path.resolve(import.meta.dirname, '..', 'data', 'db.sqlite')
let sqlite = new BetterSqlite3(databaseFilePath)

sqlite.pragma('foreign_keys = ON')
sqlite.pragma('journal_mode = WAL')

let adapter = createSqliteDatabaseAdapter(sqlite)

export let db: Database = createDatabase(adapter)
```

4. Use `db` in the root controller (same controller style as the scaffolding skill).

```tsx
import type { Controller } from 'remix/fetch-router'
import { sql } from 'remix/data-table'

import { routes } from '../../routes.ts'
import { DatabaseContext } from '../../lib/db.ts'
import { render } from '../../lib/render.ts'
import { HomePage } from './HomePage.tsx'

export default {
  middleware: [],
  actions: {
    async home({ storage }) {
      let db = storage.get(DatabaseContext)
      await db.exec(sql`select 1`)

      return render(
        <HomePage title="My Remix App">
          <h1>My Remix App</h1>
          <p>Database is connected.</p>
        </HomePage>,
      )
    },
  },
} satisfies Controller<typeof routes.root>
```

5. Keep SQLite files out of source control.

Add a rule to `.gitignore`:

```gitignore
data/*.sqlite
```

## Checklist

- [ ] `data/` exists at the project root (sibling of `app/`)
- [ ] `lib/db.ts` exists at the project root (sibling of `app/`)
- [ ] `lib/db.ts` exports `db` typed as `Database` from `remix/data-table`
- [ ] `lib/db.ts` creates `db` using `createSqliteDatabaseAdapter(...)` and `createDatabase(...)`
- [ ] `app/root/controller.tsx` imports and uses `db` in the root `Controller` object
