# Use `.sql` files for migrations

Previously, Remix used TypeScript files for migrations like:

```ts
import { column as c, table } from 'remix/data-table'
import { createMigration } from 'remix/data-table/migrations'

let users = table(/* ... */)

export default createMigration({
  async up({ db, schema }) {
    await schema.createTable(users)
  },
  async down({ schema }) {
    await schema.dropTable(users, { ifExists: true })
  },
})
```

However, it was easy for both humans and agents to accidentally pull in table definitions from `app/schema.ts`:

```ts
import { users } from '../app/schema.ts'
// Whoops! 👆

export default createMigration({
  async up({ db, schema }) {
    await schema.createTable(users)
  },
  async down({ schema }) {
    await schema.dropTable(users, { ifExists: true })
  },
})
```

At first things work fine.
You then locally iterate, changing `schema.ts` and creating a few migrations.
But you've just created a ticking time bomb for your prod database.

Each migration is treated as an immutable artifact, but by changing `schema.ts` each migration itself is changing over time.
In the worst case, this could lead to accidental data loss in prod, which is unacceptable.

Even if we could guarantee that `app/schema.ts` was never pulled in (via lint rules or other forms of static analysis), that doesn't prevent _other_ dependencies and imports that your migration pulls in from changing.

To guarantee that migrations are stable, we need a file format that precludes imports and depends _solely_ on the data in the database: `.sql` files.

```txt
├── app/
│   └── schema.ts
└── db/
    └── migrations/
        ├── 20260228090000_create_bookstore_schema/
        │   ├── up.sql
        │   └── down.sql
        └── 20260301083000_add_books_search_index/
            └── up.sql
```

We plan to support generation of migration `.sql` files based on changes to your `schema.ts` so that you don't have to manually author `.sql` files.
Until then, `.sql` files for migrations can be written by hand or via agents.