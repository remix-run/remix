import type {Executor} from "edgedb";
import {
  Expression,
  ExpressionKind,
  ParamType,
  Cardinality,
  setToTsType,
  TypeSet,
  unwrapCastableType,
  TypeKind,
  BaseTypeToTsType,
} from "edgedb/dist/reflection";
import {$expressionify} from "./path";

export type $expr_OptionalParam<Type extends ParamType = ParamType> = {
  __kind__: ExpressionKind.OptionalParam;
  __type__: Type;
};

export function optional<Type extends ParamType>(
  type: Type
): $expr_OptionalParam<Type> {
  return {
    __kind__: ExpressionKind.OptionalParam,
    __type__: type,
  };
}

export type QueryableWithParamsExpression<
  Set extends TypeSet = TypeSet,
  Params extends {
    [key: string]: ParamType | $expr_OptionalParam;
  } = {}
> = Expression<Set, false> & {
  run(
    cxn: Executor,
    args: paramsToParamArgs<Params>
  ): Promise<setToTsType<Set>>;
  runJSON(cxn: Executor, args: paramsToParamArgs<Params>): Promise<string>;
};

export type $expr_WithParams<
  Params extends {
    [key: string]: ParamType | $expr_OptionalParam;
  } = {},
  Expr extends Expression = Expression
> = QueryableWithParamsExpression<
  {
    __kind__: ExpressionKind.WithParams;
    __element__: Expr["__element__"];
    __cardinality__: Expr["__cardinality__"];
    __expr__: Expr;
    __params__: $expr_Param[];
  },
  Params
>;

type paramsToParamArgs<
  Params extends {
    [key: string]: ParamType | $expr_OptionalParam;
  }
> = {
  [key in keyof Params as Params[key] extends ParamType
    ? key
    : never]: Params[key] extends ParamType
    ? BaseTypeToTsType<Params[key]>
    : never;
} & {
  [key in keyof Params as Params[key] extends $expr_OptionalParam
    ? key
    : never]?: Params[key] extends $expr_OptionalParam
    ? BaseTypeToTsType<Params[key]["__type__"]> | null
    : never;
};

export type $expr_Param<
  Name extends string | number | symbol = string,
  Type extends ParamType = ParamType,
  Optional extends boolean = boolean
> = Expression<{
  __kind__: ExpressionKind.Param;
  __element__: unwrapCastableType<Type>;
  __cardinality__: Optional extends true
    ? Cardinality.AtMostOne
    : Cardinality.One;
  __name__: Name;
  __isComplex__: boolean;
}>;

type paramsToParamExprs<
  Params extends {
    [key: string]: ParamType | $expr_OptionalParam;
  }
> = {
  [key in keyof Params]: Params[key] extends $expr_OptionalParam
    ? $expr_Param<key, Params[key]["__type__"], true>
    : Params[key] extends ParamType
    ? $expr_Param<key, Params[key], false>
    : never;
};

const complexParamKinds = new Set([TypeKind.tuple, TypeKind.namedtuple]);

export function params<
  Params extends {
    [key: string]: ParamType | $expr_OptionalParam;
  } = {},
  Expr extends Expression = Expression
>(
  paramsDef: Params,
  expr: (params: paramsToParamExprs<Params>) => Expr
): $expr_WithParams<Params, Expr> {
  const paramExprs: {[key: string]: $expr_Param} = {};
  for (const [key, param] of Object.entries(paramsDef)) {
    const paramType =
      param.__kind__ === ExpressionKind.OptionalParam ? param.__type__ : param;
    const isComplex =
      complexParamKinds.has(paramType.__kind__) ||
      (paramType.__kind__ === TypeKind.array &&
        complexParamKinds.has(paramType.__element__.__kind__));
    paramExprs[key] = $expressionify({
      __kind__: ExpressionKind.Param,
      __element__: paramType,
      __cardinality__:
        param.__kind__ === ExpressionKind.OptionalParam
          ? Cardinality.AtMostOne
          : Cardinality.One,
      __name__: key,
      __isComplex__: isComplex,
    }) as any;
  }

  const returnExpr = expr(paramExprs as any);

  return $expressionify({
    __kind__: ExpressionKind.WithParams,
    __element__: returnExpr.__element__,
    __cardinality__: returnExpr.__cardinality__,
    __expr__: returnExpr,
    __params__: Object.values(paramExprs),
  }) as any;
}
