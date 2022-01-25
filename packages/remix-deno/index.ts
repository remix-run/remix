import { installGlobals } from "./globals";

export {
  createRequestHandler,
  createRequestHandlerWithStaticFiles,
  serveStaticFiles
} from "./server";

installGlobals();
