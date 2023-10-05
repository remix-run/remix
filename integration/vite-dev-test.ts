import { test, expect } from "@playwright/test";
import type { Readable } from "node:stream";
import { createRequire } from "node:module";
import execa, { type ExecaChildProcess } from "execa";
import pidtree from "pidtree";
import getPort from "get-port";
import waitOn from "wait-on";

import { createFixtureProject, js } from "./helpers/create-fixture.js";

const require = createRequire(import.meta.url);

test.describe("Vite dev", () => {
  let projectDir: string;
  let devProc: ExecaChildProcess;
  let devPort: number;

  test.beforeAll(async () => {
    devPort = await getPort();
    projectDir = await createFixtureProject({
      env: {
        REMIX_EXPERIMENTAL_VITE: "1",
      },
      files: {
        "remix.config.js": js`
          throw new Error("Remix should not access remix.config.js when using Vite");
          export default {};
        `,
        "vite.config.mjs": js`
          import { defineConfig } from "vite";
          import { experimental_remix } from "@remix-run/dev/vite";

          export default defineConfig({
            optimizeDeps: {
              include: ["react", "react-dom/client"],
            },
            server: {
              port: ${devPort},
              strictPort: true,
            },
            plugins: [experimental_remix()],
          });
        `,
        "app/root.tsx": js`
          import { Links, Meta, Outlet, Scripts, LiveReload } from "@remix-run/react";

          export default function Root() {
            return (
              <html lang="en">
                <head>
                  <Meta />
                  <Links />
                </head>
                <body>
                  <div id="content">
                    <h1>Root</h1>
                    <Outlet />
                  </div>
                  <LiveReload />
                  <Scripts />
                </body>
              </html>
            );
          }
        `,
        "app/routes/_index.tsx": js`
          import { useState, useEffect } from "react";

          export default function() {
            const [mounted, setMounted] = useState(false);
            useEffect(() => {
              setMounted(true);
            }, []);

            return (
              <>
                <h2>Index</h2>
                {!mounted ? <h3>Loading...</h3> : <h3 data-mounted>Mounted</h3>}
              </>
            );
          }
        `,
      },
    });

    let nodeBin = process.argv[0];
    let cliPath = require.resolve("@remix-run/dev/dist/cli.js", {
      paths: [projectDir],
    });
    let cliArgs = [cliPath, "dev"];
    devProc = execa(nodeBin, cliArgs, {
      cwd: projectDir,
      env: { ...process.env, REMIX_EXPERIMENTAL_VITE: "1" },
    });
    let devStdout = bufferize(devProc.stdout!);
    let devStderr = bufferize(devProc.stderr!);

    await waitOn({
      resources: [`http://localhost:${devPort}/`],
      timeout: 10000,
    }).catch((err) => {
      let stdout = devStdout();
      let stderr = devStderr();
      throw new Error(
        [
          err.message,
          "",
          "command: " + [nodeBin, ...cliArgs].join(" "),
          "pid: " + (devProc.pid ?? "undefined"),
          "connected: " + devProc.connected,
          "exit code: " + devProc.exitCode,
          "stdout: " + stdout ? `\n${stdout}\n` : "<empty>",
          "stderr: " + stderr ? `\n${stderr}\n` : "<empty>",
        ].join("\n")
      );
    });
  });

  test.afterAll(async () => {
    devProc.pid && (await killtree(devProc.pid));
  });

  test("renders matching routes", async ({ page }) => {
    await page.goto(`http://localhost:${devPort}/`, {
      waitUntil: "networkidle",
    });
    expect(await page.locator("#content h2").textContent()).toBe("Index");
    expect(await page.locator("#content h3[data-mounted]").textContent()).toBe(
      "Mounted"
    );
  });
});

let bufferize = (stream: Readable): (() => string) => {
  let buffer = "";
  stream.on("data", (data) => (buffer += data.toString()));
  return () => buffer;
};

let isWindows = process.platform === "win32";

let kill = async (pid: number) => {
  if (!isAlive(pid)) return;
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
};

let isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
};

let killtree = async (pid: number) => {
  let descendants = await pidtree(pid).catch(() => undefined);
  if (descendants === undefined) return;
  let pids = [pid, ...descendants];

  await Promise.all(pids.map(kill));

  return new Promise<void>((resolve, reject) => {
    let check = setInterval(() => {
      pids = pids.filter(isAlive);
      if (pids.length === 0) {
        clearInterval(check);
        resolve();
      }
    }, 50);

    setTimeout(() => {
      clearInterval(check);
      reject(
        new Error("Timeout: Processes did not exit within the specified time.")
      );
    }, 2000);
  });
};
