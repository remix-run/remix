import { test, expect } from "@playwright/test";
import type { Readable } from "node:stream";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import getPort from "get-port";
import waitOn from "wait-on";

import { createFixtureProject, js } from "./helpers/create-fixture.js";
import { killtree } from "./helpers/killtree.js";

let projectDir: string;
let devProc: ChildProcessWithoutNullStreams;
let devPort: number;

////////////////////////////////////////////////////////////////////////////////
// 💿 👋 Hola! It's me, Dora the Remix Disc, I'm here to help you write a great
// bug report pull request.
//
// You don't need to fix the bug, this is just to report one.
//
// The pull request you are submitting is supposed to fail when created, to let
// the team see the erroneous behavior, and understand what's going wrong.
//
// If you happen to have a fix as well, it will have to be applied in a subsequent
// commit to this pull request, and your now-succeeding test will have to be moved
// to the appropriate file.
//
// First, make sure to install dependencies and build Remix. From the root of
// the project, run this:
//
//    ```
//    pnpm install && pnpm build
//    ```
//
// Now try running this test:
//
//    ```
//    pnpm bug-report-test
//    ```
//
// You can add `--watch` to the end to have it re-run on file changes:
//
//    ```
//    pnpm bug-report-test --watch
//    ```
////////////////////////////////////////////////////////////////////////////////

test.beforeEach(async ({ context }) => {
  await context.route(/_data/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    route.continue();
  });
});

test.beforeAll(async () => {
  devPort = await getPort();
  projectDir = await createFixtureProject({
    ////////////////////////////////////////////////////////////////////////////
    // 💿 Next, add files to this object, just like files in a real app,
    // `createFixture` will make an app and run your tests against it.
    ////////////////////////////////////////////////////////////////////////////
    compiler: "vite",
    files: {
      "vite.config.ts": js`
        import { defineConfig } from "vite";
        import { vitePlugin as remix } from "@remix-run/dev";
        export default defineConfig({
          server: {
            port: ${devPort},
            strictPort: true,
          },
          plugins: [
            remix({
              future: {
                v3_lazyRouteDiscovery: true,
              }
            }),
          ],
        });
      `,

      "app/routes/_index.tsx": js`
        import { useNavigate } from "@remix-run/react";
        import { useEffect } from "react";

        export default function Index() {
          let navigate = useNavigate();

          useEffect(() => {
            navigate("/burgers");
          }, [navigate]);

          return null;
        }
      `,

      "app/routes/burgers.tsx": js`
        export default function Index() {
          return <div>cheeseburger</div>;
        }
      `,
    },
  });

  let nodeBin = process.argv[0];
  let remixBin = "node_modules/@remix-run/dev/dist/cli.js";
  devProc = spawn(nodeBin, [remixBin, "vite:dev"], {
    cwd: projectDir,
    env: process.env,
    stdio: "pipe",
  });
  let devStdout = bufferize(devProc.stdout);
  let devStderr = bufferize(devProc.stderr);

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

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

test("should successfully navigate to the burgers route on load", async ({
  page,
}) => {
  await page.goto(`http://localhost:${devPort}/`, {
    waitUntil: "networkidle",
  });

  await expect(page.getByText("404 Not Found")).not.toBeVisible();
  await page.waitForSelector("text=cheeseburger");
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////

let bufferize = (stream: Readable): (() => string) => {
  let buffer = "";
  stream.on("data", (data) => (buffer += data.toString()));
  return () => buffer;
};
