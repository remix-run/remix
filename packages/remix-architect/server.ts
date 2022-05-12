import {
  // This has been added as a global in node 15+
  AbortController,
  createRequestHandler as createRemixRequestHandler,
} from "@remix-run/node";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyHandler,
  APIGatewayProxyHandlerV2,
} from "aws-lambda";
import type {
  AppLoadContext,
  ServerBuild,
  Response as NodeResponse,
} from "@remix-run/node";

import {
  sendRemixResponse as sendRemixResponseV2,
  createRemixRequest as createRemixRequestV2
} from "./api/v2";
import {
  createRemixRequest,
  sendRemixResponse
} from "./api/v1";

/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action.
 */
export type GetLoadContextFunction = (
  event: APIGatewayProxyEventV2 | APIGatewayProxyEvent
) => AppLoadContext;

export type RequestHandler = APIGatewayProxyHandlerV2 | APIGatewayProxyHandler;

export enum APIGatewayVersion {
  v1 = "v1",
  v2 = "v2",
}

/**
 * Returns a request handler for Architect that serves the response using
 * Remix.
 */
export function createRequestHandler({
  build,
  getLoadContext,
  mode = process.env.NODE_ENV,
  apiGatewayVersion = APIGatewayVersion.v2
}: {
  build: ServerBuild;
  getLoadContext?: GetLoadContextFunction;
  mode?: string;
  apiGatewayVersion?: APIGatewayVersion;
}): RequestHandler {
  let handleRequest = createRemixRequestHandler(build, mode);

  return async (event: APIGatewayProxyEvent | APIGatewayProxyEventV2 /*, context*/) => {
    let abortController = new AbortController();
    let request = apiGatewayVersion === APIGatewayVersion.v1
      ? createRemixRequest(event as APIGatewayProxyEvent, abortController)
      : createRemixRequestV2(event as APIGatewayProxyEventV2, abortController);
    let loadContext =
      typeof getLoadContext === "function" ? getLoadContext(event) : undefined;

    let response = (await handleRequest(
      request as unknown as Request,
      loadContext
    )) as unknown as NodeResponse;

    return apiGatewayVersion === APIGatewayVersion.v1
        ? sendRemixResponse(response, abortController)
        : sendRemixResponseV2(response, abortController);
  };
}
