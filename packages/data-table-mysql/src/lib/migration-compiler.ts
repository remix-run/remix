import { getTableName } from '@remix-run/data-table/adapter'
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

export function compileMysqlMigrationOperations(operation: DataMigrationOperation): SqlStatement[] {
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
            'rename table ' + quoteTableRef(operation.from) + ' to ' + quoteTableRef(operation.to),
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
            quoteIdentifier(operation.index.name) +
            ' on ' +
            quoteTableRef(operation.index.table) +
            (operation.index.using ? ' using ' + operation.index.using : '') +
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
            quoteIdentifier(operation.name) +
            ' on ' +
            quoteTableRef(operation.table),
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
            ' drop foreign key ' +
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
            ' drop check ' +
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
      quoteIdentifier(columnName) + ' ' + compileMysqlColumn(operation.columns[columnName]),
  )
  let constraints = compileTableConstraints(operation)
  let statements: SqlStatement[] = [
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

  if (operation.comment) {
    statements.push({
      text:
        'alter table ' + quoteTableRef(operation.table) + ' comment = ' + quoteLiteral(operation.comment),
      values: [],
    })
  }

  return statements
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
        compileMysqlColumn(change.definition)
      )
    case 'changeColumn':
      return (
        prefix +
        'modify column ' +
        quoteIdentifier(change.column) +
        ' ' +
        compileMysqlColumn(change.definition)
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
      return prefix + 'drop index ' + quoteIdentifier(change.name)
    case 'addForeignKey':
      return prefix + 'add ' + compileForeignKeyConstraint(change.constraint)
    case 'dropForeignKey':
      return prefix + 'drop foreign key ' + quoteIdentifier(change.name)
    case 'addCheck':
      return prefix + 'add ' + compileCheckConstraint(change.constraint.name, change.constraint.expression)
    case 'dropCheck':
      return prefix + 'drop check ' + quoteIdentifier(change.name)
    case 'setTableComment':
      return prefix + 'comment = ' + quoteLiteral(change.comment)
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

function compileForeignKeyConstraint(constraint: ForeignKeyConstraint): string {
  return (
    'constraint ' +
    quoteIdentifier(constraint.name) +
    ' foreign key (' +
    constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
    ') references ' +
    quoteTableRef(constraint.references.table) +
    ' (' +
    constraint.references.columns.map((column) => quoteIdentifier(column)).join(', ') +
    ')' +
    (constraint.onDelete ? ' on delete ' + constraint.onDelete : '') +
    (constraint.onUpdate ? ' on update ' + constraint.onUpdate : '')
  )
}

function compileMysqlColumn(definition: ColumnDefinition): string {
  let parts = [compileMysqlColumnType(definition)]

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

  if (definition.autoIncrement) {
    parts.push('auto_increment')
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
    let clause =
      'references ' +
      quoteTableRef(definition.references.table) +
      ' (' +
      definition.references.columns.map((column) => quoteIdentifier(column)).join(', ') +
      ')'

    if (definition.references.onDelete) {
      clause += ' on delete ' + definition.references.onDelete
    }

    if (definition.references.onUpdate) {
      clause += ' on update ' + definition.references.onUpdate
    }

    parts.push(clause)
  }

  if (definition.checks && definition.checks.length > 0) {
    for (let check of definition.checks) {
      parts.push('check (' + check.expression + ')')
    }
  }

  return parts.join(' ')
}

function compileMysqlColumnType(definition: ColumnDefinition): string {
  if (definition.type === 'varchar') {
    return 'varchar(' + String(definition.length ?? 255) + ')'
  }

  if (definition.type === 'text') {
    return 'text'
  }

  if (definition.type === 'integer') {
    return definition.unsigned ? 'int unsigned' : 'int'
  }

  if (definition.type === 'bigint') {
    return definition.unsigned ? 'bigint unsigned' : 'bigint'
  }

  if (definition.type === 'decimal') {
    if (definition.precision !== undefined && definition.scale !== undefined) {
      return 'decimal(' + String(definition.precision) + ', ' + String(definition.scale) + ')'
    }

    return 'decimal'
  }

  if (definition.type === 'boolean') {
    return 'boolean'
  }

  if (definition.type === 'uuid') {
    return 'char(36)'
  }

  if (definition.type === 'date') {
    return 'date'
  }

  if (definition.type === 'time') {
    return 'time'
  }

  if (definition.type === 'timestamp') {
    return 'timestamp'
  }

  if (definition.type === 'json') {
    return 'json'
  }

  if (definition.type === 'binary') {
    return 'blob'
  }

  if (definition.type === 'enum') {
    if (definition.enumValues && definition.enumValues.length > 0) {
      return 'enum(' + definition.enumValues.map((value) => quoteLiteral(value)).join(', ') + ')'
    }

    return 'text'
  }

  return 'text'
}
