import type { Adapter } from "./adapter";
import type { Runtime } from "./runtime";

export interface Options {
  runtime: Runtime;
  adapter?: Adapter;
}
