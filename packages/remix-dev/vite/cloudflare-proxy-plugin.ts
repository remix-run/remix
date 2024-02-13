import { createRequestHandler } from "@remix-run/server-runtime";
import {
  type AppLoadContext,
  type ServerBuild,
} from "@remix-run/server-runtime";
import { type Plugin } from "vite";
import { type PlatformProxy, getPlatformProxy } from "wrangler";

// TODO: make wrangler import lazy??
// TODO: auto-set ssr resolve conditions for workerd

import {
  fromNodeRequest,
  toNodeRequest,
  type NodeRequestHandler,
} from "./node-adapter";

let serverBuildId = "virtual:remix/server-build";

type Env = Record<string, unknown>;
type CfProperties = Record<string, unknown>;

type LoadContext<E extends Env, Cf extends CfProperties> = {
  cloudflare: PlatformProxy<E, Cf>;
};

type GetLoadContext<E extends Env, Cf extends CfProperties> = (args: {
  request: Request;
  context: LoadContext<E, Cf>;
}) => AppLoadContext | Promise<AppLoadContext>;

export const cloudflareProxyVitePlugin = <
  E extends Env,
  Cf extends CfProperties
>(
  options: { getLoadContext?: GetLoadContext<E, Cf> } = {}
): Plugin => {
  return {
    name: "vite-plugin-remix-cloudflare-proxy",
    async configureServer(viteDevServer) {
      let cloudflare = await getPlatformProxy<E, Cf>();
      let context = { cloudflare };
      return () => {
        if (!viteDevServer.config.server.middlewareMode) {
          viteDevServer.middlewares.use(async (req, res, next) => {
            try {
              let build = (await viteDevServer.ssrLoadModule(
                serverBuildId
              )) as ServerBuild;

              let handler = createRequestHandler(build, "development");
              let nodeHandler: NodeRequestHandler = async (
                nodeReq,
                nodeRes
              ) => {
                let request = fromNodeRequest(nodeReq);
                let loadContext = options.getLoadContext
                  ? await options.getLoadContext({ request, context })
                  : context;
                let res = await handler(request, loadContext);
                await toNodeRequest(res, nodeRes);
              };
              await nodeHandler(req, res);
            } catch (error) {
              next(error);
            }
          });
        }
      };
    },
  };
};
