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
    future: { v2_routeConvention: true },
    ////////////////////////////////////////////////////////////////////////////
    // 💿 Next, add files to this object, just like files in a real app,
    // `createFixture` will make an app and run your tests against it.
    ////////////////////////////////////////////////////////////////////////////
    files: {
      "app/routes/deferred.jsx": js`
        import { defer } from "@remix-run/node";
        import { Await, Link, Outlet, useLoaderData } from "@remix-run/react";
        import { Suspense } from "react";
        
        export async function loader({ request, params }) {
          const message = (async () => {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            return "Hello, world";
          })();
        
          return defer({
            message,
          });
        }
        export default function Deferred() {
          const { message } = useLoaderData();
          return (
            <div>
              <h1>Deferred</h1>
              <ul>
                <li>
                  <Link to="/deferred/nested" id="nested-no-param">Go to nested from deferred route</Link>
                </li>
                <li>
                  <Link to="/deferred/nested?a=b" id="nested-param">
                    Go to nested from deferred route param
                  </Link>
                </li>
              </ul>
              <Suspense fallback={<div id="loading">Loading</div>}>
                <Await resolve={message}>{() => <div id="done">Done</div>}</Await>
              </Suspense>
              Child:
              <Outlet />
              <p>{"A".repeat(1024)}</p>
            </div>
          );
        }
      `,

      "app/routes/deferred.nested.jsx": js`
        import { defer } from "@remix-run/node";
        import { Await, useLoaderData } from "@remix-run/react";
        import { Suspense } from "react";
        
        export async function loader({ request, params }) {
          const message = (async () => {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            return "Hello, world";
          })();
        
          return defer({
            message,
          });
        }
        export default function DeferredNested() {
          const { message } = useLoaderData();
          return <div>
            <h1>Deferred Nested</h1>
            <Suspense fallback={<div id="loading">Loading</div>}>
                <Await resolve={message}>
                    {(message) => <div id="done">Done</div>}
                </Await>
            </Suspense>
        
            <p>{'A'.repeat(1024)}</p>
          </div>;
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

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

test("Nested client side navigation defers without url param", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  // You can test any request your app might get using `fixture`.
  // let response = await fixture.requestDocument("/");
  // If you need to test interactivity use the `app`
  await app.goto("/deferred");
  app.clickElement('#nested-no-param');
  await page.waitForSelector("#loading", { timeout: 1000 });

  // If you're not sure what's going on, you can "poke" the app, it'll
  // automatically open up in your browser for 20 seconds, so be quick!

  // Go check out the other tests to see what else you can do.
});


test("Nested client side navigation defers with a URL param", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  // You can test any request your app might get using `fixture`.
  // let response = await fixture.requestDocument("/");
  // If you need to test interactivity use the `app`
  await app.goto("/deferred");
  app.clickElement('#nested-param');
  await page.waitForSelector("#loading", { timeout: 1000 });

  // If you're not sure what's going on, you can "poke" the app, it'll
  // automatically open up in your browser for 20 seconds, so be quick!

  // Go check out the other tests to see what else you can do.
});////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
