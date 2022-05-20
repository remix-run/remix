import {
  LocalDateTime,
  LocalDate,
  LocalTime,
  Duration,
  RelativeDuration,
  ConfigMemory,
} from "edgedb";
import type {$bool, $number} from "../modules/std";
import {
  $expr_PolyShapeElement,
  $scopify,
  Cardinality,
  cardinalityUtil,
  Expression,
  ExpressionKind,
  LinkDesc,
  makeType,
  ObjectType,
  ObjectTypeExpression,
  ObjectTypePointers,
  ObjectTypeSet,
  PrimitiveTypeSet,
  PropertyDesc,
  ScalarType,
  stripSet,
  TypeKind,
  TypeSet,
  typeutil,
  BaseType,
} from "edgedb/dist/reflection";

import type {
  $expr_PathLeaf,
  $expr_PathNode,
  ExpressionRoot,
  PathParent,
} from "edgedb/dist/reflection/path";
import type {anonymizeObject} from "./casting";
import type {$expr_Operator} from "edgedb/dist/reflection/funcops";
import {$expressionify, $getScopedExpr} from "./path";
import {$getTypeByName, literal} from "./literal";
import {spec} from "../__spec__";
import {
  scalarLiterals,
  literalToScalarType,
  literalToTypeSet,
} from "../castMaps";

export const ASC: "ASC" = "ASC";
export const DESC: "DESC" = "DESC";
export const EMPTY_FIRST: "EMPTY FIRST" = "EMPTY FIRST";
export const EMPTY_LAST: "EMPTY LAST" = "EMPTY LAST";
export type OrderByDirection = "ASC" | "DESC";
export type OrderByEmpty = "EMPTY FIRST" | "EMPTY LAST";

export type OrderByExpr = TypeSet<ScalarType | ObjectType, Cardinality>;
export type OrderByObjExpr = {
  expression: OrderByExpr;
  direction?: OrderByDirection;
  empty?: OrderByEmpty;
};

export type OrderByExpression =
  | OrderByExpr
  | OrderByObjExpr
  | [OrderByExpr | OrderByObjExpr, ...(OrderByExpr | OrderByObjExpr)[]];

export type OffsetExpression = TypeSet<
  $number,
  Cardinality.Empty | Cardinality.One | Cardinality.AtMostOne
>;

export type SelectFilterExpression = TypeSet<$bool, Cardinality>;
export type LimitOffsetExpression = TypeSet<
  $number,
  Cardinality.Empty | Cardinality.One | Cardinality.AtMostOne
>;
export type LimitExpression = TypeSet<
  $number,
  Cardinality.Empty | Cardinality.One | Cardinality.AtMostOne
>;

export type SelectModifierNames = "filter" | "order_by" | "offset" | "limit";

export type SelectModifiers = {
  filter?: SelectFilterExpression;
  order_by?: OrderByExpression;
  offset?: OffsetExpression | number;
  limit?: LimitExpression | number;
};

export type NormalisedSelectModifiers = {
  filter?: SelectFilterExpression;
  order_by?: OrderByObjExpr[];
  offset?: OffsetExpression;
  limit?: LimitExpression;
};

// type NormaliseOrderByModifier<Mods extends OrderByExpression> =
//   Mods extends OrderByExpr
//     ? [{expression: Mods}]
//     : Mods extends OrderByObjExpr
//     ? [Mods]
//     : Mods extends (OrderByExpr | OrderByObjExpr)[]
//     ? {
//         [K in keyof Mods]: Mods[K] extends OrderByExpr
//           ? {expression: Mods[K]}
//           : Mods[K];
//       }
//     : [];

// type NormaliseSelectModifiers<Mods extends SelectModifiers> = {
//   filter: Mods["filter"];
//   order_by: Mods["order_by"] extends OrderByExpression
//     ? NormaliseOrderByModifier<Mods["order_by"]>
//     : [];
//   offset: Mods["offset"] extends number
//     ? $expr_Literal<ScalarType<"std::int64", number, Mods["offset"]>>
//     : Mods["offset"];
//   limit: Mods["offset"] extends number
//     ? $expr_Literal<ScalarType<"std::int64", number, Mods["offset"]>>
//     : Mods["offset"];
// };

