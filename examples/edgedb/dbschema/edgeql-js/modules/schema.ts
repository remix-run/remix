import { $ } from "edgedb";
import * as _ from "../imports";
import type * as _std from "./std";
import type * as _sys from "./sys";
import type * as _cfg from "./cfg";
import type * as _default from "./default";
enum $CardinalityλEnum {
  One = "One",
  Many = "Many",
}
export type $Cardinality = {
  One: $.$expr_Literal<$Cardinality>;
  Many: $.$expr_Literal<$Cardinality>;
} & $.EnumType<"schema::Cardinality", `${$CardinalityλEnum}`>;
const Cardinality: $Cardinality = $.makeType<$Cardinality>(_.spec, "f267a21a-bda6-11ec-85e9-31770a5a2c0f", _.syntax.literal);

enum $OperatorKindλEnum {
  Infix = "Infix",
  Postfix = "Postfix",
  Prefix = "Prefix",
  Ternary = "Ternary",
}
export type $OperatorKind = {
  Infix: $.$expr_Literal<$OperatorKind>;
  Postfix: $.$expr_Literal<$OperatorKind>;
  Prefix: $.$expr_Literal<$OperatorKind>;
  Ternary: $.$expr_Literal<$OperatorKind>;
} & $.EnumType<"schema::OperatorKind", `${$OperatorKindλEnum}`>;
const OperatorKind: $OperatorKind = $.makeType<$OperatorKind>(_.spec, "f2693bf2-bda6-11ec-bb13-b5ef6930567c", _.syntax.literal);

enum $ParameterKindλEnum {
  VariadicParam = "VariadicParam",
  NamedOnlyParam = "NamedOnlyParam",
  PositionalParam = "PositionalParam",
}
export type $ParameterKind = {
  VariadicParam: $.$expr_Literal<$ParameterKind>;
  NamedOnlyParam: $.$expr_Literal<$ParameterKind>;
  PositionalParam: $.$expr_Literal<$ParameterKind>;
} & $.EnumType<"schema::ParameterKind", `${$ParameterKindλEnum}`>;
const ParameterKind: $ParameterKind = $.makeType<$ParameterKind>(_.spec, "f26acea4-bda6-11ec-91b4-cb5295edeb8f", _.syntax.literal);

enum $TargetDeleteActionλEnum {
  Restrict = "Restrict",
  DeleteSource = "DeleteSource",
  Allow = "Allow",
  DeferredRestrict = "DeferredRestrict",
}
export type $TargetDeleteAction = {
  Restrict: $.$expr_Literal<$TargetDeleteAction>;
  DeleteSource: $.$expr_Literal<$TargetDeleteAction>;
  Allow: $.$expr_Literal<$TargetDeleteAction>;
  DeferredRestrict: $.$expr_Literal<$TargetDeleteAction>;
} & $.EnumType<"schema::TargetDeleteAction", `${$TargetDeleteActionλEnum}`>;
const TargetDeleteAction: $TargetDeleteAction = $.makeType<$TargetDeleteAction>(_.spec, "f268729e-bda6-11ec-b43a-edcfbfaa5880", _.syntax.literal);

enum $TypeModifierλEnum {
  SetOfType = "SetOfType",
  OptionalType = "OptionalType",
  SingletonType = "SingletonType",
}
export type $TypeModifier = {
  SetOfType: $.$expr_Literal<$TypeModifier>;
  OptionalType: $.$expr_Literal<$TypeModifier>;
  SingletonType: $.$expr_Literal<$TypeModifier>;
} & $.EnumType<"schema::TypeModifier", `${$TypeModifierλEnum}`>;
const TypeModifier: $TypeModifier = $.makeType<$TypeModifier>(_.spec, "f26b9e42-bda6-11ec-9417-c7df83d7df9f", _.syntax.literal);

enum $VolatilityλEnum {
  Immutable = "Immutable",
  Stable = "Stable",
  Volatile = "Volatile",
}
export type $Volatility = {
  Immutable: $.$expr_Literal<$Volatility>;
  Stable: $.$expr_Literal<$Volatility>;
  Volatile: $.$expr_Literal<$Volatility>;
} & $.EnumType<"schema::Volatility", `${$VolatilityλEnum}`>;
const Volatility: $Volatility = $.makeType<$Volatility>(_.spec, "f26a05dc-bda6-11ec-a27d-0b05559a8862", _.syntax.literal);

export type $Object_f26c9afebda611eca74dc1160a60a2d8λShape = $.typeutil.flatten<_std.$BaseObjectλShape & {
  "name": $.PropertyDesc<_std.$str, $.Cardinality.One, false, false, false, false>;
  "internal": $.PropertyDesc<_std.$bool, $.Cardinality.One, false, false, false, true>;
  "builtin": $.PropertyDesc<_std.$bool, $.Cardinality.One, false, false, false, true>;
  "computed_fields": $.PropertyDesc<$.ArrayType<_std.$str>, $.Cardinality.AtMostOne, false, false, false, false>;
}>;
type $Object_f26c9afebda611eca74dc1160a60a2d8 = $.ObjectType<"schema::Object", $Object_f26c9afebda611eca74dc1160a60a2d8λShape, null>;
const $Object_f26c9afebda611eca74dc1160a60a2d8 = $.makeType<$Object_f26c9afebda611eca74dc1160a60a2d8>(_.spec, "f26c9afe-bda6-11ec-a74d-c1160a60a2d8", _.syntax.literal);

const Object_f26c9afebda611eca74dc1160a60a2d8: $.$expr_PathNode<$.TypeSet<$Object_f26c9afebda611eca74dc1160a60a2d8, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Object_f26c9afebda611eca74dc1160a60a2d8, $.Cardinality.Many), null, true);

