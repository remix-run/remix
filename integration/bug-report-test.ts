import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { createAppFixture, createFixture, js } from "./helpers/create-fixture";

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

test.beforeEach(async ({ context }) => {
  await context.route(/_data/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    route.continue();
  });
});

test.beforeAll(async () => {
  fixture = await createFixture({
    config: {
      future: { v2_routeConvention: true },
    },
    ////////////////////////////////////////////////////////////////////////////
    // 💿 Next, add files to this object, just like files in a real app,
    // `createFixture` will make an app and run your tests against it.
    ////////////////////////////////////////////////////////////////////////////
    files: {
      "app/routes/_index.jsx": js`
        import { json } from "@remix-run/node";
        import { useLoaderData, Link } from "@remix-run/react";

        export function loader() {
          return json(Date.now());
        }

        export const shouldRevalidate = () => {
          return false;
        };

        export default function Index() {
          let data = useLoaderData();
          return (
            <div>
              <pre id="last-call">{data}</pre>
              <Link to="/burgers">Other Route</Link>
            </div>
          )
        }
      `,

      "app/routes/burgers.jsx": js`
        import { Link } from "@remix-run/react";

        export default function Index() {
          return <div>
            <Link to="..">Back</Link>
          </div>;
        }
      `,
    },
  });

  // This creates an interactive app using playwright.
  appFixture = await createAppFixture(fixture);
});

test.afterAll(() => {
  appFixture.close();
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

test("should skip loader and call shouldRevalidate", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);

  await app.goto("/", true);

  await page.waitForSelector("#loading", { state: "hidden" });
  let lastCallCheer = await app.getElement("#last-call");
  let lastCall = lastCallCheer.text();

  await app.clickLink("/burgers", { wait: true });

  await app.clickLink("/", { wait: true });
  await page.waitForSelector("#loading", { state: "hidden" });

  let latestCallCheer = await app.getElement("#last-call");
  let latestCall = latestCallCheer.text();

  expect(lastCall).toMatch(latestCall);

  // If you're not sure what's going on, you can "poke" the app, it'll
  // automatically open up in your browser for 20 seconds, so be quick!
  // await app.poke(20);

  // Go check out the other tests to see what else you can do.
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
