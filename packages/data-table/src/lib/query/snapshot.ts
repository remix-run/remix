import type { QueryTableInput } from '../database.ts'
import { cloneQueryPlan, type QueryExecutionMode, type QueryPlan } from './plan.ts'
import { cloneQueryState, type QueryState } from './state.ts'

type AnyQuerySource = QueryTableInput<string, Record<string, unknown>, readonly string[]>

type QuerySourcePrimaryKey<source extends AnyQuerySource> =
  source extends QueryTableInput<any, any, infer primaryKey extends readonly string[]>
    ? primaryKey
    : never

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
    plan: cloneQueryPlan(plan) as QueryPlan<row, QuerySourcePrimaryKey<source>, mode>,
  }
}