export type $AnnotationSubjectλShape = $.typeutil.flatten<$Object_f26c9afebda611eca74dc1160a60a2d8λShape & {
  "annotations": $.LinkDesc<$Annotation, $.Cardinality.Many, {
    "@is_owned": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne>;
    "@owned": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne>;
    "@value": $.PropertyDesc<_std.$str, $.Cardinality.AtMostOne>;
  }, false, false, false, false>;
}>;
type $AnnotationSubject = $.ObjectType<"schema::AnnotationSubject", $AnnotationSubjectλShape, null>;
const $AnnotationSubject = $.makeType<$AnnotationSubject>(_.spec, "f3c47c46-bda6-11ec-90b3-b1fcddd52a4b", _.syntax.literal);

const AnnotationSubject: $.$expr_PathNode<$.TypeSet<$AnnotationSubject, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($AnnotationSubject, $.Cardinality.Many), null, true);

export type $AliasλShape = $.typeutil.flatten<$AnnotationSubjectλShape & {
  "expr": $.PropertyDesc<_std.$str, $.Cardinality.One, false, false, false, false>;
  "type": $.LinkDesc<$Type, $.Cardinality.One, {}, false, false,  false, false>;
}>;
type $Alias = $.ObjectType<"schema::Alias", $AliasλShape, null>;
const $Alias = $.makeType<$Alias>(_.spec, "f595ca52-bda6-11ec-a89d-7db78ed7f1a6", _.syntax.literal);

const Alias: $.$expr_PathNode<$.TypeSet<$Alias, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Alias, $.Cardinality.Many), null, true);

export type $SubclassableObjectλShape = $.typeutil.flatten<$Object_f26c9afebda611eca74dc1160a60a2d8λShape & {
  "abstract": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne, false, false, false, true>;
  "is_abstract": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne, false, true, false, true>;
  "final": $.PropertyDesc<_std.$bool, $.Cardinality.One, false, true, false, false>;
  "is_final": $.PropertyDesc<_std.$bool, $.Cardinality.One, false, true, false, false>;
}>;
type $SubclassableObject = $.ObjectType<"schema::SubclassableObject", $SubclassableObjectλShape, null>;
const $SubclassableObject = $.makeType<$SubclassableObject>(_.spec, "f279599c-bda6-11ec-9d30-d99f779a2d0b", _.syntax.literal);

const SubclassableObject: $.$expr_PathNode<$.TypeSet<$SubclassableObject, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($SubclassableObject, $.Cardinality.Many), null, true);

export type $InheritingObjectλShape = $.typeutil.flatten<$SubclassableObjectλShape & {
  "bases": $.LinkDesc<$InheritingObject, $.Cardinality.Many, {
    "@index": $.PropertyDesc<_std.$int64, $.Cardinality.AtMostOne>;
  }, false, false, false, false>;
  "ancestors": $.LinkDesc<$InheritingObject, $.Cardinality.Many, {
    "@index": $.PropertyDesc<_std.$int64, $.Cardinality.AtMostOne>;
  }, false, false, false, false>;
  "inherited_fields": $.PropertyDesc<$.ArrayType<_std.$str>, $.Cardinality.AtMostOne, false, false, false, false>;
  "<bases[is schema::InheritingObject]": $.LinkDesc<$InheritingObject, $.Cardinality.Many, {}, false, false,  false, false>;
  "<ancestors[is schema::InheritingObject]": $.LinkDesc<$InheritingObject, $.Cardinality.Many, {}, false, false,  false, false>;
  "<bases[is schema::Constraint]": $.LinkDesc<$Constraint, $.Cardinality.Many, {}, false, false,  false, false>;
  "<ancestors[is schema::Constraint]": $.LinkDesc<$Constraint, $.Cardinality.Many, {}, false, false,  false, false>;
  "<bases[is schema::Pointer]": $.LinkDesc<$Pointer, $.Cardinality.Many, {}, false, false,  false, false>;
  "<ancestors[is schema::Pointer]": $.LinkDesc<$Pointer, $.Cardinality.Many, {}, false, false,  false, false>;
  "<bases[is schema::Property]": $.LinkDesc<$Property, $.Cardinality.Many, {}, false, false,  false, false>;
  "<ancestors[is schema::Property]": $.LinkDesc<$Property, $.Cardinality.Many, {}, false, false,  false, false>;
  "<bases[is schema::Link]": $.LinkDesc<$Link, $.Cardinality.Many, {}, false, false,  false, false>;
  "<ancestors[is schema::Link]": $.LinkDesc<$Link, $.Cardinality.Many, {}, false, false,  false, false>;
  "<bases[is schema::ObjectType]": $.LinkDesc<$ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<ancestors[is schema::ObjectType]": $.LinkDesc<$ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<bases[is schema::ScalarType]": $.LinkDesc<$ScalarType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<ancestors[is schema::ScalarType]": $.LinkDesc<$ScalarType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<ancestors": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<bases": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $InheritingObject = $.ObjectType<"schema::InheritingObject", $InheritingObjectλShape, null>;
const $InheritingObject = $.makeType<$InheritingObject>(_.spec, "f3e0e55c-bda6-11ec-8415-f95288fe02a3", _.syntax.literal);

const InheritingObject: $.$expr_PathNode<$.TypeSet<$InheritingObject, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($InheritingObject, $.Cardinality.Many), null, true);

