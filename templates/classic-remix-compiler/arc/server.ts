import { createRequestHandler } from "@remix-run/architect";
import * as build from "@remix-run/dev/server-build";
import { installGlobals } from "@remix-run/node";
import sourceMapSupport from "source-map-support";

sourceMapSupport.install();
installGlobals({ nativeFetch: true });

export const handler = createRequestHandler({ build });
