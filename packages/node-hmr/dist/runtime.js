import { getNodeHmrRuntime } from "./lib/runtime.js";
export const browserEventChannel = getNodeHmrRuntime()?.browserEventChannel;
