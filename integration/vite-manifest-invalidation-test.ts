import fs from "node:fs/promises";
import path from "node:path";
import { test, expect } from "@playwright/test";
import getPort from "get-port";

import { createProject, viteDev, VITE_CONFIG } from "./helpers/vite.js";

const files = {
  "app/routes/_index.tsx": String.raw`
    import { useState, useEffect } from "react";
    import { Link } from "@remix-run/react";

    export default function IndexRoute() {
      const [mounted, setMounted] = useState(false);
      useEffect(() => {
        setMounted(true);
      }, []);

      return (
        <div id="index">
          <p data-mounted>Mounted: {mounted ? "yes" : "no"}</p>
          <p data-hmr>HMR updated: 0</p>
          <Link to="/other">/other</Link>
        </div>
      );
    }
  `,
  "app/routes/other.tsx": String.raw`
    import { useLoaderData } from "@remix-run/react";

    export const loader = () => "hello";

    export default function Route() {
      const loaderData = useLoaderData();
      return (
        <div id="other">loaderData = {JSON.stringify(loaderData)}</div>
      );
    }
  `,
};

test.describe(async () => {
  let port: number;
  let cwd: string;
  let stop: () => Promise<void>;

  test.beforeAll(async () => {
    port = await getPort();
    cwd = await createProject({
      "vite.config.js": await VITE_CONFIG({ port }),
      ...files,
    });
    stop = await viteDev({ cwd, port, debug: true });
  });
  test.afterAll(async () => await stop());

  test("Vite / dev / invalidate manifest on route exports change", async ({
    page,
  }) => {
    let pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    let edit = editor(cwd);

    // wait hydration to ensure initial manifest is loaded
    await page.goto(`http://localhost:${port}/`);
    await page.getByText("Mounted: yes").click();

    console.log(
      "@@@ before",
      await page.evaluate(() => (window as any).__remixManifest)
    );

    // remove loader export in other page should invalidate manifest
    await edit("app/routes/other.tsx", (contents) =>
      contents.replace(/export const loader.*/, "")
    );

    console.log(
      "@@@ after",
      await page.evaluate(() => (window as any).__remixManifest)
    );

    // after browser reload, client knows there's no loader
    let i = 0;
    await expect
      .poll(async () => {
        console.log("@@@@@@@ trial", i++);
        await page.reload();
        // await page.goto(`http://localhost:${port}/`);
        await page.getByText("Mounted: yes").click();
        console.log(await page.evaluate(() => (window as any).__remixManifest));
        return page.evaluate(
          () => (window as any).__remixManifest.routes["routes/other"].hasLoader
        );
      })
      .toBe(false);
  });
});

const editor =
  (projectDir: string) =>
  async (file: string, transform: (contents: string) => string) => {
    let filepath = path.join(projectDir, file);
    let contents = await fs.readFile(filepath, "utf8");
    await fs.writeFile(filepath, transform(contents), "utf8");
  };
