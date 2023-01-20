import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import {
  createAppFixture,
  createFixture,
  css,
  js,
} from "./helpers/create-fixture";

let fixture: Fixture;
let appFixture: AppFixture;

////////////////////////////////////////////////////////////////////////////////
// 💿 👋 Hola! It's me, Dora the Remix Disc, I'm here to help you write a great
// bug report pull request.
//
// You don't need to fix the bug, this is just to report one.
//
// The pull request you are submitting is supposed to fail when created, to let
// the team see the erroneous behavior, and understand what's going wrong.
//
// If you happen to have a fix as well, it will have to be applied in a subsequent
// commit to this pull request, and your now-succeeding test will have to be moved
// to the appropriate file.
//
// First, make sure to install dependencies and build Remix. From the root of
// the project, run this:
//
//    ```
//    yarn && yarn build
//    ```
//
// Now try running this test:
//
//    ```
//    yarn bug-report-test
//    ```
//
// You can add `--watch` to the end to have it re-run on file changes:
//
//    ```
//    yarn bug-report-test --watch
//    ```
////////////////////////////////////////////////////////////////////////////////

test.beforeAll(async () => {
  fixture = await createFixture({
    ////////////////////////////////////////////////////////////////////////////
    // 💿 Next, add files to this object, just like files in a real app,
    // `createFixture` will make an app and run your tests against it.
    ////////////////////////////////////////////////////////////////////////////
    files: {
      "remix.config.js": js`
        module.exports = {
          future: {
            unstable_cssModules: true,
          },
        };
      `,

      "app/root.jsx": js`
        import { Links, Outlet } from "@remix-run/react";
        import { cssBundleHref } from "@remix-run/css-bundle";
        export function links() {
          // As described in the docs, add new link only if cssBundleHref is defined
          return [
            ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref, "data-test-css-bundle": true }] : []),
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

      "app/test-components/reexport/styles.module.css": css`
        .root {
          color: red;
        }
      `,

      "app/test-components/reexport/Reexport.jsx": js`
        import styles from "./styles.module.css";
        export function Reexport() {
          return (
            <div data-testid="reexport" className={styles.root}>
              Testing component re-export from index.js
            </div>
          );
        }
      `,

      "app/test-components/reexport/index.js": js`
        export * from "./Reexport";
      `,

      "app/routes/index.jsx": js`
        import { Reexport } from "~/test-components/reexport"; // This is the place which triggers the issue

        export default function Index() {
          return (
            <div>
              <Reexport />
            </div>
          )
        }
      `,
    },
  });

  // This creates an interactive app using puppeteer.
  appFixture = await createAppFixture(fixture);
});

test.afterAll(() => {
  appFixture.close();
});

// If index.js is used to re-export the component that is using CSS Modules, the imported CSS file is not bundled.
// However, the classname is still applied correctly.

// import { Reexport } from "~/test-components/reexport"; will ignore the styles.module.css file.
// import { Reexport } from "~/test-components/reexport/Reexport"; will add the CSS file to the bundle as expected.

// In this test, there is a single component. So, if the styles.module.css is ignored, the cssBundleHref will be undefined.
test("cssBundleHref should be defined", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);

  await app.goto("/");

  let cssBundleLinkElement = await app.getElement("[data-test-css-bundle]");
  expect(cssBundleLinkElement.length).toBe(1);
});
