import type { AppFixture, Fixture } from "./helpers/create-fixture";
import { createAppFixture, createFixture, js } from "./helpers/create-fixture";

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
      "app/routes/form.jsx": js`
        import { useSearchParams, useFetcher, Form } from "remix"

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

it("should redirect via referrer header", async () => {
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
