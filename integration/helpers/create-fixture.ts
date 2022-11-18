import path from "path";
import fse from "fs-extra";
import type { Writable } from "stream";
import express from "express";
import getPort from "get-port";
import stripIndent from "strip-indent";
import { sync as spawnSync } from "cross-spawn";
import type { JsonObject } from "type-fest";
import type { ServerMode } from "@remix-run/server-runtime/mode";

import type { ServerBuild } from "../../build/node_modules/@remix-run/server-runtime";
import { createRequestHandler } from "../../build/node_modules/@remix-run/server-runtime";
import { createRequestHandler as createExpressHandler } from "../../build/node_modules/@remix-run/express";

const TMP_DIR = path.join(process.cwd(), ".tmp", "integration");

interface FixtureInit {
  buildStdio?: Writable;
  sourcemap?: boolean;
  files?: { [filename: string]: string };
  template?: "cf-template" | "deno-template" | "node-template";
  setup?: "node" | "cloudflare";
}

export type Fixture = Awaited<ReturnType<typeof createFixture>>;
export type AppFixture = Awaited<ReturnType<typeof createAppFixture>>;

export const js = String.raw;
export const mdx = String.raw;
export const css = String.raw;
export function json(value: JsonObject) {
  return JSON.stringify(value, null, 2);
}

export async function createFixture(init: FixtureInit) {
  let projectDir = await createFixtureProject(init);
  let buildPath = path.resolve(projectDir, "build");
  let app: ServerBuild = await import(buildPath);
  let handler = createRequestHandler(app, "production");

  let requestDocument = async (href: string, init?: RequestInit) => {
    let url = new URL(href, "test://test");
    let request = new Request(url.toString(), {
      ...init,
      signal: init?.signal || new AbortController().signal,
    });
    return handler(request);
  };

  let requestData = async (
    href: string,
    routeId: string,
    init?: RequestInit
  ) => {
    init = init || {};
    init.signal = init.signal || new AbortController().signal;
    let url = new URL(href, "test://test");
    url.searchParams.set("_data", routeId);
    let request = new Request(url.toString(), init);
    return handler(request);
  };

  let postDocument = async (href: string, data: URLSearchParams | FormData) => {
    return requestDocument(href, {
      method: "POST",
      body: data,
      headers: {
        "Content-Type":
          data instanceof URLSearchParams
            ? "application/x-www-form-urlencoded"
            : "multipart/form-data",
      },
    });
  };

  let getBrowserAsset = async (asset: string) => {
    return fse.readFile(
      path.join(projectDir, "public", asset.replace(/^\//, "")),
      "utf8"
    );
  };

  return {
    projectDir,
    build: app,
    requestDocument,
    requestData,
    postDocument,
    getBrowserAsset,
  };
}

export async function createAppFixture(fixture: Fixture, mode?: ServerMode) {
  let startAppServer = async (): Promise<{
    port: number;
    stop: () => Promise<void>;
  }> => {
    return new Promise(async (accept) => {
      let port = await getPort();
      let app = express();
      app.use(express.static(path.join(fixture.projectDir, "public")));

      app.all(
        "*",
        createExpressHandler({
          build: fixture.build,
          mode: mode || "production",
        })
      );

      let server = app.listen(port);

      let stop = (): Promise<void> => {
        return new Promise((res) => {
          server.close(() => res());
        });
      };

      accept({ stop, port });
    });
  };

  let start = async () => {
    let { stop, port } = await startAppServer();

    let serverUrl = `http://localhost:${port}`;

    return {
      serverUrl,
      /**
       * Shuts down the fixture app, **you need to call this
       * at the end of a test** or `afterAll` if the fixture is initialized in a
       * `beforeAll` block. Also make sure to `await app.close()` or else you'll
       * have memory leaks.
       */
      close: async () => {
        return stop();
      },
    };
  };

  return start();
}

////////////////////////////////////////////////////////////////////////////////

export async function createFixtureProject(
  init: FixtureInit = {}
): Promise<string> {
  let template = init.template ?? "node-template";
  let integrationTemplateDir = path.join(__dirname, template);
  let projectName = `remix-${template}-${Math.random().toString(32).slice(2)}`;
  let projectDir = path.join(TMP_DIR, projectName);

  await fse.ensureDir(projectDir);
  await fse.copy(integrationTemplateDir, projectDir);
  await fse.copy(
    path.join(__dirname, "../../build/node_modules"),
    path.join(projectDir, "node_modules"),
    { overwrite: true }
  );

  if (init.setup) {
    let setupSpawn = spawnSync(
      "node",
      ["node_modules/@remix-run/dev/dist/cli.js", "setup", init.setup],
      { cwd: projectDir }
    );

    // These logs are helpful for debugging. Remove comments if needed.
    // console.log("spawning @remix-run/dev/cli.js `setup`:\n");
    // console.log("  STDOUT:");
    // console.log("  " + setupSpawn.stdout.toString("utf-8"));
    // console.log("  STDERR:");
    // console.log("  " + setupSpawn.stderr.toString("utf-8"));
    if (setupSpawn.error || setupSpawn.status) {
      console.error(setupSpawn.stderr.toString("utf-8"));
      throw (
        setupSpawn.error || new Error(`Setup failed, check the output above`)
      );
    }
  }
  await writeTestFiles(init, projectDir);
  build(projectDir, init.buildStdio, init.sourcemap);

  return projectDir;
}

function build(projectDir: string, buildStdio?: Writable, sourcemap?: boolean) {
  let buildArgs = ["node_modules/@remix-run/dev/dist/cli.js", "build"];
  if (sourcemap) {
    buildArgs.push("--sourcemap");
  }
  let buildSpawn = spawnSync("node", buildArgs, { cwd: projectDir });

  // These logs are helpful for debugging. Remove comments if needed.
  // console.log("spawning @remix-run/dev/cli.js `build`:\n");
  // console.log("  STDOUT:");
  // console.log("  " + buildSpawn.stdout.toString("utf-8"));
  // console.log("  STDERR:");
  // console.log("  " + buildSpawn.stderr.toString("utf-8"));

  if (buildStdio) {
    buildStdio.write(buildSpawn.stdout.toString("utf-8"));
    buildStdio.write(buildSpawn.stderr.toString("utf-8"));
    buildStdio.end();
  }

  if (buildSpawn.error || buildSpawn.status) {
    console.error(buildSpawn.stderr.toString("utf-8"));
    throw buildSpawn.error || new Error(`Build failed, check the output above`);
  }
}

async function writeTestFiles(init: FixtureInit, dir: string) {
  await Promise.all(
    Object.keys(init.files ?? {}).map(async (filename) => {
      let filePath = path.join(dir, filename);
      await fse.ensureDir(path.dirname(filePath));
      let file = init.files![filename];
      // if we have a jsconfig we don't want the tsconfig to exist
      if (filename.endsWith("jsconfig.json")) {
        let parsed = path.parse(filePath);
        await fse.remove(path.join(parsed.dir, "tsconfig.json"));
      }

      await fse.writeFile(filePath, stripIndent(file));
    })
  );
}
