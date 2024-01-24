import type { Page } from "@playwright/test";
import { test, expect } from "@playwright/test";
import getPort from "get-port";

import {
  createEditor,
  createProject,
  customDev,
  VITE_CONFIG,
  viteBuild,
  viteDev,
  viteRemixServe,
} from "./helpers/vite.js";

const files = {
  "app/routes/_index.tsx": String.raw`
    import { useState, useEffect } from "react";
    import { Link } from "@remix-run/react"

    export default function IndexRoute() {
      const [mounted, setMounted] = useState(false);
      useEffect(() => {
        setMounted(true);
      }, []);

      return (
        <div id="index">
          <h2 data-title>Index</h2>
          <input />
          <p data-mounted>Mounted: {mounted ? "yes" : "no"}</p>
          <p data-hmr>HMR updated: 0</p>
          <Link to="/other">other</Link>
        </div>
      );
    }
  `,
  "app/routes/other.tsx": String.raw`
    import { useLoaderData } from "@remix-run/react";

    export const loader = () => {
      return "other-loader";
    };

    export default function OtherRoute() {
      const loaderData = useLoaderData()

      return (
        <div id="other">
          <p>{loaderData}</p>
        </div>
      );
    }
  `,
};

const customServerFile = ({ port }: { port: number }) => String.raw`
  import { createRequestHandler } from "@remix-run/express";
  import { installGlobals } from "@remix-run/node";
  import express from "express";
  installGlobals();

  const viteDevServer =
    process.env.NODE_ENV === "production"
      ? undefined
      : await import("vite").then(({ createServer }) =>
          createServer({
            server: {
              middlewareMode: true,
            },
          })
        );

  const app = express();
  app.use("/mybase/", viteDevServer?.middlewares || express.static("build/client"));
  app.all(
    "/mybase/*",
    createRequestHandler({
      build: viteDevServer
        ? () => viteDevServer.ssrLoadModule("virtual:remix/server-build")
        : await import("./build/server/index.js"),
    })
  );
  app.get("*", (_req, res) => {
    res.setHeader("content-type", "text/html")
    res.end('Remix app is at <a href="/mybase/">/mybase/</a>');
  });

  const port = ${port};
  app.listen(port, () => console.log('http://localhost:' + port));
`;

test.describe(() => {
  let port: number;
  let cwd: string;
  let stop: () => unknown;

  test.beforeAll(async () => {
    port = await getPort();
    cwd = await createProject({
      "vite.config.js": await VITE_CONFIG({
        port,
        viteOptions: '{ base: "/mybase/" }',
        pluginOptions: '{ publicPath: "/mybase/" }',
      }),
      ...files,
    });
    stop = await viteDev({ cwd, port });
  });
  test.afterAll(async () => await stop());

  test("Vite / basename / vite dev", async ({ page }) => {
    await workflowDev({ page, cwd, port });
  });
});

test.describe(async () => {
  let port: number;
  let cwd: string;
  let stop: () => void;

  test.beforeAll(async () => {
    port = await getPort();
    cwd = await createProject({
      "vite.config.js": await VITE_CONFIG({
        port,
        viteOptions: '{ base: "/mybase/" }',
        pluginOptions: '{ publicPath: "/mybase/" }',
      }),
      "server.mjs": customServerFile({ port }),
      ...files,
    });
    stop = await customDev({ cwd, port });
  });
  test.afterAll(() => stop());

  test("Vite / basename / express dev", async ({ page }) => {
    await workflowDev({ page, cwd, port });
  });
});

async function workflowDev({
  page,
  cwd,
  port,
}: {
  page: Page;
  cwd: string;
  port: number;
}) {
  let pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  let edit = createEditor(cwd);

  let requestUrls: string[] = [];
  page.on("request", (request) => {
    requestUrls.push(request.url());
  });

  // setup: initial render
  await page.goto(`http://localhost:${port}/mybase/`, {
    waitUntil: "networkidle",
  });
  await expect(page.locator("#index [data-title]")).toHaveText("Index");

  // setup: hydration
  await expect(page.locator("#index [data-mounted]")).toHaveText(
    "Mounted: yes"
  );

  // setup: browser state
  let hmrStatus = page.locator("#index [data-hmr]");
  await expect(hmrStatus).toHaveText("HMR updated: 0");
  let input = page.locator("#index input");
  await expect(input).toBeVisible();
  await input.type("stateful");
  expect(pageErrors).toEqual([]);

  // route: HMR
  await edit("app/routes/_index.tsx", (contents) =>
    contents.replace("HMR updated: 0", "HMR updated: 1")
  );
  await page.waitForLoadState("networkidle");
  await expect(hmrStatus).toHaveText("HMR updated: 1");
  await expect(input).toHaveValue("stateful");
  expect(pageErrors).toEqual([]);

  // client side navigation
  await page.getByRole("link", { name: "other" }).click();
  await page.waitForURL(`http://localhost:${port}/mybase/other`);
  await page.getByText("other-loader").click();
  expect(pageErrors).toEqual([]);

  // verify client requests are all under basename
  expect(
    requestUrls.filter(
      (url) => !url.startsWith(`http://localhost:${port}/mybase/`)
    )
  ).toEqual([]);
}

test.describe(() => {
  let port: number;
  let cwd: string;
  let stop: () => unknown;

  test.beforeAll(async () => {
    port = await getPort();
    cwd = await createProject({
      "vite.config.js": await VITE_CONFIG({
        port,
        viteOptions: '{ base: "/mybase/" }',
        pluginOptions: '{ publicPath: "/mybase/" }',
      }),
      ...files,
    });
    viteBuild({ cwd });
    stop = await viteRemixServe({ cwd, port, base: "/mybase/" });
  });
  test.afterAll(() => stop());

  test("Vite / basename / vite build", async ({ page }) => {
    await workflowBuild({ page, cwd, port });
  });
});

test.describe(async () => {
  let port: number;
  let cwd: string;
  let stop: () => void;

  test.beforeAll(async () => {
    port = await getPort();
    cwd = await createProject({
      "vite.config.js": await VITE_CONFIG({
        port,
        viteOptions: '{ base: "/mybase/" }',
        pluginOptions: '{ publicPath: "/mybase/" }',
      }),
      "server.mjs": customServerFile({ port }),
      ...files,
    });
    viteBuild({ cwd });
    stop = await customDev({ cwd, port, env: { NODE_ENV: "production" } });
  });
  test.afterAll(() => stop());

  test("Vite / basename / express build", async ({ page }) => {
    await workflowBuild({ page, cwd, port });
  });
});

async function workflowBuild({
  page,
  cwd,
  port,
}: {
  page: Page;
  cwd: string;
  port: number;
}) {
  let pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  let requestUrls: string[] = [];
  page.on("request", (request) => {
    requestUrls.push(request.url());
  });

  // setup: initial render
  await page.goto(`http://localhost:${port}/mybase/`, {
    waitUntil: "networkidle",
  });
  await expect(page.locator("#index [data-title]")).toHaveText("Index");

  // setup: hydration
  await expect(page.locator("#index [data-mounted]")).toHaveText(
    "Mounted: yes"
  );

  // client side navigation
  await page.getByRole("link", { name: "other" }).click();
  await page.waitForURL(`http://localhost:${port}/mybase/other`);
  await page.getByText("other-loader").click();
  expect(pageErrors).toEqual([]);

  // verify client requests are all under basename
  expect(
    requestUrls.filter(
      (url) => !url.startsWith(`http://localhost:${port}/mybase/`)
    )
  ).toEqual([]);
}
