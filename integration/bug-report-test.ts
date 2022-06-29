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
        import { useActionData, useLoaderData, Form } from "@remix-run/react";
        import { json } from '@remix-run/server-runtime'

        export function action({ request }) {
          return json(request.method)
        }

        export function loader({ request }) {
          return json(request.method)
        }

        export default function Index() {
          let actionData = useActionData();
          let loaderData = useLoaderData();
          return (
            <>
              <Form method="post">
                <button type="submit" formMethod="get">Submit with GET</button>
              </Form>
              <form method="get">
                <button type="submit" formMethod="post">Submit with POST</button>
              </form>

              <pre>{loaderData || actionData}</pre>
            </>
          )
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

test("`<Form>` should submit with the method set via the `formmethod` attribute set on the submitter (button)", async ({
  page,
}) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/");
  await app.clickElement("text=Submit with GET");
  await page.waitForLoadState("load");
  expect(await app.getHtml("pre")).toBe(`<pre>GET</pre>`);
  await page.waitForLoadState("load");
  await app.clickElement("text=Submit with POST");
  expect(await app.getHtml("pre")).toBe(`<pre>POST</pre>`);
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
