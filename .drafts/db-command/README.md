# DB Command

Manage app databases from the Remix CLI using the database resources already defined by the app.

```sh
remix db create
remix db drop
```

The commands load the database resource from `app/data/database.ts`, so CLI behavior stays aligned with the same configuration runtime code uses.

```ts
// app/data/database.ts
import { createSqliteDatabase } from 'remix/data-table/sqlite'

export let database = createSqliteDatabase({
  path: 'db/app.sqlite',
})

// remix db create -> database.create()
// remix db drop   -> database.drop()
```