export type $AnnotationλShape = $.typeutil.flatten<$Object_f26c9afebda611eca74dc1160a60a2d8λShape & $InheritingObjectλShape & {
  "inheritable": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne, false, false, false, false>;
  "<annotations[is schema::AnnotationSubject]": $.LinkDesc<$AnnotationSubject, $.Cardinality.Many, {}, false, false,  false, false>;
  "<annotations[is sys::SystemObject]": $.LinkDesc<_sys.$SystemObject, $.Cardinality.Many, {}, false, false,  false, false>;
  "<annotations[is schema::CallableObject]": $.LinkDesc<$CallableObject, $.Cardinality.Many, {}, false, false,  false, false>;
  "<annotations[is schema::Operator]": $.LinkDesc<$Operator, $.Cardinality.Many, {}, false, false,  false, false>;
  "<annotations[is schema::Function]": $.LinkDesc<$Function, $.Cardinality.Many, {}, false, false,  false, false>;
  "<annotations[is schema::Cast]": $.LinkDesc<$Cast, $.Cardinality.Many, {}, false, false,  false, false>;
  "<annotations[is schema::Migration]": $.LinkDesc<$Migration, $.Cardinality.Many, {}, false, false,  false, false>;
  "<annotations[is schema::Constraint]": $.LinkDesc<$Constraint, $.Cardinality.Many, {}, false, false,  false, false>;
  "<annotations[is schema::Index]": $.LinkDesc<$Index, $.Cardinality.Many, {}, false, false,  false, false>;
  "<annotations[is schema::Alias]": $.LinkDesc<$Alias, $.Cardinality.Many, {}, false, false,  false, false>;
  "<annotations[is schema::Pointer]": $.LinkDesc<$Pointer, $.Cardinality.Many, {}, false, false,  false, false>;
  "<annotations[is schema::Property]": $.LinkDesc<$Property, $.Cardinality.Many, {}, false, false,  false, false>;
  "<annotations[is schema::Link]": $.LinkDesc<$Link, $.Cardinality.Many, {}, false, false,  false, false>;
  "<annotations[is schema::ObjectType]": $.LinkDesc<$ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<annotations[is schema::ScalarType]": $.LinkDesc<$ScalarType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<annotations[is sys::Role]": $.LinkDesc<_sys.$Role, $.Cardinality.Many, {}, false, false,  false, false>;
  "<annotations[is sys::ExtensionPackage]": $.LinkDesc<_sys.$ExtensionPackage, $.Cardinality.Many, {}, false, false,  false, false>;
  "<annotations[is schema::Extension]": $.LinkDesc<$Extension, $.Cardinality.Many, {}, false, false,  false, false>;
  "<annotations[is sys::Database]": $.LinkDesc<_sys.$Database, $.Cardinality.Many, {}, false, false,  false, false>;
  "<annotations": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $Annotation = $.ObjectType<"schema::Annotation", $AnnotationλShape, null>;
const $Annotation = $.makeType<$Annotation>(_.spec, "f3af283c-bda6-11ec-9b14-998c69285076", _.syntax.literal);

const Annotation: $.$expr_PathNode<$.TypeSet<$Annotation, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Annotation, $.Cardinality.Many), null, true);

export type $TypeλShape = $.typeutil.flatten<$SubclassableObjectλShape & $AnnotationSubjectλShape & {
  "expr": $.PropertyDesc<_std.$str, $.Cardinality.AtMostOne, false, false, false, false>;
  "from_alias": $.PropertyDesc<_std.$bool, $.Cardinality.One, false, true, false, false>;
  "is_from_alias": $.PropertyDesc<_std.$bool, $.Cardinality.One, false, true, false, false>;
  "<__type__[is std::BaseObject]": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Object]": $.LinkDesc<$Object_f26c9afebda611eca74dc1160a60a2d8, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::SubclassableObject]": $.LinkDesc<$SubclassableObject, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is std::Object]": $.LinkDesc<_std.$Object_f1e1d4a0bda611eca08599c7be50f4a1, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is std::FreeObject]": $.LinkDesc<_std.$FreeObject, $.Cardinality.Many, {}, false, false,  false, false>;
  "<element_type[is schema::Array]": $.LinkDesc<$Array, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::TupleElement]": $.LinkDesc<$TupleElement, $.Cardinality.Many, {}, false, false,  false, false>;
  "<type[is schema::TupleElement]": $.LinkDesc<$TupleElement, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Delta]": $.LinkDesc<$Delta, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::AnnotationSubject]": $.LinkDesc<$AnnotationSubject, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::InheritingObject]": $.LinkDesc<$InheritingObject, $.Cardinality.Many, {}, false, false,  false, false>;
  "<type[is schema::Parameter]": $.LinkDesc<$Parameter, $.Cardinality.Many, {}, false, false,  false, false>;
  "<return_type[is schema::CallableObject]": $.LinkDesc<$CallableObject, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::VolatilitySubject]": $.LinkDesc<$VolatilitySubject, $.Cardinality.Many, {}, false, false,  false, false>;
  "<from_type[is schema::Cast]": $.LinkDesc<$Cast, $.Cardinality.Many, {}, false, false,  false, false>;
  "<type[is schema::Alias]": $.LinkDesc<$Alias, $.Cardinality.Many, {}, false, false,  false, false>;
  "<to_type[is schema::Cast]": $.LinkDesc<$Cast, $.Cardinality.Many, {}, false, false,  false, false>;
  "<target[is schema::Pointer]": $.LinkDesc<$Pointer, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is sys::SystemObject]": $.LinkDesc<_sys.$SystemObject, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is cfg::ConfigObject]": $.LinkDesc<_cfg.$ConfigObject, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is cfg::AuthMethod]": $.LinkDesc<_cfg.$AuthMethod, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is cfg::Trust]": $.LinkDesc<_cfg.$Trust, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is cfg::SCRAM]": $.LinkDesc<_cfg.$SCRAM, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is cfg::Auth]": $.LinkDesc<_cfg.$Auth, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is cfg::AbstractConfig]": $.LinkDesc<_cfg.$AbstractConfig, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is cfg::Config]": $.LinkDesc<_cfg.$Config, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is cfg::InstanceConfig]": $.LinkDesc<_cfg.$InstanceConfig, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is cfg::DatabaseConfig]": $.LinkDesc<_cfg.$DatabaseConfig, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Annotation]": $.LinkDesc<$Annotation, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Type]": $.LinkDesc<$Type, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::PrimitiveType]": $.LinkDesc<$PrimitiveType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::CollectionType]": $.LinkDesc<$CollectionType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Array]": $.LinkDesc<$Array, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Tuple]": $.LinkDesc<$Tuple, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Parameter]": $.LinkDesc<$Parameter, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::CallableObject]": $.LinkDesc<$CallableObject, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Operator]": $.LinkDesc<$Operator, $.Cardinality.Many, {}, false, false,  false, false>;
  "<return_type[is schema::Operator]": $.LinkDesc<$Operator, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Function]": $.LinkDesc<$Function, $.Cardinality.Many, {}, false, false,  false, false>;
  "<return_type[is schema::Function]": $.LinkDesc<$Function, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Cast]": $.LinkDesc<$Cast, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Migration]": $.LinkDesc<$Migration, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Module]": $.LinkDesc<$Module, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::PseudoType]": $.LinkDesc<$PseudoType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Constraint]": $.LinkDesc<$Constraint, $.Cardinality.Many, {}, false, false,  false, false>;
  "<return_type[is schema::Constraint]": $.LinkDesc<$Constraint, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::ConsistencySubject]": $.LinkDesc<$ConsistencySubject, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Index]": $.LinkDesc<$Index, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Alias]": $.LinkDesc<$Alias, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Pointer]": $.LinkDesc<$Pointer, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Property]": $.LinkDesc<$Property, $.Cardinality.Many, {}, false, false,  false, false>;
  "<target[is schema::Property]": $.LinkDesc<$Property, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Source]": $.LinkDesc<$Source, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Link]": $.LinkDesc<$Link, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::ObjectType]": $.LinkDesc<$ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::ScalarType]": $.LinkDesc<$ScalarType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is sys::Role]": $.LinkDesc<_sys.$Role, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is sys::ExtensionPackage]": $.LinkDesc<_sys.$ExtensionPackage, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is schema::Extension]": $.LinkDesc<$Extension, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is sys::Database]": $.LinkDesc<_sys.$Database, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is Joke]": $.LinkDesc<_default.$Joke, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__[is User]": $.LinkDesc<_default.$User, $.Cardinality.Many, {}, false, false,  false, false>;
  "<__type__": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<element_type": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<from_type": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<return_type": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<target": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<to_type": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<type": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $Type = $.ObjectType<"schema::Type", $TypeλShape, null>;
