import * as edgedb from "edgedb";
import type { $ } from "edgedb";
import * as literal from "./syntax/literal";
import type * as _std from "./modules/std";
import type * as _sys from "./modules/sys";
import type * as _schema from "./modules/schema";
import type * as _cfg from "./modules/cfg";
import type * as _cal from "./modules/cal";
export type scalarAssignableBy<T extends $.ScalarType> =
  T extends _std.$number ? _std.$number : 
  T extends _sys.$VersionStage ? _sys.$VersionStage : 
  T extends _sys.$TransactionIsolation ? _sys.$TransactionIsolation : 
  T extends _std.$uuid ? _std.$uuid : 
  T extends _std.$str ? _std.$str : 
  T extends _std.$json ? _std.$json : 
  T extends _std.$int64 ? _std.$int64 : 
  T extends _std.$int32 ? _std.$int32 : 
  T extends _std.$int16 ? _std.$int16 : 
  T extends _std.$float64 ? _std.$float64 : 
  T extends _std.$float32 ? _std.$float32 : 
  T extends _std.$duration ? _std.$duration : 
  T extends _std.$decimal ? _std.$decimalλIAssignableBy : 
  T extends _std.$datetime ? _std.$datetime : 
  T extends _std.$bytes ? _std.$bytes : 
  T extends _std.$bool ? _std.$bool : 
  T extends _std.$bigint ? _std.$bigint : 
  T extends _schema.$Volatility ? _schema.$Volatility : 
  T extends _schema.$TypeModifier ? _schema.$TypeModifier : 
  T extends _schema.$TargetDeleteAction ? _schema.$TargetDeleteAction : 
  T extends _schema.$ParameterKind ? _schema.$ParameterKind : 
  T extends _schema.$OperatorKind ? _schema.$OperatorKind : 
  T extends _schema.$Cardinality ? _schema.$Cardinality : 
  T extends _cfg.$memory ? _cfg.$memory : 
  T extends _cfg.$AllowBareDDL ? _cfg.$AllowBareDDL : 
  T extends _cal.$relative_duration ? _cal.$relative_duration : 
  T extends _cal.$local_time ? _cal.$local_time : 
  T extends _cal.$local_datetime ? _cal.$local_datetime : 
  T extends _cal.$local_date ? _cal.$local_date : 
  never

export type scalarCastableFrom<T extends $.ScalarType> =
  T extends _std.$number ? _std.$number : 
  T extends _sys.$VersionStage ? _sys.$VersionStage : 
  T extends _sys.$TransactionIsolation ? _sys.$TransactionIsolation : 
  T extends _std.$uuid ? _std.$uuid : 
  T extends _std.$str ? _std.$str : 
  T extends _std.$json ? _std.$json : 
  T extends _std.$int64 ? _std.$int64 : 
  T extends _std.$int32 ? _std.$int32 : 
  T extends _std.$int16 ? _std.$int16 : 
  T extends _std.$float64 ? _std.$float64 : 
  T extends _std.$float32 ? _std.$float32 : 
  T extends _std.$duration ? _std.$duration : 
  T extends _std.$decimal ? _std.$decimalλICastableTo : 
  T extends _std.$datetime ? _std.$datetime : 
  T extends _std.$bytes ? _std.$bytes : 
  T extends _std.$bool ? _std.$bool : 
  T extends _std.$bigint ? _std.$bigint : 
  T extends _schema.$Volatility ? _schema.$Volatility : 
  T extends _schema.$TypeModifier ? _schema.$TypeModifier : 
  T extends _schema.$TargetDeleteAction ? _schema.$TargetDeleteAction : 
  T extends _schema.$ParameterKind ? _schema.$ParameterKind : 
  T extends _schema.$OperatorKind ? _schema.$OperatorKind : 
  T extends _schema.$Cardinality ? _schema.$Cardinality : 
  T extends _cfg.$memory ? _cfg.$memory : 
  T extends _cfg.$AllowBareDDL ? _cfg.$AllowBareDDL : 
  T extends _cal.$relative_duration ? _cal.$relative_duration : 
  T extends _cal.$local_time ? _cal.$local_time : 
  T extends _cal.$local_datetime ? _cal.$local_datetime : 
  T extends _cal.$local_date ? _cal.$local_date : 
  never

