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
      // Comment out this entry and the test will pass
      "app/routes/$postId.tsx": js`
        import { json } from "@remix-run/node";
        import { useLoaderData } from "@remix-run/react";

        export function loader({ params }) {
          const { postId } = params;
          return json({ message: postId });
        }

        export default function PostPage() {
          const { message } = useLoaderData();
          return <div>{message}</div>;
        }
      `,

      "app/routes/index.jsx": js`
        import { Link } from "@remix-run/react";

        export default function Index() {
          return (
            <div>
              <Link to="/asset.txt">Asset</Link>
            </div>
          );
        }
      `,

      "public/asset.txt": "I'm an asset!",
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

test(`
  <Link> without reloadDocument should 404 an href that matches both a dynamic
  route and a public/ asset because that is what it does when the href only
  matches an asset. Instead it is returning an empty page
`, async ({ page }) => {
  const app = new PlaywrightFixture(appFixture, page);
  await app.goto("/");

  await app.clickLink("/asset.txt", { wait: true });

  expect(await app.getHtml()).toMatch("Not Found");
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
