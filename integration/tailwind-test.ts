import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import {
  createAppFixture,
  createFixture,
  css,
  js,
} from "./helpers/create-fixture";

const TEST_PADDING_VALUE = "20px";

test.describe("Tailwind", () => {
  let fixture: Fixture;
  let appFixture: AppFixture;

  test.beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "remix.config.js": js`
          module.exports = {
            future: {
              // Enable all CSS future flags to
              // ensure features don't clash
              unstable_cssModules: true,
              unstable_cssSideEffectImports: true,
              unstable_postcss: true,
              unstable_tailwind: true,
              unstable_vanillaExtract: true,
            },
          };
        `,
        "tailwind.config.js": js`
          module.exports = {
            content: ["./app/**/*.{ts,tsx,jsx,js}"],
            theme: {
              spacing: {
                'test': ${JSON.stringify(TEST_PADDING_VALUE)}
              },
            },
          };
        `,
        "app/tailwind.css": css`
          @tailwind base;
          @tailwind components;
          @tailwind utilities;
        `,
        "app/root.jsx": js`
          import { Links, Outlet } from "@remix-run/react";
          import { cssBundleHref } from "@remix-run/css-bundle";
          import tailwindHref from "./tailwind.css"
          export function links() {
            return [
              { rel: "stylesheet", href: tailwindHref },
              { rel: "stylesheet", href: cssBundleHref }
            ];
          }
          export default function Root() {
            return (
              <html>
                <head>
                  <Links />
                </head>
                <body>
                  <Outlet />
                </body>
              </html>
            )
          }
        `,
        ...basicUsageFixture(),
        ...regularStylesSheetsFixture(),
        ...cssSideEffectsFixture(),
        ...cssModulesFixture(),
      },
    });
    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(async () => {
    await appFixture.close();
  });

  let basicUsageFixture = () => ({
    "app/routes/basic-usage-test.jsx": js`
      export default function() {
        return (
          <div data-testid="basic-usage" className="p-test">
            Basic usage test
          </div>
        );
      }
    `,
  });
  test("basic usage", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/basic-usage-test");
    let locator = await page.locator("[data-testid='basic-usage']");
    let padding = await locator.evaluate(
      (element) => window.getComputedStyle(element).padding
    );
    expect(padding).toBe(TEST_PADDING_VALUE);
  });

  let regularStylesSheetsFixture = () => ({
    "app/routes/regular-style-sheets-test.jsx": js`
      import { Test, links as testLinks } from "~/test-components/regular-style-sheets";
    
      export function links() {
        return [...testLinks()];
      }

      export default function() {
        return <Test />;
      }
    `,
    "app/test-components/regular-style-sheets/index.jsx": js`
      import stylesHref from "./styles.css";

      export function links() {
        return [{ rel: 'stylesheet', href: stylesHref }];
      }

      export function Test() {
        return (
          <div data-testid="regular-style-sheets" className="regular-style-sheets-test">
            Regular style sheets test
          </div>
        );
      }
    `,
    "app/test-components/regular-style-sheets/styles.css": css`
      .regular-style-sheets-test {
        @apply p-test;
      }
    `,
  });
  test("regular style sheets", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/regular-style-sheets-test");
    let locator = await page.locator("[data-testid='regular-style-sheets']");
    let padding = await locator.evaluate(
      (element) => window.getComputedStyle(element).padding
    );
    expect(padding).toBe(TEST_PADDING_VALUE);
  });

  let cssModulesFixture = () => ({
    "app/routes/css-modules-test.jsx": js`
      import { Test } from "~/test-components/css-modules";

      export default function() {
        return <Test />;
      }
    `,
    "app/test-components/css-modules/index.jsx": js`
      import styles from "./styles.module.css";

      export function Test() {
        return (
          <div data-testid="css-modules" className={styles.root}>
            CSS modules test
          </div>
        );
      }
    `,
    "app/test-components/css-modules/styles.module.css": css`
      .root {
        @apply p-test;
      }
    `,
  });
  test("CSS Modules", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/css-modules-test");
    let locator = await page.locator("[data-testid='css-modules']");
    let padding = await locator.evaluate(
      (element) => window.getComputedStyle(element).padding
    );
    expect(padding).toBe(TEST_PADDING_VALUE);
  });

  let cssSideEffectsFixture = () => ({
    "app/routes/css-side-effect-imports-test.jsx": js`
      import { Test } from "~/test-components/css-side-effect-imports";

      export default function() {
        return <Test />;
      }
    `,
    "app/test-components/css-side-effect-imports/index.jsx": js`
      import "./styles.css";

      export function Test() {
        return (
          <div data-testid="css-side-effect-imports" className="css-side-effect-imports-test">
            CSS side-effect imports test
          </div>
        );
      }
    `,
    "app/test-components/css-side-effect-imports/styles.css": css`
      .css-side-effect-imports-test {
        @apply p-test;
      }
    `,
  });
  test("CSS side-effect imports", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/css-side-effect-imports-test");
    let locator = await page.locator("[data-testid='css-side-effect-imports']");
    let padding = await locator.evaluate(
      (element) => window.getComputedStyle(element).padding
    );
    expect(padding).toBe(TEST_PADDING_VALUE);
  });
});