const $Type = $.makeType<$Type>(_.spec, "f28c6226-bda6-11ec-8630-914bc003340d", _.syntax.literal);

const Type: $.$expr_PathNode<$.TypeSet<$Type, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Type, $.Cardinality.Many), null, true);

export type $PrimitiveTypeλShape = $.typeutil.flatten<$TypeλShape & {
}>;
type $PrimitiveType = $.ObjectType<"schema::PrimitiveType", $PrimitiveTypeλShape, null>;
const $PrimitiveType = $.makeType<$PrimitiveType>(_.spec, "f2f6d502-bda6-11ec-8ecb-371fc06a94bd", _.syntax.literal);

const PrimitiveType: $.$expr_PathNode<$.TypeSet<$PrimitiveType, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($PrimitiveType, $.Cardinality.Many), null, true);

export type $CollectionTypeλShape = $.typeutil.flatten<$PrimitiveTypeλShape & {
}>;
type $CollectionType = $.ObjectType<"schema::CollectionType", $CollectionTypeλShape, null>;
const $CollectionType = $.makeType<$CollectionType>(_.spec, "f316065c-bda6-11ec-abc0-212a631969ca", _.syntax.literal);

const CollectionType: $.$expr_PathNode<$.TypeSet<$CollectionType, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($CollectionType, $.Cardinality.Many), null, true);

export type $ArrayλShape = $.typeutil.flatten<$CollectionTypeλShape & {
  "element_type": $.LinkDesc<$Type, $.Cardinality.One, {}, false, false,  false, false>;
  "dimensions": $.PropertyDesc<$.ArrayType<_std.$int16>, $.Cardinality.AtMostOne, false, false, false, false>;
}>;
type $Array = $.ObjectType<"schema::Array", $ArrayλShape, null>;
const $Array = $.makeType<$Array>(_.spec, "f335615a-bda6-11ec-8bcc-77383e0c7101", _.syntax.literal);

const Array: $.$expr_PathNode<$.TypeSet<$Array, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Array, $.Cardinality.Many), null, true);

export type $CallableObjectλShape = $.typeutil.flatten<$AnnotationSubjectλShape & {
  "params": $.LinkDesc<$Parameter, $.Cardinality.Many, {
    "@index": $.PropertyDesc<_std.$int64, $.Cardinality.AtMostOne>;
  }, false, false, false, false>;
  "return_type": $.LinkDesc<$Type, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "return_typemod": $.PropertyDesc<$TypeModifier, $.Cardinality.AtMostOne, false, false, false, false>;
}>;
type $CallableObject = $.ObjectType<"schema::CallableObject", $CallableObjectλShape, null>;
const $CallableObject = $.makeType<$CallableObject>(_.spec, "f4549f06-bda6-11ec-8965-9b8f51d4e8e7", _.syntax.literal);

const CallableObject: $.$expr_PathNode<$.TypeSet<$CallableObject, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($CallableObject, $.Cardinality.Many), null, true);

export type $VolatilitySubjectλShape = $.typeutil.flatten<$Object_f26c9afebda611eca74dc1160a60a2d8λShape & {
  "volatility": $.PropertyDesc<$Volatility, $.Cardinality.AtMostOne, false, false, false, true>;
}>;
type $VolatilitySubject = $.ObjectType<"schema::VolatilitySubject", $VolatilitySubjectλShape, null>;
const $VolatilitySubject = $.makeType<$VolatilitySubject>(_.spec, "f47d5324-bda6-11ec-bb07-a910b74573ac", _.syntax.literal);

