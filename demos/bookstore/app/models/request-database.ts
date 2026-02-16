import { getContext } from 'remix/async-context-middleware'
import { createStorageKey } from 'remix/fetch-router'

import type { BookstoreDatabase } from './database.ts'

let DATABASE_KEY = createStorageKey<BookstoreDatabase>()

export function setRequestDatabase(database: BookstoreDatabase): void {
  getContext().storage.set(DATABASE_KEY, database)
}

export function getRequestDatabase(): BookstoreDatabase {
  try {
    return getContext().storage.get(DATABASE_KEY)
  } catch (cause) {
    throw new Error(
      'No request database found. Set up asyncContext() and loadDatabase() middleware before using model functions.',
      { cause },
    )
  }
}
