Added a new `remix db` workflow for inspecting migration status, migrating, seeding, wiping, and resetting the current app database. Configure a built-in SQLite, PostgreSQL, or MySQL database in `remix.json`; for example:

```jsonc
{
  "$schema": "https://remix.run/schemas/remix.json",
  "db": {
    "adapter": {
      "type": "sqlite",
      "filename": "./db/app.sqlite",
    },
    "migrations": {
      "directory": "./db/migrations",
    },
    "seed": "./db/seed.sql",
  },
}
```

The same configuration then powers the complete local database lifecycle:

```sh
remix db status
remix db migrate
remix db seed
remix db reset --force
```

Command flags override configured values, database commands work from project subdirectories by finding the nearest `remix.json`, and destructive `wipe` and `reset` commands require `--force` (see #11608, #11639).
