import type { Database } from 'remix/data-table'

declare module 'remix/fetch-router' {
  interface RequestContext {
    db: Database
  }
}
