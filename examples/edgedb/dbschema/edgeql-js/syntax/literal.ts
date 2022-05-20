import {
  Cardinality,
  ExpressionKind,
  BaseType,
  BaseTypeToTsType,
  unwrapCastableType,
  makeType,
  ScalarType,
} from "edgedb/dist/reflection";
import type {$expr_Literal} from "edgedb/dist/reflection/literal";
import {$expressionify} from "./path";
import {spec} from "../__spec__";

export function literal<T extends BaseType>(
  type: T,
  value: BaseTypeToTsType<unwrapCastableType<T>>
): $expr_Literal<unwrapCastableType<T>> {
  return $expressionify({
    __element__: type,
    __cardinality__: Cardinality.One,
    __kind__: ExpressionKind.Literal,
    __value__: value,
  }) as any;
}

const nameMapping = new Map<string, string>([
  ...([...spec.values()].map(type => [type.name, type.id]) as any),
  ["std::number", "00000000-0000-0000-0000-0000000001ff"],
]);

export function $getType(id: string): (val: any) => $expr_Literal<ScalarType> {
  return makeType(spec, id, literal) as any;
}

export function $getTypeByName(
  name: string
): (val: any) => $expr_Literal<ScalarType> {
  return makeType(spec, nameMapping.get(name)!, literal) as any;
}
