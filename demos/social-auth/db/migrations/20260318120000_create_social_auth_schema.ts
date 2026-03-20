import { createMigration } from 'remix/data-table/migrations'

import { authAccounts, passwordResetTokens, users } from '../../app/data/schema.ts'

export default createMigration({
  async up({ schema }) {
    await schema.createTable(users)
    await schema.createIndex(users, 'email', { name: 'users_email_idx', unique: true })

    await schema.createTable(authAccounts)
    await schema.createIndex(authAccounts, 'user_id', { name: 'auth_accounts_user_id_idx' })
    await schema.createIndex(authAccounts, ['provider', 'provider_account_id'], {
      name: 'auth_accounts_provider_account_idx',
      unique: true,
    })

    await schema.createTable(passwordResetTokens)
    await schema.createIndex(passwordResetTokens, 'user_id', {
      name: 'password_reset_tokens_user_id_idx',
    })
  },
  async down({ schema }) {
    await schema.dropTable(passwordResetTokens, { ifExists: true })
    await schema.dropTable(authAccounts, { ifExists: true })
    await schema.dropTable(users, { ifExists: true })
  },
})
