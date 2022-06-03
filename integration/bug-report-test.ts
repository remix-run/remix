import { test, expect } from "@playwright/test";

import { PlaywrightFixture, getElement } from "./helpers/playwright-fixture";
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
      "app/routes/admin/login.jsx": js`
        import { redirect } from "@remix-run/node";
        import { Form } from "@remix-run/react";

        export const action = async ({ request }) => {
          return redirect("relative");
        };

        export default function LoginPage() {
          return (
              <Form method="post">
                <button id="redirectButton" type="submit">Redirect</button>
              </Form>
          );
        }
      `,

      "app/routes/admin/login/relative.jsx": js`
        export default function Index() {
          return <div id="page">Good relative page</div>;
        }
      `,

      "app/routes/relative.jsx": js`
      export default function Index() {
        return <div id="page">Bad relative page</div>;
      }
     `,
    },
  });

  // This creates an interactive app using puppeteer.
  appFixture = await createAppFixture(fixture);
});

test.afterAll(async () => appFixture.close());

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

test("[description of what you expect it to do]", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/admin/login");
  await app.clickElement("#redirectButton");
  let html = await app.getHtml();
  let el = getElement(html, "#page");
  expect(el.text()).toMatch("Good relative page");
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
