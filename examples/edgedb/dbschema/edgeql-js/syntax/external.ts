import type {TypeSet, setToTsType} from "edgedb/dist/reflection";

export {literal} from "./literal";
export {} from "./path";
export {set} from "./set";
export {cast} from "./cast";
export {
  ASC,
  DESC,
  EMPTY_FIRST,
  EMPTY_LAST,
  is,
  delete,
  select,
} from "./select";
export {update} from "./update";
export {insert} from "./insert";
export {array, tuple} from "./collections";
export {} from "./funcops";
export {for} from "./for";
export {alias, with} from "./with";
export {optional, params} from "./params";
export {detached} from "./detached";
export {} from "./toEdgeQL";

export type $infer<A extends TypeSet> = setToTsType<A>;
