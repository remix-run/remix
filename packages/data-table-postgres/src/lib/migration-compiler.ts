import type {
  ColumnDefinition,
  DataMigrationOperation,
  ForeignKeyConstraint,
  SqlStatement,
} from '@remix-run/data-table/adapter'

import { quoteIdentifier, quoteTableRef } from './sql-compiler-helpers.ts'

export function compilePostgresMigrationOperations(
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
            quoteTableRef(operation.table) +
            (operation.cascade ? ' cascade' : ''),
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
            (operation.ifExists ? 'if exists ' : '') +
            quoteIdentifier(operation.name),
          values: [],
        },
      ]
    case 'renameIndex':
      return [
        {
          text:
            'alter index ' +
            quoteIdentifier(operation.from) +
            ' rename to ' +
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
      quoteIdentifier(columnName) + ' ' + compilePostgresColumn(operation.columns[columnName]),
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
        'comment on table ' +
        quoteTableRef(operation.table) +
        ' is ' +
        quoteLiteral(operation.comment),
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
    let statement = compileAlterTableChange(operation.table, change)

    if (!statement) {
      continue
    }

    statements.push(statement)
  }

  return statements
}

function compileAlterTableChange(
  table: Extract<DataMigrationOperation, { kind: 'alterTable' }>['table'],
  change: Extract<DataMigrationOperation, { kind: 'alterTable' }>['changes'][number],
): SqlStatement | undefined {
  let prefix = 'alter table ' + quoteTableRef(table) + ' '

  switch (change.kind) {
    case 'addColumn':
      return {
        text:
          prefix +
          'add column ' +
          quoteIdentifier(change.column) +
          ' ' +
          compilePostgresColumn(change.definition),
        values: [],
      }
    case 'changeColumn':
      return {
        text:
          prefix +
          'alter column ' +
          quoteIdentifier(change.column) +
          ' type ' +
          compilePostgresColumnType(change.definition),
        values: [],
      }
    case 'renameColumn':
      return {
        text:
          prefix + 'rename column ' + quoteIdentifier(change.from) + ' to ' + quoteIdentifier(change.to),
        values: [],
      }
    case 'dropColumn':
      return {
        text:
          prefix +
          'drop column ' +
          (change.ifExists ? 'if exists ' : '') +
          quoteIdentifier(change.column),
        values: [],
      }
    case 'addPrimaryKey':
      return {
        text:
          prefix +
          'add constraint ' +
          quoteIdentifier(change.constraint.name) +
          ' primary key (' +
          change.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ')',
        values: [],
      }
    case 'dropPrimaryKey':
      return {
        text: prefix + 'drop constraint ' + quoteIdentifier(change.name),
        values: [],
      }
    case 'addUnique':
      return {
        text:
          prefix +
          'add constraint ' +
          quoteIdentifier(change.constraint.name) +
          ' unique (' +
          change.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ')',
        values: [],
      }
    case 'dropUnique':
      return {
        text: prefix + 'drop constraint ' + quoteIdentifier(change.name),
        values: [],
      }
    case 'addForeignKey':
      return {
        text: prefix + 'add ' + compileForeignKeyConstraint(change.constraint),
        values: [],
      }
    case 'dropForeignKey':
      return {
        text: prefix + 'drop constraint ' + quoteIdentifier(change.name),
        values: [],
      }
    case 'addCheck':
      return {
        text: prefix + 'add ' + compileCheckConstraint(change.constraint.name, change.constraint.expression),
        values: [],
      }
    case 'dropCheck':
      return {
        text: prefix + 'drop constraint ' + quoteIdentifier(change.name),
        values: [],
      }
    case 'setTableComment':
      return {
        text:
          'comment on table ' + quoteTableRef(table) + ' is ' + quoteLiteral(change.comment),
        values: [],
      }
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

function compilePostgresColumn(definition: ColumnDefinition): string {
  let parts = [compilePostgresColumnType(definition)]

  if (definition.nullable === false) {
    parts.push('not null')
  }

  if (definition.default) {
    if (definition.default.kind === 'now') {
      parts.push('default now()')
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
    if (!definition.computed.stored) {
      throw new Error('Postgres only supports stored computed/generated columns')
    }

    parts.push('generated always as (' + definition.computed.expression + ') stored')
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

function compilePostgresColumnType(definition: ColumnDefinition): string {
  if (definition.type === 'varchar') {
    return 'varchar(' + String(definition.length ?? 255) + ')'
  }

  if (definition.type === 'text') {
    return 'text'
  }

  if (definition.type === 'integer') {
    return 'integer'
  }

  if (definition.type === 'bigint') {
    return 'bigint'
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
    return 'uuid'
  }

  if (definition.type === 'date') {
    return 'date'
  }

  if (definition.type === 'time') {
    return definition.withTimezone ? 'time with time zone' : 'time without time zone'
  }

  if (definition.type === 'timestamp') {
    return definition.withTimezone ? 'timestamp with time zone' : 'timestamp without time zone'
  }

  if (definition.type === 'json') {
    return 'jsonb'
  }

  if (definition.type === 'binary') {
    return 'bytea'
  }

  if (definition.type === 'enum') {
    return 'text'
  }

  return 'text'
}

function quoteLiteral(value: unknown): string {
  if (value === null) {
    return 'null'
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value)
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  if (value instanceof Date) {
    return quoteLiteral(value.toISOString())
  }

  return "'" + String(value).replace(/'/g, "''") + "'"
}
