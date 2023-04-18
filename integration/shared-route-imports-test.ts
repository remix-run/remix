import { test } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { createAppFixture, createFixture, js } from "./helpers/create-fixture";

let fixture: Fixture;
let appFixture: AppFixture;

test.describe("v1 compiler", () => {
  test.beforeAll(async () => {
    fixture = await createFixture({
      future: { v2_routeConvention: true },
      files: {
        "app/routes/parent.jsx": js`
          import { createContext, useContext } from "react";
          import { Outlet } from "@remix-run/react";
  
          const ParentContext = createContext("❌");
  
          export function useParentContext() {
            return useContext(ParentContext);
          }
  
          export default function Index() {
            return (
              <ParentContext.Provider value="✅">
                <Outlet />
              </ParentContext.Provider>
            )
          }
        `,

        "app/routes/parent.child.jsx": js`
          import { useParentContext } from "./parent";
  
          export default function Index() {
            return <p>{useParentContext()}</p>;
          }
        `,
      },
    });

    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(() => {
    appFixture.close();
  });

  test("should render context value from context provider", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/parent/child", true);

    await page.waitForSelector("p:has-text('✅')");
  });
});

test.describe("v2 compiler", () => {
  test.beforeAll(async () => {
    fixture = await createFixture({
      future: { v2_routeConvention: true, unstable_dev: true },
      files: {
        "app/routes/parent.jsx": js`
          import { createContext, useContext } from "react";
          import { Outlet } from "@remix-run/react";
  
          const ParentContext = createContext("❌");
  
          export function useParentContext() {
            return useContext(ParentContext);
          }
  
          export default function Index() {
            return (
              <ParentContext.Provider value="✅">
                <Outlet />
              </ParentContext.Provider>
            )
          }
        `,

        "app/routes/parent.child.jsx": js`
          import { useParentContext } from "./parent";
  
          export default function Index() {
            return <p>{useParentContext()}</p>;
          }
        `,
      },
    });

    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(() => {
    appFixture.close();
  });

  test.only("should render context value from context provider", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/parent/child", true);

    await page.waitForSelector("p:has-text('✅')");
  });
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
