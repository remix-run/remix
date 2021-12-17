import { installGlobals } from "./globals";

export { createCloudflareKVSessionStorage } from "./sessions/cloudflareKVSessionStorage";

export type { createPagesFunctionHandlerParams } from "./worker";
export { createPagesFunctionHandler, createRequestHandler } from "./worker";

installGlobals();