export type $expr_Select<Set extends TypeSet = TypeSet> = Expression<{
  __element__: Set["__element__"];
  __cardinality__: Set["__cardinality__"];
  __expr__: TypeSet;
  __kind__: ExpressionKind.Select;
  __modifiers__: NormalisedSelectModifiers;
  __scope__?: ObjectTypeExpression;
}>;
// Modifier methods removed for now, until we can fix typescript inference
// problems / excessively deep errors
// & SelectModifierMethods<stripSet<Set>>;

export interface SelectModifierMethods<Root extends TypeSet> {
  filter<Filter extends SelectFilterExpression>(
    filter:
      | Filter
      | ((
          scope: Root extends ObjectTypeSet
            ? $scopify<Root["__element__"]>
            : stripSet<Root>
        ) => Filter)
  ): this;
  order_by(
    order_by:
      | OrderByExpression
      | ((
          scope: Root extends ObjectTypeSet
            ? $scopify<Root["__element__"]>
            : stripSet<Root>
        ) => OrderByExpression)
  ): this;
  offset(
    offset:
      | OffsetExpression
      | number
      | ((
          scope: Root extends ObjectTypeSet
            ? $scopify<Root["__element__"]>
            : stripSet<Root>
        ) => OffsetExpression | number)
  ): this;
  // $expr_Select<{
  //   __element__: Root["__element__"];
  //   __cardinality__: cardinalityUtil.overrideLowerBound<
  //     Root["__cardinality__"],
  //     "Zero"
  //   >;
  // }>;
  limit(
    limit:
      | LimitExpression
      | number
      | ((
          scope: Root extends ObjectTypeSet
            ? $scopify<Root["__element__"]>
            : stripSet<Root>
        ) => LimitExpression | number)
  ): this;
  // $expr_Select<{
  //   __element__: Root["__element__"];
  //   __cardinality__: cardinalityUtil.overrideLowerBound<
  //     Root["__cardinality__"],
  //     "Zero"
  //   >;
  // }>;
}
// Base is ObjectTypeSet &
// Filter is equality &
// Filter.args[0] is PathLeaf
//   Filter.args[0] is __exclusive__ &
//   Filter.args[0].parent.__element__ === Base.__element__
//   Filter.args[1].__cardinality__ is AtMostOne or One
// if Filter.args[0] is PathNode:
//   Filter.args[0] is __exclusive__ &
//   if Filter.args[0].parent === null
//     Filter.args[0].parent.__element__ === Base.__element__
//     Filter.args[1].__cardinality__ is AtMostOne or One
//   else
//     Filter.args[0].type.__element__ === Base.__element__ &
//     Filter.args[1].__cardinality__ is AtMostOne or One

type argCardToResultCard<
  OpCard extends Cardinality,
  BaseCase extends Cardinality
> = [OpCard] extends [Cardinality.AtMostOne | Cardinality.One]
  ? Cardinality.AtMostOne
  : [OpCard] extends [Cardinality.Empty]
  ? Cardinality.Empty
  : BaseCase;

export type InferFilterCardinality<
  Base extends TypeSet,
  Filter extends TypeSet | undefined
> = Filter extends TypeSet
  ? // Base is ObjectTypeExpression &
    Base extends ObjectTypeSet // $expr_PathNode
    ? // Filter is equality
      Filter extends $expr_Operator<"=", any, infer Args, any>
      ? // Filter.args[0] is PathLeaf
        Args[0] extends $expr_PathLeaf
        ? // Filter.args[0] is unique
          Args[0]["__exclusive__"] extends true
          ? //   Filter.args[0].parent.__element__ === Base.__element__
            typeutil.assertEqual<
              Args[0]["__parent__"]["type"]["__element__"]["__name__"],
              Base["__element__"]["__name__"]
            > extends true
            ? // Filter.args[1].__cardinality__ is AtMostOne or One
              argCardToResultCard<
                Args[1]["__cardinality__"],
                Base["__cardinality__"]
              >
            : Base["__cardinality__"]
          : Base["__cardinality__"]
        : Args[0] extends $expr_PathNode
        ? Args[0]["__exclusive__"] extends true
          ? //   Filter.args[0].parent.__element__ === Base.__element__
            Args[0]["__parent__"] extends null
            ? typeutil.assertEqual<
                Args[0]["__element__"]["__name__"],
                Base["__element__"]["__name__"]
              > extends true
              ? // Filter.args[1].__cardinality__ is AtMostOne or One
                argCardToResultCard<
                  Args[1]["__cardinality__"],
                  Base["__cardinality__"]
                >
              : Base["__cardinality__"]
            : Args[0]["__parent__"] extends infer Parent
            ? Parent extends PathParent
              ? typeutil.assertEqual<
                  Parent["type"]["__element__"]["__name__"],
                  Base["__element__"]["__name__"]
                > extends true
                ? // Filter.args[1].__cardinality__ is AtMostOne or One
                  argCardToResultCard<
                    Args[1]["__cardinality__"],
                    Base["__cardinality__"]
                  >
                : Base["__cardinality__"]
              : Base["__cardinality__"]
            : Base["__cardinality__"]
          : Base["__cardinality__"]
        : Base["__cardinality__"]
      : Base["__cardinality__"]
    : Base["__cardinality__"]
  : Base["__cardinality__"];

