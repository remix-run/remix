import * as path from 'node:path'
import { createSqliteDatabase } from 'remix/data-table-sqlite'

const DB_DIRECTORY = path.join(import.meta.dirname, '../../db')

export const database = createSqliteDatabase({
  path:
    process.env.NODE_ENV === 'test'
      ? path.join(DB_DIRECTORY, `test-${process.pid}.sqlite`)
      : path.join(DB_DIRECTORY, 'app.sqlite'),
})
