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
        import { json } from "@remix-run/node";
        import { useLoaderData, useActionData } from "@remix-run/react";

        export function loader({ request }) {
          // NOTE test use headers.connection but that could be anytything else, like the cookie
          return json({ connection: request.headers.get('connection') });
        }

        export function action({ request }) {
          return json({ connection: request.headers.get('connection') });
        }

        export default function Index() {
          let loaderData = useLoaderData();
          let actionData = useActionData();
          return (
            <div>
              <form method="post" action="/?index"><input type="submit" /></form>
              <pre>{JSON.stringify({ loaderData, actionData })}</pre>
            </div>
          )
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

test("loader still has access to request.headers when called for a POST action", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/");

  expect(await page.locator("pre").innerHTML()).toEqual(
    JSON.stringify({
      loaderData: {
        connection: "keep-alive",
      },
    })
  );

  await page.getByRole("button", { name: "Submit" }).click();

  expect(await page.locator("pre").innerHTML()).toEqual(
    JSON.stringify({
      loaderData: {
        connection: "keep-alive", // NOTE this was working prior to 1.8.0
      },
      actionData: {
        connection: "keep-alive",
      },
    })
  );
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
