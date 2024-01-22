import fs from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "@playwright/test";
import getPort from "get-port";

import { createProject, viteDev } from "./helpers/vite.js";

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

test.describe(() => {
  let port: number;
  let cwd: string;
  let stop: () => unknown;

  test.beforeAll(async () => {
    port = await getPort();
    let hmrPort = await getPort();
    cwd = await createProject({
      "vite.config.js": String.raw`
        import { defineConfig } from "vite";
        import { unstable_vitePlugin as remix } from "@remix-run/dev";

        export default defineConfig({
          server: {
            port: ${port},
            strictPort: true,
            hmr: {
              port: ${hmrPort}
            }
          },
          plugins: [
            remix({
              basename: "/mybase/",
              publicPath: "/mybase/",
            }),
          ],
        });
      `,
      ...files,
    });
    stop = await viteDev({ cwd, port });
  });
  test.afterAll(async () => await stop());

  test("Vite / basename / vite dev", async ({ page }) => {
    await workflow({ page, cwd, port });
  });
});

async function workflow({
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
  let edit = editor(cwd);

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

const editor =
  (projectDir: string) =>
  async (file: string, transform: (contents: string) => string) => {
    let filepath = path.join(projectDir, file);
    let contents = await fs.readFile(filepath, "utf8");
    await fs.writeFile(filepath, transform(contents), "utf8");
  };
