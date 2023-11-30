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
        </div>
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
    stop = await viteDev({ cwd, port });
  });
  test.afterAll(async () => await stop());

  test("Vite / dev / invalidation", async ({ page }) => {
    let pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    // wait for hydration to make sure initial virtual modules are loaded
    await page.goto(`http://localhost:${port}/`);
    await page.getByText("Mounted: yes").click();

    // add new route file
    await fs.writeFile(
      path.join(cwd, "app/routes/other.tsx"),
      String.raw`
        export default function Route() {
          return (
            <div id="other">new route</div>
          );
        }
      `,
      "utf-8"
    );

    // client is not notified of new route addition (https://github.com/remix-run/remix/issues/7894)
    // however server can handle new route
    await expect
      .poll(async () => {
        await page.goto(`http://localhost:${port}/other`);
        return page.getByText("new route").isVisible();
      })
      .toBe(true);
  });
});
