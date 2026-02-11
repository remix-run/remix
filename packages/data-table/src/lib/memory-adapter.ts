import type {
  AdapterExecuteRequest,
  AdapterResult,
  DatabaseAdapter,
  TransactionToken,
} from './adapter.ts'
import type { AnyTable } from './model.ts'
import type { Predicate } from './operators.ts'

export type MemoryDatabaseSeed = Record<string, Record<string, unknown>[]>

export type MemoryAdapterOptions = {
  returning?: boolean
  upsert?: boolean
}

export class MemoryDatabaseAdapter implements DatabaseAdapter {
  dialect = 'memory'
  capabilities

  statements: AdapterExecuteRequest[] = []
  events: string[] = []

  #data: MemoryDatabaseSeed
  #transactions = new Map<
    string,
    {
      data: MemoryDatabaseSeed
      savepoints: Map<string, MemoryDatabaseSeed>
    }
  >()
  #transactionCounter = 0

  constructor(seed: MemoryDatabaseSeed = {}, options?: MemoryAdapterOptions) {
    this.#data = cloneData(seed)
    this.capabilities = {
      returning: options?.returning ?? true,
      savepoints: true,
      ilike: true,
      upsert: options?.upsert ?? true,
    }
  }

  async execute(request: AdapterExecuteRequest): Promise<AdapterResult> {
    this.statements.push(request)

    let data = this.#dataForRequest(request)
    let statement = request.statement

    if (statement.kind === 'raw') {
      return { rows: [] }
    }

    if (statement.kind === 'select') {
      let rows = readRows(data, statement.table)
      let filtered = applyWhere(rows, statement.where)
      let sorted = applyOrder(filtered, statement.orderBy)
      let offsetRows = statement.offset === undefined ? sorted : sorted.slice(statement.offset)
      let limitRows =
        statement.limit === undefined ? offsetRows : offsetRows.slice(0, statement.limit)
      let distinctRows = statement.distinct ? distinct(limitRows) : limitRows
      let projected = projectRows(distinctRows, statement.select)
      return { rows: projected }
    }

    if (statement.kind === 'count') {
      let rows = readRows(data, statement.table)
      let filtered = applyWhere(rows, statement.where)
      return { rows: [{ count: filtered.length }] }
    }

    if (statement.kind === 'exists') {
      let rows = readRows(data, statement.table)
      let filtered = applyWhere(rows, statement.where)
      return { rows: [{ exists: filtered.length > 0 }] }
    }

    if (statement.kind === 'insert') {
      let tableRows = readRows(data, statement.table)
      let row = { ...statement.values }
      let insertId = assignPrimaryKeyIfMissing(statement.table, tableRows, row)
      tableRows.push(row)

      return {
        affectedRows: 1,
        insertId,
        rows: statement.returning ? projectRows([row], statement.returning) : undefined,
      }
    }

    if (statement.kind === 'insertMany') {
      let tableRows = readRows(data, statement.table)
      let insertedRows: Record<string, unknown>[] = []
      let lastInsertId: unknown = undefined

      for (let values of statement.values) {
        let row = { ...values }
        lastInsertId = assignPrimaryKeyIfMissing(statement.table, tableRows, row)
        tableRows.push(row)
        insertedRows.push(row)
      }

      return {
        affectedRows: statement.values.length,
        insertId: lastInsertId,
        rows: statement.returning ? projectRows(insertedRows, statement.returning) : undefined,
      }
    }

    if (statement.kind === 'update') {
      let tableRows = readRows(data, statement.table)
      let matches = tableRows.filter(function filterRow(row) {
        return matchesPredicateList(row, statement.where)
      })

      for (let row of matches) {
        Object.assign(row, statement.changes)
      }

      return {
        affectedRows: matches.length,
        rows: statement.returning ? projectRows(matches, statement.returning) : undefined,
      }
    }

    if (statement.kind === 'delete') {
      let tableRows = readRows(data, statement.table)
      let remainingRows: Record<string, unknown>[] = []
      let deletedRows: Record<string, unknown>[] = []

      for (let row of tableRows) {
        if (matchesPredicateList(row, statement.where)) {
          deletedRows.push(row)
        } else {
          remainingRows.push(row)
        }
      }

      data[statement.table.name] = remainingRows

      return {
        affectedRows: deletedRows.length,
        rows: statement.returning ? projectRows(deletedRows, statement.returning) : undefined,
      }
    }

    if (statement.kind === 'upsert') {
      let tableRows = readRows(data, statement.table)
      let conflictTarget = statement.conflictTarget ?? [...statement.table.primaryKey]
      let existing = tableRows.find(function findRow(row) {
        return conflictTarget.every(function matchesKey(key) {
          return row[key] === statement.values[key]
        })
      })

      if (existing) {
        let updateValues = statement.update ?? statement.values
        Object.assign(existing, updateValues)

        return {
          affectedRows: 1,
          rows: statement.returning ? projectRows([existing], statement.returning) : undefined,
        }
      }

      let insertedRow = { ...statement.values }
      let insertId = assignPrimaryKeyIfMissing(statement.table, tableRows, insertedRow)
      tableRows.push(insertedRow)

      return {
        affectedRows: 1,
        insertId,
        rows: statement.returning ? projectRows([insertedRow], statement.returning) : undefined,
      }
    }

    throw new Error('Unknown statement kind')
  }

