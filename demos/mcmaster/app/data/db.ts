import { createSqliteDatabase } from 'remix/data-table/sqlite'

// The catalog is generated deterministically at startup, so an in-memory database keeps the demo
// free of setup steps while still exercising real SQL queries.
export const db = createSqliteDatabase({ filename: ':memory:', foreignKeys: true })
