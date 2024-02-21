import { Server } from "node:http";

import { createRequestHandler } from "@remix-run/server-runtime";
import {
  type AppLoadContext,
  type ServerBuild,
} from "@remix-run/server-runtime";
import { type Connect, type Plugin } from "vite";
import { type GetPlatformProxyOptions, type PlatformProxy } from "wrangler";
import { Server as WebSocketServer } from "ws";

import { fromNodeRequest, toNodeRequest } from "./node-adapter";

let serverBuildId = "virtual:remix/server-build";

type CfProperties = Record<string, unknown>;

type LoadContext<Env, Cf extends CfProperties> = {
  cloudflare: Omit<PlatformProxy<Env, Cf>, "dispose">;
};

type GetLoadContext<Env, Cf extends CfProperties> = (args: {
  request: Request;
  context: LoadContext<Env, Cf>;
}) => AppLoadContext | Promise<AppLoadContext>;

function importWrangler() {
  try {
    return import("wrangler");
  } catch (_) {
    throw Error("Could not import `wrangler`. Do you have it installed?");
  }
}

const NAME = "vite-plugin-remix-cloudflare-proxy";

export const cloudflareDevProxyVitePlugin = <Env, Cf extends CfProperties>({
  getLoadContext,
  ...options
}: {
  getLoadContext?: GetLoadContext<Env, Cf>;
} & GetPlatformProxyOptions = {}): Plugin => {
  return {
    name: NAME,
    config: () => ({
      server: {
        hmr: {
          // HMR must be served on a different port than the dev server
          // so non-HMR WebSocket upgrade request is handled by the WebSocket proxy
          port: 4173,
        },
      },
      ssr: {
        resolve: {
          externalConditions: ["workerd", "worker"],
        },
      },
    }),
    configResolved: (viteConfig) => {
      let pluginIndex = (name: string) =>
        viteConfig.plugins.findIndex((plugin) => plugin.name === name);
      let remixIndex = pluginIndex("remix");
      if (remixIndex >= 0 && remixIndex < pluginIndex(NAME)) {
        throw new Error(
          `The "${NAME}" plugin should be placed before the Remix plugin in your Vite config file`
        );
      }
    },
    configureServer: async (viteDevServer) => {
      let { getPlatformProxy } = await importWrangler();
      // Do not include `dispose` in Cloudflare context
      let { dispose, ...cloudflare } = await getPlatformProxy<Env, Cf>(options);
      let context = { cloudflare };

      // Create WebSocket proxy for Durable Object WebSocket
      if (viteDevServer.httpServer instanceof Server) {
        let wsServer = new WebSocketServer({
          server: viteDevServer.httpServer,
        });

        wsServer.on("connection", async (nodeWs, nodeReq) => {
          // Patch Node IncomingMessage to be compatible with Connect.IncomingMessage
          (nodeReq as Connect.IncomingMessage).originalUrl = nodeReq.url;

          let build = (await viteDevServer.ssrLoadModule(
            serverBuildId
          )) as ServerBuild;

          let handler = createRequestHandler(build, "development");
          let req = fromNodeRequest(nodeReq);
          let loadContext = getLoadContext
            ? await getLoadContext({ request: req, context })
            : context;

          let request = fromNodeRequest(nodeReq);
          let response = (await handler(request, loadContext)) as unknown as {
            status: number;
            webSocket?: import("@cloudflare/workers-types").WebSocket;
          };

          if (response.status !== 101 || response.webSocket === undefined) {
            nodeWs.close();
            return;
          }

          let doWs = response.webSocket;
          doWs.accept();

          let closedByClient = false;
          let closedByWorkerd = false;

          nodeWs.on("close", () => {
            if (closedByWorkerd) {
              closedByWorkerd = false;
              viteDevServer.hot.send({
                type: "full-reload",
              });
              return;
            }

            closedByClient = true;
            doWs.close();
          });

          nodeWs.on("message", (data) => {
            if (Array.isArray(data)) {
              for (let datum of data) {
                doWs.send(datum);
              }
            } else {
              doWs.send(data);
            }
          });

          doWs.addEventListener("close", () => {
            if (closedByClient) {
              closedByClient = false;
              return;
            }

            closedByWorkerd = true;
            nodeWs.close();
          });

          doWs.addEventListener("message", (e) => {
            nodeWs.send(e.data);
          });
        });
      }

      return () => {
        if (!viteDevServer.config.server.middlewareMode) {
          viteDevServer.middlewares.use(async (nodeReq, nodeRes, next) => {
            try {
              let build = (await viteDevServer.ssrLoadModule(
                serverBuildId
              )) as ServerBuild;

              let handler = createRequestHandler(build, "development");
              let req = fromNodeRequest(nodeReq);
              let loadContext = getLoadContext
                ? await getLoadContext({ request: req, context })
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
