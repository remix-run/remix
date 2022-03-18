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
      "app/routes/bug/$id.tsx": js`
        import { LoaderFunction, ActionFunction, json, useLoaderData, Outlet, Form } from "remix"

        export const loader: LoaderFunction = async ({ params: { id }, request: { url } }: any) => {
            return json({
                id
            })
        }
        
        export const action: ActionFunction = async () => {
            return json({
                success: true
            })
        }
        
        export default function Bug() {
          const { id } = useLoaderData()
          
          return (<>
                <p>{id}</p>
                <Form method="post">
                    <button type="submit">Click Me</button>
                </Form>
                <Outlet />
            </>)
        }
      `,

      "app/routes/bug/$id/index.tsx": js`
        import { LoaderFunction, json, useLoaderData } from "remix"

        export const loader: LoaderFunction = async ({ params: { id }, request: { url } }: any) => {
        
            return json({
                outlet: "default"
            })
        }
        
        export default function Bug() {
          const { outlet } = useLoaderData()
          
          return (<>
              <p>{outlet}</p>
          </>)
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

it("should call all loaders after post", async () => {

  await app.goto("/bug/123");
  await app.clickElement('button')
  let title = await app.getElement('title')
  expect(await title.text()).not.toMatch("Application Error!");
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
