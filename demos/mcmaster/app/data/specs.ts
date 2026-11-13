import * as s from 'remix/data-schema'

import type { Family, Part } from './schema.ts'

export const specColumnNames = ['spec_1', 'spec_2', 'spec_3', 'spec_4'] as const

export type SpecColumnName = (typeof specColumnNames)[number]

export interface SpecColumn {
  name: string
  /** The search param that filters by this spec, such as `thread-size`. */
  param: string
  column: SpecColumnName
}

export const soldAsSpecName = 'Sold As'

const stringList = s.array(s.string())

export function getSpecColumns(family: Pick<Family, 'spec_names'>): SpecColumn[] {
  let names = s.parse(stringList, JSON.parse(family.spec_names))
  if (names.length > specColumnNames.length) {
    throw new Error(`Families support at most ${specColumnNames.length} specs`)
  }

  return names.map((name, index) => ({
    name,
    param: toParam(name),
    column: specColumnNames[index],
  }))
}

export function getSpecValues(part: Pick<Part, SpecColumnName>, columns: SpecColumn[]): string[] {
  return columns.map((column) => part[column.column] ?? '')
}

export function formatSoldAs(packQuantity: number): string {
  return packQuantity === 1 ? 'Each' : `Pack of ${packQuantity}`
}

export function toParam(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
