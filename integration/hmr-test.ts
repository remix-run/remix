import { test, expect } from "@playwright/test";
import execa from "execa";
import fs from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";
import getPort, { makeRange } from "get-port";

import { createFixtureProject } from "./helpers/create-fixture";

let fixture = (options: { port: number; appServerPort: number }) => ({
  future: {
    unstable_dev: {
      port: options.port,
      appServerPort: options.appServerPort,
    },
    unstable_tailwind: true,
  },
  files: {
    "package.json": `
        {
          "private": true,
          "sideEffects": false,
          "scripts": {
            "dev:remix": "NODE_ENV=development node ../../../build/node_modules/@remix-run/dev/dist/cli.js dev",
            "dev:app": "NODE_ENV=development nodemon --watch build/ ./server.js"
          },
          "dependencies": {
            "@remix-run/node": "0.0.0-local-version",
            "@remix-run/react": "0.0.0-local-version",
            "express": "0.0.0-local-version",
            "nodemon": "0.0.0-local-version",
            "react": "0.0.0-local-version",
            "react-dom": "0.0.0-local-version",
            "tailwindcss": "0.0.0-local-version"
          },
          "devDependencies": {
            "@remix-run/dev": "0.0.0-local-version",
            "@types/react": "0.0.0-local-version",
            "@types/react-dom": "0.0.0-local-version",
            "typescript": "0.0.0-local-version"
          },
          "engines": {
            "node": ">=14"
          }
        }
      `,
    "server.js": `
        let path = require("path");
        let express = require("express");
        let { createRequestHandler } = require("@remix-run/express");

        const app = express();
        app.use(express.static("public", { immutable: true, maxAge: "1y" }));

        const MODE = process.env.NODE_ENV;
        const BUILD_DIR = path.join(process.cwd(), "build");

        app.all(
          "*",
          createRequestHandler({
            build: require(BUILD_DIR),
            mode: MODE,
          })
        );

        let port = ${options.appServerPort};
        app.listen(port, () => {
          require(BUILD_DIR);
          console.log('✅ app ready: http://localhost:' + port);
        });
      `,
    "tailwind.config.js": `
        /** @type {import('tailwindcss').Config} */
        module.exports = {
          content: ["./app/**/*.{ts,tsx,jsx,js}"],
          theme: {
            extend: {},
          },
          plugins: [],
        };
      `,
    "app/tailwind.css": `
        @tailwind base;
        @tailwind components;
        @tailwind utilities;
      `,
    "app/root.tsx": `
        import type { LinksFunction } from "@remix-run/node";
        import { Link, Links, LiveReload, Meta, Outlet, Scripts } from "@remix-run/react";

        import styles from "./tailwind.css";

        export const links: LinksFunction = () => [
          { rel: "stylesheet", href: styles },
        ];

        export default function Root() {
          return (
            <html lang="en" className="h-full">
              <head>
                <Meta />
                <Links />
              </head>
              <body className="h-full">
                <header>
                  <label htmlFor="root-input">Root Input</label>
                  <input id="root-input" />
                  <nav>
                    <ul>
                      <li><Link to="/">Home</Link></li>
                      <li><Link to="/a">A</Link></li>
                      <li><Link to="/b">B</Link></li>
                    </ul>
                  </nav>
                </header>
                <Outlet />
                <Scripts />
                <LiveReload />
              </body>
            </html>
          );
        }
      `,
    "app/routes/index.tsx": `
        export default function Index() {
          return (
            <main>
              <h1>Index Title</h1>
            </main>
          )
        }
      `,
  },
});

let sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let wait = async (
  callback: () => boolean,
  { timeoutMs = 1000, intervalMs = 250 } = {}
) => {
  let start = Date.now();
  while (Date.now() - start <= timeoutMs) {
    if (callback()) {
      return;
    }
    await sleep(intervalMs);
  }
  throw Error(`wait: timeout ${timeoutMs}ms`);
};

let bufferize = (stream: Readable): (() => string) => {
  let buffer = "";
  stream.on("data", (data) => (buffer += data.toString()));
  return () => buffer;
};

