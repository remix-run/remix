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
      "app/routes/withBoundary.jsx": js`
          import { json } from '@remix-run/node';
          import { useCatch } from '@remix-run/react';
          
          export const loader = () => {
            const message = 'data from example-with-catchboundary/loader';
            throw json({ message });
          };
          
          export function CatchBoundary() {
            return <div>{JSON.stringify(useCatch().data.message)}</div>;
          }
          
          export default function Example() {
            return (
              <div style={{ border: '1px solid red' }}>
                <h3>example-with-catchboundary/index</h3>
              </div>
            );
          }
      `,
      "app/routes/withoutBoundary.jsx": js`
          import { json } from '@remix-run/node';
          
          export const loader = () => {
            const message = 'data from example-without-catchboundary/loader';
            throw json({ message });
          };
          
          export default function Example() {
            return (
              <div style={{ border: '1px solid red' }}>
                <h3>example-with-catchboundary/index</h3>
              </div>
            );
          }
      `,

      "app/root.jsx": js`
          import {
            Links,
            LiveReload,
            Meta,
            Outlet,
            Scripts,
            ScrollRestoration,
            useCatch,
            useLoaderData,
          } from '@remix-run/react';
          import { json } from '@remix-run/node/';
          
          export const meta = () => ({
            charset: 'utf-8',
            title: 'New Remix App',
            viewport: 'width=device-width,initial-scale=1',
          });
          
          export const loader = () => {
            const message = 'data from root loader';
            throw json({ message });
          };
          
          export function CatchBoundary() {
            return <div>root boundary: {JSON.stringify(useCatch().data.message)}</div>;
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

test.only("[description of what you expect it to do]", async ({ page }) => {
  // ✅ Root loader throws json, root catch boundary renders with data from root loader
  let response = await fixture.requestDocument("/");
  expect(await response.text()).toContain("data from root loader");

  // ✅ Root loader throws json, root catch boundary renders with data from root loader
  response = await fixture.requestDocument("/withBoundary");
  expect(await response.text()).toContain("data from root loader");

  // ❌ Root loader throws json, root catch boundary renders with data from nested loader
  // if that loader does not export a CatchBoundary
  response = await fixture.requestDocument("/withoutBoundary");
  expect(await response.text()).toContain("data from root loader");
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
