import type { Middleware } from 'remix/fetch-router'

import { checkoutBookstoreDatabase } from '../models/database.ts'
import { setRequestDatabase } from '../models/request-database.ts'

export function loadDatabase(): Middleware {
  return async (_, next) => {
    let database = checkoutBookstoreDatabase()
    setRequestDatabase(database.db)

    try {
      return await next()
    } finally {
      database.release()
    }
  }
}
