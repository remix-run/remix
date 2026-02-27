# job-data-table

Data Table-backed backend adapter for `@remix-run/job`.

## Features

- **Durable SQL queue** - Store jobs in PostgreSQL, MySQL, or SQLite
- **Lease-based processing** - Supports worker failover and retries
- **Cron persistence** - Stores recurring schedule state
- **Schema helper** - Generates SQL DDL for scheduler tables

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createDataTableJobBackend } from 'remix/job/data-table'

let backend = createDataTableJobBackend({
  db,
  dialect: 'postgres',
})
```

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
