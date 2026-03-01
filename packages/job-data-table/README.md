# job-data-table

Data Table-backed storage adapter for `remix/job`.

## Features

- **Durable SQL queue** - Store jobs in PostgreSQL, MySQL, or SQLite
- **Lease-based processing** - Supports worker failover and retries
- **Cron persistence** - Stores recurring schedule state
- **Built-in migration** - Provisions job tables/indexes through `data-table` migrations

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createMigrationRunner } from 'remix/data-table/migrations'
import { createDataTableJobStorage, createDataTableJobStorageMigration } from 'remix/job-data-table'

let migrationRunner = createMigrationRunner(db.adapter, [
  {
    id: '20260301000000',
    name: 'create_job_storage_tables',
    migration: createDataTableJobStorageMigration(),
  },
])

await migrationRunner.up()

let storage = createDataTableJobStorage({
  db,
})
```

## Transaction-Aware Scheduler Writes

`createDataTableJobStorage` enables typed transaction support in `createJobScheduler`.

```ts
await db.transaction(async (transaction) => {
  await scheduler.enqueue(jobs.sendEmail, { to: 'a@example.com', subject: 'Hello' }, { transaction })
  await scheduler.cancel('job-id', { transaction })
})
```

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
