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
      "app/root.jsx": js`
       import {
        Links,
        LiveReload,
        Meta,
        Outlet,
        Scripts,
        ScrollRestoration,
        useCatch,
      } from "@remix-run/react";
      
      export const meta = () => ({
        charset: "utf-8",
        title: "New Remix App",
        viewport: "width=device-width,initial-scale=1",
      });
    
      
      export function ErrorBoundary({ error }) {
        console.error(error);
        return (
          <html>
            <head>
              <title>Oh no!</title>
              <Meta />
              <Links />
            </head>
            <body>
              ERROR BOUNDARY
            </body>
          </html>
        );
      }
      
      export default function App() {
        return (
          <html lang="en">
            <head>
              <Meta />
              <Links />
            </head>
            <body>
              <Outlet />
              <ScrollRestoration />
              <Scripts />
              <LiveReload />
            </body>
          </html>
        );
      }
      
      `,
      "app/routes/index.jsx": js`
      import { Link } from "@remix-run/react";

      export default function Index() {
        return (
          <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.4" }}>
            <p>Index file, working fine</p>
            <Link to="/boom">This will error</Link>
          </div>
        );
      }
      
      `,

      "app/routes/boom.jsx": js`
      import { json } from "@remix-run/node";

      export function loader() {
          boom()
          return null;
      }
      
      export default function() {
          return <b>my page</b>
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

test("Should rended the index file contents", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  
  // If you need to test interactivity use the `app`
  await app.goto("/");
  await app.clickLink("/boom");
  expect(await app.getHtml()).toMatch("ERROR BOUNDARY");

  await app.reload();
  expect(await app.getHtml()).toMatch("ERROR BOUNDARY");

  expect(app.page.url()).toMatch("boom");

  await app.goBack();
 
  // we're on / again
  expect(app.page.url()).not.toContain("boom");

  expect(await app.getHtml()).toMatch("working fine");


  // If you're not sure what's going on, you can "poke" the app, it'll
  // automatically open up in your browser for 20 seconds, so be quick!
  // await app.poke(20);

  // Go check out the other tests to see what else you can do.
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
