import {
  createRequestHandler,
  type AppLoadContext,
} from "@remix-run/server-runtime";

import { type Preset } from "../plugin";

type MaybePromise<T> = T | Promise<T>;

type GetRemixDevLoadContext = (args: {
  request: Request;
  env: AppLoadContext["env"];
}) => MaybePromise<Record<string, unknown>>;

type GetLoadContext = (
  request: Request
) => MaybePromise<Record<string, unknown>>;

type GetBindingsProxy = () => Promise<{ bindings: Record<string, unknown> }>;

/**
 * @param options.getRemixDevLoadContext - Augment the load context.
 */
export const cloudflareProxyPreset = (
  getBindingsProxy: GetBindingsProxy,
  options: {
    getRemixDevLoadContext?: GetRemixDevLoadContext;
  } = {}
): Preset => ({
  name: "cloudflare-proxy",
  remixConfig: async () => {
    let getLoadContext: GetLoadContext = async () => {
      let { bindings } = await getBindingsProxy();
      return { env: bindings };
    };

    // eslint-disable-next-line prefer-let/prefer-let
    const { getRemixDevLoadContext } = options;
    if (getRemixDevLoadContext) {
      getLoadContext = async (request: Request) => {
        let { bindings } = await getBindingsProxy();
        let loadContext = await getRemixDevLoadContext({
          env: bindings,
          request,
        });
        return loadContext;
      };
    }

    return {
      unstable_devRequestHandler: async ({ loadServerBuild }) => {
        let build = await loadServerBuild();
        let handler = createRequestHandler(build, "development");
        return async (request: Request): Promise<Response> => {
          return handler(request, await getLoadContext(request));
        };
      },
    };
  },
});
