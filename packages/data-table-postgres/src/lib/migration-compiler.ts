import type {
  ColumnDefinition,
  DataMigrationOperation,
  SqlStatement,
} from '@remix-run/data-table/adapter'

import { quoteIdentifier, quoteTableRef } from './sql-compiler-helpers.ts'

export function compilePostgresMigrationOperations(
  operation: DataMigrationOperation,
): SqlStatement[] {
  if (operation.kind === 'raw') {
    return [{ text: operation.sql.text, values: [...operation.sql.values] }]
  }

  if (operation.kind === 'createTable') {
    let columns = Object.keys(operation.columns).map(
      (columnName) =>
        quoteIdentifier(columnName) + ' ' + compilePostgresColumn(operation.columns[columnName]),
    )
    let tableConstraints: string[] = []

    if (operation.primaryKey) {
      tableConstraints.push(
        'constraint ' +
          quoteIdentifier(operation.primaryKey.name) +
          ' primary key (' +
          operation.primaryKey.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ')',
      )
    }

    for (let unique of operation.uniques ?? []) {
      tableConstraints.push(
        'constraint ' +
          quoteIdentifier(unique.name) +
          ' ' +
          'unique (' +
          unique.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ')',
      )
    }

    for (let check of operation.checks ?? []) {
      tableConstraints.push(
        'constraint ' + quoteIdentifier(check.name) + ' ' + 'check (' + check.expression + ')',
      )
    }

    for (let foreignKey of operation.foreignKeys ?? []) {
      let clause =
        'constraint ' +
        quoteIdentifier(foreignKey.name) +
        ' ' +
        'foreign key (' +
        foreignKey.columns.map((column) => quoteIdentifier(column)).join(', ') +
        ') references ' +
        quoteTableRef(foreignKey.references.table) +
        ' (' +
        foreignKey.references.columns.map((column) => quoteIdentifier(column)).join(', ') +
        ')'

      if (foreignKey.onDelete) {
        clause += ' on delete ' + foreignKey.onDelete
      }

      if (foreignKey.onUpdate) {
        clause += ' on update ' + foreignKey.onUpdate
      }

      tableConstraints.push(clause)
    }

    let sql =
      'create table ' +
      (operation.ifNotExists ? 'if not exists ' : '') +
      quoteTableRef(operation.table) +
      ' (' +
      [...columns, ...tableConstraints].join(', ') +
      ')'
    let statements: SqlStatement[] = [{ text: sql, values: [] }]

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

  if (operation.kind === 'alterTable') {
    let sqlStatements: SqlStatement[] = []

    for (let change of operation.changes) {
      let sql = 'alter table ' + quoteTableRef(operation.table) + ' '

      if (change.kind === 'addColumn') {
        sql +=
          'add column ' +
          quoteIdentifier(change.column) +
          ' ' +
          compilePostgresColumn(change.definition)
      } else if (change.kind === 'changeColumn') {
        let typeSql = compilePostgresColumnType(change.definition)
        sql += 'alter column ' + quoteIdentifier(change.column) + ' type ' + typeSql
      } else if (change.kind === 'renameColumn') {
        sql += 'rename column ' + quoteIdentifier(change.from) + ' to ' + quoteIdentifier(change.to)
      } else if (change.kind === 'dropColumn') {
        sql +=
          'drop column ' + (change.ifExists ? 'if exists ' : '') + quoteIdentifier(change.column)
      } else if (change.kind === 'addPrimaryKey') {
        sql +=
          'add ' +
          'constraint ' +
          quoteIdentifier(change.constraint.name) +
          ' ' +
          'primary key (' +
          change.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ')'
      } else if (change.kind === 'dropPrimaryKey') {
        sql += 'drop constraint ' + quoteIdentifier(change.name)
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
        sqlStatements.push({
          text:
            'comment on table ' +
            quoteTableRef(operation.table) +
            ' is ' +
            quoteLiteral(change.comment),
          values: [],
        })
        continue
      } else {
        continue
      }

      sqlStatements.push({ text: sql, values: [] })
    }

    return sqlStatements
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
          'drop table ' +
          (operation.ifExists ? 'if exists ' : '') +
          quoteTableRef(operation.table) +
          (operation.cascade ? ' cascade' : ''),
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
          (operation.index.using ? ' using ' + operation.index.using : '') +
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
          'alter index ' +
          quoteIdentifier(operation.from) +
          ' rename to ' +
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
          'constraint ' +
          quoteIdentifier(operation.constraint.name) +
          ' ' +
          'foreign key (' +
          operation.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ') references ' +
          quoteTableRef(operation.constraint.references.table) +
          ' (' +
          operation.constraint.references.columns
            .map((column) => quoteIdentifier(column))
            .join(', ') +
          ')' +
          (operation.constraint.onDelete ? ' on delete ' + operation.constraint.onDelete : '') +
          (operation.constraint.onUpdate ? ' on update ' + operation.constraint.onUpdate : ''),
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
