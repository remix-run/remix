import { createRequestHandler } from "@remix-run/server-runtime";
import {
  type AppLoadContext,
  type ServerBuild,
} from "@remix-run/server-runtime";
import { type Plugin } from "vite";
import { type PlatformProxy, getPlatformProxy } from "wrangler";

// TODO: make wrangler import lazy??

import { fromNodeRequest, toNodeRequest } from "./node-adapter";

let serverBuildId = "virtual:remix/server-build";

type CfProperties = Record<string, unknown>;

type LoadContext<Env, Cf extends CfProperties> = {
  cloudflare: PlatformProxy<Env, Cf>;
};

type GetLoadContext<Env, Cf extends CfProperties> = (args: {
  request: Request;
  context: LoadContext<Env, Cf>;
}) => AppLoadContext | Promise<AppLoadContext>;

export const cloudflareProxyVitePlugin = <Env, Cf extends CfProperties>(
  options: { getLoadContext?: GetLoadContext<Env, Cf> } = {}
): Plugin => {
  return {
    name: "vite-plugin-remix-cloudflare-proxy",
    config: () => ({
      ssr: {
        resolve: {
          externalConditions: ["workerd", "worker"],
        },
      },
    }),
    async configureServer(viteDevServer) {
      let cloudflare = await getPlatformProxy<Env, Cf>();
      let context = { cloudflare };
      return () => {
        if (!viteDevServer.config.server.middlewareMode) {
          viteDevServer.middlewares.use(async (nodeReq, nodeRes, next) => {
            try {
              let build = (await viteDevServer.ssrLoadModule(
                serverBuildId
              )) as ServerBuild;

              let handler = createRequestHandler(build, "development");
              let req = fromNodeRequest(nodeReq);
              let loadContext = options.getLoadContext
                ? await options.getLoadContext({ request: req, context })
                : context;
              let res = await handler(req, loadContext);
              await toNodeRequest(res, nodeRes);
            } catch (error) {
              next(error);
            }
          });
        }
      };
    },
  };
};
