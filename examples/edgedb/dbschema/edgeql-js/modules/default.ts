import { $ } from "edgedb";
import * as _ from "../imports";
import type * as _std from "./std";
export type $JokeλShape = $.typeutil.flatten<_std.$Object_f1e1d4a0bda611eca08599c7be50f4a1λShape & {
  "content": $.PropertyDesc<_std.$str, $.Cardinality.One, false, false, false, false>;
  "createdAt": $.PropertyDesc<_std.$datetime, $.Cardinality.One, false, false, false, true>;
  "name": $.PropertyDesc<_std.$str, $.Cardinality.One, false, false, false, false>;
  "jokester": $.LinkDesc<$User, $.Cardinality.One, {}, false, false,  false, false>;
  "<jokes[is User]": $.LinkDesc<$User, $.Cardinality.Many, {}, false, false,  false, false>;
  "<jokes": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $Joke = $.ObjectType<"default::Joke", $JokeλShape, null>;
const $Joke = $.makeType<$Joke>(_.spec, "37d406cc-d30f-11ec-a347-d3208cc8b532", _.syntax.literal);

const Joke: $.$expr_PathNode<$.TypeSet<$Joke, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($Joke, $.Cardinality.Many), null, true);

export type $UserλShape = $.typeutil.flatten<_std.$Object_f1e1d4a0bda611eca08599c7be50f4a1λShape & {
  "createdAt": $.PropertyDesc<_std.$datetime, $.Cardinality.One, false, false, false, true>;
  "passwordHash": $.PropertyDesc<_std.$str, $.Cardinality.One, false, false, false, false>;
  "username": $.PropertyDesc<_std.$str, $.Cardinality.One, true, false, false, false>;
  "jokes": $.LinkDesc<$Joke, $.Cardinality.Many, {}, false, true,  false, false>;
  "<jokester[is Joke]": $.LinkDesc<$Joke, $.Cardinality.Many, {}, false, false,  false, false>;
  "<jokester": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $User = $.ObjectType<"default::User", $UserλShape, null>;
const $User = $.makeType<$User>(_.spec, "37d713ee-d30f-11ec-af15-c18f26964d06", _.syntax.literal);

const User: $.$expr_PathNode<$.TypeSet<$User, $.Cardinality.Many>, null, true> = _.syntax.$PathNode($.$toSet($User, $.Cardinality.Many), null, true);



export { $Joke, Joke, $User, User };

type __defaultExports = {
  "Joke": typeof Joke;
  "User": typeof User
};
const __defaultExports: __defaultExports = {
  "Joke": Joke,
  "User": User
};
export default __defaultExports;
