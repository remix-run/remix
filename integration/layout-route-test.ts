import { test } from "@playwright/test";

import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { AppFixture } from "./helpers/create-fixture";

test.describe("pathless layout routes", () => {
  let app: AppFixture;

  test.beforeAll(async () => {
    app = await createAppFixture(
      await createFixture({
        files: {
          "app/routes/__layout.jsx": js`
            import { Outlet } from "@remix-run/react";

            export default () => <div data-testid="layout-route"><Outlet /></div>;
          `,
          "app/routes/__layout/index.jsx": js`
            export default () => <div data-testid="layout-index">Layout index</div>;
          `,
          "app/routes/__layout/subroute.jsx": js`
            export default () => <div data-testid="layout-subroute">Layout subroute</div>;
          `,
          "app/routes/sandwiches/__pathless.jsx": js`
            import { Outlet } from "@remix-run/react";

            export default () => <div data-testid="sandwiches-pathless-route"><Outlet /></div>;
          `,
          "app/routes/sandwiches/__pathless/index.jsx": js`
            export default () => <div data-testid="sandwiches-pathless-index">Sandwiches pathless index</div>;
          `,
        },
      })
    );
  });

  test.afterAll(async () => {
    await app.close();
  });

  test("should render pathless index route", async ({ page }) => {
    await app.goto(page, "/");
    await page.waitForSelector("[data-testid='layout-route']");
    await page.waitForSelector("[data-testid='layout-index']");
  });

  test("should render pathless sub route", async ({ page }) => {
    await app.goto(page, "/subroute");
    await page.waitForSelector("[data-testid='layout-route']");
    await page.waitForSelector("[data-testid='layout-subroute']");
  });

  test("should render pathless index as a sub route", async ({ page }) => {
    await app.goto(page, "/sandwiches");
    await page.waitForSelector("[data-testid='sandwiches-pathless-route']");
    await page.waitForSelector("[data-testid='sandwiches-pathless-index']");
  });
});