type getSharedParentScalar<A, B> =
  A extends _std.$number ?
    B extends _std.$number ?
    B
    :
    never
  :
  A extends _sys.$VersionStage ?
    B extends _sys.$VersionStage ?
    B
    :
    never
  :
  A extends _sys.$TransactionIsolation ?
    B extends _sys.$TransactionIsolation ?
    B
    :
    never
  :
  A extends _std.$uuid ?
    B extends _std.$uuid ?
    B
    :
    never
  :
  A extends _std.$str ?
    B extends _std.$str ?
    B
    :
    never
  :
  A extends _std.$json ?
    B extends _std.$json ?
    B
    :
    never
  :
  A extends _std.$int64 ?
    B extends _std.$int64 ?
    B
    :
    never
  :
  A extends _std.$int32 ?
    B extends _std.$int32 ?
    B
    :
    never
  :
  A extends _std.$int16 ?
    B extends _std.$int16 ?
    B
    :
    never
  :
  A extends _std.$float64 ?
    B extends _std.$float64 ?
    B
    :
    never
  :
  A extends _std.$float32 ?
    B extends _std.$float32 ?
    B
    :
    never
  :
  A extends _std.$duration ?
    B extends _std.$duration ?
    B
    :
    never
  :
  A extends _std.$decimal ?
    B extends _std.$decimal ?
    B
    :
    B extends _std.$bigint ?
    A
    :
    never
  :
  A extends _std.$datetime ?
    B extends _std.$datetime ?
    B
    :
    never
  :
  A extends _std.$bytes ?
    B extends _std.$bytes ?
    B
    :
    never
  :
  A extends _std.$bool ?
    B extends _std.$bool ?
    B
    :
    never
  :
  A extends _std.$bigint ?
    B extends _std.$decimal ?
    B
    :
    B extends _std.$bigint ?
    B
    :
    never
  :
  A extends _schema.$Volatility ?
    B extends _schema.$Volatility ?
    B
    :
    never
  :
  A extends _schema.$TypeModifier ?
    B extends _schema.$TypeModifier ?
    B
    :
    never
  :
  A extends _schema.$TargetDeleteAction ?
    B extends _schema.$TargetDeleteAction ?
    B
    :
    never
  :
  A extends _schema.$ParameterKind ?
    B extends _schema.$ParameterKind ?
    B
    :
    never
  :
  A extends _schema.$OperatorKind ?
    B extends _schema.$OperatorKind ?
    B
    :
    never
  :
  A extends _schema.$Cardinality ?
    B extends _schema.$Cardinality ?
    B
    :
    never
  :
  A extends _cfg.$memory ?
    B extends _cfg.$memory ?
    B
    :
    never
  :
  A extends _cfg.$AllowBareDDL ?
    B extends _cfg.$AllowBareDDL ?
    B
    :
    never
  :
  A extends _cal.$relative_duration ?
    B extends _cal.$relative_duration ?
    B
    :
    never
  :
  A extends _cal.$local_time ?
    B extends _cal.$local_time ?
    B
    :
    never
  :
  A extends _cal.$local_datetime ?
    B extends _cal.$local_datetime ?
    B
    :
    never
  :
  A extends _cal.$local_date ?
    B extends _cal.$local_date ?
    B
    :
    never
  :
never