export type InferOffsetLimitCardinality<
  Card extends Cardinality,
  Modifers extends SelectModifiers
> = Modifers["limit"] extends number | LimitExpression
  ? cardinalityUtil.overrideLowerBound<Card, "Zero">
  : Modifers["offset"] extends number | OffsetExpression
  ? cardinalityUtil.overrideLowerBound<Card, "Zero">
  : Card;

export type ComputeSelectCardinality<
  Expr extends ObjectTypeExpression,
  Modifiers extends SelectModifiers
> = InferOffsetLimitCardinality<
  InferFilterCardinality<Expr, Modifiers["filter"]>,
  Modifiers
>;

export function is<
  Expr extends ObjectTypeExpression,
  Shape extends pointersToSelectShape<Expr["__element__"]["__pointers__"]>
>(
  expr: Expr,
  shape: Shape
): {
  [k in Exclude<keyof Shape, SelectModifierNames>]: $expr_PolyShapeElement<
    Expr,
    normaliseElement<Shape[k]>
  >;
} {
  const mappedShape: any = {};
  for (const [key, value] of Object.entries(shape)) {
    mappedShape[key] = {
      __kind__: ExpressionKind.PolyShapeElement,
      __polyType__: expr,
      __shapeElement__: value,
    };
  }
  return mappedShape;
}

function computeFilterCardinality(
  expr: SelectFilterExpression,
  cardinality: Cardinality,
  base: TypeSet
) {
  let card = cardinality;

  const filter: any = expr;
  // Base is ObjectExpression
  const baseIsObjectExpr = base?.__element__?.__kind__ === TypeKind.object;
  const filterExprIsEq =
    filter.__kind__ === ExpressionKind.Operator && filter.__name__ === "=";
  const arg0: $expr_PathLeaf | $expr_PathNode = filter?.__args__?.[0];
  const arg1: TypeSet = filter?.__args__?.[1];
  const argsExist = !!arg0 && !!arg1 && !!arg1.__cardinality__;
  const arg0IsUnique = arg0?.__exclusive__ === true;

  if (baseIsObjectExpr && filterExprIsEq && argsExist && arg0IsUnique) {
    const newCard =
      arg1.__cardinality__ === Cardinality.One ||
      arg1.__cardinality__ === Cardinality.AtMostOne
        ? Cardinality.AtMostOne
        : arg1.__cardinality__ === Cardinality.Empty
        ? Cardinality.Empty
        : cardinality;

    if (arg0.__kind__ === ExpressionKind.PathLeaf) {
      const arg0ParentMatchesBase =
        arg0.__parent__.type.__element__.__name__ ===
        base.__element__.__name__;
      if (arg0ParentMatchesBase) {
        card = newCard;
      }
    } else if (arg0.__kind__ === ExpressionKind.PathNode) {
      // if Filter.args[0] is PathNode:
      //   Filter.args[0] is __exclusive__ &
      //   if Filter.args[0].parent === null
      //     Filter.args[0].__element__ === Base.__element__
      //     Filter.args[1].__cardinality__ is AtMostOne or One
      //   else
      //     Filter.args[0].type.__element__ === Base.__element__ &
      //     Filter.args[1].__cardinality__ is AtMostOne or One
      const parent = arg0.__parent__;
      if (parent === null) {
        const arg0MatchesBase =
          arg0.__element__.__name__ === base.__element__.__name__;
        if (arg0MatchesBase) {
          card = newCard;
        }
      } else {
        const arg0ParentMatchesBase =
          parent?.type.__element__.__name__ === base.__element__.__name__;
        if (arg0ParentMatchesBase) {
          card = newCard;
        }
      }
    }
  }

  return card;
}

