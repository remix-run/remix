import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { createSqliteDatabase } from 'remix/data-table-sqlite'

const databasePath = process.env.DATABASE_URL ?? './db/timebox.sqlite'

mkdirSync(dirname(databasePath), { recursive: true })

export const database = createSqliteDatabase({ path: databasePath })
