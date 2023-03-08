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
      import {
        Form,
        useFetcher,
        useLoaderData,
        useNavigation
      } from "@remix-run/react";
      import { useState } from "react";
      
      export async function loader({ request }) {
      
        // 1 second timeout on data
        const data = await new Promise((resolve) => {
          setTimeout(() => {
            resolve({ foo: 'bar' });
          }, 1000);
        });
      
        return { data };
      }
      
      export default function Index() {
        const { data } = useLoaderData();
      
        const [open, setOpen] = useState(true);
        const navigation = useNavigation();
      
        return (
          <div>
              {navigation.state === 'idle' && <div id="idle">Idle</div>}
              <Form id="main-form">
                <input id="submit-form" type="submit" />
              </Form>

              <button id="open" onClick={() => setOpen(true)}>Show async form</button>
              {open && <Child onClose={() => setOpen(false)} />}
          </div>
        );
      }
      
      function Child({ onClose }) {
        const fetcher = useFetcher();
      
        return (
          <fetcher.Form method="get" action="/api">
            <button id="submit-fetcher" type="submit">Trigger fetcher (shows a message)</button>
            <button
              type="submit"
              form="main-form"
              id="submit-and-close"
              onClick={() => {
                setTimeout(() => {
                  onClose();
                }, 250);
              }}
            >
              Submit main form and close async form
            </button>
          </fetcher.Form>
        );
      }
        
      `,

      "app/routes/api.jsx": js`
        export async function loader() {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return {message: 'Hello world!'}
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

test("Unmounting a fetcher does not cancel the request of an adjacent form", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  // If you need to test interactivity use the `app`
  await app.goto("/");
  
  // Works as expected before the fetcher is loaded
  await app.clickElement("#submit-and-close"); // submit the main form and unmount the fetcher form
  await page.waitForSelector("#idle", {timeout: 2000}); // Wait for our navigation state to be "Idle"

  // Breaks after the fetcher is loaded
  await app.clickElement("#open"); // re-mount the fetcher form
  await app.clickElement("#submit-fetcher"); // submit the fetcher form
  await app.clickElement("#submit-and-close"); // submit the main form and unmount the fetcher form
  await page.waitForSelector("#idle", {timeout: 2000}); // Wait for navigation state to be "Idle"
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
