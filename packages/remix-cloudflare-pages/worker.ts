import { getType } from "mime";
import type { ServerBuild, AppLoadContext } from "@remix-run/server-runtime";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/server-runtime";

export interface CreateFetchHandlerParams<Env = any> {
  build: ServerBuild;
  getLoadContext?: (context: EventContext<Env, any, any>) => AppLoadContext;
  mode?: string;
}

export function createRequestHandler<Env = any>({
  build,
  getLoadContext,
  mode
}: CreateFetchHandlerParams<Env>): PagesFunction<Env> {
  let platform = {};
  let handleRequest = createRemixRequestHandler(build, platform, mode);

  return context => {
    let loadContext =
      typeof getLoadContext === "function"
        ? getLoadContext(context)
        : undefined;
    return handleRequest(context.request, loadContext);
  };
}

declare const process: any;

export function createFetchHandler<Env = any>({
  build,
  getLoadContext,
  mode
}: CreateFetchHandlerParams<Env>) {
  const handleRequest = createRequestHandler<Env>({
    build,
    getLoadContext,
    mode
  });

  const handleFetch = async (context: EventContext<Env, any, any>) => {
    let response: Response | undefined;

    const request = new Request(context.request);
    // https://github.com/cloudflare/wrangler2/issues/117
    request.headers.delete("If-None-Match");
    context.request = request;

    let url = new URL(context.request.url);
    try {
      response = await context.next();
      response = response.ok ? response : undefined;
    } catch {}
    // This is a known CF bug in the Pages runtime
    if (response) {
      let contentType = getType(url.pathname);
      if (contentType) {
        response.headers.set("Content-Type", contentType);
      }
    }

    if (!response) {
      response = await handleRequest(context);
    }

    return response;
  };

  return async (context: EventContext<Env, any, any>) => {
    try {
      return await handleFetch(context);
    } catch (e) {
      if (process.env.NODE_ENV === "development" && e instanceof Error) {
        console.error(e);
        return new Response(e.message || e.toString(), {
          status: 500
        });
      }

      return new Response("Internal Error", {
        status: 500
      });
    }
  };
}
