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
        import { useFetcher } from '@remix-run/react';
        import { useEffect } from 'react';

        export default function Index() {
          const fetcher = useFetcher();

          useEffect(() => {
            if (!fetcher.data && fetcher.state === 'idle') {
              fetcher.load('/load');
            }
          }, [fetcher]);

          return (
            <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: '1.4' }}>
              <h1>web-fetch 4.3.2 crash "Premature close"</h1>
              <ol>
                <li>Observe exit code 1 when fetcher loads from /load.tsx route</li>
                <li>Go to load.tsx, uncomment the import that uses web-fetch 4.3.1</li>
                <li>Remix no longer crashes</li>
              </ol>
              <hr />
              <h2>Response from /load:</h2>
              <code>{JSON.stringify(fetcher.data)}</code>
            </div>
          );
        }
      `,

      "app/routes/load.jsx": js`
        import { json } from '@remix-run/server-runtime';

        export async function loader() {
          const res = await fetch(
            'https://docs.google.com/document/d/1ZM3fgLNXoj8_QYnits3UiITvctobJvB9KEh_SE9KL-E/edit?usp=sharing'
          );
          return json({ response: await res.text() });
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

test("fetching a private google url", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/");
  expect(await app.getHtml()).toMatch("Response");

  // If you're not sure what's going on, you can "poke" the app, it'll
  // automatically open up in your browser for 20 seconds, so be quick!
  // await app.poke(20);

  // Go check out the other tests to see what else you can do.
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
