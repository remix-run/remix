import {ExpressionKind, ParamType, TypeKind} from "edgedb/dist/reflection";
import type {$expr_WithParams} from "./params";

function jsonStringify(type: ParamType, val: any): string {
  if (type.__kind__ === TypeKind.array) {
    if (Array.isArray(val)) {
      return `[${val
        .map(item => jsonStringify(type.__element__, item))
        .join()}]`;
    }
    throw new Error(`Param with array type is not an array`);
  }
  if (type.__kind__ === TypeKind.tuple) {
    if (!Array.isArray(val)) {
      throw new Error(`Param with tuple type is not an array`);
    }
    if (val.length !== type.__items__.length) {
      throw new Error(
        `Param with tuple type has incorrect number of items. Got ${val.length} expected ${type.__items__.length}`
      );
    }
    return `[${val
      .map((item, i) => jsonStringify(type.__items__[i], item))
      .join()}]`;
  }
  if (type.__kind__ === TypeKind.namedtuple) {
    if (typeof val !== "object") {
      throw new Error(`Param with named tuple type is not an object`);
    }
    if (Object.keys(val).length !== Object.keys(type.__shape__).length) {
      throw new Error(
        `Param with named tuple type has incorrect number of items. Got ${
          Object.keys(val).length
        } expected ${Object.keys(type.__shape__).length}`
      );
    }
    return `{${Object.entries(val)
      .map(([key, item]) => {
        if (!type.__shape__[key]) {
          throw new Error(
            `Unexpected key in named tuple param: ${key}, expected keys: ${Object.keys(
              type.__shape__
            ).join()}`
          );
        }
        return `"${key}": ${jsonStringify(type.__shape__[key], item)}`;
      })
      .join()}}`;
  }
  if (
    type.__kind__ === TypeKind.scalar
    // || type.__kind__ === TypeKind.castonlyscalar
  ) {
    switch (type.__name__) {
      case "std::bigint":
        return val.toString();
      case "std::json":
        return val;
      case "std::bytes":
        return `"${val.toString("base64")}"`;
      case "cfg::memory":
        return `"${val.toString()}"`;
      default:
        return JSON.stringify(val);
    }
  }
  throw new Error(`Invalid param type: ${(type as any).__kind__}`);
}

export function jsonifyComplexParams(expr: any, _args: any) {
  if (_args && expr.__kind__ === ExpressionKind.WithParams) {
    const args = {..._args};
    for (const param of (expr as $expr_WithParams).__params__) {
      if (param.__isComplex__) {
        args[param.__name__] = jsonStringify(
          param.__element__ as any,
          args[param.__name__]
        );
      }
    }

    return args;
  }
  return _args;
}