  async beginTransaction(): Promise<TransactionToken> {
    this.#transactionCounter += 1
    let id = 'tx_' + String(this.#transactionCounter)

    this.events.push('begin:' + id)
    this.#transactions.set(id, {
      data: cloneData(this.#data),
      savepoints: new Map(),
    })

    return { id }
  }

  async commitTransaction(token: TransactionToken): Promise<void> {
    let transaction = this.#transactions.get(token.id)

    if (!transaction) {
      throw new Error('Unknown transaction token: ' + token.id)
    }

    this.#data = transaction.data
    this.#transactions.delete(token.id)
    this.events.push('commit:' + token.id)
  }

  async rollbackTransaction(token: TransactionToken): Promise<void> {
    this.#transactions.delete(token.id)
    this.events.push('rollback:' + token.id)
  }

  async createSavepoint(token: TransactionToken, name: string): Promise<void> {
    let transaction = this.#transactions.get(token.id)

    if (!transaction) {
      throw new Error('Unknown transaction token: ' + token.id)
    }

    transaction.savepoints.set(name, cloneData(transaction.data))
    this.events.push('savepoint:' + token.id + ':' + name)
  }

  async rollbackToSavepoint(token: TransactionToken, name: string): Promise<void> {
    let transaction = this.#transactions.get(token.id)

    if (!transaction) {
      throw new Error('Unknown transaction token: ' + token.id)
    }

    let snapshot = transaction.savepoints.get(name)

    if (!snapshot) {
      throw new Error('Unknown savepoint: ' + name)
    }

    transaction.data = cloneData(snapshot)
    this.events.push('rollback-to-savepoint:' + token.id + ':' + name)
  }

  async releaseSavepoint(token: TransactionToken, name: string): Promise<void> {
    let transaction = this.#transactions.get(token.id)

    if (!transaction) {
      throw new Error('Unknown transaction token: ' + token.id)
    }

    transaction.savepoints.delete(name)
    this.events.push('release-savepoint:' + token.id + ':' + name)
  }

  seed(data: MemoryDatabaseSeed): void {
    this.#data = cloneData(data)
  }

  snapshot(tableName: string): Record<string, unknown>[] {
    return cloneData(this.#data)[tableName] ?? []
  }

  clear(): void {
    this.#data = {}
    this.#transactions.clear()
    this.statements = []
    this.events = []
  }

  #dataForRequest(request: AdapterExecuteRequest): MemoryDatabaseSeed {
    if (!request.transaction) {
      return this.#data
    }

    let transaction = this.#transactions.get(request.transaction.id)

    if (!transaction) {
      throw new Error('Unknown transaction token: ' + request.transaction.id)
    }

    return transaction.data
  }
}

export function createMemoryDatabaseAdapter(
  seed: MemoryDatabaseSeed = {},
  options?: MemoryAdapterOptions,
): MemoryDatabaseAdapter {
  return new MemoryDatabaseAdapter(seed, options)
}

function readRows(data: MemoryDatabaseSeed, table: AnyTable): Record<string, unknown>[] {
  if (!data[table.name]) {
    data[table.name] = []
  }

  return data[table.name]
}

function applyWhere(
  rows: Record<string, unknown>[],
  predicates: Predicate[],
): Record<string, unknown>[] {
  return rows.filter(function filterRow(row) {
    return matchesPredicateList(row, predicates)
  })
}

function matchesPredicateList(row: Record<string, unknown>, predicates: Predicate[]): boolean {
  for (let predicate of predicates) {
    if (!matchesPredicate(row, predicate)) {
      return false
    }
  }

  return true
}

