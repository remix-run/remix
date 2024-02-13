import {
  createRequestHandler,
  type ServerBuild,
} from "@remix-run/server-runtime";
import { type Plugin } from "vite";
// TODO: make wrangler import lazy??
import { type PlatformProxy, getPlatformProxy } from "wrangler";

// TODO: auto-set ssr resolve conditions for workerd

import {
  fromNodeRequest,
  toNodeRequest,
  type NodeRequestHandler,
} from "./node-adapter";

let serverBuildId = "virtual:remix/server-build";

type LoadContext = {
  cloudflare: PlatformProxy;
};

type GetLoadContext = (args: {
  request: Request;
  context: LoadContext;
}) => Promise<Record<string, unknown>>;

export const cloudflareProxyVitePlugin = (
  options: { getLoadContext?: GetLoadContext } = {}
): Plugin => {
  return {
    name: "vite-plugin-remix-cloudflare-proxy",
    async configureServer(viteDevServer) {
      let cloudflare = await getPlatformProxy();
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