function getSharedParentScalar<A extends $.ScalarType, B extends $.ScalarType>(a: A, b: B): A | B {
  a = (a as any).__casttype__ || a;
  b = (b as any).__casttype__ || b;
  if (a.__name__ === "std::number") {
    if(b.__name__ === "std::number") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "sys::VersionStage") {
    if(b.__name__ === "sys::VersionStage") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "sys::TransactionIsolation") {
    if(b.__name__ === "sys::TransactionIsolation") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "std::uuid") {
    if(b.__name__ === "std::uuid") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "std::str") {
    if(b.__name__ === "std::str") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "std::json") {
    if(b.__name__ === "std::json") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "std::int64") {
    if(b.__name__ === "std::int64") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "std::int32") {
    if(b.__name__ === "std::int32") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "std::int16") {
    if(b.__name__ === "std::int16") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "std::float64") {
    if(b.__name__ === "std::float64") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "std::float32") {
    if(b.__name__ === "std::float32") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "std::duration") {
    if(b.__name__ === "std::duration") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "std::decimal") {
    if(b.__name__ === "std::decimal") {
      return b;
    }
    if(b.__name__ === "std::bigint") {
      return a;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "std::datetime") {
    if(b.__name__ === "std::datetime") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "std::bytes") {
    if(b.__name__ === "std::bytes") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "std::bool") {
    if(b.__name__ === "std::bool") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "std::bigint") {
    if(b.__name__ === "std::decimal") {
      return b;
    }
    if(b.__name__ === "std::bigint") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "schema::Volatility") {
    if(b.__name__ === "schema::Volatility") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "schema::TypeModifier") {
    if(b.__name__ === "schema::TypeModifier") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "schema::TargetDeleteAction") {
    if(b.__name__ === "schema::TargetDeleteAction") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "schema::ParameterKind") {
    if(b.__name__ === "schema::ParameterKind") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "schema::OperatorKind") {
    if(b.__name__ === "schema::OperatorKind") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "schema::Cardinality") {
    if(b.__name__ === "schema::Cardinality") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "cfg::memory") {
    if(b.__name__ === "cfg::memory") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "cfg::AllowBareDDL") {
    if(b.__name__ === "cfg::AllowBareDDL") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "cal::relative_duration") {
    if(b.__name__ === "cal::relative_duration") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "cal::local_time") {
    if(b.__name__ === "cal::local_time") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "cal::local_datetime") {
    if(b.__name__ === "cal::local_datetime") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  if (a.__name__ === "cal::local_date") {
    if(b.__name__ === "cal::local_date") {
      return b;
    }
    throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
    }
  throw new Error(`Types are not castable: ${a.__name__}, ${b.__name__}`);
}

const implicitCastMap = new Map<string, Set<string>>([
  ["std::bigint", new Set(["std::decimal"])],
]);
function isImplicitlyCastableTo(from: string, to: string): boolean {
  const _a = implicitCastMap.get(from),
        _b = _a != null ? _a.has(to) : null;
  return _b != null ? _b : false;
};

export type scalarLiterals =
  | number
  | string
  | boolean
  | bigint
  | Buffer
  | Date
  | edgedb.Duration
  | edgedb.LocalDateTime
  | edgedb.LocalDate
  | edgedb.LocalTime
  | edgedb.RelativeDuration
  | edgedb.ConfigMemory;

type getTsType<T extends $.BaseType> = T extends $.ScalarType
  ? T extends _std.$decimal | _std.$json | _std.$uuid
    ? never
    : T["__tstype__"]
  : never;
export type orScalarLiteral<T extends $.TypeSet> =
  | T
  | ($.BaseTypeSet extends T      ? scalarLiterals      : $.Cardinality extends T["__cardinality__"]        ? getTsType<T["__element__"]>        : $.computeTsTypeCard<            getTsType<T["__element__"]>,            T["__cardinality__"]          >);
export type scalarWithConstType<
  T extends $.ScalarType,
  TsConstType
> = $.ScalarType<
  T["__name__"],
  T["__tstype__"],
  T["__castable__"],
  TsConstType
>;
export type literalToScalarType<T extends any> =
  T extends number ? scalarWithConstType<_std.$number, T> :
  T extends string ? scalarWithConstType<_std.$str, T> :
  T extends boolean ? scalarWithConstType<_std.$bool, T> :
  T extends bigint ? scalarWithConstType<_std.$bigint, T> :
  T extends Buffer ? scalarWithConstType<_std.$bytes, T> :
  T extends Date ? scalarWithConstType<_std.$datetime, T> :
  T extends edgedb.Duration ? scalarWithConstType<_std.$duration, T> :
  T extends edgedb.LocalDateTime ? scalarWithConstType<_cal.$local_datetime, T> :
  T extends edgedb.LocalDate ? scalarWithConstType<_cal.$local_date, T> :
  T extends edgedb.LocalTime ? scalarWithConstType<_cal.$local_time, T> :
  T extends edgedb.RelativeDuration ? scalarWithConstType<_cal.$relative_duration, T> :
  T extends edgedb.ConfigMemory ? scalarWithConstType<_cfg.$memory, T> :
  $.BaseType;

type literalToTypeSet<T extends any> = T extends $.TypeSet
  ? T
  : $.$expr_Literal<literalToScalarType<T>>;

export type mapLiteralToTypeSet<T> = {
  [k in keyof T]: literalToTypeSet<T[k]>;
};

function literalToTypeSet(type: any): $.TypeSet {
  if (type && type.__element__) {
    return type;
  }
  if (typeof type === "number") {
    return literal.$getType("00000000-0000-0000-0000-0000000001ff")(type);
  }
  if (typeof type === "string") {
    return literal.$getType("00000000-0000-0000-0000-000000000101")(type);
  }
  if (typeof type === "boolean") {
    return literal.$getType("00000000-0000-0000-0000-000000000109")(type);
  }
  if (typeof type === "bigint") {
    return literal.$getType("00000000-0000-0000-0000-000000000110")(type);
  }
  if (type instanceof Buffer) {
    return literal.$getType("00000000-0000-0000-0000-000000000102")(type);
  }
  if (type instanceof Date) {
    return literal.$getType("00000000-0000-0000-0000-00000000010a")(type);
  }
  if (type instanceof edgedb.Duration) {
    return literal.$getType("00000000-0000-0000-0000-00000000010e")(type);
  }
  if (type instanceof edgedb.LocalDateTime) {
    return literal.$getType("00000000-0000-0000-0000-00000000010b")(type);
  }
  if (type instanceof edgedb.LocalDate) {
    return literal.$getType("00000000-0000-0000-0000-00000000010c")(type);
  }
  if (type instanceof edgedb.LocalTime) {
    return literal.$getType("00000000-0000-0000-0000-00000000010d")(type);
  }
  if (type instanceof edgedb.RelativeDuration) {
    return literal.$getType("00000000-0000-0000-0000-000000000111")(type);
  }
  if (type instanceof edgedb.ConfigMemory) {
    return literal.$getType("00000000-0000-0000-0000-000000000130")(type);
  }
  throw new Error(`Cannot convert literal '${type}' into scalar type`);
}


export { getSharedParentScalar, isImplicitlyCastableTo, literalToTypeSet };
