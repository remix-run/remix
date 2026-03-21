import type { SelectColumn } from '../adapter.ts'
import type { QueryColumnInput } from './types.ts'
import { normalizeColumnInput } from '../references.ts'

export function isSelectionMap(
  input: readonly unknown[],
): input is [Record<string, unknown>] {
  return (
    input.length === 1 &&
    typeof input[0] === 'object' &&
    input[0] !== null &&
    !Array.isArray(input[0])
  )
}

export function normalizeSelectionMap<columnTypes extends Record<string, unknown>>(
  selection: Record<string, QueryColumnInput<columnTypes>>,
): SelectColumn[] {
  let aliases = Object.keys(selection)

  return aliases.map((alias) => ({
    column: normalizeColumnInput(selection[alias]),
    alias,
  }))
}

export function normalizeSelectionColumns<row extends Record<string, unknown>>(
  columns: readonly (keyof row & string)[],
): SelectColumn[] {
  return columns.map((column) => ({
    column,
    alias: column,
  }))
}