function matchesPredicate(row: Record<string, unknown>, predicate: Predicate): boolean {
  if (predicate.type === 'comparison') {
    let rowValue = readRowValue(row, predicate.column)
    let comparisonValue =
      predicate.valueType === 'column' ? readRowValue(row, predicate.value) : predicate.value

    if (predicate.operator === 'eq') {
      return rowValue === comparisonValue
    }

    if (predicate.operator === 'ne') {
      return rowValue !== comparisonValue
    }

    if (predicate.operator === 'gt') {
      return compareValues(rowValue, comparisonValue) > 0
    }

    if (predicate.operator === 'gte') {
      return compareValues(rowValue, comparisonValue) >= 0
    }

    if (predicate.operator === 'lt') {
      return compareValues(rowValue, comparisonValue) < 0
    }

    if (predicate.operator === 'lte') {
      return compareValues(rowValue, comparisonValue) <= 0
    }

    if (predicate.operator === 'in') {
      return Array.isArray(predicate.value) && predicate.value.includes(rowValue)
    }

    if (predicate.operator === 'notIn') {
      return Array.isArray(predicate.value) && !predicate.value.includes(rowValue)
    }

    if (predicate.operator === 'like') {
      return likeMatch(String(rowValue ?? ''), String(comparisonValue), false)
    }

    if (predicate.operator === 'ilike') {
      return likeMatch(String(rowValue ?? ''), String(comparisonValue), true)
    }
  }

  if (predicate.type === 'between') {
    let rowValue = readRowValue(row, predicate.column)
    return (
      compareValues(rowValue, predicate.lower) >= 0 && compareValues(rowValue, predicate.upper) <= 0
    )
  }

  if (predicate.type === 'null') {
    if (predicate.operator === 'isNull') {
      let value = readRowValue(row, predicate.column)
      return value === null || value === undefined
    }

    let value = readRowValue(row, predicate.column)
    return value !== null && value !== undefined
  }

  if (predicate.type === 'logical') {
    if (predicate.operator === 'and') {
      return predicate.predicates.every(function everyPredicate(child: Predicate) {
        return matchesPredicate(row, child)
      })
    }

    return predicate.predicates.some(function somePredicate(child: Predicate) {
      return matchesPredicate(row, child)
    })
  }

  return false
}

function readRowValue(row: Record<string, unknown>, path: string): unknown {
  if (Object.prototype.hasOwnProperty.call(row, path)) {
    return row[path]
  }

  let dotIndex = path.indexOf('.')

  if (dotIndex === -1) {
    return row[path]
  }

  let column = path.slice(dotIndex + 1)
  return row[column]
}

function compareValues(left: unknown, right: unknown): number {
  if (left === right) {
    return 0
  }

  if (left === undefined || left === null) {
    return -1
  }

  if (right === undefined || right === null) {
    return 1
  }

  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime()
  }

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }

  return String(left).localeCompare(String(right))
}

function likeMatch(value: string, pattern: string, caseInsensitive: boolean): boolean {
  let escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  let regexPattern = '^' + escaped.replace(/%/g, '.*').replace(/_/g, '.') + '$'
  let regex = new RegExp(regexPattern, caseInsensitive ? 'i' : undefined)

  return regex.test(value)
}

function applyOrder(
  rows: Record<string, unknown>[],
  orderBy: { column: string; direction: string }[],
): Record<string, unknown>[] {
  if (orderBy.length === 0) {
    return [...rows]
  }

  return [...rows].sort(function compare(left, right) {
    for (let clause of orderBy) {
      let direction = clause.direction === 'desc' ? -1 : 1
      let comparison = compareValues(left[clause.column], right[clause.column])

      if (comparison !== 0) {
        return comparison * direction
      }
    }

    return 0
  })
}

function distinct(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  let seen = new Set<string>()
  let output: Record<string, unknown>[] = []

  for (let row of rows) {
    let key = JSON.stringify(row)

    if (!seen.has(key)) {
      seen.add(key)
      output.push(row)
    }
  }

  return output
}

function projectRows(
  rows: Record<string, unknown>[],
  select: '*' | string[],
): Record<string, unknown>[] {
  if (select === '*') {
    return rows.map(function clone(row) {
      return { ...row }
    })
  }

  return rows.map(function project(row) {
    let output: Record<string, unknown> = {}

    for (let key of select) {
      output[key] = row[key]
    }

    return output
  })
}

function assignPrimaryKeyIfMissing(
  table: AnyTable,
  rows: Record<string, unknown>[],
  row: Record<string, unknown>,
): unknown {
  if (table.primaryKey.length !== 1) {
    return undefined
  }

  let key = table.primaryKey[0]

  if (row[key] !== undefined) {
    return row[key]
  }

  let highest = 0

  for (let current of rows) {
    let value = current[key]

    if (typeof value === 'number' && value > highest) {
      highest = value
    }
  }

  let nextId = highest + 1
  row[key] = nextId
  return nextId
}

function cloneData(data: MemoryDatabaseSeed): MemoryDatabaseSeed {
  return structuredClone(data)
}
