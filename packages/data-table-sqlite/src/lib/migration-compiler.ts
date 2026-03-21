import type {
  ColumnDefinition,
  DataMigrationOperation,
  ForeignKeyConstraint,
  SqlStatement,
} from '@remix-run/data-table/adapter'

import {
  quoteIdentifier,
  quoteLiteral,
  quoteTableRef,
} from './sql-compiler-helpers.ts'

export function compileSqliteMigrationOperations(
  operation: DataMigrationOperation,
): SqlStatement[] {
  switch (operation.kind) {
    case 'raw':
      return [{ text: operation.sql.text, values: [...operation.sql.values] }]
    case 'createTable':
      return compileCreateTableStatements(operation)
    case 'alterTable':
      return compileAlterTableStatements(operation)
    case 'renameTable':
      return [
        {
          text:
            'alter table ' +
            quoteTableRef(operation.from) +
            ' rename to ' +
            quoteIdentifier(operation.to.name),
          values: [],
        },
      ]
    case 'dropTable':
      return [
        {
          text:
            'drop table ' +
            (operation.ifExists ? 'if exists ' : '') +
            quoteTableRef(operation.table),
          values: [],
        },
      ]
    case 'createIndex':
      return [
        {
          text:
            'create ' +
            (operation.index.unique ? 'unique ' : '') +
            'index ' +
            (operation.ifNotExists ? 'if not exists ' : '') +
            quoteIdentifier(operation.index.name) +
            ' on ' +
            quoteTableRef(operation.index.table) +
            ' (' +
            operation.index.columns.map((column) => quoteIdentifier(column)).join(', ') +
            ')' +
            (operation.index.where ? ' where ' + operation.index.where : ''),
          values: [],
        },
      ]
    case 'dropIndex':
      return [
        {
          text:
            'drop index ' +
            (operation.ifExists ? 'if exists ' : '') +
            quoteIdentifier(operation.name),
          values: [],
        },
      ]
    case 'renameIndex':
      return [
        {
          text:
            'alter table ' +
            quoteTableRef(operation.table) +
            ' rename index ' +
            quoteIdentifier(operation.from) +
            ' to ' +
            quoteIdentifier(operation.to),
          values: [],
        },
      ]
    case 'addForeignKey':
      return [
        {
          text:
            'alter table ' +
            quoteTableRef(operation.table) +
            ' add ' +
            compileForeignKeyConstraint(operation.constraint),
          values: [],
        },
      ]
    case 'dropForeignKey':
      return [
        {
          text:
            'alter table ' +
            quoteTableRef(operation.table) +
            ' drop constraint ' +
            quoteIdentifier(operation.name),
          values: [],
        },
      ]
    case 'addCheck':
      return [
        {
          text:
            'alter table ' +
            quoteTableRef(operation.table) +
            ' add ' +
            compileCheckConstraint(operation.constraint.name, operation.constraint.expression),
          values: [],
        },
      ]
    case 'dropCheck':
      return [
        {
          text:
            'alter table ' +
            quoteTableRef(operation.table) +
            ' drop constraint ' +
            quoteIdentifier(operation.name),
          values: [],
        },
      ]
  }

  throw new Error('Unsupported data migration operation kind')
}

function compileCreateTableStatements(
  operation: Extract<DataMigrationOperation, { kind: 'createTable' }>,
): SqlStatement[] {
  let columns = Object.keys(operation.columns).map(
    (columnName) =>
      quoteIdentifier(columnName) + ' ' + compileSqliteColumn(operation.columns[columnName]),
  )
  let constraints = compileTableConstraints(operation)

  return [
    {
      text:
        'create table ' +
        (operation.ifNotExists ? 'if not exists ' : '') +
        quoteTableRef(operation.table) +
        ' (' +
        [...columns, ...constraints].join(', ') +
        ')',
      values: [],
    },
  ]
}

function compileAlterTableStatements(
  operation: Extract<DataMigrationOperation, { kind: 'alterTable' }>,
): SqlStatement[] {
  let statements: SqlStatement[] = []

  for (let change of operation.changes) {
    let sql = compileAlterTableChange(operation.table, change)

    if (!sql) {
      continue
    }

    statements.push({ text: sql, values: [] })
  }

  return statements
}

