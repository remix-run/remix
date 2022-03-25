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
      "app/routes/index.jsx": js`
        import { json, useLoaderData, Link } from "remix";

        export function loader() {
          return json("pizza");
        }

        export default function Index() {
          let data = useLoaderData();
          return (
            <div>
              {data}
              <Link to="/ريمكس">Other Route</Link>
              <Link to="/route-remixée">Other Route</Link>
              <Link to="/autre-route-remixée">Other Route</Link>
            </div>
          )
        }
      `,

      "app/routes/ريمكس.jsx": js`
        export default function Index() {
          return <div>remix in arabic is written ريمكس</div>;
        }
      `,
      "app/routes/route-remixée.jsx": js`
        export default function Index() {
          return <div>Bonjour</div>;
        }
      `,
      "app/routes/autre-route-remix%C3%A9e.jsx": js`
        export default function Index() {
          return <div>Bonsoir</div>;
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

it("it should render my ريمكس route", async () => {
  await app.goto("/ريمكس");
  expect(await app.getHtml()).toMatch("remix in arabic is written ريمكس");
});


it("it should render my route-remixée", async () => {
  await app.goto("/route-remixée");
  expect(await app.getHtml()).toMatch("Bonjour");
});

it("it should render my autre-route-remixée", async () => {
  await app.goto("/autre-route-remixée");
  expect(await app.getHtml()).toMatch("Bonsoir");
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
