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
        import { json, redirect } from "@remix-run/node";
        import { useLoaderData, Link, Form } from "@remix-run/react";

        export const action = async ({ request }) => {
          let url = new URL(request.url);
          const form = await request.formData();
          const action = form.get("action");
          switch (action) {
            case "relative":
              return redirect("/test");
            case "absolute":
              return redirect(url.origin + "/test");
            default:
              throw new Error("Invalid action");
          }
        };

        export default function Index() {
          return (
            <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.4" }}>
              <h1>Welcome to Remix</h1>
              <Link to="/test">Test link</Link>
              <Form method="post">
                <div>
                  <button type="submit" name="action" value="relative">
                    Redirect action with relative path
                  </button>
                </div>
                <div>
                  <button type="submit" name="action" value="absolute">
                    Redirect action with absolute path
                  </button>
                </div>
              </Form>
            </div>
          );
        }
      `,

      "app/routes/test.jsx": js`
        export default function Index() {
          return <div id="success">Success!</div>;
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

test("Link to relative path should work", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  // You can test any request your app might get using `fixture`.
  let response = await fixture.requestDocument("/");
  expect(await response.text()).toMatch("Welcome to Remix");

  // If you need to test interactivity use the `app`
  await app.goto("/");
  await app.clickLink("/test");
  expect(await app.getHtml()).toMatch("Success!");
});
test("Redirect in action to relative path should work", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  // You can test any request your app might get using `fixture`.
  let response = await fixture.requestDocument("/");
  expect(await response.text()).toMatch("Welcome to Remix");

  // If you need to test interactivity use the `app`
  await app.goto("/");
  await app.clickElement("button[name=action][value=relative]");
  expect(await app.getHtml()).toMatch("Success!");
});
test("Redirect in action to absolute path should work", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  // You can test any request your app might get using `fixture`.
  let response = await fixture.requestDocument("/");
  expect(await response.text()).toMatch("Welcome to Remix");

  // If you need to test interactivity use the `app`
  await app.goto("/");
  await app.clickElement("button[name=action][value=absolute]");
  expect(await app.getHtml()).toMatch("Success!");
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
