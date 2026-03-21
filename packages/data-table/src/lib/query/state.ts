import type { JoinClause, SelectColumn } from '../adapter.ts'
import type { Predicate } from '../operators.ts'
import type { AnyRelation } from '../table-relations.ts'
import type { OrderByClause } from '../table.ts'

export type QueryState = {
  select: '*' | SelectColumn[]
  distinct: boolean
  joins: JoinClause[]
  where: Predicate<string>[]
  groupBy: string[]
  having: Predicate<string>[]
  orderBy: OrderByClause[]
  limit?: number
  offset?: number
  with: Record<string, AnyRelation>
}

export type QueryStatePatch = Partial<QueryState>

export function createInitialQueryState(): QueryState {
  return {
    select: '*',
    distinct: false,
    joins: [],
    where: [],
    groupBy: [],
    having: [],
    orderBy: [],
    with: {},
  }
}

export function cloneSelection(selection: '*' | SelectColumn[]): '*' | SelectColumn[] {
  if (selection === '*') {
    return '*'
  }

  return selection.map((column) => ({ ...column }))
}

export function cloneQueryState(state: QueryState): QueryState {
  return {
    select: cloneSelection(state.select),
    distinct: state.distinct,
    joins: [...state.joins],
    where: [...state.where],
    groupBy: [...state.groupBy],
    having: [...state.having],
    orderBy: [...state.orderBy],
    limit: state.limit,
    offset: state.offset,
    with: { ...state.with },
  }
}

export function mergeQueryState(state: QueryState, patch: QueryStatePatch): QueryState {
  return {
    select: patch.select ?? cloneSelection(state.select),
    distinct: patch.distinct ?? state.distinct,
    joins: patch.joins ? [...patch.joins] : [...state.joins],
    where: patch.where ? [...patch.where] : [...state.where],
    groupBy: patch.groupBy ? [...patch.groupBy] : [...state.groupBy],
    having: patch.having ? [...patch.having] : [...state.having],
    orderBy: patch.orderBy ? [...patch.orderBy] : [...state.orderBy],
    limit: patch.limit === undefined ? state.limit : patch.limit,
    offset: patch.offset === undefined ? state.offset : patch.offset,
    with: patch.with ? { ...patch.with } : { ...state.with },
  }
}
