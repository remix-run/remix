import type { MigrationTransactionMode } from '../migrations.ts'

const directivePattern = /^\s*--\s*data-table\/transaction\s*:(.*)$/i
const transactionModes = new Set<string>(['auto', 'required', 'none'])

/**
 * Parses an optional `-- data-table/transaction: auto|required|none` directive
 * from any single-line SQL comment in the script.
 *
 * Returns `undefined` when no directive is present.
 * @param sql SQL script contents.
 * @returns The declared transaction mode, or `undefined` when not declared.
 * @throws when more than one directive is present or the value is invalid.
 */
export function parseTransactionDirective(sql: string): MigrationTransactionMode | undefined {
  let match: MigrationTransactionMode | undefined

  for (let line of sql.split(/\r?\n/)) {
    let trimmed = line.trim()

    if (!trimmed.startsWith('--')) {
      continue
    }

    let result = directivePattern.exec(trimmed)

    if (!result) {
      continue
    }

    if (match !== undefined) {
      throw new Error('Migration script declares more than one transaction directive')
    }

    let mode = result[1].trim().toLowerCase()

    if (!transactionModes.has(mode)) {
      throw new Error(
        `Invalid transaction directive value "${result[1].trim()}". Expected auto, required, or none`,
      )
    }

    match = mode as MigrationTransactionMode
  }

  return match
}
