import { createMigration } from 'remix/data-table/migrations'

import { authAccountTokens } from '../../app/data/schema.ts'

export default createMigration({
  async up({ schema }) {
    await schema.createTable(authAccountTokens)
    await schema.createIndex(authAccountTokens, 'auth_account_id', {
      name: 'auth_account_tokens_auth_account_id_idx',
      unique: true,
    })
  },
  async down({ schema }) {
    await schema.dropTable(authAccountTokens, { ifExists: true })
  },
})
