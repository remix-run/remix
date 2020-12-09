import { readConfig } from "./config";
import { Request, Response } from "./fetch";
import { createRemixRequestHandler } from "./server";
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
    let remixConfig: RemixConfig;

    return async (...platformArgs: any[]) => {
      if (!remixConfig) {
        try {
          remixConfig = await readConfig(root, process.env.NODE_ENV);
        } catch (error) {
          handleConfigError(error);
        }
      }
      let handleRequest = createRemixRequestHandler(remixConfig);

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
