import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

let fixture: Fixture;
let app: AppFixture;

////////////////////////////////////////////////////////////////////////////////
// 💿 👋 Hola! It's me, Dora the Remix Disc, I'm here to help you write a great
// bug report pull request. You don't need to fix the bug, this is just to
// report one.
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
//    jest integration/bug-report-test.ts
//    ```
//
// You can add `--watch` to the end to have it re-run on file changes:
//
//    ```
//    jest integration/bug-report-test.ts --watch
//    ```
////////////////////////////////////////////////////////////////////////////////

beforeAll(async () => {
  fixture = await createFixture({
    ////////////////////////////////////////////////////////////////////////////
    // 💿 Next, add files to this object, just like files in a real app,
    // `createFixture` will make an app and run your tests against it.
    ////////////////////////////////////////////////////////////////////////////
    files: {
      "app/routes/item/$id.jsx": js`
        import React from "react";
        import { useParams } from "react-router-dom";

        export default function Item() {
          const { id } = useParams();
          return <div>Item {id}</div>;
        }
      `,
      "app/routes/item.jsx": js`
        import { json, useLoaderData, Outlet, useFetcher, redirect } from "remix";

        let counter = 1;
        export function loader() {
          return json(counter);
        }

        export function action() {
          counter += 1;
          return redirect("/item");
          // return null
        }

        export default function Index() {
          let data = useLoaderData();
          const fetcher = useFetcher();
          const count = "count: " + data;
          return (
            <div>
              <span>{count}</span>
              <button onClick={e => {
                fetcher.submit({ value: 46 }, { method: 'post', replace: true })
              }}>Do something and redirect</button>
              <Outlet />
            </div>
          )
        }
      `,
    },
  });

  // This creates an interactive app using puppeteer.
  app = await createAppFixture(fixture);
});

afterAll(async () => app.close());

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

it("[description of w", async () => {
  // You can test any request your app might get using `fixture`.
  let response = await fixture.requestDocument("/item/test");
  expect(await response.text()).toMatch("count: 1");

  // If you need to test interactivity use the `app`
  await app.goto("/item/test");
  await app.clickElement("button");
  expect(await app.getHtml()).toMatch("count: 2");

  // If you're not sure what's going on, you can "poke" the app, it'll
  // automatically open up in your browser for 20 seconds, so be quick!
  // await app.poke(20);

  // Go check out the other tests to see what else you can do.
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