export function $handleModifiers(
  modifiers: SelectModifiers,
  rootExpr: TypeSet
): {modifiers: NormalisedSelectModifiers; cardinality: Cardinality} {
  const mods = {...modifiers};
  let card = rootExpr.__cardinality__;

  if (mods.filter && rootExpr.__element__.__kind__ === TypeKind.object) {
    card = computeFilterCardinality(mods.filter, card, rootExpr);
  }
  if (mods.order_by) {
    const orderExprs = Array.isArray(mods.order_by)
      ? mods.order_by
      : [mods.order_by];
    mods.order_by = orderExprs.map(expr =>
      typeof (expr as any).__element__ === "undefined"
        ? expr
        : {expression: expr}
    ) as any;
  }
  if (mods.offset) {
    mods.offset =
      typeof mods.offset === "number"
        ? ($getTypeByName("std::number")(mods.offset) as any)
        : mods.offset;
    card = cardinalityUtil.overrideLowerBound(card, "Zero");
  }
  if (mods.limit) {
    let expr = mods.limit;
    if (typeof expr === "number") {
      expr = $getTypeByName("std::number")(expr) as any;
    } else if ((expr as any).__kind__ === ExpressionKind.Set) {
      expr = (expr as any).__exprs__[0];
    }
    mods.limit = expr;
    card = cardinalityUtil.overrideLowerBound(card, "Zero");
  }

  return {modifiers: mods as NormalisedSelectModifiers, cardinality: card};
}

export type $expr_Delete<Root extends ObjectTypeSet = ObjectTypeSet> =
  Expression<{
    __kind__: ExpressionKind.Delete;
    __element__: Root["__element__"];
    __cardinality__: Root["__cardinality__"];
    __expr__: Root;
  }>;

function deleteExpr<
  Expr extends ObjectTypeExpression,
  Modifiers extends SelectModifiers
>(
  expr: Expr,
  modifiers?: (scope: $scopify<Expr["__element__"]>) => Readonly<Modifiers>
): $expr_Delete<{
  __element__: ObjectType<
    Expr["__element__"]["__name__"],
    Expr["__element__"]["__pointers__"],
    {id: true}
  >;
  __cardinality__: ComputeSelectCardinality<Expr, Modifiers>;
}>;
function deleteExpr(expr: any, modifiersGetter: any) {
  const selectExpr = select(expr, modifiersGetter);

  return $expressionify({
    __kind__: ExpressionKind.Delete,
    __element__: selectExpr.__element__,
    __cardinality__: selectExpr.__cardinality__,
    __expr__: selectExpr,
  }) as any;
}

export {deleteExpr as delete};

// Modifier methods removed for now, until we can fix typescript inference
// problems / excessively deep errors

// function resolveModifierGetter(parent: any, modGetter: any) {
//   if (typeof modGetter === "function" && !modGetter.__kind__) {
//     if (parent.__expr__.__element__.__kind__ === TypeKind.object) {
//       const shape = parent.__element__.__shape__;
//       const _scope =
//         parent.__scope__ ?? $getScopedExpr(parent.__expr__,
//           $existingScopes);
//       const scope = new Proxy(_scope, {
//         get(target: any, prop: string) {
//           if (shape[prop] && shape[prop] !== true) {
//             return shape[prop];
//           }
//           return target[prop];
//         },
//       });
//       return {
//         scope: _scope,
//         modExpr: modGetter(scope),
//       };
//     } else {
//       return {
//         scope: undefined,
//         modExpr: modGetter(parent.__expr__),
//       };
//     }
//   } else {
//     return {scope: parent.__scope__, modExpr: modGetter};
//   }
// }

// function updateModifier(
//   parent: any,
//   modName: "filter" | "order_by" | "offset" | "limit",
//   modGetter: any
// ) {
//   const modifiers = {
//     ...parent.__modifiers__,
//   };
//   const cardinality = parent.__cardinality__;

