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
        import { useSearchParams, useFetcher, Form } from "@remix-run/react";

        export default function FormPage() {
          const [params] = useSearchParams()
          const redirects = params.get("redirects") ?? 0
          const fetcher = useFetcher()
          return <>
            <p>{'redirects: ' + redirects}</p>
            <form action="/action" method="post">
              <button name="redirects" value={redirects} data-testid="browser">browser form</button>
            </form>
            <Form action="/action" method="post">
              <button name="redirects" value={redirects} data-testid="remix">remix form</button>
            </Form>
            <fetcher.Form action="/action" method="post">
              <button name="redirects" value={redirects} data-testid="fetcher">fetcher form</button>
            </fetcher.Form>
          </>
        }
      `,

      "app/routes/action.jsx": js`
        import { redirect } from 'remix'
        export async function action({ request }) {
          const data = await request.formData()
          const redirects = data.get("redirects")
          const referrer = new URL(request.headers.get("referer"))
          referrer.searchParams.set("redirects", Number(redirects) + 1)
          return redirect(referrer.href)
        }
        
        export default function Render() {
            return <span />;
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

test("should redirect via referrer header", async ({page}) => {
  let app = new PlaywrightFixture(appFixture, page);
  // You can test any request your app might get using `fixture`.
  // If you need to test interactivity use the `app`

  await app.goto("/form");
  expect(await app.getHtml()).toMatch("redirects: 0");
  await app.clickElement("[data-testid=browser]");
  expect(await app.getHtml()).toMatch("redirects: 1");
  await app.clickElement("[data-testid=fetcher]");
  expect(await app.getHtml()).toMatch("redirects: 2");
  await app.clickElement("[data-testid=remix]");
  expect(await app.getHtml()).toMatch("redirects: 3");

  // If you're not sure what's going on, you can "poke" the app, it'll
  // automatically open up in your browser for 20 seconds, so be quick!
  // await app.poke(20);

  // Go check out the other tests to see what else you can do.
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
