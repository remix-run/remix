import type { ServerBuild, AppLoadContext } from "@remix-run/server-runtime";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/server-runtime";

export interface createPagesFunctionHandlerParams<Env = any> {
  build: ServerBuild;
  getLoadContext?: (context: EventContext<Env, any, any>) => AppLoadContext;
  mode?: string;
}

export function createRequestHandler<Env = any>({
  build,
  getLoadContext,
  mode
}: createPagesFunctionHandlerParams<Env>): PagesFunction<Env> {
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

export function createPagesFunctionHandler<Env = any>({
  build,
  getLoadContext,
  mode
}: createPagesFunctionHandlerParams<Env>) {
  const handleRequest = createRequestHandler<Env>({
    build,
    getLoadContext,
    mode
  });

  const handleFetch = async (context: EventContext<Env, any, any>) => {
    let response: Response | undefined;

    // https://github.com/cloudflare/wrangler2/issues/117
    context.request.headers.delete("If-None-Match");

    try {
      response = await (context.env as any).ASSETS.fetch(
        context.request.url,
        context.request.clone()
      );
      response = response?.ok
        ? new Response(response.body, response)
        : undefined;
    } catch {}

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
