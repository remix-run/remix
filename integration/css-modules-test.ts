import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import {
  createAppFixture,
  createFixture,
  css,
  js,
} from "./helpers/create-fixture";

test.describe("CSS Modules", () => {
  let fixture: Fixture;
  let appFixture: AppFixture;

  test.beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "remix.config.js": js`
          module.exports = {
            future: {
              unstable_cssBundle: true
            },
          };
        `,
        "app/root.jsx": js`
          import { Links, Outlet } from "@remix-run/react";
          import cssBundleHref from "@remix-run/css-bundle";
          export function links() {
            return [{ rel: "stylesheet", href: cssBundleHref }];
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

        // Basic test
        "app/routes/basic-test.jsx": js`
          import { Test } from "~/test-components/basic";
          export default function() {
            return <Test />;
          }
        `,
        "app/test-components/basic/index.jsx": js`
          import styles from "./styles.module.css";
          export function Test() {
            return (
              <div data-testid="basic" className={styles.root}>
                Basic test
              </div>
            );
          }
        `,
        "app/test-components/basic/styles.module.css": css`
          .root {
            background: peachpuff;
            padding: 20px;
          }
        `,

        // Local composes test
        "app/routes/local-composes-test.jsx": js`
          import { Test } from "~/test-components/local-composes";
          export default function() {
            return <Test />;
          }
        `,
        "app/test-components/local-composes/index.jsx": js`
          import styles from "./styles.module.css";
          export function Test() {
            return (
              <div data-testid="local-composes" className={styles.root}>
                Local composes test
              </div>
            );
          }
        `,
        "app/test-components/local-composes/styles.module.css": css`
          .root {
            background: peachpuff;
            composes: padding;
          }
          .padding {
            padding: 20px;
          }
        `,

        // Import composes test
        "app/routes/import-composes-test.jsx": js`
          import { Test } from "~/test-components/import-composes";
          export default function() {
            return <Test />;
          }
        `,
        "app/test-components/import-composes/index.jsx": js`
          import styles from "./styles.module.css";
          export function Test() {
            return (
              <div data-testid="import-composes" className={styles.root}>
                Import composes test
              </div>
            );
          }
        `,
        "app/test-components/import-composes/styles.module.css": css`
          .root {
            background: peachpuff;
            composes: padding from "./import.module.css";
          }
        `,
        "app/test-components/import-composes/import.module.css": css`
          .padding {
            padding: 20px;
          }
        `,

        // Root import composes test
        "app/routes/root-relative-import-composes-test.jsx": js`
          import { Test } from "~/test-components/root-relative-import-composes";
          export default function() {
            return <Test />;
          }
        `,
        "app/test-components/root-relative-import-composes/index.jsx": js`
          import styles from "./styles.module.css";
          export function Test() {
            return (
              <div data-testid="root-relative-import-composes" className={styles.root}>
                Root import composes test
              </div>
            );
          }
        `,
        "app/test-components/root-relative-import-composes/styles.module.css": css`
          .root {
            background: peachpuff;
            composes: padding from "~/test-components/root-relative-import-composes/import.module.css";
          }
        `,
        "app/test-components/root-relative-import-composes/import.module.css": css`
          .padding {
            padding: 20px;
          }
        `,

        // Global composes test
        "app/routes/global-composes-test.jsx": js`
          import { Test } from "~/test-components/global-composes";
          export default function() {
            return <Test />;
          }
        `,
        "app/test-components/global-composes/index.jsx": js`
          import styles from "./styles.module.css";
          export function Test() {
            return (
              <div data-testid="global-composes" className={styles.root}>
                Global composes test
              </div>
            );
          }
        `,
        "app/test-components/global-composes/styles.module.css": css`
          .root {
            background: peachpuff;
            composes: padding from global;
          }

          :global(.padding) {
            padding: 20px;
          }
        `,

        // Image test
        "app/routes/image-test.jsx": js`
          import { Test } from "~/test-components/image";
          export default function() {
            return <Test />;
          }
        `,
        "app/test-components/image/index.jsx": js`
          import styles from "./styles.module.css";
          export function Test() {
            return (
              <div data-testid="image" className={styles.root}>
                Image test
              </div>
            );
          }
        `,
        "app/test-components/image/styles.module.css": css`
          .root {
            background-color: peachpuff;
            background-image: url(./image.svg);
            padding: 20px;
          }
        `,
        "app/test-components/image/image.svg": `
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="50" fill="coral" />
          </svg>
        `,

        // Root relative image test
        "app/routes/root-relative-image-test.jsx": js`
          import { Test } from "~/test-components/root-relative-image";
          export default function() {
            return <Test />;
          }
        `,
        "app/test-components/root-relative-image/index.jsx": js`
          import styles from "./styles.module.css";
          export function Test() {
            return (
              <div data-testid="root-relative-image" className={styles.root}>
                Root relative image test
              </div>
            );
          }
        `,
        "app/test-components/root-relative-image/styles.module.css": css`
          .root {
            background-color: peachpuff;
            background-image: url(~/test-components/root-relative-image/image.svg);
            padding: 20px;
          }
        `,
        "app/test-components/root-relative-image/image.svg": `
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="50" fill="coral" />
          </svg>
        `,

        // Unique class names test
        "app/routes/unique-class-names-test.jsx": js`
          import { Test } from "~/test-components/unique-class-names";
          export default function() {
            return <Test />;
          }
        `,
        "app/test-components/unique-class-names/index.jsx": js`
          import styles from "./styles.module.css";
          export function Test() {
            return (
              <div data-testid="unique-class-names" className={[styles.background, styles.padding].join(' ')}>
                Unique class names test
              </div>
            );
          }
        `,
        "app/test-components/unique-class-names/styles.module.css": css`
          .background {
            background: peachpuff;
          }
          .padding {
            padding: 20px;
          }
        `,

        // Scoped grid line name test
        "app/routes/grid-line-name-test.jsx": js`
          import { Test } from "~/test-components/grid-line-name";
          export default function() {
            return <Test />;
          }
        `,
        "app/test-components/grid-line-name/index.jsx": js`
          import styles from "./styles.module.css";
          export function Test() {
            return (
              <div data-testid="grid-line-name" className={styles.root}>
                Grid line name test
              </div>
            );
          }
        `,
        "app/test-components/grid-line-name/styles.module.css": css`
          .root {
            grid-column-start: test-start;
          }
        `,
      },
    });
    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(async () => {
    await appFixture.close();
  });

  test("supports basic scoped styles", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/basic-test");
    let locator = await page.locator("[data-testid='basic']");
    let styles = await locator.evaluate((element) => {
      let { padding } = window.getComputedStyle(element);
      return { padding };
    });
    expect(styles.padding).toBe("20px");
  });

  test("composes from a local classname", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/local-composes-test");
    let locator = await page.locator("[data-testid='local-composes']");
    let styles = await locator.evaluate((element) => {
      let { padding } = window.getComputedStyle(element);
      return { padding };
    });
    expect(styles.padding).toBe("20px");
  });

  test("composes from an imported classname", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/import-composes-test");
    let locator = await page.locator("[data-testid='import-composes']");
    let styles = await locator.evaluate((element) => {
      let { padding } = window.getComputedStyle(element);
      return { padding };
    });
    expect(styles.padding).toBe("20px");
  });

  test("composes from root relative imported classname", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/root-relative-import-composes-test");
    let locator = await page.locator(
      "[data-testid='root-relative-import-composes']"
    );
    let styles = await locator.evaluate((element) => {
      let { padding } = window.getComputedStyle(element);
      return { padding };
    });
    expect(styles.padding).toBe("20px");
  });

  test("composes from a global classname", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/global-composes-test");
    let locator = await page.locator("[data-testid='global-composes']");
    let styles = await locator.evaluate((element) => {
      let { padding } = window.getComputedStyle(element);
      return { padding };
    });
    expect(styles.padding).toBe("20px");
  });

  test("supports image URLs", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/image-test");
    let locator = await page.locator("[data-testid='image']");
    let styles = await locator.evaluate((element) => {
      let { backgroundImage } = window.getComputedStyle(element);
      return { backgroundImage };
    });
    expect(styles.backgroundImage).toContain(".svg");
  });

  test("supports root relative image URLs", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/root-relative-image-test");
    let locator = await page.locator("[data-testid='root-relative-image']");
    let styles = await locator.evaluate((element) => {
      let { backgroundImage } = window.getComputedStyle(element);
      return { backgroundImage };
    });
    expect(styles.backgroundImage).toContain(".svg");
  });

  // This test is designed to catch this issue: https://github.com/parcel-bundler/lightningcss/issues/351
  test("generates unique class names per file", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/unique-class-names-test");
    let element = await app.getElement("[data-testid='unique-class-names']");
    let classNames = element.attr("class")?.split(" ");
    expect(new Set(classNames).size).toBe(2);
  });

  // This test is designed to catch this issue: https://github.com/parcel-bundler/lightningcss/issues/351#issuecomment-1342099486
  test("supports scoped grid line names", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/grid-line-name-test");
    let locator = await page.locator("[data-testid='grid-line-name']");
    let styles = await locator.evaluate((element) => {
      let { gridColumnStart } = window.getComputedStyle(element);
      return { gridColumnStart };
    });
    expect(styles.gridColumnStart.endsWith("-start")).toBeTruthy();
  });
});
