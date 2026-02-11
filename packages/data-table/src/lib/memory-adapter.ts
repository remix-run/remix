import type {
  AdapterExecuteRequest,
  AdapterResult,
  DatabaseAdapter,
  JoinClause,
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
      let filtered = readRowsForStatement(data, statement)
      let sorted = applyOrder(filtered, statement.orderBy)
      let offsetRows = statement.offset === undefined ? sorted : sorted.slice(statement.offset)
      let limitRows =
        statement.limit === undefined ? offsetRows : offsetRows.slice(0, statement.limit)
      let distinctRows = statement.distinct ? distinct(limitRows) : limitRows
      let projected = projectRows(distinctRows, statement.select)
      return { rows: projected }
    }

    if (statement.kind === 'count') {
      let filtered = readRowsForStatement(data, statement)
      return { rows: [{ count: filtered.length }] }
    }

    if (statement.kind === 'exists') {
      let filtered = readRowsForStatement(data, statement)
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
    let deleted = this.#transactions.delete(token.id)

    if (!deleted) {
      throw new Error('Unknown transaction token: ' + token.id)
    }

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

  if (rowHasQualifiedColumns(row)) {
    return undefined
  }

  let column = path.slice(dotIndex + 1)
  return row[column]
}

function rowHasQualifiedColumns(row: Record<string, unknown>): boolean {
  for (let key of Object.keys(row)) {
    if (key.includes('.')) {
      return true
    }
  }

  return false
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
      let comparison = compareValues(readRowValue(left, clause.column), readRowValue(right, clause.column))

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

type ReadStatement = {
  table: AnyTable
  joins: JoinClause[]
  where: Predicate[]
  groupBy: string[]
  having: Predicate[]
}

function readRowsForStatement(
  data: MemoryDatabaseSeed,
  statement: ReadStatement,
): Record<string, unknown>[] {
  let sourceRows = readRows(data, statement.table)
  let joinedRows =
    statement.joins.length === 0
      ? sourceRows.map(function cloneSourceRow(row) {
          return { ...row }
        })
      : applyJoins(sourceRows, statement.table, statement.joins, data)
  let filteredRows = applyWhere(joinedRows, statement.where)
  let groupedRows = applyGroupBy(filteredRows, statement.groupBy)
  return applyWhere(groupedRows, statement.having)
}

function applyJoins(
  sourceRows: Record<string, unknown>[],
  sourceTable: AnyTable,
  joins: JoinClause[],
  data: MemoryDatabaseSeed,
): Record<string, unknown>[] {
  let currentRows = sourceRows.map(function mapSourceRow(row) {
    return mergeTableData({}, sourceTable, row)
  })

  for (let join of joins) {
    let targetRows = readRows(data, join.table)
    let nextRows: Record<string, unknown>[] = []
    let matchedTargetIndexes = new Set<number>()
    let nullLeftRow = currentRows[0] ? createNullRow(currentRows[0]) : {}

    for (let leftRow of currentRows) {
      let matched = false
      let targetIndex = 0

      while (targetIndex < targetRows.length) {
        let candidate = mergeTableData(leftRow, join.table, targetRows[targetIndex])

        if (matchesPredicate(candidate, join.on)) {
          matched = true
          matchedTargetIndexes.add(targetIndex)
          nextRows.push(candidate)
        }

        targetIndex += 1
      }

      if (!matched && (join.type === 'left' || join.type === 'full')) {
        nextRows.push(mergeTableData(leftRow, join.table))
      }
    }

    if (join.type === 'right' || join.type === 'full') {
      let targetIndex = 0

      while (targetIndex < targetRows.length) {
        if (!matchedTargetIndexes.has(targetIndex)) {
          nextRows.push(mergeTableData(nullLeftRow, join.table, targetRows[targetIndex]))
        }

        targetIndex += 1
      }
    }

    currentRows = nextRows
  }

  return currentRows
}

function applyGroupBy(rows: Record<string, unknown>[], groupBy: string[]): Record<string, unknown>[] {
  if (groupBy.length === 0) {
    return rows
  }

  let output: Record<string, unknown>[] = []
  let seen = new Set<string>()

  for (let row of rows) {
    let key = JSON.stringify(
      groupBy.map(function mapGroupColumn(column) {
        return readRowValue(row, column)
      }),
    )

    if (!seen.has(key)) {
      seen.add(key)
      output.push(row)
    }
  }

  return output
}

function mergeTableData(
  base: Record<string, unknown>,
  table: AnyTable,
  row?: Record<string, unknown>,
): Record<string, unknown> {
  let output: Record<string, unknown> = { ...base }

  for (let column of Object.keys(table.columns)) {
    let value = row ? row[column] : undefined
    let qualifiedColumn = table.name + '.' + column

    output[qualifiedColumn] = value

    if (!Object.prototype.hasOwnProperty.call(output, column)) {
      output[column] = value
    }
  }

  return output
}

function createNullRow(template: Record<string, unknown>): Record<string, unknown> {
  let output: Record<string, unknown> = {}

  for (let key of Object.keys(template)) {
    output[key] = undefined
  }

  return output
}
