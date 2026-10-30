import { column as c, table, type TableRow } from 'remix/data-table'

export const entries = table({
  name: 'entries',
  columns: {
    id: c.integer().primaryKey().autoIncrement(),
    name: c.text().notNull(),
    message: c.text().notNull(),
    signed_at: c.integer().notNull(),
  },
})

export type Entry = TableRow<typeof entries>
