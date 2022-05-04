import "./modules";

export type { AppConfig } from "@remix-run/config";

export * as cli from "./cli/index";
export { createApp } from "./cli/create";

export { getDependenciesToBundle } from "./compiler/dependencies";
