import type { ServerBuild } from "@remix-run/server-runtime";

throw new Error(
  "This module is not meant to be used directly from node_modules." +
    " It is used to provide type definitions for a virtual module provided" +
    " the Remix compiler at build time."
);

export const assets: ServerBuild["assets"] = undefined!;
export const entry: ServerBuild["entry"] = undefined!;
export const routes: ServerBuild["routes"] = undefined!;
