import { test, expect } from "@playwright/test";

import type { Fixture, AppFixture } from "./helpers/create-fixture.js";
import {
  createAppFixture,
  createFixture,
  js,
} from "./helpers/create-fixture.js";

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
//    pnpm install && pnpm build
//    ```
//
// Now try running this test:
//
//    ```
//    pnpm bug-report-test
//    ```
//
// You can add `--watch` to the end to have it re-run on file changes:
//
//    ```
//    pnpm bug-report-test --watch
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
    config: {
      future: {
        unstable_singleFetch: true,
      },
    },
    files: {
      "app/routes/_index.tsx": js`
        import { unstable_defineLoader as defineLoader } from "@remix-run/node";
        import { useLoaderData, Link } from "@remix-run/react";

        export const loader = defineLoader(({ response }) => {
          response.status = 404;
          throw response;
        });

        export default function Index() {
          return null;
        }
      `,

      "app/root.tsx": js`
        import {
          Links,
          Meta,
          Outlet,
          Scripts,
          ScrollRestoration,
          isRouteErrorResponse,
          useRouteError,
        } from "@remix-run/react";
        import { isResponseStub } from "@remix-run/server-runtime/dist/single-fetch.js";

        export function Layout({ children }: { children: React.ReactNode }) {
          return (
            <html lang="en">
              <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <Meta />
                <Links />
              </head>
              <body>
                {children}
                <ScrollRestoration />
                <Scripts />
              </body>
            </html>
          );
        }

        export default function App() {
          return <Outlet />;
        }

        export function ErrorBoundary() {
          const error = useRouteError();

          if ((isRouteErrorResponse(error) || isResponseStub(error)) && error.status === 404) {
            return <h1>Not found</h1>;
          }

          return <h1>Something went wrong</h1>;
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

test("throwing a response stub with status 404 hits the root error boundary and renders the not found page", async () => {
  let response = await fixture.requestDocument("/");
  expect(await response.text()).toContain("Not found");
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
