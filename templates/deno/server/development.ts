import { createRequestHandler } from "@remix-run/express";
import type { ServerBuild } from "@remix-run/server-runtime";
import express from "express";
import { createServer } from "vite";

const PORT = Number(Deno.env.get("PORT")) || 8000;

const app = express();
const viteDevServer = await createServer({
  server: { middlewareMode: true },
});
app.use(viteDevServer.middlewares);
app.use(express.static("build/client", { maxAge: "1h" }));

app.all(
  "*",
  createRequestHandler({
    build: () =>
      viteDevServer.ssrLoadModule(
        "virtual:remix/server-build",
      ) as Promise<ServerBuild>,
    mode: "development",
  }),
);

app.listen(PORT, () => console.log(`👉 http://localhost:${PORT}`));
