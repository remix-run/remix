import { readConfig } from "./config";
import { Request, Response } from "./fetch";
import { createRemixRequestHandler } from "./server";
import type { RequestHandler } from "./server";
import { Session } from "./sessions";

import type { RemixConfig } from "./config";
import type { AppLoadContext } from "./data";

interface Adapter {
  createRemixRequest: (...platformArgs: any[]) => Request;
  createRemixSession: (...platformArgs: any[]) => Session | Promise<Session>;
  sendPlatformResponse: (
    remixResponse: Response,
    session: Session,
    ...platformArgs: any[]
  ) => any;
}

type PlatformRequestHandlerOptions = {
  getLoadContext?: (...platformArgs: any[]) => AppLoadContext;
  root?: string;
  enableSessions?: boolean;
};

export function createAdapter({
  createRemixRequest,
  createRemixSession,
  sendPlatformResponse
}: Adapter) {
  return function createPlatformRequestHandler({
    getLoadContext,
    root,
    enableSessions = true
  }: PlatformRequestHandlerOptions = {}) {
    // only need to read the config once, so we keep it outside of the request
    let handleRequest: RequestHandler;
    let remixConfig: RemixConfig;

    return async (...platformArgs: any[]) => {
      if (!remixConfig) {
        try {
          // TODO: see why we were getting unhandled exceptions when this was up
          // one scope so that they get the error before they make a request
          remixConfig = await readConfig(
            root,
            process.env.REMIX_ENV || process.env.NODE_ENV
          );
        } catch (error) {
          handleConfigError(error);
        }

        handleRequest = createRemixRequestHandler(remixConfig);
      }

      let remixReq = createRemixRequest(...platformArgs);
      let session = await createRemixSession(enableSessions, ...platformArgs);

      let loadContext: AppLoadContext;
      if (getLoadContext) {
        loadContext = await getLoadContext(...platformArgs);
      }

      let remixRes = await handleRequest(remixReq, session, loadContext);

      return sendPlatformResponse(remixRes, session, ...platformArgs);
    };
  };
}

function handleConfigError(error: Error) {
  console.error(`There was an error reading the Remix config`);
  console.error(error);
  process.exit(1);
}