const VolatilitySubject: $.$expr_PathNode<$.TypeSet<$VolatilitySubject, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($VolatilitySubject, $.Cardinality.Many), null, true);

export type $CastλShape = $.typeutil.flatten<$AnnotationSubjectλShape & $VolatilitySubjectλShape & {
  "from_type": $.LinkDesc<$Type, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "to_type": $.LinkDesc<$Type, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "allow_implicit": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne, false, false, false, false>;
  "allow_assignment": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne, false, false, false, false>;
}>;
type $Cast = $.ObjectType<"schema::Cast", $CastλShape, null>;
const $Cast = $.makeType<$Cast>(_.spec, "f80b1756-bda6-11ec-8ce3-0d83f0430521", _.syntax.literal);

const Cast: $.$expr_PathNode<$.TypeSet<$Cast, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Cast, $.Cardinality.Many), null, true);

export type $ConsistencySubjectλShape = $.typeutil.flatten<$Object_f26c9afebda611eca74dc1160a60a2d8λShape & $InheritingObjectλShape & $AnnotationSubjectλShape & {
  "constraints": $.LinkDesc<$Constraint, $.Cardinality.Many, {
    "@is_owned": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne>;
    "@owned": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne>;
  }, true, false, false, false>;
  "<subject[is schema::Constraint]": $.LinkDesc<$Constraint, $.Cardinality.Many, {}, false, false,  false, false>;
  "<subject": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $ConsistencySubject = $.ObjectType<"schema::ConsistencySubject", $ConsistencySubjectλShape, null>;
const $ConsistencySubject = $.makeType<$ConsistencySubject>(_.spec, "f4db97e0-bda6-11ec-8030-6b127f9e3775", _.syntax.literal);

const ConsistencySubject: $.$expr_PathNode<$.TypeSet<$ConsistencySubject, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($ConsistencySubject, $.Cardinality.Many), null, true);

export type $ConstraintλShape = $.typeutil.flatten<$CallableObjectλShape & $InheritingObjectλShape & {
  "params": $.LinkDesc<$Parameter, $.Cardinality.Many, {
    "@index": $.PropertyDesc<_std.$int64, $.Cardinality.AtMostOne>;
    "@value": $.PropertyDesc<_std.$str, $.Cardinality.AtMostOne>;
  }, false, false, false, false>;
  "expr": $.PropertyDesc<_std.$str, $.Cardinality.AtMostOne, false, false, false, false>;
  "subjectexpr": $.PropertyDesc<_std.$str, $.Cardinality.AtMostOne, false, false, false, false>;
  "finalexpr": $.PropertyDesc<_std.$str, $.Cardinality.AtMostOne, false, false, false, false>;
  "errmessage": $.PropertyDesc<_std.$str, $.Cardinality.AtMostOne, false, false, false, false>;
  "delegated": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne, false, false, false, false>;
  "subject": $.LinkDesc<$ConsistencySubject, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "<constraints[is schema::ConsistencySubject]": $.LinkDesc<$ConsistencySubject, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "<constraints[is schema::Pointer]": $.LinkDesc<$Pointer, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "<constraints[is schema::Property]": $.LinkDesc<$Property, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "<constraints[is schema::Link]": $.LinkDesc<$Link, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "<constraints[is schema::ObjectType]": $.LinkDesc<$ObjectType, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "<constraints[is schema::ScalarType]": $.LinkDesc<$ScalarType, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "<constraints": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $Constraint = $.ObjectType<"schema::Constraint", $ConstraintλShape, null>;
const $Constraint = $.makeType<$Constraint>(_.spec, "f49572ba-bda6-11ec-ac29-ef9c0a94eee0", _.syntax.literal);

const Constraint: $.$expr_PathNode<$.TypeSet<$Constraint, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Constraint, $.Cardinality.Many), null, true);

export type $DeltaλShape = $.typeutil.flatten<$Object_f26c9afebda611eca74dc1160a60a2d8λShape & {
  "parents": $.LinkDesc<$Delta, $.Cardinality.Many, {}, false, false,  false, false>;
  "<parents[is schema::Delta]": $.LinkDesc<$Delta, $.Cardinality.Many, {}, false, false,  false, false>;
  "<parents": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $Delta = $.ObjectType<"schema::Delta", $DeltaλShape, null>;
const $Delta = $.makeType<$Delta>(_.spec, "f3976a58-bda6-11ec-b52f-894601d512f0", _.syntax.literal);

const Delta: $.$expr_PathNode<$.TypeSet<$Delta, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Delta, $.Cardinality.Many), null, true);

export type $ExtensionλShape = $.typeutil.flatten<$AnnotationSubjectλShape & $Object_f26c9afebda611eca74dc1160a60a2d8λShape & {
  "package": $.LinkDesc<_sys.$ExtensionPackage, $.Cardinality.One, {}, true, false,  false, false>;
}>;
type $Extension = $.ObjectType<"schema::Extension", $ExtensionλShape, null>;
const $Extension = $.makeType<$Extension>(_.spec, "f86f5c66-bda6-11ec-91f7-edbe34e970a7", _.syntax.literal);

const Extension: $.$expr_PathNode<$.TypeSet<$Extension, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Extension, $.Cardinality.Many), null, true);

export type $FunctionλShape = $.typeutil.flatten<$CallableObjectλShape & $VolatilitySubjectλShape & {
  "preserves_optionality": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne, false, false, false, true>;
}>;
type $Function = $.ObjectType<"schema::Function", $FunctionλShape, null>;
const $Function = $.makeType<$Function>(_.spec, "f7950d18-bda6-11ec-a49d-7128961b0a7c", _.syntax.literal);

const Function: $.$expr_PathNode<$.TypeSet<$Function, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Function, $.Cardinality.Many), null, true);

