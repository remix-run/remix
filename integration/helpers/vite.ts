import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import type { Readable } from "node:stream";
import url from "node:url";
import execa from "execa";
import fse from "fs-extra";
import resolveBin from "resolve-bin";
import stripIndent from "strip-indent";
import waitOn from "wait-on";
import getPort from "get-port";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

export const VITE_CONFIG = async (args: { port: number }) => {
  let hmrPort = await getPort();
  return String.raw`
    import { defineConfig } from "vite";
    import { unstable_vitePlugin as remix } from "@remix-run/dev";

    export default defineConfig({
      server: {
        port: ${args.port},
        strictPort: true,
        hmr: {
          port: ${hmrPort}
        }
      },
      plugins: [remix()],
    });
  `;
};

export const EXPRESS_SERVER = (args: {
  port: number;
  loadContext?: Record<string, unknown>;
}) =>
  String.raw`
    import { unstable_viteServerBuildModuleId } from "@remix-run/dev";
    import { createRequestHandler } from "@remix-run/express";
    import { installGlobals } from "@remix-run/node";
    import express from "express";

    installGlobals();

    let vite =
      process.env.NODE_ENV === "production"
        ? undefined
        : await import("vite").then(({ createServer }) =>
            createServer({
              server: { middlewareMode: true },
            })
          );

    const app = express();

    if (vite) {
      app.use(vite.middlewares);
    } else {
      app.use(
        "/assets",
        express.static("build/client/assets", { immutable: true, maxAge: "1y" })
      );
    }
    app.use(express.static("build/client", { maxAge: "1h" }));

    app.all(
      "*",
      createRequestHandler({
        build: vite
          ? () => vite.ssrLoadModule(unstable_viteServerBuildModuleId)
          : await import("./build/index.js"),
        getLoadContext: () => (${JSON.stringify(args.loadContext ?? {})}),
      })
    );

    const port = ${args.port};
    app.listen(port, () => console.log('http://localhost:' + port));
  `;

const TMP_DIR = path.join(process.cwd(), ".tmp/integration");
export async function createProject(files: Record<string, string> = {}) {
  let projectName = `remix-${Math.random().toString(32).slice(2)}`;
  let projectDir = path.join(TMP_DIR, projectName);
  await fse.ensureDir(projectDir);

  // base template
  let template = path.resolve(__dirname, "vite-template");
  await fse.copy(template, projectDir, { errorOnExist: true });

  // user-defined files
  await Promise.all(
    Object.entries(files).map(async ([filename, contents]) => {
      let filepath = path.join(projectDir, filename);
      await fse.ensureDir(path.dirname(filepath));
      await fse.writeFile(filepath, stripIndent(contents));
    })
  );

  // node_modules: overwrite with locally built Remix packages
  await fse.copy(
    path.join(__dirname, "../../build/node_modules"),
    path.join(projectDir, "node_modules"),
    { overwrite: true }
  );

  return projectDir;
}

type ServerArgs = {
  cwd: string;
  port: number;
  debug?: boolean;
};

const createDev =
  (nodeArgs: string[]) =>
  async ({ cwd, port, debug }: ServerArgs): Promise<() => Promise<void>> => {
    let proc = node(nodeArgs, { cwd, debug });
    await waitForServer(proc, { port: port });
    return async () => await kill(proc.pid!);
  };

export const viteBuild = (args: { cwd: string }) => {
  let vite = resolveBin.sync("vite");
  let commands = [
    [vite, "build"],
    [vite, "build", "--ssr"],
  ];
  let results = [];
  for (let command of commands) {
    let result = spawnSync("node", command, {
      cwd: args.cwd,
      env: {
        ...process.env,
      },
    });
    results.push(result);
  }
  return results;
};
export const viteDev = createDev([resolveBin.sync("vite"), "dev"]);
export const customDev = createDev(["./server.mjs"]);

function node(args: string[], options: { cwd: string; debug?: boolean }) {
  let nodeBin = process.argv[0];

  let proc = spawn(nodeBin, args, {
    cwd: options.cwd,
    env: process.env,
    stdio: "pipe",
  });
  if (options.debug) {
    proc.stderr.on("data", (data) => console.log(data.toString()));
    proc.stdout.on("data", (data) => console.log(data.toString()));
  }
  return proc;
}

async function kill(pid: number) {
  if (!isAlive(pid)) return;

  let isWindows = process.platform === "win32";
  if (isWindows) {
    await execa("taskkill", ["/F", "/PID", pid.toString()]).catch((error) => {
      // taskkill 128 -> the process is already dead
      if (error.exitCode === 128) return;
      if (/There is no running instance of the task./.test(error.message))
        return;
      console.warn(error.message);
    });
    return;
  }
  await execa("kill", ["-9", pid.toString()]).catch((error) => {
    // process is already dead
    if (/No such process/.test(error.message)) return;
    console.warn(error.message);
  });
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

async function waitForServer(
  proc: ChildProcess & { stdout: Readable; stderr: Readable },
  args: { port: number }
) {
  let devStdout = bufferize(proc.stdout);
  let devStderr = bufferize(proc.stderr);

  await waitOn({
    resources: [`http://localhost:${args.port}/`],
    timeout: 10000,
  }).catch((err) => {
    let stdout = devStdout();
    let stderr = devStderr();
    kill(proc.pid!);
    throw new Error(
      [
        err.message,
        "",
        "exit code: " + proc.exitCode,
        "stdout: " + stdout ? `\n${stdout}\n` : "<empty>",
        "stderr: " + stderr ? `\n${stderr}\n` : "<empty>",
      ].join("\n")
    );
  });
}

function bufferize(stream: Readable): () => string {
  let buffer = "";
  stream.on("data", (data) => (buffer += data.toString()));
  return () => buffer;
}