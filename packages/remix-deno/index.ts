export * from "@remix-run/server-runtime";

import { installGlobals } from "./globals";

export { createRequestHandlerWithStaticFiles } from "./server";

installGlobals();
