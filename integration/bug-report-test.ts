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

test.beforeAll(async () => {
  fixture = await createFixture({
    ////////////////////////////////////////////////////////////////////////////
    // 💿 Next, add files to this object, just like files in a real app,
    // `createFixture` will make an app and run your tests against it.
    ////////////////////////////////////////////////////////////////////////////
    files: {
      "app/routes/index.jsx": js`
        import { Link } from "@remix-run/react";

        export default function Index() {
          return (
            <div>
              <div>pizza</div>
              <Link to="/burgers">burger link</Link>
            </div>
          )
        }
      `,

      "app/routes/burgers.jsx": js`

        export default function Index() {
          return (
            <div>cheeseburger</div>
          );
        }
      `,
    },
  });

  // This creates an interactive app using puppeteer.
  appFixture = await createAppFixture(fixture);
});

test.afterAll(() => appFixture.close());

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

test("expect to be able to go forward and backward in browser history without error", async ({
  page,
}) => {
  let app = new PlaywrightFixture(appFixture, page);

  // This sets up the module cache in memory, priming the error case.
  await app.goto("/");
  await app.clickLink("/burgers");
  expect(await app.getHtml()).toMatch("cheeseburger");

  // For chromium, this usually triggers the error.
  // It requires fast navigation between an empty state,
  // for example Chromium's 'no url' page and a page
  // 2 deep in your history (eg click forward twice).
  let testStr = "Application Error!";
  let retry = 40;
  for (let i = 0; i < retry; i++) {
    // Back to /
    await page.goBack();
    expect(await app.getHtml()).toContain("pizza");
    // Takes the browser to its undefined route
    await page.goBack();

    // Forward to /
    await page.goForward();
    let appHtml1 = await app.getHtml();
    expect(appHtml1).not.toContain(testStr);
    if (appHtml1.includes(testStr)) break;

    // Forward to /burgers
    await page.goForward();
    let appHtml2 = await app.getHtml();
    expect(appHtml2).not.toContain(testStr);
    if (appHtml2.includes(testStr)) break;
    expect(appHtml2).not.toContain(testStr);
  }
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
