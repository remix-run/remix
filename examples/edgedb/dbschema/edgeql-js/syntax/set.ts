import type {
  ArrayType,
  BaseTypeTuple,
  BaseType,
  NamedTupleType,
  ObjectTypeSet,
  TypeSet,
  TupleType,
  Expression,
  ExpressionKind,
  mergeObjectTypes,
  ObjectType,
  Cardinality,
  getPrimitiveBaseType,
  SomeType,
} from "edgedb/dist/reflection";
import {TypeKind, $mergeObjectTypes} from "edgedb/dist/reflection";

// "@generated/" path gets replaced during generation step
// @ts-ignore
import * as castMaps from "../castMaps";

export function getSharedParent(a: SomeType, b: SomeType): SomeType {
  if (a.__kind__ !== b.__kind__) {
    throw new Error(
      `Incompatible array types: ${a.__name__} and ${b.__name__}`
    );
  }
  if (a.__kind__ === TypeKind.scalar && b.__kind__ === TypeKind.scalar) {
    return castMaps.getSharedParentScalar(a, b);
  } else if (
    a.__kind__ === TypeKind.object &&
    b.__kind__ === TypeKind.object
  ) {
    return $mergeObjectTypes(a, b);
  } else if (a.__kind__ === TypeKind.tuple && b.__kind__ === TypeKind.tuple) {
    if (a.__items__.length !== b.__items__.length) {
      throw new Error(
        `Incompatible tuple types: ${a.__name__} and ${b.__name__}`
      );
    }
    try {
      const items = a.__items__.map((_, i) => {
        if (!a.__items__[i] || !b.__items__[i]) {
          throw new Error();
        }
        return getSharedParent(
          a.__items__[i] as SomeType,
          b.__items__[i] as SomeType
        );
      });

      return {
        __kind__: TypeKind.tuple,
        __name__: `tuple<${items.map(item => item.__name__).join(", ")}>`,
        __items__: items as BaseTypeTuple,
      };
    } catch (err) {
      throw new Error(
        `Incompatible tuple types: ${a.__name__} and ${b.__name__}`
      );
    }
  } else if (
    a.__kind__ === TypeKind.namedtuple &&
    b.__kind__ === TypeKind.namedtuple
  ) {
    const aKeys = Object.keys(a);
    const bKeys = new Set(Object.keys(b));
    const sameKeys =
      aKeys.length === bKeys.size && aKeys.every(k => bKeys.has(k));
    if (!sameKeys) {
      throw new Error(
        `Incompatible tuple types: ${a.__name__} and ${b.__name__}`
      );
    }
    try {
      const items: {[k: string]: BaseType} = {};
      for (const [i] of Object.entries(a.__shape__)) {
        if (!a.__shape__[i] || !b.__shape__[i]) {
          throw new Error();
        }
        items[i] = getSharedParent(
          a.__shape__[i] as SomeType,
          b.__shape__[i] as SomeType
        );
      }

      return {
        __kind__: TypeKind.namedtuple,
        __name__: `tuple<${Object.entries(items)
          .map(([key, val]: [string, any]) => `${key}: ${val.__name__}`)
          .join(", ")}>`,
        __shape__: items,
      };
    } catch (err) {
      throw new Error(
        `Incompatible tuple types: ${a.__name__} and ${b.__name__}`
      );
    }
  } else if (a.__kind__ === TypeKind.array && b.__kind__ === TypeKind.array) {
    try {
      const mergedEl: any = getSharedParent(a.__element__, b.__element__);
      return {
        __kind__: TypeKind.array,
        __name__: a.__name__,
        __element__: mergedEl,
      } as ArrayType;
    } catch (err) {
      throw new Error(
        `Incompatible array types: ${a.__name__} and ${b.__name__}`
      );
    }
  } else if (a.__kind__ === TypeKind.enum && b.__kind__ === TypeKind.enum) {
    if (a.__name__ === b.__name__) return a;
    throw new Error(
      `Incompatible array types: ${a.__name__} and ${b.__name__}`
    );
  } else {
    throw new Error(
      `Incompatible array types: ${a.__name__} and ${b.__name__}`
    );
  }
}

// @ts-ignore
export {set} from "./setImpl";

export type $expr_Set<Set extends LooseTypeSet = LooseTypeSet> = Expression<{
  __element__: Set["__element__"];
  __cardinality__: Set["__cardinality__"];
  __exprs__: Expression<Set>[];
  __kind__: ExpressionKind.Set;
}>;

type mergeTypeTuples<AItems, BItems> = {
  [k in keyof AItems]: k extends keyof BItems
    ? getSharedParentPrimitive<AItems[k], BItems[k]>
    : never;
};

// find shared parent of two primitives
export type getSharedParentPrimitive<A, B> = A extends undefined
  ? B extends undefined
    ? undefined
    : B
  : B extends undefined
  ? A
  : A extends ArrayType<infer AEl>
  ? B extends ArrayType<infer BEl>
    ? ArrayType<castMaps.getSharedParentScalar<AEl, BEl>>
    : never
  : A extends NamedTupleType<infer AShape>
  ? B extends NamedTupleType<infer BShape>
    ? NamedTupleType<{
        [k in keyof AShape & keyof BShape]: castMaps.getSharedParentScalar<
          AShape[k],
          BShape[k]
        >;
      }>
    : never
  : A extends TupleType<infer AItems>
  ? B extends TupleType<infer BItems>
    ? mergeTypeTuples<AItems, BItems> extends BaseTypeTuple
      ? TupleType<mergeTypeTuples<AItems, BItems>>
      : never
    : never
  : castMaps.getSharedParentScalar<A, B>;

type _getSharedParentPrimitiveVariadic<Types extends [any, ...any[]]> =
  Types extends [infer U]
    ? U
    : Types extends [infer A, infer B, ...infer Rest]
    ? _getSharedParentPrimitiveVariadic<
        [getSharedParentPrimitive<A, B>, ...Rest]
      >
    : never;

export type getSharedParentPrimitiveVariadic<Types extends [any, ...any[]]> =
  _getSharedParentPrimitiveVariadic<Types>;

export type LooseTypeSet<
  T extends any = any,
  C extends Cardinality = Cardinality
> = {
  __element__: T;
  __cardinality__: C;
};

export type {mergeObjectTypes};

type _mergeObjectTypesVariadic<Types extends [ObjectType, ...ObjectType[]]> =
  Types extends [infer U]
    ? U
    : Types extends [infer A, infer B, ...infer Rest]
    ? A extends ObjectType
      ? B extends ObjectType
        ? mergeObjectTypes<A, B> extends BaseType
          ? mergeObjectTypesVariadic<[mergeObjectTypes<A, B>, ...Rest]>
          : never
        : never
      : never
    : never;

export type mergeObjectTypesVariadic<Types extends [any, ...any[]]> =
  _mergeObjectTypesVariadic<Types>;

export type getTypesFromExprs<Exprs extends [TypeSet, ...TypeSet[]]> = {
  [k in keyof Exprs]: Exprs[k] extends TypeSet<infer El, any>
    ? getPrimitiveBaseType<El>
    : never;
};

export type getTypesFromObjectExprs<
  Exprs extends [ObjectTypeSet, ...ObjectTypeSet[]]
> = {
  [k in keyof Exprs]: Exprs[k] extends TypeSet<infer El, any> ? El : never;
};

export type getCardsFromExprs<Exprs extends [TypeSet, ...TypeSet[]]> = {
  [k in keyof Exprs]: Exprs[k] extends TypeSet<any, infer Card> ? Card : never;
};