function compileAlterTableChange(
  table: Extract<DataMigrationOperation, { kind: 'alterTable' }>['table'],
  change: Extract<DataMigrationOperation, { kind: 'alterTable' }>['changes'][number],
): string | undefined {
  let prefix = 'alter table ' + quoteTableRef(table) + ' '

  switch (change.kind) {
    case 'addColumn':
      return (
        prefix +
        'add column ' +
        quoteIdentifier(change.column) +
        ' ' +
        compileSqliteColumn(change.definition)
      )
    case 'changeColumn':
      return (
        prefix +
        'alter column ' +
        quoteIdentifier(change.column) +
        ' type ' +
        compileSqliteColumnType(change.definition)
      )
    case 'renameColumn':
      return prefix + 'rename column ' + quoteIdentifier(change.from) + ' to ' + quoteIdentifier(change.to)
    case 'dropColumn':
      return prefix + 'drop column ' + quoteIdentifier(change.column)
    case 'addPrimaryKey':
      return (
        prefix +
        'add primary key (' +
        change.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
        ')'
      )
    case 'dropPrimaryKey':
      return prefix + 'drop primary key'
    case 'addUnique':
      return (
        prefix +
        'add constraint ' +
        quoteIdentifier(change.constraint.name) +
        ' unique (' +
        change.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
        ')'
      )
    case 'dropUnique':
      return prefix + 'drop constraint ' + quoteIdentifier(change.name)
    case 'addForeignKey':
      return prefix + 'add ' + compileForeignKeyConstraint(change.constraint)
    case 'dropForeignKey':
      return prefix + 'drop constraint ' + quoteIdentifier(change.name)
    case 'addCheck':
      return prefix + 'add ' + compileCheckConstraint(change.constraint.name, change.constraint.expression)
    case 'dropCheck':
      return prefix + 'drop constraint ' + quoteIdentifier(change.name)
    case 'setTableComment':
      return undefined
  }
}

function compileTableConstraints(
  operation: Extract<DataMigrationOperation, { kind: 'createTable' }>,
): string[] {
  let constraints: string[] = []

  if (operation.primaryKey) {
    constraints.push(
      'constraint ' +
        quoteIdentifier(operation.primaryKey.name) +
        ' primary key (' +
        operation.primaryKey.columns.map((column) => quoteIdentifier(column)).join(', ') +
        ')',
    )
  }

  for (let unique of operation.uniques ?? []) {
    constraints.push(
      'constraint ' +
        quoteIdentifier(unique.name) +
        ' unique (' +
        unique.columns.map((column) => quoteIdentifier(column)).join(', ') +
        ')',
    )
  }

  for (let check of operation.checks ?? []) {
    constraints.push(compileCheckConstraint(check.name, check.expression))
  }

  for (let foreignKey of operation.foreignKeys ?? []) {
    constraints.push(compileForeignKeyConstraint(foreignKey))
  }

  return constraints
}

function compileCheckConstraint(name: string, expression: string): string {
  return 'constraint ' + quoteIdentifier(name) + ' check (' + expression + ')'
}

function compileSqliteColumn(definition: ColumnDefinition): string {
  let parts = [compileSqliteColumnType(definition)]

  if (definition.nullable === false) {
    parts.push('not null')
  }

  if (definition.default) {
    if (definition.default.kind === 'now') {
      parts.push('default current_timestamp')
    } else if (definition.default.kind === 'sql') {
      parts.push('default ' + definition.default.expression)
    } else {
      parts.push('default ' + quoteLiteral(definition.default.value))
    }
  }

  if (definition.primaryKey) {
    parts.push('primary key')
  }

  if (definition.unique) {
    parts.push('unique')
  }

  if (definition.computed) {
    parts.push('generated always as (' + definition.computed.expression + ')')
    parts.push(definition.computed.stored ? 'stored' : 'virtual')
  }

  if (definition.references) {
    parts.push(compileForeignKeyReferenceClause(definition.references))
  }

  if (definition.checks && definition.checks.length > 0) {
    for (let check of definition.checks) {
      parts.push('check (' + check.expression + ')')
    }
  }

  return parts.join(' ')
}

function compileSqliteColumnType(definition: ColumnDefinition): string {
  return SQLITE_COLUMN_TYPES[definition.type] ?? 'text'
}

function compileForeignKeyConstraint(
  constraint: ForeignKeyConstraint,
): string {
  let clause =
    'constraint ' +
    quoteIdentifier(constraint.name) +
    ' ' +
    'foreign key (' +
    constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
    ') references ' +
    quoteTableRef(constraint.references.table) +
    ' (' +
    constraint.references.columns.map((column) => quoteIdentifier(column)).join(', ') +
    ')'

  if (constraint.onDelete) {
    clause += ' on delete ' + constraint.onDelete
  }

  if (constraint.onUpdate) {
    clause += ' on update ' + constraint.onUpdate
  }

  return clause
}

function compileForeignKeyReferenceClause(
  references: NonNullable<ColumnDefinition['references']>,
): string {
  return (
    'references ' +
    quoteTableRef(references.table) +
    ' (' +
    references.columns.map((column) => quoteIdentifier(column)).join(', ') +
    ')' +
    (references.onDelete ? ' on delete ' + references.onDelete : '') +
    (references.onUpdate ? ' on update ' + references.onUpdate : '')
  )
}

const SQLITE_COLUMN_TYPES: Record<ColumnDefinition['type'], string> = {
  varchar: 'text',
  text: 'text',
  integer: 'integer',
  bigint: 'integer',
  decimal: 'numeric',
  boolean: 'integer',
  uuid: 'text',
  date: 'text',
  time: 'text',
  timestamp: 'text',
  json: 'text',
  binary: 'blob',
  enum: 'text',
}
