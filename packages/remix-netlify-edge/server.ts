import { createRequestHandler as createRemixRequestHandler } from "@remix-run/server-runtime";
import type { ServerBuild } from "@remix-run/server-runtime";
export function createRequestHandler<Context = unknown>({
  build,
  mode,
  getLoadContext,
}: {
  build: ServerBuild;
  mode?: string;
  getLoadContext?: (
    request: Request,
    context?: Context
  ) => Promise<Context> | Context;
}) {
  let remixHandler = createRemixRequestHandler(build, mode);
  return async (request: Request, context: Context): Promise<Response> => {
    try {
      let loadContext = getLoadContext
        ? await getLoadContext(request, context)
        : context;

      return await remixHandler(request, loadContext);
    } catch (e) {
      console.error(e);

      return new Response("Internal Error", { status: 500 });
    }
  };
}
