import {
  createRequestHandler,
  type AppLoadContext,
} from "@remix-run/server-runtime";
import { type PlatformProxy, getPlatformProxy } from "wrangler";

import { type Preset } from "../plugin";

type MaybePromise<T> = T | Promise<T>;

type Env = AppLoadContext["env"];

type GetRemixDevLoadContext = (args: {
  request: Request;
  cloudflare: PlatformProxy<Env>;
}) => MaybePromise<Record<string, unknown>>;

type GetLoadContext = (
  request: Request
) => MaybePromise<Record<string, unknown>>;

/**
 * @param options.getRemixDevLoadContext - Augment the load context.
 */
export const cloudflareProxyPreset = (
  options: {
    getRemixDevLoadContext?: GetRemixDevLoadContext;
  } = {}
): Preset => ({
  name: "cloudflare-proxy",
  remixConfig: async () => {
    let getLoadContext: GetLoadContext = async () => {
      let cloudflare = await getPlatformProxy<Env>();
      return { cloudflare };
    };

    // eslint-disable-next-line prefer-let/prefer-let
    const { getRemixDevLoadContext } = options;
    if (getRemixDevLoadContext) {
      getLoadContext = async (request: Request) => {
        let cloudflare = await getPlatformProxy<Env>();
        let loadContext = await getRemixDevLoadContext({
          cloudflare,
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