export type $IndexλShape = $.typeutil.flatten<$AnnotationSubjectλShape & {
  "expr": $.PropertyDesc<_std.$str, $.Cardinality.AtMostOne, false, false, false, false>;
  "<indexes[is schema::Source]": $.LinkDesc<$Source, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "<indexes[is schema::Link]": $.LinkDesc<$Link, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "<indexes[is schema::ObjectType]": $.LinkDesc<$ObjectType, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "<indexes": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $Index = $.ObjectType<"schema::Index", $IndexλShape, null>;
const $Index = $.makeType<$Index>(_.spec, "f5038836-bda6-11ec-9f85-ab45185ffac5", _.syntax.literal);

const Index: $.$expr_PathNode<$.TypeSet<$Index, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Index, $.Cardinality.Many), null, true);

export type $PointerλShape = $.typeutil.flatten<$InheritingObjectλShape & $ConsistencySubjectλShape & $AnnotationSubjectλShape & {
  "cardinality": $.PropertyDesc<$Cardinality, $.Cardinality.AtMostOne, false, false, false, false>;
  "required": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne, false, false, false, false>;
  "readonly": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne, false, false, false, false>;
  "default": $.PropertyDesc<_std.$str, $.Cardinality.AtMostOne, false, false, false, false>;
  "expr": $.PropertyDesc<_std.$str, $.Cardinality.AtMostOne, false, false, false, false>;
  "source": $.LinkDesc<$Source, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "target": $.LinkDesc<$Type, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "<pointers[is schema::Source]": $.LinkDesc<$Source, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "<pointers[is schema::Link]": $.LinkDesc<$Link, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "<pointers[is schema::ObjectType]": $.LinkDesc<$ObjectType, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "<pointers": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $Pointer = $.ObjectType<"schema::Pointer", $PointerλShape, null>;
const $Pointer = $.makeType<$Pointer>(_.spec, "f5425aca-bda6-11ec-b30c-cbeb6cbdc145", _.syntax.literal);

const Pointer: $.$expr_PathNode<$.TypeSet<$Pointer, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Pointer, $.Cardinality.Many), null, true);

export type $SourceλShape = $.typeutil.flatten<$Object_f26c9afebda611eca74dc1160a60a2d8λShape & {
  "indexes": $.LinkDesc<$Index, $.Cardinality.Many, {}, true, false,  false, false>;
  "pointers": $.LinkDesc<$Pointer, $.Cardinality.Many, {
    "@owned": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne>;
    "@is_owned": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne>;
  }, true, false, false, false>;
  "<source[is schema::Pointer]": $.LinkDesc<$Pointer, $.Cardinality.Many, {}, false, false,  false, false>;
  "<source[is schema::Property]": $.LinkDesc<$Property, $.Cardinality.Many, {}, false, false,  false, false>;
  "<source[is schema::Link]": $.LinkDesc<$Link, $.Cardinality.Many, {}, false, false,  false, false>;
  "<source": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $Source = $.ObjectType<"schema::Source", $SourceλShape, null>;
const $Source = $.makeType<$Source>(_.spec, "f5245110-bda6-11ec-b445-af8660a83c82", _.syntax.literal);

const Source: $.$expr_PathNode<$.TypeSet<$Source, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Source, $.Cardinality.Many), null, true);

export type $LinkλShape = $.typeutil.flatten<$PointerλShape & $SourceλShape & {
  "target": $.LinkDesc<$ObjectType, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "properties": $.LinkDesc<$Property, $.Cardinality.Many, {
    "@owned": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne>;
    "@is_owned": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne>;
  }, false, true, false, false>;
  "on_target_delete": $.PropertyDesc<$TargetDeleteAction, $.Cardinality.AtMostOne, false, false, false, false>;
  "<links[is schema::ObjectType]": $.LinkDesc<$ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<links": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $Link = $.ObjectType<"schema::Link", $LinkλShape, null>;
const $Link = $.makeType<$Link>(_.spec, "f686de24-bda6-11ec-a12b-6be4d2186be8", _.syntax.literal);

const Link: $.$expr_PathNode<$.TypeSet<$Link, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Link, $.Cardinality.Many), null, true);

export type $MigrationλShape = $.typeutil.flatten<$AnnotationSubjectλShape & $Object_f26c9afebda611eca74dc1160a60a2d8λShape & {
  "parents": $.LinkDesc<$Migration, $.Cardinality.Many, {}, false, false,  false, false>;
  "script": $.PropertyDesc<_std.$str, $.Cardinality.One, false, false, false, false>;
  "message": $.PropertyDesc<_std.$str, $.Cardinality.AtMostOne, false, false, false, false>;
  "<parents[is schema::Migration]": $.LinkDesc<$Migration, $.Cardinality.Many, {}, false, false,  false, false>;
  "<parents": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $Migration = $.ObjectType<"schema::Migration", $MigrationλShape, null>;
const $Migration = $.makeType<$Migration>(_.spec, "f83f9468-bda6-11ec-a90c-9d8338b12606", _.syntax.literal);

const Migration: $.$expr_PathNode<$.TypeSet<$Migration, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Migration, $.Cardinality.Many), null, true);

export type $ModuleλShape = $.typeutil.flatten<$Object_f26c9afebda611eca74dc1160a60a2d8λShape & $AnnotationSubjectλShape & {
}>;
type $Module = $.ObjectType<"schema::Module", $ModuleλShape, null>;
const $Module = $.makeType<$Module>(_.spec, "f2e49400-bda6-11ec-a058-f50a7c2c92dc", _.syntax.literal);

const Module: $.$expr_PathNode<$.TypeSet<$Module, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Module, $.Cardinality.Many), null, true);

