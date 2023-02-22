import type { AppLoadContext, ServerBuild } from "@remix-run/server-runtime";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/server-runtime";

export type GetEdgeLoadContextFunction = (request: Request) => AppLoadContext;

/**
 * Returns a request handler for the Vercel Edge runtime that serves
 * the Remix SSR response.
 */
export function createRequestHandler({
  build,
  getEdgeLoadContext,
  mode,
}: {
  build: ServerBuild;
  getEdgeLoadContext?: GetEdgeLoadContextFunction;
  mode?: string;
}) {
  let handleRequest = createRemixRequestHandler(build, mode);

  return (request: Request) => {
    let loadContext = getEdgeLoadContext?.(request);

    return handleRequest(request, loadContext);
  };
}
