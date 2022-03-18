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

        export function loader() {
          return new Date().toISOString();
        }

        export function action() {
          // mutate state
          return redirect("/item");
          // return null
        }

        export default function Index() {
          let data = useLoaderData();
          const fetcher = useFetcher();
          return (
            <div>
              <span id="date">{data}</span>
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
  // collect data calls to validate that loader isn't being called after redirect
  let data = app.collectDataResponses();

  // goto child route
  await app.goto("/item/test");

  // read the date of last loader call
  let date = await app.page.evaluate(el => el.textContent, await app.page.$("#date"))

  // click the button which will trigger redirect to parent route
  await app.clickElement("button");

  // I would expect there to be a loader call in here to the parent route to refresh the data.
  // console.log('data', data);
  // expect(data.length).toBe(2);

  // read the date of last loader call
  let newDate = await app.page.evaluate(el => el.textContent, await app.page.$("#date"))

  // check that the date has changed (this should not fail)
  expect(date).not.toEqual(newDate)
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