test("HMR", async ({ page }) => {
  // uncomment for debugging
  // page.on("console", (msg) => console.log(msg.text()));
  page.on("pageerror", (err) => console.log(err.message));

  let appServerPort = await getPort({ port: makeRange(3080, 3089) });
  let port = await getPort({ port: makeRange(3090, 3099) });
  let projectDir = await createFixtureProject(fixture({ port, appServerPort }));

  // spin up dev server
  let dev = execa("npm", ["run", "dev:remix"], { cwd: projectDir });
  let devStdout = bufferize(dev.stdout!);
  let devStderr = bufferize(dev.stderr!);
  await wait(() => /💿 Built in /.test(devStdout()), { timeoutMs: 3000 });

  // spin up app server
  let app = execa("npm", ["run", "dev:app"], { cwd: projectDir });
  let appStdout = bufferize(app.stdout!);
  let appStderr = bufferize(app.stderr!);
  await wait(() => /✅ app ready: /.test(appStdout()));

  try {
    await page.goto(`http://localhost:${appServerPort}`);

    // `<input />` value as page state that
    // would be wiped out by a full page refresh
    // but should be persisted by hmr
    let input = page.getByLabel("Root Input");
    expect(input).toBeVisible();
    await input.type("asdfasdf");

    let indexPath = path.join(projectDir, "app", "routes", "index.tsx");
    let originalIndex = fs.readFileSync(indexPath, "utf8");

    // make content and style changed to index route
    let newIndex = `
      export default function Index() {
        return (
          <main>
            <h1 className="text-white bg-black">Changed</h1>
          </main>
        )
      }
    `;
    fs.writeFileSync(indexPath, newIndex);

    // detect HMR'd content and style changes
    let h1 = page.getByText("Changed");
    await h1.waitFor({ timeout: 2000 });
    expect(h1).toHaveCSS("color", "rgb(255, 255, 255)");
    expect(h1).toHaveCSS("background-color", "rgb(0, 0, 0)");

    // verify that `<input />` value was persisted (i.e. hmr, not full page refresh)
    expect(await page.getByLabel("Root Input").inputValue()).toBe("asdfasdf");

    // undo change
    fs.writeFileSync(indexPath, originalIndex);
    await page.getByText("Index Title").waitFor({ timeout: 2000 });
    expect(await page.getByLabel("Root Input").inputValue()).toBe("asdfasdf");

    // add loader
    let withLoader1 = `
        import { json } from "@remix-run/node";
        import { useLoaderData } from "@remix-run/react";

        export let loader = () => json({ hello: "world" })

        export default function Index() {
          let { hello } = useLoaderData<typeof loader>();
          return (
            <main>
              <h1>Hello, {hello}</h1>
            </main>
          )
        }
    `;
    fs.writeFileSync(indexPath, withLoader1);
    await page.getByText("Hello, world").waitFor({ timeout: 2000 });
    expect(await page.getByLabel("Root Input").inputValue()).toBe("asdfasdf");

    let withLoader2 = `
        import { json } from "@remix-run/node";
        import { useLoaderData } from "@remix-run/react";

        export function loader() {
          return json({ hello: "planet" })
        }

        export default function Index() {
          let { hello } = useLoaderData<typeof loader>();
          return (
            <main>
              <h1>Hello, {hello}</h1>
            </main>
          )
        }
    `;
    fs.writeFileSync(indexPath, withLoader2);
    await page.getByText("Hello, planet").waitFor({ timeout: 2000 });
    expect(await page.getByLabel("Root Input").inputValue()).toBe("asdfasdf");
  } finally {
    dev.kill();
    app.kill();
    console.log(devStderr());
    console.log(appStderr());
  }
});

// TODO: test complex undo flow?
// 1. Go to route A
// 2. Go to route B
// 3. Modify code for route A
// 4. Navigate to route A
// 5. Nav to route B
// 6. Undo changes from (3)
// 7. Nav to route A
