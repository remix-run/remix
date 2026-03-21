import { normalizeColumnInput } from '../references.ts'
import type { SelectColumn } from '../adapter.ts'
import type { QueryColumnInput } from './types.ts'

export function isSelectionMap<columnTypes extends Record<string, unknown>>(
  input: readonly unknown[],
): input is readonly [Record<string, QueryColumnInput<columnTypes>>] {
  return (
    input.length === 1 &&
    typeof input[0] === 'object' &&
    input[0] !== null &&
    !Array.isArray(input[0])
  )
}

export function normalizeSelection<
  row extends Record<string, unknown>,
  columnTypes extends Record<string, unknown>,
>(
  input: readonly [Record<string, QueryColumnInput<columnTypes>>],
): SelectColumn[]
export function normalizeSelection<
  row extends Record<string, unknown>,
  columnTypes extends Record<string, unknown>,
>(input: readonly (keyof row & string)[]): SelectColumn[]
export function normalizeSelection<
  row extends Record<string, unknown>,
  columnTypes extends Record<string, unknown>,
>(
  input: readonly [Record<string, QueryColumnInput<columnTypes>>] | readonly (keyof row & string)[],
): SelectColumn[]
export function normalizeSelection<
  row extends Record<string, unknown>,
  columnTypes extends Record<string, unknown>,
>(
  input: readonly [Record<string, QueryColumnInput<columnTypes>>] | readonly (keyof row & string)[],
): SelectColumn[] {
  if (isSelectionMap<columnTypes>(input)) {
    let selection = input[0]
    let aliases = Object.keys(selection)

    return aliases.map((alias) => ({
      column: normalizeColumnInput(selection[alias]),
      alias,
    }))
  }

  return input.map((column) => ({
    column,
    alias: column,
  }))
}
