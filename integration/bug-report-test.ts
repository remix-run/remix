import { test, expect } from "@playwright/test";
import { spawn } from "cross-spawn";
import getPort from "get-port";
import * as readline from "node:readline";
import fs from "fs";
import path from "path";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import { createFixtureProject } from "./helpers/create-fixture";
import { js } from "./helpers/create-fixture";

let appFixture: Awaited<ReturnType<typeof startDevServer>>;

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
//    yarn && yarn build
//    ```
//
// Now try running this test:
//
//    ```
//    yarn bug-report-test
//    ```
//
// You can add `--watch` to the end to have it re-run on file changes:
//
//    ```
//    yarn bug-report-test --watch
//    ```
////////////////////////////////////////////////////////////////////////////////

async function startDevServer(fixture: {
  files?: { [filename: string]: string };
}) {
  let port = await getPort();
  let serverUrl = `http://localhost:${port}`;

  let projectDir = await createFixtureProject(fixture);

  let watchProcess = spawn(
    "node",
    ["node_modules/@remix-run/dev/dist/cli.js", "dev"],
    {
      cwd: projectDir,
      env: {
        ...process.env,
        PORT: port.toString(),
      },
    }
  );

  await new Promise<void>((isReady, onError) => {
    let rl = readline.createInterface(watchProcess.stdout);
    let timeout = setTimeout(() => {
      onError(new Error("Timed out waiting for watch server"));
    }, 10000);

    rl.on("line", (input) => {
      if (input.match(/Remix App Server started at http:\/\/localhost/)) {
        rl.removeAllListeners();
        clearTimeout(timeout);
        isReady();
      }
    });
    rl.on("close", () => {
      clearTimeout(timeout);
      onError(new Error("Watch server did not start correctly"));
    });
  });

  let waitForRebuild = (timeout: number = 10000) => {
    let rl = readline.createInterface(watchProcess.stdout);
    return new Promise<void>((resolve, reject) => {
      let timeoutRef = setTimeout(() => {
        reject(new Error("Timed out waiting for watch server rebuild"));
      }, timeout);

      rl.on("line", (input) => {
        if (input.match(/Rebuilt in/)) {
          rl.removeAllListeners();
          clearTimeout(timeoutRef);
          resolve();
        }
      });
      rl.on("close", () => {
        clearTimeout(timeoutRef);
        reject(new Error("Watch server died unexpectedly"));
      });
    });
  };

  return {
    projectDir,
    serverUrl,
    waitForRebuild,
    close: async () => {
      if (!watchProcess.kill()) {
        watchProcess.kill(9);
      }
    },
  };
}

test.beforeEach(async () => {
  appFixture = await startDevServer({
    files: {
      "app/routes/index.jsx": js`
        import { json } from "@remix-run/node";

        export async function loader() {
          return json({});
        }

        export default function Index() {
          return "initial";
        }
      `,
    },
  });
});

test.afterEach(() => appFixture.close());

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

test("after file changes the app reloads if the loader is slow", async ({
  page,
}) => {
  let app = new PlaywrightFixture(appFixture, page);

  await app.goto("/");
  expect(await app.getHtml()).toMatch("initial");

  await Promise.all([
    fs.promises.writeFile(
      path.join(appFixture.projectDir, "app", "routes", "index.jsx"),
      js`
        import { json } from "@remix-run/node";

        export async function loader() {
          await new Promise((resolve) => {
            setTimeout(resolve, 2000);
          });

          return json({});
        }

        export default function Index() {
          return (
            <div id="changed">changed</div>
          );
        }
      `
    ),
    appFixture.waitForRebuild(),
    app.page.waitForNavigation(),
    app.page.waitForSelector("#changed"),
  ]);

  expect(await app.getHtml()).toMatch("changed");
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
