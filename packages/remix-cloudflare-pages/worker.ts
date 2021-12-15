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

type EnvWithAssets = Record<string, unknown> & {
  ASSETS: { fetch: typeof fetch };
};

async function handleAsset(request: Request, env: unknown) {
  let envWithAssets = env as EnvWithAssets;

  const response = await envWithAssets.ASSETS.fetch(request);
  if (response.ok) return response;
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

    let url = new URL(context.request.url);
    response =
      // TODO: Remove this once a fix has been meged to wranger@v2
      process.env.NODE_ENV === "development" && url.pathname === "/"
        ? undefined
        : await handleAsset(context.request.clone(), context.env);

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
