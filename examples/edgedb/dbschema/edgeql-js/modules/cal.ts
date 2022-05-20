import { $ } from "edgedb";
import * as _ from "../imports";
import type * as _std from "./std";
export type $local_date = $.ScalarType<"cal::local_date", _.edgedb.LocalDate, true>;
const local_date: $.scalarTypeWithConstructor<$local_date, never> = $.makeType<$.scalarTypeWithConstructor<$local_date, never>>(_.spec, "00000000-0000-0000-0000-00000000010c", _.syntax.literal);

export type $local_datetime = $.ScalarType<"cal::local_datetime", _.edgedb.LocalDateTime, true>;
const local_datetime: $.scalarTypeWithConstructor<$local_datetime, never> = $.makeType<$.scalarTypeWithConstructor<$local_datetime, never>>(_.spec, "00000000-0000-0000-0000-00000000010b", _.syntax.literal);

export type $local_time = $.ScalarType<"cal::local_time", _.edgedb.LocalTime, true>;
const local_time: $.scalarTypeWithConstructor<$local_time, never> = $.makeType<$.scalarTypeWithConstructor<$local_time, never>>(_.spec, "00000000-0000-0000-0000-00000000010d", _.syntax.literal);

export type $relative_duration = $.ScalarType<"cal::relative_duration", _.edgedb.RelativeDuration, true>;
const relative_duration: $.scalarTypeWithConstructor<$relative_duration, never> = $.makeType<$.scalarTypeWithConstructor<$relative_duration, never>>(_.spec, "00000000-0000-0000-0000-000000000111", _.syntax.literal);

type to_local_datetimeλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>> | undefined,
> = $.$expr_Function<
  "cal::to_local_datetime",
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  {},
  $.TypeSet<$local_datetime, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
type to_local_datetimeλFuncExpr2<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
> = $.$expr_Function<
  "cal::to_local_datetime",
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  {},
  $.TypeSet<$local_datetime, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
type to_local_datetimeλFuncExpr3<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P3 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P4 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P5 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P6 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  "cal::to_local_datetime",
  _.castMaps.mapLiteralToTypeSet<[P1, P2, P3, P4, P5, P6]>,
  {},
  $.TypeSet<$local_datetime, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>, _.castMaps.literalToTypeSet<P3>["__cardinality__"]>, _.castMaps.literalToTypeSet<P4>["__cardinality__"]>, _.castMaps.literalToTypeSet<P5>["__cardinality__"]>, _.castMaps.literalToTypeSet<P6>["__cardinality__"]>>
>;
/**
 * Create a `cal::local_datetime` value.
 */
function to_local_datetime<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>> | undefined,
>(
  s: P1,
  fmt?: P2,
): to_local_datetimeλFuncExpr<P1, P2>;
/**
 * Create a `cal::local_datetime` value.
 */
function to_local_datetime<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
>(
  dt: P1,
  zone: P2,
): to_local_datetimeλFuncExpr2<P1, P2>;
/**
 * Create a `cal::local_datetime` value.
 */
