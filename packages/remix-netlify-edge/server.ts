import type { ServerBuild } from "https://esm.sh/@remix-run/server-runtime@1.3.5?pin=v77";
import { createRequestHandler as createRemixRequestHandler } from "https://esm.sh/@remix-run/server-runtime@1.3.5?pin=v77";

// This can be replaced with the full context type when that is published
interface BaseContext {
  next: (options?: { sendConditionalRequest?: boolean }) => Promise<Response>;
}

export function createRequestHandler<
  Context extends BaseContext = BaseContext
>({
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

  let assetPath = build.assets.url.split("/").slice(0, -1).join("/");

  return async (
    request: Request,
    context: Context
  ): Promise<Response | void> => {
    let { pathname } = new URL(request.url);
    // Skip the handler for static files
    if (pathname.startsWith(`${assetPath}/`)) {
      return;
    }
    try {
      let loadContext = getLoadContext
        ? await getLoadContext(request, context)
        : context;

      let response = await remixHandler(request, loadContext);
      if (response.status === 404) {
        // Check if there is a matching static file
        let originResponse = await context.next({
          sendConditionalRequest: true,
        });
        if (originResponse.status !== 404) {
          return originResponse;
        }
      }
      return response;
    } catch (e) {
      console.error(e);

      return new Response("Internal Error", { status: 500 });
    }
  };
}
