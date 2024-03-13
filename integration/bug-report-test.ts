import { expect, test } from "@playwright/test";

import type { AppFixture, Fixture } from "./helpers/create-fixture.js";
import {
  createAppFixture,
  createFixture,
  js,
} from "./helpers/create-fixture.js";
import { PlaywrightFixture } from "./helpers/playwright-fixture.js";

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
    ////////////////////////////////////////////////////////////////////////////
    // 💿 Next, add files to this object, just like files in a real app,
    // `createFixture` will make an app and run your tests against it.
    ////////////////////////////////////////////////////////////////////////////
    files: {
      "app/routes/_index.tsx": js`
        import { json } from "@remix-run/node";
        import { useLoaderData, Link } from "@remix-run/react";

        export function loader() {
          return json("pizza");
        }

        export default function Index() {
          let data = useLoaderData();
          return (
            <div>
              {data}
              <Link to="/burgers">Burgers</Link>
              <Link to="/spaghetti">spaghetti</Link>
            </div>
          )
        }
      `,
      "app/routes/spaghetti.tsx": js`
      import { Await, defer, useLoaderData, useRevalidator } from "@remix-run/react";
      import { Suspense, useEffect, useRef } from "react";

      export const loader = () => {
        const meatball = Promise.resolve(1);

        return defer({ meatball });
      };

      export default function Spaghetti() {
        const { meatball } = useLoaderData();
        const { revalidate } = useRevalidator();
        const renderCounter = useRef(0);

        useEffect(() => {
          revalidate();
        }, []);

        renderCounter.current++;
        console.log("render", renderCounter.current);

        return (
          <>
            <p data-testid="render-count">[{renderCounter.current}]</p>
            <Suspense>
              <Await resolve={meatball.then((amount) => amount * 2)}>
                {(val) => (
                  <div>
                    <p>Async val: {val}</p>
                  </div>
                )}
              </Await>
            </Suspense>
          </>
        );
      }
      `,

      "app/routes/burgers.tsx": js`
        export default function Index() {
          return <div>cheeseburger</div>;
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

test("Revalidate & Suspense/Await should not cause infinite renders", async ({
  page,
}) => {
  let app = new PlaywrightFixture(appFixture, page);
  // You can test any request your app might get using `fixture`.
  let response = await fixture.requestDocument("/");
  expect(await response.text()).toMatch("pizza");

  // If you need to test interactivity use the `app`
  await app.goto("/");
  await app.clickLink("/spaghetti");

  await page.waitForSelector("p");

  // await page.waitForTimeout(1000);

  await expect(page.getByTestId("render-count")).toHaveText("[2]");

  await app.poke(20, "/spaghetti");

  // If you're not sure what's going on, you can "poke" the app, it'll
  // automatically open up in your browser for 20 seconds, so be quick!

  // Go check out the other tests to see what else you can do.
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