function to_local_datetime<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P3 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P4 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P5 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P6 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  year: P1,
  month: P2,
  day: P3,
  hour: P4,
  min: P5,
  sec: P6,
): to_local_datetimeλFuncExpr3<P1, P2, P3, P4, P5, P6>;
function to_local_datetime(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('cal::to_local_datetime', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010b"},
    {args: [{typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010b"},
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010b"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "cal::to_local_datetime",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type to_local_dateλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>> | undefined,
> = $.$expr_Function<
  "cal::to_local_date",
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  {},
  $.TypeSet<$local_date, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
type to_local_dateλFuncExpr2<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
> = $.$expr_Function<
  "cal::to_local_date",
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  {},
  $.TypeSet<$local_date, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
type to_local_dateλFuncExpr3<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P3 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  "cal::to_local_date",
  _.castMaps.mapLiteralToTypeSet<[P1, P2, P3]>,
  {},
  $.TypeSet<$local_date, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>, _.castMaps.literalToTypeSet<P3>["__cardinality__"]>>
>;
/**
 * Create a `cal::local_date` value.
 */
function to_local_date<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>> | undefined,
>(
  s: P1,
  fmt?: P2,
): to_local_dateλFuncExpr<P1, P2>;
/**
 * Create a `cal::local_date` value.
 */
function to_local_date<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
>(
  dt: P1,
  zone: P2,
): to_local_dateλFuncExpr2<P1, P2>;
/**
 * Create a `cal::local_date` value.
 */
function to_local_date<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P3 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  year: P1,
  month: P2,
  day: P3,
): to_local_dateλFuncExpr3<P1, P2, P3>;
function to_local_date(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('cal::to_local_date', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010c"},
    {args: [{typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010c"},
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010c"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "cal::to_local_date",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type to_local_timeλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>> | undefined,
> = $.$expr_Function<
  "cal::to_local_time",
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  {},
  $.TypeSet<$local_time, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
type to_local_timeλFuncExpr2<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
> = $.$expr_Function<
  "cal::to_local_time",
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  {},
  $.TypeSet<$local_time, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
type to_local_timeλFuncExpr3<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P3 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  "cal::to_local_time",
  _.castMaps.mapLiteralToTypeSet<[P1, P2, P3]>,
  {},
  $.TypeSet<$local_time, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>, _.castMaps.literalToTypeSet<P3>["__cardinality__"]>>
>;
/**
 * Create a `cal::local_time` value.
 */
function to_local_time<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>> | undefined,
>(
  s: P1,
  fmt?: P2,
): to_local_timeλFuncExpr<P1, P2>;
/**
 * Create a `cal::local_time` value.
 */
function to_local_time<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
>(
  dt: P1,
  zone: P2,
): to_local_timeλFuncExpr2<P1, P2>;
/**
 * Create a `cal::local_time` value.
 */
function to_local_time<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P3 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  hour: P1,
  min: P2,
  sec: P3,
): to_local_timeλFuncExpr3<P1, P2, P3>;
function to_local_time(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('cal::to_local_time', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010d"},
    {args: [{typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010d"},
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010d"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "cal::to_local_time",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type time_getλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<$local_time>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
> = $.$expr_Function<
  "cal::time_get",
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  {},
  $.TypeSet<_std.$number, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
 * Extract a specific element of input time by name.
 */
function time_get<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<$local_time>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
>(
  dt: P1,
  el: P2,
): time_getλFuncExpr<P1, P2>;
function time_get(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('cal::time_get', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-00000000010d", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "cal::time_get",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type date_getλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<$local_date>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
> = $.$expr_Function<
  "cal::date_get",
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  {},
  $.TypeSet<_std.$number, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
 * Extract a specific element of input date by name.
 */
function date_get<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<$local_date>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
>(
  dt: P1,
  el: P2,
): date_getλFuncExpr<P1, P2>;
function date_get(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('cal::date_get', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-00000000010c", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "cal::date_get",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type to_relative_durationλFuncExpr<
  NamedArgs extends {
    "years"?: _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
    "months"?: _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
    "days"?: _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
    "hours"?: _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
    "minutes"?: _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
    "seconds"?: _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
    "microseconds"?: _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  },
> = $.$expr_Function<
  "cal::to_relative_duration",
  [],
  _.castMaps.mapLiteralToTypeSet<NamedArgs>,
  $.TypeSet<$relative_duration, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<NamedArgs["years"]>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<NamedArgs["months"]>>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<NamedArgs["days"]>>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<NamedArgs["hours"]>>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<NamedArgs["minutes"]>>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<NamedArgs["seconds"]>>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<NamedArgs["microseconds"]>>>>
>;
/**
 * Create a `cal::relative_duration` value.
 */
function to_relative_duration<
  NamedArgs extends {
    "years"?: _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
    "months"?: _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
    "days"?: _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
    "hours"?: _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
    "minutes"?: _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
    "seconds"?: _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
    "microseconds"?: _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  },
>(
  namedArgs: NamedArgs,
): to_relative_durationλFuncExpr<NamedArgs>;
function to_relative_duration(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('cal::to_relative_duration', args, _.spec, [
    {args: [], namedArgs: {"years": {typeId: "00000000-0000-0000-0000-0000000001ff", optional: true, setoftype: false, variadic: false}, "months": {typeId: "00000000-0000-0000-0000-0000000001ff", optional: true, setoftype: false, variadic: false}, "days": {typeId: "00000000-0000-0000-0000-0000000001ff", optional: true, setoftype: false, variadic: false}, "hours": {typeId: "00000000-0000-0000-0000-0000000001ff", optional: true, setoftype: false, variadic: false}, "minutes": {typeId: "00000000-0000-0000-0000-0000000001ff", optional: true, setoftype: false, variadic: false}, "seconds": {typeId: "00000000-0000-0000-0000-0000000001ff", optional: true, setoftype: false, variadic: false}, "microseconds": {typeId: "00000000-0000-0000-0000-0000000001ff", optional: true, setoftype: false, variadic: false}}, returnTypeId: "00000000-0000-0000-0000-000000000111"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "cal::to_relative_duration",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};



export { local_date, local_datetime, local_time, relative_duration };

type __defaultExports = {
  "local_date": typeof local_date;
  "local_datetime": typeof local_datetime;
  "local_time": typeof local_time;
  "relative_duration": typeof relative_duration;
  "to_local_datetime": typeof to_local_datetime;
  "to_local_date": typeof to_local_date;
  "to_local_time": typeof to_local_time;
  "time_get": typeof time_get;
  "date_get": typeof date_get;
  "to_relative_duration": typeof to_relative_duration
};
const __defaultExports: __defaultExports = {
  "local_date": local_date,
  "local_datetime": local_datetime,
  "local_time": local_time,
  "relative_duration": relative_duration,
  "to_local_datetime": to_local_datetime,
  "to_local_date": to_local_date,
  "to_local_time": to_local_time,
  "time_get": time_get,
  "date_get": date_get,
  "to_relative_duration": to_relative_duration
};
export default __defaultExports;