export type $ObjectTypeλShape = $.typeutil.flatten<$InheritingObjectλShape & $ConsistencySubjectλShape & $AnnotationSubjectλShape & $TypeλShape & $SourceλShape & {
  "union_of": $.LinkDesc<$ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "intersection_of": $.LinkDesc<$ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "compound_type": $.PropertyDesc<_std.$bool, $.Cardinality.One, false, true, false, false>;
  "is_compound_type": $.PropertyDesc<_std.$bool, $.Cardinality.One, false, true, false, false>;
  "links": $.LinkDesc<$Link, $.Cardinality.Many, {
    "@is_owned": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne>;
    "@owned": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne>;
  }, false, true, false, false>;
  "properties": $.LinkDesc<$Property, $.Cardinality.Many, {
    "@is_owned": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne>;
    "@owned": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne>;
  }, false, true, false, false>;
  "<union_of[is schema::ObjectType]": $.LinkDesc<$ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<intersection_of[is schema::ObjectType]": $.LinkDesc<$ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<target[is schema::Link]": $.LinkDesc<$Link, $.Cardinality.Many, {}, false, false,  false, false>;
  "<intersection_of": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<target": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<union_of": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $ObjectType = $.ObjectType<"schema::ObjectType", $ObjectTypeλShape, null>;
const $ObjectType = $.makeType<$ObjectType>(_.spec, "f612acca-bda6-11ec-8e5f-3563f6b3294c", _.syntax.literal);

const ObjectType: $.$expr_PathNode<$.TypeSet<$ObjectType, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($ObjectType, $.Cardinality.Many), null, true);

export type $OperatorλShape = $.typeutil.flatten<$CallableObjectλShape & $VolatilitySubjectλShape & {
  "operator_kind": $.PropertyDesc<$OperatorKind, $.Cardinality.AtMostOne, false, false, false, false>;
  "abstract": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne, false, false, false, true>;
  "is_abstract": $.PropertyDesc<_std.$bool, $.Cardinality.AtMostOne, false, true, false, true>;
}>;
type $Operator = $.ObjectType<"schema::Operator", $OperatorλShape, null>;
const $Operator = $.makeType<$Operator>(_.spec, "f7cd94ee-bda6-11ec-834f-2dea7fcbba26", _.syntax.literal);

const Operator: $.$expr_PathNode<$.TypeSet<$Operator, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Operator, $.Cardinality.Many), null, true);

export type $ParameterλShape = $.typeutil.flatten<$Object_f26c9afebda611eca74dc1160a60a2d8λShape & {
  "type": $.LinkDesc<$Type, $.Cardinality.One, {}, false, false,  false, false>;
  "typemod": $.PropertyDesc<$TypeModifier, $.Cardinality.One, false, false, false, false>;
  "kind": $.PropertyDesc<$ParameterKind, $.Cardinality.One, false, false, false, false>;
  "num": $.PropertyDesc<_std.$int64, $.Cardinality.One, false, false, false, false>;
  "default": $.PropertyDesc<_std.$str, $.Cardinality.AtMostOne, false, false, false, false>;
  "<params[is schema::CallableObject]": $.LinkDesc<$CallableObject, $.Cardinality.Many, {}, false, false,  false, false>;
  "<params[is schema::Operator]": $.LinkDesc<$Operator, $.Cardinality.Many, {}, false, false,  false, false>;
  "<params[is schema::Function]": $.LinkDesc<$Function, $.Cardinality.Many, {}, false, false,  false, false>;
  "<params[is schema::Constraint]": $.LinkDesc<$Constraint, $.Cardinality.Many, {}, false, false,  false, false>;
  "<params": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $Parameter = $.ObjectType<"schema::Parameter", $ParameterλShape, null>;
const $Parameter = $.makeType<$Parameter>(_.spec, "f4084fc0-bda6-11ec-bc15-7f963fbda5ef", _.syntax.literal);

const Parameter: $.$expr_PathNode<$.TypeSet<$Parameter, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Parameter, $.Cardinality.Many), null, true);

export type $PropertyλShape = $.typeutil.flatten<$PointerλShape & {
  "<properties[is schema::Link]": $.LinkDesc<$Link, $.Cardinality.Many, {}, false, false,  false, false>;
  "<properties[is schema::ObjectType]": $.LinkDesc<$ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<properties": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $Property = $.ObjectType<"schema::Property", $PropertyλShape, null>;
const $Property = $.makeType<$Property>(_.spec, "f6f1a7fe-bda6-11ec-a8a2-a73fdce85469", _.syntax.literal);

const Property: $.$expr_PathNode<$.TypeSet<$Property, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Property, $.Cardinality.Many), null, true);

export type $PseudoTypeλShape = $.typeutil.flatten<$InheritingObjectλShape & $TypeλShape & {
}>;
type $PseudoType = $.ObjectType<"schema::PseudoType", $PseudoTypeλShape, null>;
const $PseudoType = $.makeType<$PseudoType>(_.spec, "f2a0cfe0-bda6-11ec-8507-85d546b9ab22", _.syntax.literal);

const PseudoType: $.$expr_PathNode<$.TypeSet<$PseudoType, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($PseudoType, $.Cardinality.Many), null, true);

export type $ScalarTypeλShape = $.typeutil.flatten<$InheritingObjectλShape & $ConsistencySubjectλShape & $AnnotationSubjectλShape & $PrimitiveTypeλShape & {
  "default": $.PropertyDesc<_std.$str, $.Cardinality.AtMostOne, false, false, false, false>;
  "enum_values": $.PropertyDesc<$.ArrayType<_std.$str>, $.Cardinality.AtMostOne, false, false, false, false>;
}>;
type $ScalarType = $.ObjectType<"schema::ScalarType", $ScalarTypeλShape, null>;
const $ScalarType = $.makeType<$ScalarType>(_.spec, "f5bbd986-bda6-11ec-b8dc-f97457aa9573", _.syntax.literal);

const ScalarType: $.$expr_PathNode<$.TypeSet<$ScalarType, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($ScalarType, $.Cardinality.Many), null, true);

