import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture.js";
import type { Fixture, AppFixture } from "./helpers/create-fixture.js";
import {
  createAppFixture,
  createFixture,
  js,
} from "./helpers/create-fixture.js";

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
    ////////////////////////////////////////////////////////////////////////////
    // 💿 Next, add files to this object, just like files in a real app,
    // `createFixture` will make an app and run your tests against it.
    ////////////////////////////////////////////////////////////////////////////
    files: {
      "app/utils/buggy.server.ts": js`
        export function buggy() {
          return "this is a bug";
        }
      `,
      "app/routes/about.tsx": js`
        import { buggy } from "../utils/buggy.server";
        const forcebug = buggy();

        export default function Index() {
          return <div id='tst'>about {forcebug}</div>;
        }
      `,
      "app/routes/_index.tsx": js`
        import { json } from "@remix-run/node";
        import { useLoaderData, Link } from "@remix-run/react";

        export default function Index() {
          let data = useLoaderData();
          return (
            <div>
              home
              <Link id="link" to="/about">Other Route</Link>
              <a id="aelm" href="/about">Other Route with a element</a>
            </div>
          )
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

test("[navigate to about page using a element]", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  // You can test any request your app might get using `fixture`.
  let response = await fixture.requestDocument("/");
  expect(await response.text()).toMatch("home");
  // If you're not sure what's going on, you can "poke" the app, it'll
  // automatically open up in your browser for 20 seconds, so be quick!
  // await app.poke(20);

  // If you need to test interactivity use the `app`
  await app.goto("/");
  await app.clickElement("#aelm");
  await page.waitForSelector("#tst");
  await page.waitForSelector("text=about this is a bug");
});

test("[navigate to about page using Link]", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  // You can test any request your app might get using `fixture`.
  let response = await fixture.requestDocument("/");
  expect(await response.text()).toMatch("home");

  await app.goto("/");
  await app.clickElement("#link");
  await page.waitForSelector("#tst");
  await page.waitForSelector("text=about this is a bug");
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
