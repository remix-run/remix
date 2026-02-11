import { number, string, boolean } from '@remix-run/data-schema'

import { createDatabase } from './database.ts'
import { MemoryDatabaseAdapter } from './memory-adapter.ts'
import { createTable } from './model.ts'
import { eq } from './operators.ts'

let Accounts = createTable({
  name: 'accounts',
  columns: {
    id: number(),
    email: string(),
    status: string(),
  },
})

let Projects = createTable({
  name: 'projects',
  columns: {
    id: number(),
    account_id: number(),
    archived: boolean(),
  },
})

let AccountProjects = Accounts.hasMany(Projects)

let db = createDatabase(new MemoryDatabaseAdapter())

db.query(Accounts).where({ status: 'active' })
db.query(Accounts).having({ status: 'active' })

// @ts-expect-error unknown predicate key
db.query(Accounts).where({ not_a_column: 'active' })
// @ts-expect-error unknown predicate key
db.query(Accounts).having({ not_a_column: 'active' })

db.query(Accounts).join(Projects, eq('archived', false))
db.query(Accounts).join(Projects, eq('projects.archived', false))
db.query(Accounts).join(Projects, eq('email', 'user@example.com'))
db.query(Accounts).join(Projects, eq('accounts.id', 'projects.account_id'))

// @ts-expect-error join predicate key must be from source or target table
db.query(Accounts).join(Projects, eq('not_a_column', true))
// @ts-expect-error right-hand column reference must be from source or target table
db.query(Accounts).join(Projects, eq('accounts.id', 'projects.not_a_column'))

AccountProjects.where({ archived: false })
// @ts-expect-error relation predicate key must be from relation target table
AccountProjects.where({ not_a_column: true })