//   const {modExpr, scope} = resolveModifierGetter(parent, modGetter);

//   switch (modName) {
//     case "filter":
//       modifiers.filter = modifiers.filter
//         ? op(modifiers.filter, "and", modExpr)
//         : modExpr;

//       // methods no longer change cardinality
//       // cardinality = computeFilterCardinality(
//       //   modExpr,
//       //   cardinality,
//       //   parent.__expr__
//       // );
//       break;
//     case "order_by":
//       const ordering =
//         typeof (modExpr as any).__element__ === "undefined"
//           ? modExpr
//           : {expression: modExpr};
//       modifiers.order_by = modifiers.order_by
//         ? [...modifiers.order_by, ordering]
//         : [ordering];
//       break;
//     case "offset":
//       modifiers.offset =
//         typeof modExpr === "number" ? _std.number(modExpr) : modExpr;
//       // methods no longer change cardinality
//       // cardinality = cardinalityUtil
//            .overrideLowerBound(cardinality, "Zero");
//       break;
//     case "limit":
//       modifiers.limit =
//         typeof modExpr === "number"
//           ? _std.number(modExpr)
//           : (modExpr as any).__kind__ === ExpressionKind.Set
//           ? (modExpr as any).__exprs__[0]
//           : modExpr;
//       // methods no longer change cardinality
//       // cardinality = cardinalityUtil
//            .overrideLowerBound(cardinality, "Zero");
//       break;
//   }

//   return $expressionify(
//     $selectify({
//       __kind__: ExpressionKind.Select,
//       __element__: parent.__element__,
//       __cardinality__: cardinality,
//       __expr__: parent.__expr__,
//       __modifiers__: modifiers,
//       __scope__: scope,
//     })
//   );
// }

export function $selectify<Expr extends ExpressionRoot>(expr: Expr) {
  // Object.assign(expr, {
  //   filter: (filter: any) => updateModifier(expr, "filter", filter),
  //   order_by: (order_by: any) => updateModifier(expr, "order_by", order_by),
  //   offset: (offset: any) => updateModifier(expr, "offset", offset),
  //   limit: (limit: any) => updateModifier(expr, "limit", limit),
  // });
  return expr;
}

export type linkDescToLinkProps<Desc extends LinkDesc> = {
  [k in keyof Desc["properties"] & string]: $expr_PathLeaf<
    TypeSet<
      Desc["properties"][k]["target"],
      Desc["properties"][k]["cardinality"]
    >,
    {type: $scopify<Desc["target"]>; linkName: k},
    Desc["properties"][k]["exclusive"]
  >;
};

export type pointersToSelectShape<
  Shape extends ObjectTypePointers = ObjectTypePointers
> = Partial<{
  [k in keyof Shape]: Shape[k] extends PropertyDesc
    ?
        | boolean
        | TypeSet<
            // causes excessively deep error:
            // castableFrom<Shape[k]["target"]>
            Shape[k]["target"],
            cardinalityUtil.assignable<Shape[k]["cardinality"]>
          >
    : // | pointerToCastableExpression<Shape[k]>
    Shape[k] extends LinkDesc
    ?
        | boolean
        // | pointerToCastableExpression<Shape[k]>
        | TypeSet<
            anonymizeObject<Shape[k]["target"]>,
            cardinalityUtil.assignable<Shape[k]["cardinality"]>
          >
        | (pointersToSelectShape<Shape[k]["target"]["__pointers__"]> &
            pointersToSelectShape<Shape[k]["properties"]> &
            SelectModifiers)
        | ((
            scope: $scopify<Shape[k]["target"]> & linkDescToLinkProps<Shape[k]>
          ) => pointersToSelectShape<Shape[k]["target"]["__pointers__"]> &
            pointersToSelectShape<Shape[k]["properties"]> &
            SelectModifiers)
    : any;
}> & {[k: string]: unknown};

export type normaliseElement<El> = El extends boolean
  ? El
  : El extends TypeSet
  ? stripSet<El>
  : El extends (...scope: any[]) => any
  ? normaliseShape<ReturnType<El>>
  : El extends object
  ? normaliseShape<stripSet<El>>
  : stripSet<El>;

export type normaliseShape<Shape extends object> = {
  [k in Exclude<keyof Shape, SelectModifierNames>]: normaliseElement<Shape[k]>;
};

