import { test, expect } from "@playwright/test";
import globby from "globby";
import fse from "fs-extra";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import {
  createAppFixture,
  createFixture,
  css,
  js,
} from "./helpers/create-fixture";

const TEST_PADDING_VALUE = "20px";

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
        ...basicFixture(),
        ...localComposesFixture(),
        ...importComposesFixture(),
        ...rootRelativeImportComposesFixture(),
        ...globalComposesFixture(),
        ...imageFixture(),
        ...rootRelativeImageFixture(),
        ...clientEntrySideEffectsFixture(),
        ...deduplicatedCssFixture(),
        ...uniqueClassNamesFixture(),
        ...gridLineNameFixture(),
      },
    });
    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(async () => {
    await appFixture.close();
  });

  function basicFixture() {
    return {
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
          padding: ${TEST_PADDING_VALUE};
        }
      `,
    };
  }
  test("supports basic scoped styles", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/basic-test");
    let locator = await page.locator("[data-testid='basic']");
    let padding = await locator.evaluate(
      (element) => window.getComputedStyle(element).padding
    );
    expect(padding).toBe(TEST_PADDING_VALUE);
  });

  function localComposesFixture() {
    return {
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
          padding: ${TEST_PADDING_VALUE};
        }
      `,
    };
  }
  test("composes from a local classname", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/local-composes-test");
    let locator = await page.locator("[data-testid='local-composes']");
    let padding = await locator.evaluate(
      (element) => window.getComputedStyle(element).padding
    );
    expect(padding).toBe(TEST_PADDING_VALUE);
  });

  function importComposesFixture() {
    return {
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
          padding: ${TEST_PADDING_VALUE};
        }
      `,
    };
  }
  test("composes from an imported classname", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/import-composes-test");
    let locator = await page.locator("[data-testid='import-composes']");
    let padding = await locator.evaluate(
      (element) => window.getComputedStyle(element).padding
    );
    expect(padding).toBe(TEST_PADDING_VALUE);
  });

  function rootRelativeImportComposesFixture() {
    return {
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
          padding: ${TEST_PADDING_VALUE};
        }
      `,
    };
  }
  test("composes from root relative imported classname", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/root-relative-import-composes-test");
    let locator = await page.locator(
      "[data-testid='root-relative-import-composes']"
    );
    let padding = await locator.evaluate(
      (element) => window.getComputedStyle(element).padding
    );
    expect(padding).toBe(TEST_PADDING_VALUE);
  });

  function globalComposesFixture() {
    return {
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
          padding: ${TEST_PADDING_VALUE};
        }
      `,
    };
  }
  test("composes from a global classname", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/global-composes-test");
    let locator = await page.locator("[data-testid='global-composes']");
    let padding = await locator.evaluate(
      (element) => window.getComputedStyle(element).padding
    );
    expect(padding).toBe(TEST_PADDING_VALUE);
  });

  function imageFixture() {
    return {
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
          padding: ${TEST_PADDING_VALUE};
        }
      `,
      "app/test-components/image/image.svg": `
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="coral" />
        </svg>
      `,
    };
  }
  test("supports image URLs", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/image-test");
    let locator = await page.locator("[data-testid='image']");
    let backgroundImage = await locator.evaluate(
      (element) => window.getComputedStyle(element).backgroundImage
    );
    expect(backgroundImage).toContain(".svg");
  });

  function rootRelativeImageFixture() {
    return {
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
          padding: ${TEST_PADDING_VALUE};
        }
      `,
      "app/test-components/root-relative-image/image.svg": `
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="coral" />
        </svg>
      `,
    };
  }
  test("supports root relative image URLs", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/root-relative-image-test");
    let locator = await page.locator("[data-testid='root-relative-image']");
    let backgroundImage = await locator.evaluate(
      (element) => window.getComputedStyle(element).backgroundImage
    );
    expect(backgroundImage).toContain(".svg");
  });

  function clientEntrySideEffectsFixture() {
    return {
      "app/entry.client.jsx": js`
        import { RemixBrowser } from "@remix-run/react";
        import { startTransition, StrictMode } from "react";
        import { hydrateRoot } from "react-dom/client";
        import "./entry.client.module.css";
        
        const hydrate = () => {
          startTransition(() => {
            hydrateRoot(
              document,
              <StrictMode>
                <RemixBrowser />
              </StrictMode>
            );
          });
        };
        
        if (window.requestIdleCallback) {
          window.requestIdleCallback(hydrate);
        } else {
          // Safari doesn't support requestIdleCallback
          // https://caniuse.com/requestidlecallback
          window.setTimeout(hydrate, 1);
        }        
      `,
      "app/entry.client.module.css": css`
        :global(.clientEntry) {
          padding: ${TEST_PADDING_VALUE};
        }
      `,
      "app/routes/client-entry-side-effects-test.jsx": js`
        export default function() {
          return (
            <div data-testid="client-entry-side-effects" className="clientEntry">
              Client entry side effects test
            </div>
          );
        }
      `,
    };
  }
  test("supports client entry side effects", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/client-entry-side-effects-test");
    let locator = await page.locator(
      "[data-testid='client-entry-side-effects']"
    );
    let padding = await locator.evaluate(
      (element) => window.getComputedStyle(element).padding
    );
    expect(padding).toBe(TEST_PADDING_VALUE);
  });

  function deduplicatedCssFixture() {
    return {
      "app/routes/deduplicated-css-test.jsx": js`
        import { Test } from "~/test-components/deduplicated-css";
        export default function() {
          return <Test />;
        }
      `,
      "app/test-components/deduplicated-css/index.jsx": js`
        import styles_1 from "./styles_1.module.css";
        import styles_2 from "./styles_2.module.css";
        import sharedStyles from "./shared.module.css";
        export function Test() {
          return (
            <div
              data-testid="deduplicated-css"
              data-deduplicated-class-name={sharedStyles.deduplicated}
              className={[
                styles_1.root,
                styles_2.root,
              ].join(' ')}
              >
              Deduplicated CSS test
            </div>
          );
        }
      `,
      "app/test-components/deduplicated-css/styles_1.module.css": css`
        .root {
          composes: deduplicated from "./shared.module.css";
        }
      `,
      "app/test-components/deduplicated-css/styles_2.module.css": css`
        .root {
          composes: deduplicated from "./shared.module.css";
        }
      `,
      "app/test-components/deduplicated-css/shared.module.css": css`
        .deduplicated {
          background: peachpuff;
        }
      `,
    };
  }
  test("deduplicates CSS bundle contents in production build", async ({
    page,
  }) => {
    // Using `composes: xxx from "./another.module.css"` leads
    // to duplicate CSS in the final bundle prior to optimization.
    // This test ensures the optimization does in fact happen,
    // otherwise it could lead to very large CSS files if this
    // feature is used heavily.
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/deduplicated-css-test");

    let element = await app.getElement("[data-testid='deduplicated-css']");
    let deduplicatedClassName = element.data().deduplicatedClassName;

    if (typeof deduplicatedClassName !== "string") {
      throw new Error(
        "Couldn't find data-deduplicated-class-name value on test element"
      );
    }

    let [cssBundlePath] = await globby(["public/build/css-bundle-*.css"], {
      cwd: fixture.projectDir,
      absolute: true,
    });

    if (!cssBundlePath) {
      throw new Error("Couldn't find CSS bundle");
    }

    let cssBundleContents = await fse.readFile(cssBundlePath, "utf8");

    let deduplicatedClassNameUsages = cssBundleContents.match(
      new RegExp(`\\.${deduplicatedClassName}`, "g")
    );

    expect(deduplicatedClassNameUsages?.length).toBe(1);
  });

  function uniqueClassNamesFixture() {
    return {
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
            <div data-testid="unique-class-names" className={[styles.background, styles.color].join(' ')}>
              Unique class names test
            </div>
          );
        }
      `,
      "app/test-components/unique-class-names/styles.module.css": css`
        .background {
          background: peachpuff;
        }
        .color {
          color: coral;
        }
      `,
    };
  }
  test("generates unique class names per file", async ({ page }) => {
    // This test is designed to catch this issue:
    // https://github.com/parcel-bundler/lightningcss/issues/351
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/unique-class-names-test");
    let element = await app.getElement("[data-testid='unique-class-names']");
    let classNames = element.attr("class")?.split(" ");
    expect(new Set(classNames).size).toBe(2);
  });

  function gridLineNameFixture() {
    return {
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
    };
  }
  test("supports grid line names", async ({ page }) => {
    // This test is designed to catch this issue:
    // https://github.com/parcel-bundler/lightningcss/issues/351#issuecomment-1342099486
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/grid-line-name-test");
    let locator = await page.locator("[data-testid='grid-line-name']");
    let gridColumnStart = await locator.evaluate(
      (element) => window.getComputedStyle(element).gridColumnStart
    );
    expect(gridColumnStart.endsWith("-start")).toBeTruthy();
  });
});
