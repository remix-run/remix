import type {TypeSet, setToTsType} from "edgedb/dist/reflection";

export * from "./literal";
export * from "./path";
export * from "./set";
export * from "./cast";
export * from "./select";
export * from "./update";
export * from "./insert";
export * from "./collections";
export * from "./funcops";
export * from "./for";
export * from "./with";
export * from "./params";
export * from "./detached";
export * from "./toEdgeQL";

export type $infer<A extends TypeSet> = setToTsType<A>;
