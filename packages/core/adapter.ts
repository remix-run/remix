import { readConfig } from "./config";
import { Request, Response } from "./fetch";
import { createRequestHandler } from "./server";
import { Session } from "./sessions";

import type { RemixConfig } from "./config";
import type { AppLoadContext } from "./data";
import type { RequestHandler } from "./server";

interface Adapter {
  createRemixRequest: (...platformArgs: any[]) => Request;
  createRemixSession: (...platformArgs: any[]) => Session;
  sendPlatformResponse: (
    remixResponse: Response,
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
    let handleRequest: RequestHandler;
    let remixConfig: RemixConfig;
    let remixConfigPromise = readConfig(root, process.env.NODE_ENV);

    // If there is a config error, catch it early and exit. But keep this function
    // sync in case they don't have top-level await (unflagged in node v14.8.0).
    remixConfigPromise.catch(handleConfigError);

    return async (...platformArgs: any[]) => {
      if (!remixConfig) {
        try {
          remixConfig = await remixConfigPromise;
        } catch (error) {
          handleConfigError(error);
        }

        handleRequest = createRequestHandler(remixConfig);
      }

      let remixReq = createRemixRequest(...platformArgs);
      let session = createRemixSession(enableSessions, ...platformArgs);

      let loadContext: AppLoadContext;
      if (getLoadContext) {
        loadContext = await getLoadContext(...platformArgs);
      }

      let remixRes = await handleRequest(remixReq, session, loadContext);

      return sendPlatformResponse(remixRes, ...platformArgs);
    };
  };
}

function handleConfigError(error: Error) {
  console.error(`There was an error reading the Remix config`);
  console.error(error);
  process.exit(1);
}
