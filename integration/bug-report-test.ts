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
      "app/root.jsx": js`
      import { redirect } from "@remix-run/node";
      import {
        Links,
        LiveReload,
        Meta,
        NavLink,
        Outlet,
        Scripts,
        ScrollRestoration,
        useLoaderData,
      } from "@remix-run/react";

      export const meta = () => ({
        charset: "utf-8",
        title: "New Remix App",
        viewport: "width=device-width,initial-scale=1",
      });

      /**
       * @type {import("@remix-run/node").LoaderFunction}
       */
      export const loader = ({ params }) => {
        let { lang = "en" } = params;
      
        if (lang !== "en" && lang !== "ckb") {
          return redirect("/");
        }
      
        return { lang };
      };

      export default function App() {
        const { lang } = useLoaderData();
        return (
          <html lang="en">
            <head>
              <Meta />
              <Links />
            </head>
            <body>
              <NavLink id="lang-switcher" to={lang === "en" ? "/ckb" : "/"}>
                {lang === "en" ? "CKB" : "EN"}
              </NavLink>
              <Outlet />
              <ScrollRestoration />
              <Scripts />
              <LiveReload />
            </body>
          </html>
        );
      }
    `,
      "app/routes/($lang)/index.jsx": js`
      export default function Index() {
        return (
          <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.4" }}>
            <h1>Welcome to Remix</h1>
            <ul>
              <li>
                <a
                  target="_blank"
                  href="https://remix.run/tutorials/blog"
                  rel="noreferrer"
                >
                  15m Quickstart Blog Tutorial
                </a>
              </li>
              <li>
                <a
                  target="_blank"
                  href="https://remix.run/tutorials/jokes"
                  rel="noreferrer"
                >
                  Deep Dive Jokes App Tutorial
                </a>
              </li>
              <li>
                <a target="_blank" href="https://remix.run/docs" rel="noreferrer">
                  Remix Docs
                </a>
              </li>
            </ul>
          </div>
        );
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

test("changes in URL and particularly optional segments should trigger loaders", async ({
  page,
}) => {
  let app = new PlaywrightFixture(appFixture, page);
  await fixture.requestDocument("/");

  await app.goto("/");
  let langSwitcher = await app.getElement("#lang-switcher");
  expect(langSwitcher.text()).toMatch("CKB");

  await app.clickLink("/ckb");

  langSwitcher = await app.getElement("#lang-switcher");
  expect(langSwitcher.text()).toMatch("EN");
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
