import http from "http";
import express from "express";
import morgan from "morgan";
import * as rollup from "rollup";
import onExit from "signal-exit";

import { watch } from "./core";
import { runtime as reactRefreshRuntime } from "./reactRefresh";
import { EsmHmrEngine } from "./vendor/esm-hmr/server";
import { debugBundle, debugChunk } from "./rollupDebugUtils";

type ReqResPair = { req: express.Request; res: express.Response };

export interface CreateDevServerOptions {
  flattenWaterfall: boolean;
  publicDir: string;
  sourceDir: string;
}

export default function createDevServer({
  flattenWaterfall = false,
  publicDir = "public",
  sourceDir
}: Partial<CreateDevServerOptions> = {}) {
  let app = express();

  app.use(morgan("dev"));
  app.use(express.static(publicDir));

  app.get("/favicon.ico", (_req: express.Request, res: express.Response) => {
    res.end();
  });

  app.get("/", (_req: express.Request, res: express.Response) => {
    // TODO: Add routing ... do we need to wait for the bundle to be ready
    // before we can render some HTML?
    let html = createHtml({
      moduleUrls: ["/_src/main.js"]
    });

    res.set({ "Content-Type": "text/html" }).send(html);
  });

  app.use("/_npm", handleDependencyRequest);
  app.get("*", handleRequest);

  function handleDependencyRequest(
    req: express.Request,
    res: express.Response
  ) {
    let entry = req.url.slice(1).replace(/\.js$/, "");
    // TODO
  }

  let bundle: rollup.RollupOutput | null = null;

  watch({ sourceDir }, async event => {
    switch (event.code) {
      case "ERROR":
        console.error(event);
        break;
      case "BUNDLE_START":
        bundle = null;
        break;
      case "BUNDLE_END":
        let build = event.result;
        bundle = await build.generate({
          format: "esm",
          hoistTransitiveImports: flattenWaterfall,
          sourcemap: true
        });
        handleChanges(bundle);
        flushPendingQueue();
        break;
    }
  });

  let pendingQueue: ReqResPair[] = [];

  function flushPendingQueue() {
    while (pendingQueue.length > 0) {
      let { req, res } = pendingQueue.shift() as ReqResPair;
      handleRequest(req, res);
    }
  }

  function handleRequest(req: express.Request, res: express.Response) {
    if (!bundle) {
      pendingQueue.push({ req, res });
      return;
    }

    let url = req.url;
    let wantsSourceMap = false;
    if (url.endsWith(".map")) {
      url = url.slice(0, -4);
      wantsSourceMap = true;
    }

    let output = getOutput(bundle, url);

    if (!output) {
      res.status(404).end();
      return;
    }

    if (output.type === "chunk") {
      if (wantsSourceMap) {
        sendSourceMap(res, output.map);
      } else {
        sendJavaScript(res, output.code, getSourceMapUrl(req));
      }

      return;
    }

    // TODO: Get content-type from output.fileName
    res.end(output.source);
  }

  let prevBundle: rollup.RollupOutput;

  function handleChanges(bundle: rollup.RollupOutput) {
    console.log(debugBundle(bundle));

    if (prevBundle) {
      let changedChunks = getChunks(bundle).filter(chunk => {
        let prevChunk = getChunks(prevBundle).find(
          item => item.name === chunk.name
        );
        return !prevChunk || prevChunk.code !== chunk.code;
      });

      triggerHotUpdates(changedChunks);
    }

    prevBundle = bundle;
  }

  function triggerHotUpdates(chunks: rollup.OutputChunk[]) {
    let chunk = chunks[0];
    let updateUrl = getOutputUrl(chunk.fileName);

    console.log({ node: hmrEngine.getEntry(updateUrl) });

    if (hmrEngine.getEntry(updateUrl)) {
      updateOrBubble(updateUrl, new Set());
    }
  }

  // Copied from https://github.com/pikapkg/snowpack/blob/34ea7af320fda46bd8a5d25d6243682a11060189/packages/snowpack/src/commands/dev.ts#L802
  function updateOrBubble(url: string, visited: Set<string>) {
    if (visited.has(url)) return;
    visited.add(url);

    let node = hmrEngine.getEntry(url);

    if (node && node.isHmrEnabled) {
      hmrEngine.broadcastMessage({ type: "update", url });
    }

    if (node && node.isHmrAccepted) {
      // Found a boundary, no bubbling needed.
    } else if (node && node.dependents.size > 0) {
      hmrEngine.markEntryForReplacement(node, true);
      node.dependents.forEach(dep => updateOrBubble(dep, visited));
    } else {
      // We've reached the top, trigger a full page refresh.
      // hmrEngine.broadcastMessage({ type: "reload" });
      console.log({ reload: true });
    }
  }

  // TODO: Support https/http2
  let server = http.createServer(app);
  let hmrEngine = new EsmHmrEngine({ server });

  onExit(() => {
    hmrEngine.disconnectAllClients();
  });

  return server;
}

////////////////////////////////////////////////////////////////////////////////

function serveBundle(
  bundle: rollup.RollupOutput,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  let url = req.url;
  let wantsSourceMap = false;
  if (url.endsWith(".map")) {
    url = url.slice(0, -4);
    wantsSourceMap = true;
  }

  let output = getOutput(bundle, url);
  if (!output) return next();

  if (output.type === "chunk") {
    if (wantsSourceMap) {
      sendSourceMap(res, output.map);
    } else {
      sendJavaScript(res, output.code, getSourceMapUrl(req));
    }
  } else {
    // TODO: Get content-type from output.fileName
    res.end(output.source);
  }
}

function getChunks(bundle: rollup.RollupOutput): rollup.OutputChunk[] {
  return bundle.output.filter(
    item => item.type === "chunk"
  ) as rollup.OutputChunk[];
}

function getOutputUrl(fileName: string) {
  return "/" + fileName.split("\\").join("/");
}

function getOutput(bundle: rollup.RollupOutput, url: string) {
  return bundle.output.find(item => url === getOutputUrl(item.fileName));
}

function getSourceMapUrl(req: express.Request) {
  let split = req.originalUrl.split("?");
  return `${split[0]}.map${split[1] || ""}`;
}

function sendSourceMap(res: express.Response, sourceMap?: rollup.SourceMap) {
  res.json(sourceMap || {});
}

function sendJavaScript(
  res: express.Response,
  code: string,
  sourceMapUrl?: string
) {
  res
    .set({
      "Content-Type": "text/javascript",
      SourceMap: sourceMapUrl
    })
    .send(code);
}

function createHtml({
  moduleUrls = []
}: {
  moduleUrls?: string[];
} = {}): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Test</title>
  </head>
  <body>
    ${reactRefreshRuntime}
    <div id="root"></div>
    ${moduleUrls
      .map(url => `<script type="module" src="${url}"></script>`)
      .join("")}
  </body>
</html>`;
}
