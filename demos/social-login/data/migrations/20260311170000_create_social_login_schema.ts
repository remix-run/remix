import { column as c, createMigration } from 'remix/data-table/migrations'
import { table } from 'remix/data-table'

export default createMigration({
  async up({ schema }) {
    let users = table({
      name: 'users',
      columns: {
        id: c.integer().primaryKey().autoIncrement(),
        email: c.text().unique(),
        password: c.text(),
        name: c.text(),
        avatar_url: c.text(),
        created_at: c.integer().notNull(),
        updated_at: c.integer().notNull(),
      },
    })
    await schema.createTable(users)
    await schema.createIndex(users, 'email', { name: 'users_email_idx', unique: true })

    let authAccounts = table({
      name: 'auth_accounts',
      columns: {
        id: c.integer().primaryKey().autoIncrement(),
        user_id: c.integer().notNull().references('users', 'id', 'auth_accounts_user_id_fk').onDelete('cascade'),
        provider: c.text().notNull(),
        provider_account_id: c.text().notNull(),
        email: c.text(),
        name: c.text(),
        avatar_url: c.text(),
        created_at: c.integer().notNull(),
        updated_at: c.integer().notNull(),
      },
    })
    await schema.createTable(authAccounts)
    await schema.createIndex(authAccounts, 'user_id', { name: 'auth_accounts_user_id_idx' })
    await schema.createIndex(authAccounts, ['provider', 'provider_account_id'], {
      name: 'auth_accounts_provider_account_idx',
      unique: true,
    })
  },
  async down({ schema }) {
    await schema.dropTable('auth_accounts', { ifExists: true })
    await schema.dropTable('users', { ifExists: true })
  },
})
