import type { TableRef } from '../adapter.ts'
import type { IndexColumns, KeyColumns } from '../migrations.ts'

export function toTableRef(name: string): TableRef {
  let segments = name.split('.')

  if (segments.length === 1) {
    return { name }
  }

  return {
    schema: segments[0],
    name: segments.slice(1).join('.'),
  }
}

export function normalizeIndexColumns(columns: IndexColumns): string[] {
  return normalizeKeyColumns(columns)
}

export function normalizeKeyColumns(columns: KeyColumns): string[] {
  if (Array.isArray(columns)) {
    return [...columns]
  }

  return [columns]
}

function normalizeNamePart(value: string): string {
  let normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (normalized.length === 0) {
    return 'item'
  }

  return normalized
}

function tableNamePart(table: TableRef): string {
  if (table.schema) {
    return normalizeNamePart(table.schema + '_' + table.name)
  }

  return normalizeNamePart(table.name)
}

function hashString(value: string): number {
  let hash = 5381

  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index)
  }

  return hash >>> 0
}

function withNameLimit(name: string): string {
  let limit = 63

  if (name.length <= limit) {
    return name
  }

  let suffix = hashString(name).toString(36).padStart(8, '0').slice(0, 8)
  return name.slice(0, limit - 9) + '_' + suffix
}

function columnsNamePart(columns: string[]): string {
  return columns.map((column) => normalizeNamePart(column)).join('_')
}

export function createPrimaryKeyName(table: TableRef): string {
  return withNameLimit(tableNamePart(table) + '_pk')
}

export function createUniqueName(table: TableRef, columns: string[]): string {
  return withNameLimit(tableNamePart(table) + '_' + columnsNamePart(columns) + '_uq')
}

export function createForeignKeyName(
  table: TableRef,
  columns: string[],
  references: TableRef,
  referenceColumns: string[],
): string {
  let base =
    tableNamePart(table) +
    '_' +
    columnsNamePart(columns) +
    '_' +
    tableNamePart(references) +
    '_' +
    columnsNamePart(referenceColumns) +
    '_fk'
  return withNameLimit(base)
}

export function createCheckName(table: TableRef, expression: string): string {
  let suffix = hashString(expression).toString(36)
  return withNameLimit(tableNamePart(table) + '_chk_' + suffix)
}

export function createIndexName(table: TableRef, columns: string[]): string {
  return withNameLimit(tableNamePart(table) + '_' + columnsNamePart(columns) + '_idx')
}
