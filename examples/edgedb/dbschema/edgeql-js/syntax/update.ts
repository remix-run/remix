import {
  Expression,
  ExpressionKind,
  ObjectTypePointers,
  TypeSet,
  ObjectTypeSet,
  stripBacklinks,
  stripNonUpdateables,
  typeutil,
  ObjectTypeExpression,
  $scopify,
  Cardinality,
} from "edgedb/dist/reflection";
import type {pointerToAssignmentExpression} from "./casting";
import {$expressionify, $getScopedExpr} from "./path";
import {
  SelectModifiers,
  NormalisedSelectModifiers,
  ComputeSelectCardinality,
  $existingScopes,
  $handleModifiers,
} from "./select";
import {$normaliseInsertShape, pointerIsOptional} from "./insert";

/////////////////
/// UPDATE
/////////////////

export type $expr_Update<
  Set extends TypeSet = TypeSet,
  Expr extends ObjectTypeSet = ObjectTypeSet,
  Shape extends UpdateShape<Expr> = any
> = Expression<{
  __kind__: ExpressionKind.Update;
  __element__: Set["__element__"];
  __cardinality__: Set["__cardinality__"];
  __expr__: Expr;
  __shape__: Shape;
  __modifiers__: NormalisedSelectModifiers;
  __scope__: ObjectTypeExpression;
}>;

export type UpdateShape<Root extends ObjectTypeSet> = typeutil.stripNever<
  stripNonUpdateables<stripBacklinks<Root["__element__"]["__pointers__"]>>
> extends infer Shape
  ? Shape extends ObjectTypePointers
    ? {
        [k in keyof Shape]?:
          | (
              | pointerToAssignmentExpression<Shape[k]>
              | (Shape[k]["cardinality"] extends
                  | Cardinality.Many
                  | Cardinality.AtLeastOne
                  ?
                      | {"+=": pointerToAssignmentExpression<Shape[k], true>}
                      | {"-=": pointerToAssignmentExpression<Shape[k], true>}
                  : never)
            )
          | (pointerIsOptional<Shape[k]> extends true
              ? undefined | null
              : never);
      }
    : never
  : never;

export function update<
  Expr extends ObjectTypeExpression,
  Shape extends {
    filter?: SelectModifiers["filter"];
    order_by?: SelectModifiers["order_by"];
    limit?: SelectModifiers["limit"];
    offset?: SelectModifiers["offset"];
    set: UpdateShape<Expr>;
  }
  // SetShape extends UpdateShape<Expr>,
  // Modifiers extends Pick<SelectModifiers, "filter">
>(
  expr: Expr,
  shape: (scope: $scopify<Expr["__element__"]>) => Readonly<Shape>
): $expr_Update<
  {
    __element__: Expr["__element__"];
    __cardinality__: ComputeSelectCardinality<Expr, Shape>;
  },
  Expr,
  Shape["set"]
> {
  const cleanScopedExprs = $existingScopes.size === 0;

  const scope = $getScopedExpr(expr as any, $existingScopes);

  const resolvedShape = shape(scope);

  if (cleanScopedExprs) {
    $existingScopes.clear();
  }

  const mods: any = {};
  let updateShape: any | null;
  for (const [key, val] of Object.entries(resolvedShape)) {
    if (key === "filter") {
      mods[key] = val;
    } else if (key === "set") {
      updateShape = val;
    } else {
      throw new Error(
        `Invalid update shape key '${key}', only 'filter', ` +
          `and 'set' are allowed`
      );
    }
  }

  if (!updateShape) {
    throw new Error(`Update shape must contain 'set' shape`);
  }

  const {modifiers, cardinality} = $handleModifiers(mods, expr);

  return $expressionify({
    __kind__: ExpressionKind.Update,
    __element__: expr.__element__,
    __cardinality__: cardinality,
    __expr__: expr,
    __shape__: $normaliseInsertShape(expr, updateShape, true),
    __modifiers__: modifiers,
    __scope__: scope,
  }) as any;
}
