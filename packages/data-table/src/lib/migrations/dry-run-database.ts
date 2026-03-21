import { createDatabase } from '../database.ts'
import type { Database } from '../database.ts'
import type { DatabaseAdapter } from '../adapter.ts'

export function createDryRunDatabase(adapter: DatabaseAdapter): Database {
  let error = new Error('Cannot execute data operations while running migrations with dryRun')
  let throwDryRunError = async (): Promise<never> => {
    throw error
  }
  let dryRunAdapter: DatabaseAdapter = {
    dialect: adapter.dialect,
    capabilities: adapter.capabilities,
    compileSql(operation) {
      return adapter.compileSql(operation)
    },
    async hasTable(table) {
      return adapter.hasTable(table)
    },
    async hasColumn(table, column) {
      return adapter.hasColumn(table, column)
    },
    execute: throwDryRunError,
    migrate: throwDryRunError,
    beginTransaction: throwDryRunError,
    commitTransaction: throwDryRunError,
    rollbackTransaction: throwDryRunError,
    createSavepoint: throwDryRunError,
    rollbackToSavepoint: throwDryRunError,
    releaseSavepoint: throwDryRunError,
  }

  return createDatabase(dryRunAdapter)
}