export type $TupleλShape = $.typeutil.flatten<$CollectionTypeλShape & {
  "element_types": $.LinkDesc<$TupleElement, $.Cardinality.Many, {
    "@index": $.PropertyDesc<_std.$int64, $.Cardinality.AtMostOne>;
  }, true, false, false, false>;
}>;
type $Tuple = $.ObjectType<"schema::Tuple", $TupleλShape, null>;
const $Tuple = $.makeType<$Tuple>(_.spec, "f36cf854-bda6-11ec-8c61-b59045727fda", _.syntax.literal);

const Tuple: $.$expr_PathNode<$.TypeSet<$Tuple, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Tuple, $.Cardinality.Many), null, true);

export type $TupleElementλShape = $.typeutil.flatten<_std.$BaseObjectλShape & {
  "type": $.LinkDesc<$Type, $.Cardinality.One, {}, false, false,  false, false>;
  "name": $.PropertyDesc<_std.$str, $.Cardinality.AtMostOne, false, false, false, false>;
  "<element_types[is schema::Tuple]": $.LinkDesc<$Tuple, $.Cardinality.AtMostOne, {}, false, false,  false, false>;
  "<element_types": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $TupleElement = $.ObjectType<"schema::TupleElement", $TupleElementλShape, null>;
const $TupleElement = $.makeType<$TupleElement>(_.spec, "f35c454a-bda6-11ec-8425-5358c61c18d6", _.syntax.literal);

const TupleElement: $.$expr_PathNode<$.TypeSet<$TupleElement, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($TupleElement, $.Cardinality.Many), null, true);



export { $CardinalityλEnum, Cardinality, $OperatorKindλEnum, OperatorKind, $ParameterKindλEnum, ParameterKind, $TargetDeleteActionλEnum, TargetDeleteAction, $TypeModifierλEnum, TypeModifier, $VolatilityλEnum, Volatility, $Object_f26c9afebda611eca74dc1160a60a2d8, Object_f26c9afebda611eca74dc1160a60a2d8, $AnnotationSubject, AnnotationSubject, $Alias, Alias, $SubclassableObject, SubclassableObject, $InheritingObject, InheritingObject, $Annotation, Annotation, $Type, Type, $PrimitiveType, PrimitiveType, $CollectionType, CollectionType, $Array, Array, $CallableObject, CallableObject, $VolatilitySubject, VolatilitySubject, $Cast, Cast, $ConsistencySubject, ConsistencySubject, $Constraint, Constraint, $Delta, Delta, $Extension, Extension, $Function, Function, $Index, Index, $Pointer, Pointer, $Source, Source, $Link, Link, $Migration, Migration, $Module, Module, $ObjectType, ObjectType, $Operator, Operator, $Parameter, Parameter, $Property, Property, $PseudoType, PseudoType, $ScalarType, ScalarType, $Tuple, Tuple, $TupleElement, TupleElement };

type __defaultExports = {
  "Cardinality": typeof Cardinality;
  "OperatorKind": typeof OperatorKind;
  "ParameterKind": typeof ParameterKind;
  "TargetDeleteAction": typeof TargetDeleteAction;
  "TypeModifier": typeof TypeModifier;
  "Volatility": typeof Volatility;
  "Object": typeof Object_f26c9afebda611eca74dc1160a60a2d8;
  "AnnotationSubject": typeof AnnotationSubject;
  "Alias": typeof Alias;
  "SubclassableObject": typeof SubclassableObject;
  "InheritingObject": typeof InheritingObject;
  "Annotation": typeof Annotation;
  "Type": typeof Type;
  "PrimitiveType": typeof PrimitiveType;
  "CollectionType": typeof CollectionType;
  "Array": typeof Array;
  "CallableObject": typeof CallableObject;
  "VolatilitySubject": typeof VolatilitySubject;
  "Cast": typeof Cast;
  "ConsistencySubject": typeof ConsistencySubject;
  "Constraint": typeof Constraint;
  "Delta": typeof Delta;
  "Extension": typeof Extension;
  "Function": typeof Function;
  "Index": typeof Index;
  "Pointer": typeof Pointer;
  "Source": typeof Source;
  "Link": typeof Link;
  "Migration": typeof Migration;
  "Module": typeof Module;
  "ObjectType": typeof ObjectType;
  "Operator": typeof Operator;
  "Parameter": typeof Parameter;
  "Property": typeof Property;
  "PseudoType": typeof PseudoType;
  "ScalarType": typeof ScalarType;
  "Tuple": typeof Tuple;
  "TupleElement": typeof TupleElement
};
const __defaultExports: __defaultExports = {
  "Cardinality": Cardinality,
  "OperatorKind": OperatorKind,
  "ParameterKind": ParameterKind,
  "TargetDeleteAction": TargetDeleteAction,
  "TypeModifier": TypeModifier,
  "Volatility": Volatility,
  "Object": Object_f26c9afebda611eca74dc1160a60a2d8,
  "AnnotationSubject": AnnotationSubject,
  "Alias": Alias,
  "SubclassableObject": SubclassableObject,
  "InheritingObject": InheritingObject,
  "Annotation": Annotation,
  "Type": Type,
  "PrimitiveType": PrimitiveType,
  "CollectionType": CollectionType,
  "Array": Array,
  "CallableObject": CallableObject,
  "VolatilitySubject": VolatilitySubject,
  "Cast": Cast,
  "ConsistencySubject": ConsistencySubject,
  "Constraint": Constraint,
  "Delta": Delta,
  "Extension": Extension,
  "Function": Function,
  "Index": Index,
  "Pointer": Pointer,
  "Source": Source,
  "Link": Link,
  "Migration": Migration,
  "Module": Module,
  "ObjectType": ObjectType,
  "Operator": Operator,
  "Parameter": Parameter,
  "Property": Property,
  "PseudoType": PseudoType,
  "ScalarType": ScalarType,
  "Tuple": Tuple,
  "TupleElement": TupleElement
};
export default __defaultExports;
