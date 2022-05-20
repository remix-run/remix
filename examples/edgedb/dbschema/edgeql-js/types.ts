import type * as edgedb from "edgedb";
export namespace std {
  export interface BaseObject {
    "id": string;
    "__type__": schema.Type;
  }
  export interface $Object extends BaseObject {}
  export interface FreeObject extends BaseObject {}
}
export namespace schema {
  export interface $Object extends std.BaseObject {
    "name": string;
    "internal": boolean;
    "builtin": boolean;
    "computed_fields"?: string[] | null;
  }
  export interface AnnotationSubject extends $Object {
    "annotations": Annotation[];
  }
  export interface Alias extends AnnotationSubject {
    "expr": string;
    "type": Type;
  }
  export interface SubclassableObject extends $Object {
    "abstract"?: boolean | null;
    "is_abstract"?: boolean | null;
    "final": boolean;
    "is_final": boolean;
  }
  export interface InheritingObject extends SubclassableObject {
    "bases": InheritingObject[];
    "ancestors": InheritingObject[];
    "inherited_fields"?: string[] | null;
  }
  export interface Annotation extends $Object, InheritingObject {
    "inheritable"?: boolean | null;
  }
  export interface Type extends SubclassableObject, AnnotationSubject {
    "expr"?: string | null;
    "from_alias": boolean;
    "is_from_alias": boolean;
  }
  export interface PrimitiveType extends Type {}
  export interface CollectionType extends PrimitiveType {}
  export interface Array extends CollectionType {
    "element_type": Type;
    "dimensions"?: number[] | null;
  }
  export interface CallableObject extends AnnotationSubject {
    "params": Parameter[];
    "return_type"?: Type | null;
    "return_typemod"?: TypeModifier | null;
  }
  export enum Cardinality {
    One = "One",
    Many = "Many",
  }
  export interface VolatilitySubject extends $Object {
    "volatility"?: Volatility | null;
  }
  export interface Cast extends AnnotationSubject, VolatilitySubject {
    "from_type"?: Type | null;
    "to_type"?: Type | null;
    "allow_implicit"?: boolean | null;
    "allow_assignment"?: boolean | null;
  }
  export interface ConsistencySubject extends $Object, InheritingObject, AnnotationSubject {
    "constraints": Constraint[];
  }
  export interface Constraint extends CallableObject, InheritingObject {
    "params": Parameter[];
    "expr"?: string | null;
    "subjectexpr"?: string | null;
    "finalexpr"?: string | null;
    "errmessage"?: string | null;
    "delegated"?: boolean | null;
    "subject"?: ConsistencySubject | null;
  }
  export interface Delta extends $Object {
    "parents": Delta[];
  }
  export interface Extension extends AnnotationSubject, $Object {
    "package": sys.ExtensionPackage;
  }
  export interface Function extends CallableObject, VolatilitySubject {
    "preserves_optionality"?: boolean | null;
  }
  export interface Index extends AnnotationSubject {
    "expr"?: string | null;
  }
  export interface Pointer extends InheritingObject, ConsistencySubject, AnnotationSubject {
    "cardinality"?: Cardinality | null;
    "required"?: boolean | null;
    "readonly"?: boolean | null;
    "default"?: string | null;
    "expr"?: string | null;
    "source"?: Source | null;
    "target"?: Type | null;
  }
  export interface Source extends $Object {
    "indexes": Index[];
    "pointers": Pointer[];
  }
  export interface Link extends Pointer, Source {
    "target"?: ObjectType | null;
    "properties": Property[];
    "on_target_delete"?: TargetDeleteAction | null;
  }
  export interface Migration extends AnnotationSubject, $Object {
    "parents": Migration[];
    "script": string;
    "message"?: string | null;
  }
  export interface Module extends $Object, AnnotationSubject {}
  export interface ObjectType extends InheritingObject, ConsistencySubject, AnnotationSubject, Type, Source {
    "union_of": ObjectType[];
    "intersection_of": ObjectType[];
    "compound_type": boolean;
    "is_compound_type": boolean;
    "links": Link[];
    "properties": Property[];
  }
  export interface Operator extends CallableObject, VolatilitySubject {
    "operator_kind"?: OperatorKind | null;
    "abstract"?: boolean | null;
    "is_abstract"?: boolean | null;
  }
  export enum OperatorKind {
    Infix = "Infix",
    Postfix = "Postfix",
    Prefix = "Prefix",
    Ternary = "Ternary",
  }
  export interface Parameter extends $Object {
    "type": Type;
    "typemod": TypeModifier;
    "kind": ParameterKind;
    "num": number;
    "default"?: string | null;
  }
  export enum ParameterKind {
    VariadicParam = "VariadicParam",
    NamedOnlyParam = "NamedOnlyParam",
    PositionalParam = "PositionalParam",
  }
  export interface Property extends Pointer {}
  export interface PseudoType extends InheritingObject, Type {}
  export interface ScalarType extends InheritingObject, ConsistencySubject, AnnotationSubject, PrimitiveType {
    "default"?: string | null;
    "enum_values"?: string[] | null;
  }
  export enum TargetDeleteAction {
    Restrict = "Restrict",
    DeleteSource = "DeleteSource",
    Allow = "Allow",
    DeferredRestrict = "DeferredRestrict",
  }
  export interface Tuple extends CollectionType {
    "element_types": TupleElement[];
  }
  export interface TupleElement extends std.BaseObject {
    "type": Type;
    "name"?: string | null;
  }
  export enum TypeModifier {
    SetOfType = "SetOfType",
    OptionalType = "OptionalType",
    SingletonType = "SingletonType",
  }
  export enum Volatility {
    Immutable = "Immutable",
    Stable = "Stable",
    Volatile = "Volatile",
  }
}
export namespace cfg {
  export interface ConfigObject extends std.BaseObject {}
  export interface AbstractConfig extends ConfigObject {
    "session_idle_timeout": edgedb.Duration;
    "session_idle_transaction_timeout": edgedb.Duration;
    "query_execution_timeout": edgedb.Duration;
    "listen_port": number;
    "listen_addresses": string[];
    "auth": Auth[];
    "allow_dml_in_functions"?: boolean | null;
    "allow_bare_ddl"?: AllowBareDDL | null;
    "shared_buffers"?: edgedb.ConfigMemory | null;
    "query_work_mem"?: edgedb.ConfigMemory | null;
    "effective_cache_size"?: edgedb.ConfigMemory | null;
    "effective_io_concurrency"?: number | null;
    "default_statistics_target"?: number | null;
  }
  export enum AllowBareDDL {
    AlwaysAllow = "AlwaysAllow",
    NeverAllow = "NeverAllow",
  }
  export interface Auth extends ConfigObject {
    "priority": number;
    "user": string[];
    "method"?: AuthMethod | null;
    "comment"?: string | null;
  }
  export interface AuthMethod extends ConfigObject {}
  export interface Config extends AbstractConfig {}
  export interface DatabaseConfig extends AbstractConfig {}
  export interface InstanceConfig extends AbstractConfig {}
  export interface SCRAM extends AuthMethod {}
  export interface Trust extends AuthMethod {}
}
export interface Joke extends std.$Object {
  "content": string;
  "createdAt": Date;
  "name": string;
  "jokester": User;
}
export interface User extends std.$Object {
  "createdAt": Date;
  "passwordHash": string;
  "username": string;
  "jokes": Joke[];
}
export namespace sys {
  export interface SystemObject extends schema.AnnotationSubject {}
  export interface Database extends SystemObject, schema.AnnotationSubject {
    "name": string;
  }
  export interface ExtensionPackage extends SystemObject, schema.AnnotationSubject {
    "script": string;
    "version": {major: number, minor: number, stage: VersionStage, stage_no: number, local: string[]};
  }
  export interface Role extends SystemObject, schema.InheritingObject, schema.AnnotationSubject {
    "name": string;
    "superuser": boolean;
    "is_superuser": boolean;
    "password"?: string | null;
    "member_of": Role[];
  }
  export enum TransactionIsolation {
    RepeatableRead = "RepeatableRead",
    Serializable = "Serializable",
  }
  export enum VersionStage {
    dev = "dev",
    alpha = "alpha",
    beta = "beta",
    rc = "rc",
    final = "final",
  }
}
export interface types {
  "std": {
    "BaseObject": std.BaseObject;
    "Object": std.$Object;
    "FreeObject": std.FreeObject;
  };
  "schema": {
    "Object": schema.$Object;
    "AnnotationSubject": schema.AnnotationSubject;
    "Alias": schema.Alias;
    "SubclassableObject": schema.SubclassableObject;
    "InheritingObject": schema.InheritingObject;
    "Annotation": schema.Annotation;
    "Type": schema.Type;
    "PrimitiveType": schema.PrimitiveType;
    "CollectionType": schema.CollectionType;
    "Array": schema.Array;
    "CallableObject": schema.CallableObject;
    "Cardinality": schema.Cardinality;
    "VolatilitySubject": schema.VolatilitySubject;
    "Cast": schema.Cast;
    "ConsistencySubject": schema.ConsistencySubject;
    "Constraint": schema.Constraint;
    "Delta": schema.Delta;
    "Extension": schema.Extension;
    "Function": schema.Function;
    "Index": schema.Index;
    "Pointer": schema.Pointer;
    "Source": schema.Source;
    "Link": schema.Link;
    "Migration": schema.Migration;
    "Module": schema.Module;
    "ObjectType": schema.ObjectType;
    "Operator": schema.Operator;
    "OperatorKind": schema.OperatorKind;
    "Parameter": schema.Parameter;
    "ParameterKind": schema.ParameterKind;
    "Property": schema.Property;
    "PseudoType": schema.PseudoType;
    "ScalarType": schema.ScalarType;
    "TargetDeleteAction": schema.TargetDeleteAction;
    "Tuple": schema.Tuple;
    "TupleElement": schema.TupleElement;
    "TypeModifier": schema.TypeModifier;
    "Volatility": schema.Volatility;
  };
  "cfg": {
    "ConfigObject": cfg.ConfigObject;
    "AbstractConfig": cfg.AbstractConfig;
    "AllowBareDDL": cfg.AllowBareDDL;
    "Auth": cfg.Auth;
    "AuthMethod": cfg.AuthMethod;
    "Config": cfg.Config;
    "DatabaseConfig": cfg.DatabaseConfig;
    "InstanceConfig": cfg.InstanceConfig;
    "SCRAM": cfg.SCRAM;
    "Trust": cfg.Trust;
  };
  "default": {
    "Joke": Joke;
    "User": User;
  };
  "sys": {
    "SystemObject": sys.SystemObject;
    "Database": sys.Database;
    "ExtensionPackage": sys.ExtensionPackage;
    "Role": sys.Role;
    "TransactionIsolation": sys.TransactionIsolation;
    "VersionStage": sys.VersionStage;
  };
}
