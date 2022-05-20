import { $ } from "edgedb";
import * as _ from "./imports";
import type * as _std from "./modules/std";
import type * as _cfg from "./modules/cfg";
import type * as _cal from "./modules/cal";

const overloadDefs: {
  [opKind in 'Infix' | 'Prefix' | 'Postfix' | 'Ternary']: {
    [opSymbol: string]: any[]
  }
} = {
  Infix: {
    "=": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000002", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000002", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000109", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000109", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "eaee6a1e-bda6-11ec-80e5-9729b54af6fd", optional: false, setoftype: false, variadic: false}, {typeId: "eaee6a1e-bda6-11ec-80e5-9729b54af6fd", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "5d31584b-3a5f-533d-3d64-fab0fdab61b3", optional: false, setoftype: false, variadic: false}, {typeId: "5d31584b-3a5f-533d-3d64-fab0fdab61b3", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000102", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000102", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010f", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010f", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000100", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000100", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "f1dae21c-bda6-11ec-945c-0dc522decfc4", optional: false, setoftype: false, variadic: false}, {typeId: "f1dae21c-bda6-11ec-945c-0dc522decfc4", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000130", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000130", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010b", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010b", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010c", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010c", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010d", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010d", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}, {typeId: "eae67af2-bda6-11ec-817b-5343efe7c32c", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
    ],
    "?=": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000002", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000002", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000109", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000109", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "eaee6a1e-bda6-11ec-80e5-9729b54af6fd", optional: true, setoftype: false, variadic: false}, {typeId: "eaee6a1e-bda6-11ec-80e5-9729b54af6fd", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000110", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000110", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "5d31584b-3a5f-533d-3d64-fab0fdab61b3", optional: true, setoftype: false, variadic: false}, {typeId: "5d31584b-3a5f-533d-3d64-fab0fdab61b3", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000102", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000102", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010a", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010a", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010e", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010e", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010f", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010f", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000101", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000100", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000100", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "f1dae21c-bda6-11ec-945c-0dc522decfc4", optional: true, setoftype: false, variadic: false}, {typeId: "f1dae21c-bda6-11ec-945c-0dc522decfc4", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000130", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000130", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010b", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010b", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010c", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010c", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010d", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010d", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000111", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: true, setoftype: false, variadic: false}, {typeId: "eae67af2-bda6-11ec-817b-5343efe7c32c", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000108", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
    ],
    "!=": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000002", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000002", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000109", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000109", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "eaee6a1e-bda6-11ec-80e5-9729b54af6fd", optional: false, setoftype: false, variadic: false}, {typeId: "eaee6a1e-bda6-11ec-80e5-9729b54af6fd", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "5d31584b-3a5f-533d-3d64-fab0fdab61b3", optional: false, setoftype: false, variadic: false}, {typeId: "5d31584b-3a5f-533d-3d64-fab0fdab61b3", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000102", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000102", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010f", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010f", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000100", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000100", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "f1dae21c-bda6-11ec-945c-0dc522decfc4", optional: false, setoftype: false, variadic: false}, {typeId: "f1dae21c-bda6-11ec-945c-0dc522decfc4", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000130", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000130", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010b", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010b", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010c", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010c", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010d", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010d", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}, {typeId: "eae67af2-bda6-11ec-817b-5343efe7c32c", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
    ],
    "?!=": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000002", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000002", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000109", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000109", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "eaee6a1e-bda6-11ec-80e5-9729b54af6fd", optional: true, setoftype: false, variadic: false}, {typeId: "eaee6a1e-bda6-11ec-80e5-9729b54af6fd", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000110", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000110", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "5d31584b-3a5f-533d-3d64-fab0fdab61b3", optional: true, setoftype: false, variadic: false}, {typeId: "5d31584b-3a5f-533d-3d64-fab0fdab61b3", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000102", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000102", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010a", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010a", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010e", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010e", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010f", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010f", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000101", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000100", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000100", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "f1dae21c-bda6-11ec-945c-0dc522decfc4", optional: true, setoftype: false, variadic: false}, {typeId: "f1dae21c-bda6-11ec-945c-0dc522decfc4", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000130", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000130", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010b", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010b", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010c", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010c", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010d", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010d", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000111", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: true, setoftype: false, variadic: false}, {typeId: "eae67af2-bda6-11ec-817b-5343efe7c32c", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000108", optional: true, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
    ],
    ">=": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000002", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000002", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000109", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000109", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "eaee6a1e-bda6-11ec-80e5-9729b54af6fd", optional: false, setoftype: false, variadic: false}, {typeId: "eaee6a1e-bda6-11ec-80e5-9729b54af6fd", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "5d31584b-3a5f-533d-3d64-fab0fdab61b3", optional: false, setoftype: false, variadic: false}, {typeId: "5d31584b-3a5f-533d-3d64-fab0fdab61b3", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000102", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000102", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010f", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010f", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000100", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000100", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "f1dae21c-bda6-11ec-945c-0dc522decfc4", optional: false, setoftype: false, variadic: false}, {typeId: "f1dae21c-bda6-11ec-945c-0dc522decfc4", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000130", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000130", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010b", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010b", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010c", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010c", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010d", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010d", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "eae67af2-bda6-11ec-817b-5343efe7c32c", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
    ],
    ">": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000002", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000002", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000109", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000109", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "eaee6a1e-bda6-11ec-80e5-9729b54af6fd", optional: false, setoftype: false, variadic: false}, {typeId: "eaee6a1e-bda6-11ec-80e5-9729b54af6fd", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "5d31584b-3a5f-533d-3d64-fab0fdab61b3", optional: false, setoftype: false, variadic: false}, {typeId: "5d31584b-3a5f-533d-3d64-fab0fdab61b3", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000102", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000102", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000100", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000100", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010f", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010f", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "f1dae21c-bda6-11ec-945c-0dc522decfc4", optional: false, setoftype: false, variadic: false}, {typeId: "f1dae21c-bda6-11ec-945c-0dc522decfc4", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000130", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000130", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010b", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010b", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010c", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010c", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010d", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010d", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "eae67af2-bda6-11ec-817b-5343efe7c32c", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
    ],
    "<=": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000002", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000002", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000109", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000109", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "eaee6a1e-bda6-11ec-80e5-9729b54af6fd", optional: false, setoftype: false, variadic: false}, {typeId: "eaee6a1e-bda6-11ec-80e5-9729b54af6fd", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "5d31584b-3a5f-533d-3d64-fab0fdab61b3", optional: false, setoftype: false, variadic: false}, {typeId: "5d31584b-3a5f-533d-3d64-fab0fdab61b3", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000102", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000102", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010f", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010f", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000100", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000100", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "f1dae21c-bda6-11ec-945c-0dc522decfc4", optional: false, setoftype: false, variadic: false}, {typeId: "f1dae21c-bda6-11ec-945c-0dc522decfc4", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000130", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000130", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010b", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010b", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010c", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010c", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010d", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010d", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "eae67af2-bda6-11ec-817b-5343efe7c32c", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
    ],
    "<": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000002", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000002", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000109", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000109", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "eaee6a1e-bda6-11ec-80e5-9729b54af6fd", optional: false, setoftype: false, variadic: false}, {typeId: "eaee6a1e-bda6-11ec-80e5-9729b54af6fd", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "5d31584b-3a5f-533d-3d64-fab0fdab61b3", optional: false, setoftype: false, variadic: false}, {typeId: "5d31584b-3a5f-533d-3d64-fab0fdab61b3", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000102", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000102", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010f", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010f", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000100", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000100", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "f1dae21c-bda6-11ec-945c-0dc522decfc4", optional: false, setoftype: false, variadic: false}, {typeId: "f1dae21c-bda6-11ec-945c-0dc522decfc4", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000130", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000130", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010b", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010b", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010c", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010c", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010d", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010d", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "eae67af2-bda6-11ec-817b-5343efe7c32c", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
    ],
    "or": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000109", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000109", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
    ],
    "and": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000109", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000109", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
    ],
    "+": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000110"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010a"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010e"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010a"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010b", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010b"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010b", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010b"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010c", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010c"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010c", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010c"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010d", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010d"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010d", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010d"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000111"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000111"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108"},
    ],
    "-": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000110"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010a"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010e"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010e"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010a", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010a"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010b", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010b"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010b", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010b"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010c", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010c"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010c", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010c"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010d", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010d"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010d", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010d"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000111"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000111"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108"},
    ],
    "*": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000110"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108"},
    ],
    "/": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108"},
    ],
    "//": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000110"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108"},
    ],
    "%": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000110"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108"},
    ],
    "^": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108"},
    ],
    "in": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000001", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000001", optional: false, setoftype: true, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
    ],
    "not in": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000001", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000001", optional: false, setoftype: true, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
    ],
    "union": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000001", optional: false, setoftype: true, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000001", optional: false, setoftype: true, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000001", returnTypemod: "SetOfType"},
    ],
    "??": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000001", optional: true, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000001", optional: false, setoftype: true, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000001", returnTypemod: "SetOfType"},
    ],
    "++": [
      {kind: "Infix", args: [{typeId: "5d31584b-3a5f-533d-3d64-fab0fdab61b3", optional: false, setoftype: false, variadic: false}, {typeId: "5d31584b-3a5f-533d-3d64-fab0fdab61b3", optional: false, setoftype: false, variadic: false}], returnTypeId: "5d31584b-3a5f-533d-3d64-fab0fdab61b3"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000102", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000102", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000102"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000101"},
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-00000000010f", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-00000000010f", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010f"},
    ],
    "like": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
    ],
    "ilike": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
    ],
    "not like": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
    ],
    "not ilike": [
      {kind: "Infix", args: [{typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000101", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
    ],
  },
  Postfix: {
  },
  Prefix: {
    "not": [
      {kind: "Prefix", args: [{typeId: "00000000-0000-0000-0000-000000000109", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
    ],
    "+": [
      {kind: "Prefix", args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
      {kind: "Prefix", args: [{typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000110"},
      {kind: "Prefix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108"},
    ],
    "-": [
      {kind: "Prefix", args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
      {kind: "Prefix", args: [{typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000110"},
      {kind: "Prefix", args: [{typeId: "00000000-0000-0000-0000-00000000010e", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-00000000010e"},
      {kind: "Prefix", args: [{typeId: "00000000-0000-0000-0000-000000000111", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000111"},
      {kind: "Prefix", args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108"},
    ],
    "exists": [
      {kind: "Prefix", args: [{typeId: "00000000-0000-0000-0000-000000000001", optional: false, setoftype: true, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000109"},
    ],
    "distinct": [
      {kind: "Prefix", args: [{typeId: "00000000-0000-0000-0000-000000000001", optional: false, setoftype: true, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000001", returnTypemod: "SetOfType"},
    ],
  },
  Ternary: {
    "if_else": [
      {kind: "Ternary", args: [{typeId: "00000000-0000-0000-0000-000000000001", optional: false, setoftype: true, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000109", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-000000000001", optional: false, setoftype: true, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000001", returnTypemod: "SetOfType"},
    ],
  },
};

/**
* Compare two values for equality.
*/
function op<
  P1 extends $.TypeSet<$.AnyTupleType>,
  P2 extends $.TypeSet<$.AnyTupleType>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<$.EnumType>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<$.EnumType>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
  P2 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.ObjectType>>,
  P2 extends $.TypeSet<$.ArrayType<$.ObjectType>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.AnyTupleType>>,
  P2 extends $.TypeSet<$.ArrayType<$.AnyTupleType>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.NonArrayType>>,
  P2 extends $.TypeSet<$.ArrayType<$.getPrimitiveNonArrayBaseType<P1["__element__"]["__element__"]>>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bytes>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bytes>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$json>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$json>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$uuid>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$uuid>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends $.TypeSet<$.ObjectType>,
  P2 extends $.TypeSet<$.ObjectType>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cfg.$memory>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cfg.$memory>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$anyint>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "=", r: P2
): $.$expr_Operator<
  "=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends $.TypeSet<$.AnyTupleType>,
  P2 extends $.TypeSet<$.AnyTupleType>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<P1>, $.cardinalityUtil.optionalParamCardinality<P2>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<$.EnumType>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<$.EnumType>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
  P2 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<P1>, $.cardinalityUtil.optionalParamCardinality<P2>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.ObjectType>>,
  P2 extends $.TypeSet<$.ArrayType<$.ObjectType>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<P1>, $.cardinalityUtil.optionalParamCardinality<P2>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.AnyTupleType>>,
  P2 extends $.TypeSet<$.ArrayType<$.AnyTupleType>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<P1>, $.cardinalityUtil.optionalParamCardinality<P2>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.NonArrayType>>,
  P2 extends $.TypeSet<$.ArrayType<$.getPrimitiveNonArrayBaseType<P1["__element__"]["__element__"]>>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<P1>, $.cardinalityUtil.optionalParamCardinality<P2>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bytes>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bytes>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$json>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$json>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$uuid>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$uuid>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends $.TypeSet<$.ObjectType>,
  P2 extends $.TypeSet<$.ObjectType>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<P1>, $.cardinalityUtil.optionalParamCardinality<P2>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cfg.$memory>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cfg.$memory>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$anyint>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for equality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "?=", r: P2
): $.$expr_Operator<
  "?=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends $.TypeSet<$.AnyTupleType>,
  P2 extends $.TypeSet<$.AnyTupleType>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<$.EnumType>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<$.EnumType>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
  P2 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.ObjectType>>,
  P2 extends $.TypeSet<$.ArrayType<$.ObjectType>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.AnyTupleType>>,
  P2 extends $.TypeSet<$.ArrayType<$.AnyTupleType>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.NonArrayType>>,
  P2 extends $.TypeSet<$.ArrayType<$.getPrimitiveNonArrayBaseType<P1["__element__"]["__element__"]>>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bytes>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bytes>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$json>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$json>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$uuid>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$uuid>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends $.TypeSet<$.ObjectType>,
  P2 extends $.TypeSet<$.ObjectType>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cfg.$memory>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cfg.$memory>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$anyint>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "!=", r: P2
): $.$expr_Operator<
  "!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends $.TypeSet<$.AnyTupleType>,
  P2 extends $.TypeSet<$.AnyTupleType>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<P1>, $.cardinalityUtil.optionalParamCardinality<P2>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<$.EnumType>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<$.EnumType>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
  P2 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<P1>, $.cardinalityUtil.optionalParamCardinality<P2>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.ObjectType>>,
  P2 extends $.TypeSet<$.ArrayType<$.ObjectType>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<P1>, $.cardinalityUtil.optionalParamCardinality<P2>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.AnyTupleType>>,
  P2 extends $.TypeSet<$.ArrayType<$.AnyTupleType>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<P1>, $.cardinalityUtil.optionalParamCardinality<P2>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.NonArrayType>>,
  P2 extends $.TypeSet<$.ArrayType<$.getPrimitiveNonArrayBaseType<P1["__element__"]["__element__"]>>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<P1>, $.cardinalityUtil.optionalParamCardinality<P2>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bytes>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bytes>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$json>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$json>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$uuid>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$uuid>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends $.TypeSet<$.ObjectType>,
  P2 extends $.TypeSet<$.ObjectType>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<P1>, $.cardinalityUtil.optionalParamCardinality<P2>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cfg.$memory>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cfg.$memory>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$anyint>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Compare two (potentially empty) values for inequality.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "?!=", r: P2
): $.$expr_Operator<
  "?!=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P1>>, $.cardinalityUtil.optionalParamCardinality<_.castMaps.literalToTypeSet<P2>>>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends $.TypeSet<$.AnyTupleType>,
  P2 extends $.TypeSet<$.AnyTupleType>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<$.EnumType>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<$.EnumType>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
  P2 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.ObjectType>>,
  P2 extends $.TypeSet<$.ArrayType<$.ObjectType>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.AnyTupleType>>,
  P2 extends $.TypeSet<$.ArrayType<$.AnyTupleType>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.NonArrayType>>,
  P2 extends $.TypeSet<$.ArrayType<$.getPrimitiveNonArrayBaseType<P1["__element__"]["__element__"]>>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bytes>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bytes>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$json>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$json>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$uuid>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$uuid>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends $.TypeSet<$.ObjectType>,
  P2 extends $.TypeSet<$.ObjectType>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cfg.$memory>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cfg.$memory>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$anyint>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  l: P1, op: ">=", r: P2
): $.$expr_Operator<
  ">=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends $.TypeSet<$.AnyTupleType>,
  P2 extends $.TypeSet<$.AnyTupleType>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<$.EnumType>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<$.EnumType>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
  P2 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.ObjectType>>,
  P2 extends $.TypeSet<$.ArrayType<$.ObjectType>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.AnyTupleType>>,
  P2 extends $.TypeSet<$.ArrayType<$.AnyTupleType>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.NonArrayType>>,
  P2 extends $.TypeSet<$.ArrayType<$.getPrimitiveNonArrayBaseType<P1["__element__"]["__element__"]>>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bytes>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bytes>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$uuid>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$uuid>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$json>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$json>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends $.TypeSet<$.ObjectType>,
  P2 extends $.TypeSet<$.ObjectType>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cfg.$memory>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cfg.$memory>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$anyint>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Greater than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  l: P1, op: ">", r: P2
): $.$expr_Operator<
  ">",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends $.TypeSet<$.AnyTupleType>,
  P2 extends $.TypeSet<$.AnyTupleType>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<$.EnumType>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<$.EnumType>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
  P2 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.ObjectType>>,
  P2 extends $.TypeSet<$.ArrayType<$.ObjectType>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.AnyTupleType>>,
  P2 extends $.TypeSet<$.ArrayType<$.AnyTupleType>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.NonArrayType>>,
  P2 extends $.TypeSet<$.ArrayType<$.getPrimitiveNonArrayBaseType<P1["__element__"]["__element__"]>>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bytes>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bytes>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$json>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$json>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$uuid>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$uuid>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends $.TypeSet<$.ObjectType>,
  P2 extends $.TypeSet<$.ObjectType>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cfg.$memory>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cfg.$memory>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$anyint>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than or equal.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "<=", r: P2
): $.$expr_Operator<
  "<=",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends $.TypeSet<$.AnyTupleType>,
  P2 extends $.TypeSet<$.AnyTupleType>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<$.EnumType>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<$.EnumType>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
  P2 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.ObjectType>>,
  P2 extends $.TypeSet<$.ArrayType<$.ObjectType>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.AnyTupleType>>,
  P2 extends $.TypeSet<$.ArrayType<$.AnyTupleType>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.NonArrayType>>,
  P2 extends $.TypeSet<$.ArrayType<$.getPrimitiveNonArrayBaseType<P1["__element__"]["__element__"]>>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bytes>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bytes>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$json>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$json>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$uuid>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$uuid>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends $.TypeSet<$.ObjectType>,
  P2 extends $.TypeSet<$.ObjectType>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cfg.$memory>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cfg.$memory>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$anyint>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Less than.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "<", r: P2
): $.$expr_Operator<
  "<",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Logical disjunction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
>(
  a: P1, op: "or", b: P2
): $.$expr_Operator<
  "or",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Logical conjunction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
>(
  a: P1, op: "and", b: P2
): $.$expr_Operator<
  "and",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Logical negation.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
>(
  op: "not", v: P1
): $.$expr_Operator<
  "not",
  $.OperatorKind.Prefix,
  _.castMaps.mapLiteralToTypeSet<[P1]>,
  $.TypeSet<_std.$bool, _.castMaps.literalToTypeSet<P1>["__cardinality__"]>
>;
/**
* Arithmetic addition.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  op: "+", l: P1
): $.$expr_Operator<
  "+",
  $.OperatorKind.Prefix,
  _.castMaps.mapLiteralToTypeSet<[P1]>,
  $.TypeSet<_std.$number, _.castMaps.literalToTypeSet<P1>["__cardinality__"]>
>;
/**
* Arithmetic addition.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
>(
  op: "+", l: P1
): $.$expr_Operator<
  "+",
  $.OperatorKind.Prefix,
  _.castMaps.mapLiteralToTypeSet<[P1]>,
  $.TypeSet<_std.$bigint, _.castMaps.literalToTypeSet<P1>["__cardinality__"]>
>;
/**
* Arithmetic addition.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  l: P1, op: "+", r: P2
): $.$expr_Operator<
  "+",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$number, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Arithmetic addition.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
>(
  l: P1, op: "+", r: P2
): $.$expr_Operator<
  "+",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bigint, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time addition.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
>(
  l: P1, op: "+", r: P2
): $.$expr_Operator<
  "+",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$datetime, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time addition.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
>(
  l: P1, op: "+", r: P2
): $.$expr_Operator<
  "+",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$duration, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time addition.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: "+", r: P2
): $.$expr_Operator<
  "+",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$datetime, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time addition.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
>(
  l: P1, op: "+", r: P2
): $.$expr_Operator<
  "+",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_cal.$local_datetime, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time addition.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: "+", r: P2
): $.$expr_Operator<
  "+",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_cal.$local_datetime, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time addition.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
>(
  l: P1, op: "+", r: P2
): $.$expr_Operator<
  "+",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_cal.$local_date, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time addition.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: "+", r: P2
): $.$expr_Operator<
  "+",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_cal.$local_date, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time addition.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
>(
  l: P1, op: "+", r: P2
): $.$expr_Operator<
  "+",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_cal.$local_time, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time addition.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: "+", r: P2
): $.$expr_Operator<
  "+",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_cal.$local_time, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time addition.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: "+", r: P2
): $.$expr_Operator<
  "+",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_cal.$relative_duration, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time addition.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: "+", r: P2
): $.$expr_Operator<
  "+",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_cal.$relative_duration, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Arithmetic addition.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  op: "+", l: P1
): $.$expr_Operator<
  "+",
  $.OperatorKind.Prefix,
  _.castMaps.mapLiteralToTypeSet<[P1]>,
  $.TypeSet<_std.$decimal, _.castMaps.literalToTypeSet<P1>["__cardinality__"]>
>;
/**
* Arithmetic addition.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "+", r: P2
): $.$expr_Operator<
  "+",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$decimal, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Arithmetic subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  op: "-", l: P1
): $.$expr_Operator<
  "-",
  $.OperatorKind.Prefix,
  _.castMaps.mapLiteralToTypeSet<[P1]>,
  $.TypeSet<_std.$number, _.castMaps.literalToTypeSet<P1>["__cardinality__"]>
>;
/**
* Arithmetic subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
>(
  op: "-", l: P1
): $.$expr_Operator<
  "-",
  $.OperatorKind.Prefix,
  _.castMaps.mapLiteralToTypeSet<[P1]>,
  $.TypeSet<_std.$bigint, _.castMaps.literalToTypeSet<P1>["__cardinality__"]>
>;
/**
* Time interval and date/time subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
>(
  op: "-", v: P1
): $.$expr_Operator<
  "-",
  $.OperatorKind.Prefix,
  _.castMaps.mapLiteralToTypeSet<[P1]>,
  $.TypeSet<_std.$duration, _.castMaps.literalToTypeSet<P1>["__cardinality__"]>
>;
/**
* Time interval and date/time subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  op: "-", v: P1
): $.$expr_Operator<
  "-",
  $.OperatorKind.Prefix,
  _.castMaps.mapLiteralToTypeSet<[P1]>,
  $.TypeSet<_cal.$relative_duration, _.castMaps.literalToTypeSet<P1>["__cardinality__"]>
>;
/**
* Arithmetic subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  l: P1, op: "-", r: P2
): $.$expr_Operator<
  "-",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$number, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Arithmetic subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
>(
  l: P1, op: "-", r: P2
): $.$expr_Operator<
  "-",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bigint, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
>(
  l: P1, op: "-", r: P2
): $.$expr_Operator<
  "-",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$datetime, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
>(
  l: P1, op: "-", r: P2
): $.$expr_Operator<
  "-",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$duration, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
>(
  l: P1, op: "-", r: P2
): $.$expr_Operator<
  "-",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$duration, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: "-", r: P2
): $.$expr_Operator<
  "-",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$datetime, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
>(
  l: P1, op: "-", r: P2
): $.$expr_Operator<
  "-",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_cal.$local_datetime, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_datetime>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: "-", r: P2
): $.$expr_Operator<
  "-",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_cal.$local_datetime, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
>(
  l: P1, op: "-", r: P2
): $.$expr_Operator<
  "-",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_cal.$local_date, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_date>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: "-", r: P2
): $.$expr_Operator<
  "-",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_cal.$local_date, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
>(
  l: P1, op: "-", r: P2
): $.$expr_Operator<
  "-",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_cal.$local_time, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$local_time>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: "-", r: P2
): $.$expr_Operator<
  "-",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_cal.$local_time, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: "-", r: P2
): $.$expr_Operator<
  "-",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_cal.$relative_duration, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Time interval and date/time subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$duration>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_cal.$relative_duration>>,
>(
  l: P1, op: "-", r: P2
): $.$expr_Operator<
  "-",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_cal.$relative_duration, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Arithmetic subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  op: "-", l: P1
): $.$expr_Operator<
  "-",
  $.OperatorKind.Prefix,
  _.castMaps.mapLiteralToTypeSet<[P1]>,
  $.TypeSet<_std.$decimal, _.castMaps.literalToTypeSet<P1>["__cardinality__"]>
>;
/**
* Arithmetic subtraction.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "-", r: P2
): $.$expr_Operator<
  "-",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$decimal, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Arithmetic multiplication.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  l: P1, op: "*", r: P2
): $.$expr_Operator<
  "*",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$number, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Arithmetic multiplication.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
>(
  l: P1, op: "*", r: P2
): $.$expr_Operator<
  "*",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bigint, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Arithmetic multiplication.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "*", r: P2
): $.$expr_Operator<
  "*",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$decimal, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Arithmetic division.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  l: P1, op: "/", r: P2
): $.$expr_Operator<
  "/",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$number, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Arithmetic division.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "/", r: P2
): $.$expr_Operator<
  "/",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$decimal, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Floor division. Result is rounded down to the nearest integer
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  n: P1, op: "//", d: P2
): $.$expr_Operator<
  "//",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$number, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Floor division. Result is rounded down to the nearest integer
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
>(
  n: P1, op: "//", d: P2
): $.$expr_Operator<
  "//",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bigint, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Floor division. Result is rounded down to the nearest integer
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  n: P1, op: "//", d: P2
): $.$expr_Operator<
  "//",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$decimal, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Remainder from division (modulo).
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  n: P1, op: "%", d: P2
): $.$expr_Operator<
  "%",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$number, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Remainder from division (modulo).
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
>(
  n: P1, op: "%", d: P2
): $.$expr_Operator<
  "%",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bigint, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Remainder from division (modulo).
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  n: P1, op: "%", d: P2
): $.$expr_Operator<
  "%",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$decimal, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Power operation.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  n: P1, op: "^", p: P2
): $.$expr_Operator<
  "^",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$number, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Power operation.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
>(
  n: P1, op: "^", p: P2
): $.$expr_Operator<
  "^",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$decimal, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Power operation.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  n: P1, op: "^", p: P2
): $.$expr_Operator<
  "^",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$decimal, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Test the membership of an element in a set.
*/
function op<
  P1 extends $.TypeSet<_std.$decimalλICastableTo>,
  P2 extends $.TypeSet<_std.$decimalλICastableTo>,
>(
  e: P1, op: "in", s: P2
): $.$expr_Operator<
  "in",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], $.Cardinality.One>>
>;
/**
* Test the membership of an element in a set.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
  P2 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
>(
  e: P1, op: "in", s: P2
): $.$expr_Operator<
  "in",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], $.Cardinality.One>>
>;
/**
* Test the membership of an element in a set.
*/
function op<
  P1 extends $.TypeSet<$.ObjectType>,
  P2 extends $.TypeSet<$.ObjectType>,
>(
  e: P1, op: "in", s: P2
): $.$expr_Operator<
  "in",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], $.Cardinality.One>>
>;
/**
* Test the membership of an element in a set.
*/
function op<
  P1 extends $.TypeSet<$.AnyTupleType>,
  P2 extends $.TypeSet<$.AnyTupleType>,
>(
  e: P1, op: "in", s: P2
): $.$expr_Operator<
  "in",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], $.Cardinality.One>>
>;
/**
* Test the membership of an element in a set.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<$.BaseType>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<$.getPrimitiveBaseType<_.castMaps.literalToTypeSet<P1>["__element__"]>>>,
>(
  e: P1, op: "in", s: P2
): $.$expr_Operator<
  "in",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], $.Cardinality.One>>
>;
/**
* Test the membership of an element in a set.
*/
function op<
  P1 extends $.TypeSet<_std.$decimalλICastableTo>,
  P2 extends $.TypeSet<_std.$decimalλICastableTo>,
>(
  e: P1, op: "not in", s: P2
): $.$expr_Operator<
  "not in",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], $.Cardinality.One>>
>;
/**
* Test the membership of an element in a set.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
  P2 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
>(
  e: P1, op: "not in", s: P2
): $.$expr_Operator<
  "not in",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], $.Cardinality.One>>
>;
/**
* Test the membership of an element in a set.
*/
function op<
  P1 extends $.TypeSet<$.ObjectType>,
  P2 extends $.TypeSet<$.ObjectType>,
>(
  e: P1, op: "not in", s: P2
): $.$expr_Operator<
  "not in",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], $.Cardinality.One>>
>;
/**
* Test the membership of an element in a set.
*/
function op<
  P1 extends $.TypeSet<$.AnyTupleType>,
  P2 extends $.TypeSet<$.AnyTupleType>,
>(
  e: P1, op: "not in", s: P2
): $.$expr_Operator<
  "not in",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], $.Cardinality.One>>
>;
/**
* Test the membership of an element in a set.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<$.BaseType>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<$.getPrimitiveBaseType<_.castMaps.literalToTypeSet<P1>["__element__"]>>>,
>(
  e: P1, op: "not in", s: P2
): $.$expr_Operator<
  "not in",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], $.Cardinality.One>>
>;
/**
* Test whether a set is not empty.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<$.BaseType>>,
>(
  op: "exists", s: P1
): $.$expr_Operator<
  "exists",
  $.OperatorKind.Prefix,
  _.castMaps.mapLiteralToTypeSet<[P1]>,
  $.TypeSet<_std.$bool, $.Cardinality.One>
>;
/**
* Return a set without repeating any elements.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<$.BaseType>>,
>(
  op: "distinct", s: P1
): $.$expr_Operator<
  "distinct",
  $.OperatorKind.Prefix,
  _.castMaps.mapLiteralToTypeSet<[P1]>,
  $.TypeSet<$.getPrimitiveBaseType<_.castMaps.literalToTypeSet<P1>["__element__"]>, $.Cardinality.Many>
>;
/**
* Merge two sets.
*/
function op<
  P1 extends $.TypeSet<_std.$decimalλICastableTo>,
  P2 extends $.TypeSet<_std.$decimalλICastableTo>,
>(
  s1: P1, op: "union", s2: P2
): $.$expr_Operator<
  "union",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_.syntax.getSharedParentPrimitive<P1["__element__"], P2["__element__"]>, $.Cardinality.Many>
>;
/**
* Merge two sets.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
  P2 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
>(
  s1: P1, op: "union", s2: P2
): $.$expr_Operator<
  "union",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_.syntax.getSharedParentPrimitive<P1["__element__"], P2["__element__"]>, $.Cardinality.Many>
>;
/**
* Merge two sets.
*/
function op<
  P1 extends $.TypeSet<$.ObjectType>,
  P2 extends $.TypeSet<$.ObjectType>,
>(
  s1: P1, op: "union", s2: P2
): $.$expr_Operator<
  "union",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_.syntax.mergeObjectTypes<P1["__element__"], P2["__element__"]>, $.Cardinality.Many>
>;
/**
* Merge two sets.
*/
function op<
  P1 extends $.TypeSet<$.AnyTupleType>,
  P2 extends $.TypeSet<$.AnyTupleType>,
>(
  s1: P1, op: "union", s2: P2
): $.$expr_Operator<
  "union",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_.syntax.getSharedParentPrimitive<P1["__element__"], P2["__element__"]>, $.Cardinality.Many>
>;
/**
* Merge two sets.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<$.BaseType>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<$.getPrimitiveBaseType<_.castMaps.literalToTypeSet<P1>["__element__"]>>>,
>(
  s1: P1, op: "union", s2: P2
): $.$expr_Operator<
  "union",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<$.getPrimitiveBaseType<_.castMaps.literalToTypeSet<P1>["__element__"]>, $.Cardinality.Many>
>;
/**
* Coalesce.
*/
function op<
  P1 extends $.TypeSet<_std.$decimalλICastableTo>,
  P2 extends $.TypeSet<_std.$decimalλICastableTo>,
>(
  l: P1, op: "??", r: P2
): $.$expr_Operator<
  "??",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_.syntax.getSharedParentPrimitive<P1["__element__"], P2["__element__"]>, $.Cardinality.Many>
>;
/**
* Coalesce.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
  P2 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "??", r: P2
): $.$expr_Operator<
  "??",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_.syntax.getSharedParentPrimitive<P1["__element__"], P2["__element__"]>, $.Cardinality.Many>
>;
/**
* Coalesce.
*/
function op<
  P1 extends $.TypeSet<$.ObjectType>,
  P2 extends $.TypeSet<$.ObjectType>,
>(
  l: P1, op: "??", r: P2
): $.$expr_Operator<
  "??",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_.syntax.mergeObjectTypes<P1["__element__"], P2["__element__"]>, $.Cardinality.Many>
>;
/**
* Coalesce.
*/
function op<
  P1 extends $.TypeSet<$.AnyTupleType>,
  P2 extends $.TypeSet<$.AnyTupleType>,
>(
  l: P1, op: "??", r: P2
): $.$expr_Operator<
  "??",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<_.syntax.getSharedParentPrimitive<P1["__element__"], P2["__element__"]>, $.Cardinality.Many>
>;
/**
* Coalesce.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<$.BaseType>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<$.getPrimitiveBaseType<_.castMaps.literalToTypeSet<P1>["__element__"]>>>,
>(
  l: P1, op: "??", r: P2
): $.$expr_Operator<
  "??",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<$.getPrimitiveBaseType<_.castMaps.literalToTypeSet<P1>["__element__"]>, $.Cardinality.Many>
>;
/**
* Conditionally provide one or the other result.
*/
function op<
  P1 extends $.TypeSet<_std.$decimalλICastableTo>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
  P3 extends $.TypeSet<_std.$decimalλICastableTo>,
>(
  if_true: P1, op: "if", condition: P2, op2: "else", if_false: P3
): $.$expr_Operator<
  "if_else",
  $.OperatorKind.Ternary,
  _.castMaps.mapLiteralToTypeSet<[P1, P2, P3]>,
  $.TypeSet<_.syntax.getSharedParentPrimitive<P1["__element__"], P3["__element__"]>, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.orCardinalities<P1["__cardinality__"], P3["__cardinality__"]>, _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Conditionally provide one or the other result.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
  P3 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
>(
  if_true: P1, op: "if", condition: P2, op2: "else", if_false: P3
): $.$expr_Operator<
  "if_else",
  $.OperatorKind.Ternary,
  _.castMaps.mapLiteralToTypeSet<[P1, P2, P3]>,
  $.TypeSet<_.syntax.getSharedParentPrimitive<P1["__element__"], P3["__element__"]>, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.orCardinalities<P1["__cardinality__"], P3["__cardinality__"]>, _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Conditionally provide one or the other result.
*/
function op<
  P1 extends $.TypeSet<$.ObjectType>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
  P3 extends $.TypeSet<$.ObjectType>,
>(
  if_true: P1, op: "if", condition: P2, op2: "else", if_false: P3
): $.$expr_Operator<
  "if_else",
  $.OperatorKind.Ternary,
  _.castMaps.mapLiteralToTypeSet<[P1, P2, P3]>,
  $.TypeSet<_.syntax.mergeObjectTypes<P1["__element__"], P3["__element__"]>, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.orCardinalities<P1["__cardinality__"], P3["__cardinality__"]>, _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Conditionally provide one or the other result.
*/
function op<
  P1 extends $.TypeSet<$.AnyTupleType>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
  P3 extends $.TypeSet<$.AnyTupleType>,
>(
  if_true: P1, op: "if", condition: P2, op2: "else", if_false: P3
): $.$expr_Operator<
  "if_else",
  $.OperatorKind.Ternary,
  _.castMaps.mapLiteralToTypeSet<[P1, P2, P3]>,
  $.TypeSet<_.syntax.getSharedParentPrimitive<P1["__element__"], P3["__element__"]>, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.orCardinalities<P1["__cardinality__"], P3["__cardinality__"]>, _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Conditionally provide one or the other result.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<$.BaseType>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bool>>,
  P3 extends _.castMaps.orScalarLiteral<$.TypeSet<$.getPrimitiveBaseType<_.castMaps.literalToTypeSet<P1>["__element__"]>>>,
>(
  if_true: P1, op: "if", condition: P2, op2: "else", if_false: P3
): $.$expr_Operator<
  "if_else",
  $.OperatorKind.Ternary,
  _.castMaps.mapLiteralToTypeSet<[P1, P2, P3]>,
  $.TypeSet<$.getPrimitiveBaseType<_.castMaps.literalToTypeSet<P1>["__element__"]>, $.cardinalityUtil.multiplyCardinalities<$.cardinalityUtil.orCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P3>["__cardinality__"]>, _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Array concatenation.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
  P2 extends $.TypeSet<$.ArrayType<_std.$decimalλICastableTo>>,
>(
  l: P1, op: "++", r: P2
): $.$expr_Operator<
  "++",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<$.ArrayType<_.syntax.getSharedParentPrimitive<P1["__element__"]["__element__"], P2["__element__"]["__element__"]>>, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Array concatenation.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.ObjectType>>,
  P2 extends $.TypeSet<$.ArrayType<$.ObjectType>>,
>(
  l: P1, op: "++", r: P2
): $.$expr_Operator<
  "++",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<$.ArrayType<_.syntax.mergeObjectTypes<P1["__element__"]["__element__"], P2["__element__"]["__element__"]>>, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Array concatenation.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.AnyTupleType>>,
  P2 extends $.TypeSet<$.ArrayType<$.AnyTupleType>>,
>(
  l: P1, op: "++", r: P2
): $.$expr_Operator<
  "++",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<$.ArrayType<_.syntax.getSharedParentPrimitive<P1["__element__"]["__element__"], P2["__element__"]["__element__"]>>, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Array concatenation.
*/
function op<
  P1 extends $.TypeSet<$.ArrayType<$.NonArrayType>>,
  P2 extends $.TypeSet<$.ArrayType<$.getPrimitiveNonArrayBaseType<P1["__element__"]["__element__"]>>>,
>(
  l: P1, op: "++", r: P2
): $.$expr_Operator<
  "++",
  $.OperatorKind.Infix,
  [P1, P2],
  $.TypeSet<$.ArrayType<$.getPrimitiveNonArrayBaseType<P1["__element__"]["__element__"]>>, $.cardinalityUtil.multiplyCardinalities<P1["__cardinality__"], P2["__cardinality__"]>>
>;
/**
* Bytes concatenation.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bytes>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bytes>>,
>(
  l: P1, op: "++", r: P2
): $.$expr_Operator<
  "++",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bytes, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* String concatenation.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
>(
  l: P1, op: "++", r: P2
): $.$expr_Operator<
  "++",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$str, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Concatenate two JSON values into a new JSON value.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$json>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$json>>,
>(
  l: P1, op: "++", r: P2
): $.$expr_Operator<
  "++",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$json, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Case-sensitive simple string matching.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
>(
  string: P1, op: "like", pattern: P2
): $.$expr_Operator<
  "like",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Case-insensitive simple string matching.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
>(
  string: P1, op: "ilike", pattern: P2
): $.$expr_Operator<
  "ilike",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Case-sensitive simple string matching.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
>(
  string: P1, op: "not like", pattern: P2
): $.$expr_Operator<
  "not like",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
/**
* Case-insensitive simple string matching.
*/
function op<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$str>>,
>(
  string: P1, op: "not ilike", pattern: P2
): $.$expr_Operator<
  "not ilike",
  $.OperatorKind.Infix,
  _.castMaps.mapLiteralToTypeSet<[P1, P2]>,
  $.TypeSet<_std.$bool, $.cardinalityUtil.multiplyCardinalities<_.castMaps.literalToTypeSet<P1>["__cardinality__"], _.castMaps.literalToTypeSet<P2>["__cardinality__"]>>
>;
function op(...args: any[]) {
  let op: string = "";
    let params: any[] = [];
    let defs: any[] | null = null;
    if (args.length === 2) {
      if (typeof args[0] === "string" && overloadDefs.Prefix[args[0]]) {
        op = args[0];
        params = [args[1]];
        defs = overloadDefs.Prefix[op];
      } else if (typeof args[1] === "string" && overloadDefs.Postfix[args[1]]) {
        op = args[1];
        params = [args[0]];
        defs = overloadDefs.Postfix[op];
      }
    } else if (args.length === 3) {
      if (typeof args[1] === "string") {
        op = args[1];
        params = [args[0], args[2]];
        defs = overloadDefs.Infix[op];
      }
    } else if (args.length === 5) {
      if (typeof args[1] === "string" && typeof args[3] === "string") {
        op = `${args[1]}_${args[3]}`;
        params = [args[0], args[2], args[4]];
        defs = overloadDefs.Ternary[op];
      }
    }
  
    if (!defs) {
      throw new Error(`No operator exists with signature: ${args.map(arg => `${arg}`).join(", ")}`);
    }

  const {kind, returnType, cardinality, args: resolvedArgs} = _.syntax.$resolveOverload(op, params, _.spec, defs);

  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Operator,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: op,
    __opkind__: kind,
    __args__: resolvedArgs,
  }) as any;
};


export { op };
