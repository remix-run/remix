import { rawSql, sql, type Database, type SqlStatement } from 'remix/data-table'
import * as s from 'remix/data-schema'

import type { Family, Presentation } from '../../data/schema.ts'
import { toParam, type SpecColumn, type SpecColumnName } from '../../data/specs.ts'

export interface FilterOption {
  value: string
  label: string
  /** Parts that match this option and every other active filter. */
  count: number
  selected: boolean
}

export interface Filter {
  name: string
  param: string
  options: FilterOption[]
}

export interface FamilySelection {
  presentationId: number | null
  specs: Partial<Record<SpecColumnName, string>>
}

export interface FamilyFilters {
  filters: Filter[]
  selection: FamilySelection
  /** Parts in each presentation that match the active spec filters. */
  matchCounts: Map<number, number>
}

const facetRows = s.array(s.object({ value: s.string(), count: s.number() }))
const presentationFacetRows = s.array(s.object({ value: s.number(), count: s.number() }))

/**
 * Builds the filter sidebar for a family page from the selection in the URL, like
 * `?material=brass&length=1"`.
 *
 * Each filter's counts reflect every other active filter, so visitors can see how many parts remain
 * before they click. Counts come from grouped SQL queries served by an index, so the work grows with
 * the number of filters, not the number of parts.
 */
export async function loadFamilyFilters(
  db: Database,
  family: Family,
  familyPresentations: Presentation[],
  columns: SpecColumn[],
  searchParams: URLSearchParams,
): Promise<FamilyFilters> {
  let presentationParam = toParam(family.presentation_label)
  let selectedSlug = searchParams.get(presentationParam)
  let selection: FamilySelection = {
    presentationId:
      familyPresentations.find((presentation) => presentation.slug === selectedSlug)?.id ?? null,
    specs: Object.fromEntries(
      columns.flatMap((column) => {
        let value = searchParams.get(column.param)
        return value == null ? [] : [[column.column, value]]
      }),
    ),
  }

  let specOptions = await loadSpecOptions(db, family.id, columns, selection)

  // Values the family does not offer would match nothing, so drop them and count again.
  let validSpecs = Object.fromEntries(
    Object.entries(selection.specs).filter(([column, value]) =>
      specOptions.get(column as SpecColumnName)?.some((option) => option.value === value),
    ),
  )
  if (Object.keys(validSpecs).length !== Object.keys(selection.specs).length) {
    selection = { ...selection, specs: validSpecs }
    specOptions = await loadSpecOptions(db, family.id, columns, selection)
  }

  let matchCounts = await loadPresentationCounts(db, family.id, selection)

  return {
    selection,
    matchCounts,
    filters: [
      {
        name: family.presentation_label,
        param: presentationParam,
        options: familyPresentations.map((presentation) => ({
          value: presentation.slug,
          label: presentation.name,
          count: matchCounts.get(presentation.id) ?? 0,
          selected: presentation.id === selection.presentationId,
        })),
      },
      ...columns.map((column) => ({
        name: column.name,
        param: column.param,
        options: (specOptions.get(column.column) ?? []).map((option) => ({
          value: option.value,
          label: option.value,
          count: option.count,
          selected: option.value === selection.specs[column.column],
        })),
      })),
    ],
  }
}

async function loadSpecOptions(
  db: Database,
  familyId: number,
  columns: SpecColumn[],
  selection: FamilySelection,
): Promise<Map<SpecColumnName, Array<{ value: string; count: number }>>> {
  let entries = await Promise.all(
    columns.map(async (column) => {
      let columnSql = rawSql(column.column)
      // Every value the family offers is listed, in catalog order, even when no part matches.
      let result = await db.exec(sql`
        select ${columnSql} as value, sum(case when ${matchSql(selection, column.column)} then 1 else 0 end) as count
        from parts
        where family_id = ${familyId}
        group by ${columnSql}
        order by min(id)
      `)
      return [column.column, s.parse(facetRows, result.rows ?? [])] as const
    }),
  )

  return new Map(entries)
}

async function loadPresentationCounts(
  db: Database,
  familyId: number,
  selection: FamilySelection,
): Promise<Map<number, number>> {
  let result = await db.exec(sql`
    select presentation_id as value, sum(case when ${matchSql(selection, 'presentation')} then 1 else 0 end) as count
    from parts
    where family_id = ${familyId}
    group by presentation_id
  `)
  let rows = s.parse(presentationFacetRows, result.rows ?? [])

  return new Map(rows.map((row) => [row.value, row.count]))
}

/** A SQL condition for the selection, leaving out one filter so its own options can be counted. */
function matchSql(
  selection: FamilySelection,
  ignored: SpecColumnName | 'presentation',
): SqlStatement {
  let conditions: SqlStatement[] = []

  if (ignored !== 'presentation' && selection.presentationId != null) {
    conditions.push(sql`presentation_id = ${selection.presentationId}`)
  }
  for (let [column, value] of Object.entries(selection.specs)) {
    if (column !== ignored) conditions.push(sql`${rawSql(column)} = ${value}`)
  }

  return conditions.reduce((combined, condition) => sql`${combined} and ${condition}`, sql`1 = 1`)
}

export function getFilterHref(url: URL, param: string, value: string | null): string {
  let searchParams = new URLSearchParams(url.searchParams)

  if (value == null) searchParams.delete(param)
  else searchParams.set(param, value)

  let search = searchParams.toString()
  return search === '' ? url.pathname : `${url.pathname}?${search}`
}
