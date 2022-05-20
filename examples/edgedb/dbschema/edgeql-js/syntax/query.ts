import type * as edgedb from "edgedb";
import {Cardinality, ExpressionKind} from "edgedb/dist/reflection";
import {jsonifyComplexParams} from "./json";
import {select} from "./select";

const runnableExpressionKinds = new Set([
  ExpressionKind.Select,
  ExpressionKind.Update,
  ExpressionKind.Insert,
  ExpressionKind.InsertUnlessConflict,
  ExpressionKind.Delete,
  ExpressionKind.For,
  ExpressionKind.With,
  ExpressionKind.WithParams,
]);

const wrappedExprCache = new WeakMap();

export async function $queryFunc(this: any, cxn: edgedb.Executor, args: any) {
  const expr = runnableExpressionKinds.has(this.__kind__)
    ? this
    : wrappedExprCache.get(this) ??
      wrappedExprCache.set(this, select(this)).get(this);
  const _args = jsonifyComplexParams(expr, args);

  if (
    expr.__cardinality__ === Cardinality.One ||
    expr.__cardinality__ === Cardinality.AtMostOne
  ) {
    return cxn.querySingle(expr.toEdgeQL(), _args);
  } else {
    return cxn.query(expr.toEdgeQL(), _args);
  }
}

export async function $queryFuncJSON(
  this: any,
  cxn: edgedb.Executor,
  args: any
) {
  const expr = runnableExpressionKinds.has(this.__kind__)
    ? this
    : wrappedExprCache.get(this) ??
      wrappedExprCache.set(this, select(this)).get(this);
  const _args = jsonifyComplexParams(expr, args);

  if (
    expr.__cardinality__ === Cardinality.One ||
    expr.__cardinality__ === Cardinality.AtMostOne
  ) {
    return cxn.querySingleJSON(expr.toEdgeQL(), _args);
  } else {
    return cxn.queryJSON(expr.toEdgeQL(), _args);
  }
}
