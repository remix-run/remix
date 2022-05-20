import {
  Expression,
  BaseType,
  BaseTypeSet,
  Cardinality,
  ExpressionKind,
  cardinalityUtil,
} from "edgedb/dist/reflection";
import {$expressionify} from "./path";

export type $expr_For<
  IterSet extends BaseTypeSet = BaseTypeSet,
  Expr extends Expression = Expression
> = Expression<{
  __element__: Expr["__element__"];
  __cardinality__: cardinalityUtil.multiplyCardinalities<
    IterSet["__cardinality__"],
    Expr["__cardinality__"]
  >;
  __kind__: ExpressionKind.For;
  __iterSet__: IterSet;
  __forVar__: $expr_ForVar;
  __expr__: Expr;
}>;

export type $expr_ForVar<Type extends BaseType = BaseType> = Expression<{
  __element__: Type;
  __cardinality__: Cardinality.One;
  __kind__: ExpressionKind.ForVar;
}>;

function _for<IteratorSet extends BaseTypeSet, Expr extends Expression>(
  set: IteratorSet,
  expr: (variable: $expr_ForVar<IteratorSet["__element__"]>) => Expr
): $expr_For<IteratorSet, Expr> {
  const forVar = $expressionify({
    __kind__: ExpressionKind.ForVar,
    __element__: set.__element__,
    __cardinality__: Cardinality.One,
  }) as $expr_ForVar<IteratorSet["__element__"]>;

  const returnExpr = expr(forVar);

  return $expressionify({
    __kind__: ExpressionKind.For,
    __element__: returnExpr.__element__,
    __cardinality__: cardinalityUtil.multiplyCardinalities(
      set.__cardinality__,
      returnExpr.__cardinality__
    ),
    __iterSet__: set,
    __expr__: returnExpr,
    __forVar__: forVar,
  }) as any;
}

export {_for as for};
