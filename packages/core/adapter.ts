import { readConfig } from "./config";
import { Request, Response } from "./fetch";
import { createRequestHandler as createRemixRequestHandler } from "./server";
import type { RequestHandler } from "./server";
import { Session } from "./sessions";

import type { AppLoadContext } from "./buildModules";
import type { RemixConfig } from "./config";

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
    let handleRequest: RequestHandler;
    let remixConfig: RemixConfig;

    let env = process.env.REMIX_ENV || process.env.NODE_ENV;
    let remixConfigPromise = readConfig(root, env);
    remixConfigPromise.catch(handleConfigError);

    return async (...platformArgs: any[]) => {
      if (!remixConfig) {
        remixConfig = await remixConfigPromise;
        handleRequest = createRemixRequestHandler(remixConfig);
      }

      let remixReq = createRemixRequest(...platformArgs);
      let session = await createRemixSession(enableSessions, ...platformArgs);

      let loadContext: AppLoadContext;
      if (getLoadContext) {
        loadContext = await getLoadContext(...platformArgs);
      }

      // Catch any errors in Remix itself.
      try {
        let remixRes = await handleRequest(remixReq, session, loadContext);
        return sendPlatformResponse(remixRes, session, ...platformArgs);
      } catch (error) {
        console.error(error);
        return sendPlatformResponse(
          new Response(error.message, { status: 500 }),
          session,
          ...platformArgs
        );
      }
    };
  };
}

function handleConfigError(error: Error) {
  console.error(`There was an error reading the Remix config`);
  console.error(error);
  process.exit(1);
}