const $FreeObject = makeType(
  spec,
  [...spec.values()].find(s => s.name === "std::FreeObject")!.id,
  literal
);
const FreeObject = {
  __kind__: ExpressionKind.PathNode,
  __element__: $FreeObject,
  __cardinality__: Cardinality.One,
  __parent__: null,
  __exclusive__: true,
  __scopeRoot__: null,
};

export const $existingScopes = new Set<
  Expression<TypeSet<BaseType, Cardinality>>
>();

export function select<Expr extends ObjectTypeExpression>(
  expr: Expr
): $expr_Select<{
  __element__: ObjectType<
    `${Expr["__element__"]["__name__"]}`, // _shape
    Expr["__element__"]["__pointers__"],
    Expr["__element__"]["__shape__"] // {id: true}
  >;
  __cardinality__: Expr["__cardinality__"];
}>;
export function select<Expr extends TypeSet>(
  expr: Expr
): $expr_Select<stripSet<Expr>>;
export function select<
  Expr extends ObjectTypeExpression,
  Shape extends pointersToSelectShape<Expr["__element__"]["__pointers__"]> &
    SelectModifiers,
  Modifiers = Pick<Shape, SelectModifierNames>
>(
  expr: Expr,
  shape: (scope: $scopify<Expr["__element__"]>) => Readonly<Shape>
): $expr_Select<{
  __element__: ObjectType<
    `${Expr["__element__"]["__name__"]}`, // _shape
    Expr["__element__"]["__pointers__"],
    Omit<normaliseShape<Shape>, SelectModifierNames>
  >;
  __cardinality__: ComputeSelectCardinality<Expr, Modifiers>;
}>;
/*

For the moment is isn't possible to implement both closure-based and plain
object overloads without breaking autocomplete on one or the other.
This is due to a limitation in TS:

https://github.com/microsoft/TypeScript/issues/26892
https://github.com/microsoft/TypeScript/issues/47081

*/
export function select<
  Expr extends PrimitiveTypeSet,
  Modifiers extends SelectModifiers
>(
  expr: Expr,
  modifiers: (expr: Expr) => Readonly<Modifiers>
): $expr_Select<{
  __element__: Expr["__element__"];
  __cardinality__: InferOffsetLimitCardinality<
    Expr["__cardinality__"],
    Modifiers
  >;
}>;
export function select<Shape extends {[key: string]: TypeSet}>(
  shape: Shape
): $expr_Select<{
  __element__: ObjectType<`std::FreeObject`, {}, Shape>; // _shape
  __cardinality__: Cardinality.One;
}>;
export function select<Expr extends scalarLiterals>(
  expr: Expr
): $expr_Select<{
  __element__: literalToScalarType<Expr>;
  __cardinality__: Cardinality.One;
}>;
export function select(...args: any[]) {
  const firstArg = args[0];

  if (
    typeof firstArg !== "object" ||
    firstArg instanceof Buffer ||
    firstArg instanceof Date ||
    firstArg instanceof Duration ||
    firstArg instanceof LocalDateTime ||
    firstArg instanceof LocalDate ||
    firstArg instanceof LocalTime ||
    firstArg instanceof RelativeDuration ||
    firstArg instanceof ConfigMemory
  ) {
    const literalExpr = literalToTypeSet(firstArg);
    return $expressionify(
      $selectify({
        __kind__: ExpressionKind.Select,
        __element__: literalExpr.__element__,
        __cardinality__: literalExpr.__cardinality__,
        __expr__: literalExpr,
        __modifiers__: {},
      })
    ) as any;
  }

  const [expr, shapeGetter]: [TypeSet, (scope: any) => any] =
    typeof args[0].__element__ !== "undefined"
      ? (args as any)
      : [FreeObject, () => args[0]];

  if (!shapeGetter) {
    if (expr.__element__.__kind__ === TypeKind.object) {
      const objectExpr: ObjectTypeSet = expr as any;
      return $expressionify(
        $selectify({
          __kind__: ExpressionKind.Select,
          __element__: {
            __kind__: TypeKind.object,
            __name__: `${objectExpr.__element__.__name__}`, // _shape
            __pointers__: objectExpr.__element__.__pointers__,
            __shape__: objectExpr.__element__.__shape__,
          } as any,
          __cardinality__: objectExpr.__cardinality__,
          __expr__: objectExpr,
          __modifiers__: {},
        })
      ) as any;
    } else {
      return $expressionify(
        $selectify({
          __kind__: ExpressionKind.Select,
          __element__: expr.__element__,
          __cardinality__: expr.__cardinality__,
          __expr__: expr,
          __modifiers__: {},
        })
      ) as any;
    }
  }

  const cleanScopedExprs = $existingScopes.size === 0;

  const {modifiers: mods, shape, scope} = resolveShape(shapeGetter, expr);

  if (cleanScopedExprs) {
    $existingScopes.clear();
  }

  const {modifiers, cardinality} = $handleModifiers(mods, expr);
  return $expressionify(
    $selectify({
      __kind__: ExpressionKind.Select,
      __element__:
        expr !== scope
          ? {
              __kind__: TypeKind.object,
              __name__: `${expr.__element__.__name__}`, // _shape
              __pointers__: (expr.__element__ as ObjectType).__pointers__,
              __shape__: shape,
            }
          : expr.__element__,
      __cardinality__: cardinality,
      __expr__: expr,
      __modifiers__: modifiers,
      __scope__:
        expr !== scope && expr.__element__.__name__ !== "std::FreeObject"
          ? scope
          : undefined,
    })
  ) as any;
}

