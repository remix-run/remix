import type { QueryExecutionMode, QueryPlan } from './plan.ts'
import type { AnyQuerySource, QuerySourcePrimaryKey } from './types.ts'
import { cloneQueryState, type QueryState } from './state.ts'
import { cloneQueryPlan } from './plan.ts'

export type QuerySnapshot<
  source extends AnyQuerySource = AnyQuerySource,
  row extends Record<string, unknown> = Record<string, unknown>,
  mode extends QueryExecutionMode = QueryExecutionMode,
> = {
  table: source
  state: QueryState
  plan: QueryPlan<row, QuerySourcePrimaryKey<source>, mode>
}

export function createQuerySnapshot<
  source extends AnyQuerySource,
  row extends Record<string, unknown>,
  mode extends QueryExecutionMode,
>(
  table: source,
  state: QueryState,
  plan: QueryPlan<row, QuerySourcePrimaryKey<source>, mode>,
): QuerySnapshot<source, row, mode> {
  return {
    table,
    state: cloneQueryState(state),
    plan: cloneQueryPlan(plan),
  }
}
