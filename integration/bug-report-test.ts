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

test(`expect to be able to browse backward out of a remix app, 
      then forward in history and have pages render correctly`, async ({
  page,
}) => {
  let app = new PlaywrightFixture(appFixture, page);

  // This sets up the Remix modules cache in memory, priming the error case.
  await app.goto("/");
  await app.clickLink("/burgers");
  expect(await page.content()).toMatch("cheeseburger");

  let retry = 4;
  for (let i = 0; i < retry; i++) {
    // Back to /
    await page.goBack();
    expect(await app.getHtml()).toContain("pizza");
    // Takes the browser to an empty state. This doesn't seem to work in headless Firefox
    await page.goBack();

    // Forward to /
    await page.goForward();
    // This passes
    expect(await app.getHtml()).toContain("pizza");

    // Forward to /burgers
    await page.goForward();
    // Here's an error: the path should be `/burgers`
    // (this validates correctly and passes)
    expect(page.url()).toContain("/burgers");
    // but now the content won't contain the string "cheeseburger"
    expect(await app.getHtml()).toMatch("cheeseburger");
    expect(await app.getHtml()).not.toMatch("pizza");
  }
});

test("expect to be able to go forward and backward in browser history without triggering a TypeError", async ({
  page,
}) => {
  let app = new PlaywrightFixture(appFixture, page);

  // This fails locally in chromium, edge or Firefox but all intermittently on an M1 MacPro.
  // Increasing the retries will ensure more of the browsers fail.
  // Failure message look like:
  //
  // TypeError: Cannot destructure property 'default' of 'n[e]' as it is undefined.
  // at hr (http://localhost:60918/build/_shared/chunk-2QBB563C.js:14:85)
  // at mu (http://localhost:60918/build/entry.client-RIRIZEHM.js:6:19484)
  // at Xa (http://localhost:60918/build/entry.client-RIRIZEHM.js:8:44019)
  // at $a (http://localhost:60918/build/entry.client-RIRIZEHM.js:8:39724)
  // at Zf (http://localhost:60918/build/entry.client-RIRIZEHM.js:8:39655)
  // at br (http://localhost:60918/build/entry.client-RIRIZEHM.js:8:39515)
  // at Ui (http://localhost:60918/build/entry.client-RIRIZEHM.js:8:35905)
  // at Ha (http://localhost:60918/build/entry.client-RIRIZEHM.js:8:34858)
  // at Cl (http://localhost:60918/build/entry.client-RIRIZEHM.js:1:1741)
  // at MessagePort.gl (http://localhost:60918/build/entry.client-RIRIZEHM.js:1:2131)</pre
  //   >

  // First create some history in the browser and validate that Remix
  // is rendering the content expected.
  await app.goto("/");
  await app.clickLink("/burgers");
  expect(await page.content()).toMatch("cheeseburger");

  // For chromium, this usually triggers the error.
  // It requires fast navigation between a page that is not the remix app,
  // for example Chromium's 'no url' page, or remix.run, and a page
  // 2 deep in history that's part of a remix app (eg click forward twice).
  let appErrorStr = "Application Error!";

  // Increase `retry` to something large, like 40, to view the
  // TyepError failures if you're not seeing them after a couple of tries.
  let retry = 10;

  for (let i = 0; i < retry; i++) {
    // Back to /
    await page.goBack();
    expect(await app.getHtml()).toContain("pizza");
    // Back to empty page
    await page.goBack();

    // Forward to /
    await page.goForward();
    let appHtml1 = await app.getHtml();
    expect(appHtml1).toContain("pizza");
    expect(appHtml1).not.toContain(appErrorStr);

    // Forward to /burgers
    await page.goForward();
    // But now the content won't contain the string "cheeseburger"
    let appHtml2 = await app.getHtml();
    expect(appHtml2).not.toContain(appErrorStr);
  }
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
