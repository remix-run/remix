import { createRouter, type MiddlewareContext } from "remix/router";
import { staticFiles } from "remix/middleware/static";

import { assetServer } from "./assets.ts";
import marketing from "./controllers/marketing.tsx";
import { render } from "./middleware/render.tsx";
import { routes } from "./routes.ts";

type AppContext = MiddlewareContext<[ReturnType<typeof render>]>;

declare module "remix/router" {
  interface RouterTypes {
    context: AppContext;
  }
}

export const router = createRouter<AppContext>({
  middleware: [staticFiles("./public", { index: false }), render()],
});

router.map(
  routes.assets,
  async ({ request }) =>
    (await assetServer.fetch(request)) ??
      new Response("Not Found", { status: 404 }),
);

router.map(routes.marketing, marketing);
