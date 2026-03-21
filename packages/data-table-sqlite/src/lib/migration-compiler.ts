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
  if (operation.kind === 'raw') {
    return [{ text: operation.sql.text, values: [...operation.sql.values] }]
  }

  if (operation.kind === 'createTable') {
    let columns = Object.keys(operation.columns).map(
      (columnName) =>
        quoteIdentifier(columnName) + ' ' + compileSqliteColumn(operation.columns[columnName]),
    )
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
          ' ' +
          'unique (' +
          unique.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ')',
      )
    }

    for (let check of operation.checks ?? []) {
      constraints.push(
        'constraint ' + quoteIdentifier(check.name) + ' ' + 'check (' + check.expression + ')',
      )
    }

    for (let foreignKey of operation.foreignKeys ?? []) {
      constraints.push(compileForeignKeyConstraint(foreignKey))
    }

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

  if (operation.kind === 'alterTable') {
    let statements: SqlStatement[] = []

    for (let change of operation.changes) {
      let sql = 'alter table ' + quoteTableRef(operation.table) + ' '

      if (change.kind === 'addColumn') {
        sql +=
          'add column ' +
          quoteIdentifier(change.column) +
          ' ' +
          compileSqliteColumn(change.definition)
      } else if (change.kind === 'changeColumn') {
        sql +=
          'alter column ' +
          quoteIdentifier(change.column) +
          ' type ' +
          compileSqliteColumnType(change.definition)
      } else if (change.kind === 'renameColumn') {
        sql += 'rename column ' + quoteIdentifier(change.from) + ' to ' + quoteIdentifier(change.to)
      } else if (change.kind === 'dropColumn') {
        sql += 'drop column ' + quoteIdentifier(change.column)
      } else if (change.kind === 'addPrimaryKey') {
        sql +=
          'add primary key (' +
          change.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ')'
      } else if (change.kind === 'dropPrimaryKey') {
        sql += 'drop primary key'
      } else if (change.kind === 'addUnique') {
        sql +=
          'add ' +
          'constraint ' +
          quoteIdentifier(change.constraint.name) +
          ' ' +
          'unique (' +
          change.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ')'
      } else if (change.kind === 'dropUnique') {
        sql += 'drop constraint ' + quoteIdentifier(change.name)
      } else if (change.kind === 'addForeignKey') {
        sql +=
          'add ' +
          'constraint ' +
          quoteIdentifier(change.constraint.name) +
          ' ' +
          'foreign key (' +
          change.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ') references ' +
          quoteTableRef(change.constraint.references.table) +
          ' (' +
          change.constraint.references.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ')'
      } else if (change.kind === 'dropForeignKey') {
        sql += 'drop constraint ' + quoteIdentifier(change.name)
      } else if (change.kind === 'addCheck') {
        sql +=
          'add ' +
          'constraint ' +
          quoteIdentifier(change.constraint.name) +
          ' ' +
          'check (' +
          change.constraint.expression +
          ')'
      } else if (change.kind === 'dropCheck') {
        sql += 'drop constraint ' + quoteIdentifier(change.name)
      } else if (change.kind === 'setTableComment') {
        continue
      } else {
        continue
      }

      statements.push({ text: sql, values: [] })
    }

    return statements
  }

  if (operation.kind === 'renameTable') {
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
  }

  if (operation.kind === 'dropTable') {
    return [
      {
        text:
          'drop table ' + (operation.ifExists ? 'if exists ' : '') + quoteTableRef(operation.table),
        values: [],
      },
    ]
  }

  if (operation.kind === 'createIndex') {
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
  }

  if (operation.kind === 'dropIndex') {
    return [
      {
        text:
          'drop index ' +
          (operation.ifExists ? 'if exists ' : '') +
          quoteIdentifier(operation.name),
        values: [],
      },
    ]
  }

  if (operation.kind === 'renameIndex') {
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
  }

  if (operation.kind === 'addForeignKey') {
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
  }

  if (operation.kind === 'dropForeignKey') {
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

  if (operation.kind === 'addCheck') {
    return [
      {
        text:
          'alter table ' +
          quoteTableRef(operation.table) +
          ' add ' +
          'constraint ' +
          quoteIdentifier(operation.constraint.name) +
          ' ' +
          'check (' +
          operation.constraint.expression +
          ')',
        values: [],
      },
    ]
  }

  if (operation.kind === 'dropCheck') {
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