function resolveShape(
  shapeGetter: ((scope: any) => any) | any,
  expr: TypeSet
): {modifiers: any; shape: any; scope: TypeSet} {
  const modifiers: any = {};
  const shape: any = {};

  const scope =
    expr.__element__.__kind__ === TypeKind.object
      ? $getScopedExpr(expr as any, $existingScopes)
      : expr;

  const selectShape =
    typeof shapeGetter === "function" ? shapeGetter(scope) : shapeGetter;

  for (const [key, value] of Object.entries(selectShape)) {
    if (
      key === "filter" ||
      key === "order_by" ||
      key === "offset" ||
      key === "limit"
    ) {
      modifiers[key] = value;
    } else {
      if (scope === expr) {
        throw new Error(
          `Invalid select shape key '${key}' on scalar expression, ` +
            `only modifiers are allowed (filter, order_by, offset and limit)`
        );
      }
      shape[key] = resolveShapeElement(key, value, scope);
    }
  }
  return {shape, modifiers, scope};
}

function resolveShapeElement(
  key: any,
  value: any,
  scope: ObjectTypeExpression
): any {
  if (
    (typeof value === "function" &&
      scope.__element__.__pointers__[key]?.__kind__ === "link") ||
    (typeof value === "object" &&
      typeof (value as any).__kind__ === "undefined")
  ) {
    const childExpr = (scope as any)[key];
    const {
      shape: childShape,
      scope: childScope,
      modifiers: mods,
    } = resolveShape(value as any, childExpr);

    const {modifiers} = $handleModifiers(mods, childExpr);

    return {
      __kind__: ExpressionKind.Select,
      __element__: {
        __kind__: TypeKind.object,
        __name__: `${childExpr.__element__.__name__}`,
        __pointers__: childExpr.__element__.__pointers__,
        __shape__: childShape,
      },
      __cardinality__: scope.__element__.__pointers__[key].cardinality,
      __expr__: childExpr,
      __modifiers__: modifiers,
      __scope__: childScope,
    };
  } else if ((value as any)?.__kind__ === ExpressionKind.PolyShapeElement) {
    const polyElement = value as $expr_PolyShapeElement;
    const polyScope = (scope as any).is(polyElement.__polyType__);
    return {
      __kind__: ExpressionKind.PolyShapeElement,
      __polyType__: polyScope,
      __shapeElement__: resolveShapeElement(
        key,
        polyElement.__shapeElement__,
        polyScope
      ),
    };
  } else if (typeof value === "boolean" && key.startsWith("@")) {
    const linkProp = (scope as any)[key];
    if (!linkProp) {
      throw new Error(
        (scope as any).__parent__
          ? `link property '${key}' does not exist on link ${
              (scope as any).__parent__.linkName
            }`
          : `cannot select link property '${key}' on an object (${scope.__element__.__name__})`
      );
    }
    return value ? linkProp : false;
  } else {
    return value;
  }
}
