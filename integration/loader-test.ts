import { test, expect } from "@playwright/test";

import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { PlaywrightFixture } from "./helpers/playwright-fixture";

test.describe("loader", () => {
  let fixture: Fixture;

  let ROOT_DATA = "ROOT_DATA";
  let INDEX_DATA = "INDEX_DATA";

  test.beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/root.jsx": js`
        import { json } from "@remix-run/node";
        import { Links, Meta, Outlet, Scripts } from "@remix-run/react";

          export const loader = () => json("${ROOT_DATA}");

          export default function Root() {
            return (
              <html lang="en">
                <head>
                  <Meta />
                  <Links />
                </head>
                <body>
                  <Outlet />
                  <Scripts />
                </body>
              </html>
            );
          }
        `,

        "app/routes/index.jsx": js`
          import { json } from "@remix-run/node";

          export function loader() {
            return "${INDEX_DATA}"
          }

          export default function Index() {
            return <div/>
          }
        `,
      },
    });
  });

  test("returns responses for a specific route", async () => {
    let [root, index] = await Promise.all([
      fixture.requestData("/", "root"),
      fixture.requestData("/", "routes/index"),
    ]);

    expect(root.headers.get("Content-Type")).toBe(
      "application/json; charset=utf-8"
    );

    expect(await root.json()).toBe(ROOT_DATA);
    expect(await index.json()).toBe(INDEX_DATA);
  });
});

test.describe("loader in an app", () => {
  let appFixture: AppFixture;

  let HOME_PAGE_TEXT = "hello world";
  let REDIRECT_TARGET_TEXT = "redirect target";
  let FETCH_TARGET_TEXT = "fetch target";

  test.beforeAll(async () => {
    appFixture = await createAppFixture(
      await createFixture({
        files: {
          "app/root.jsx": js`
            import { Outlet } from '@remix-run/react'

            export default function Root() {
              return (
                <html>
                  <body>
                    ${HOME_PAGE_TEXT}
                    <Outlet />
                  </body>
                </html>
              );
            }
          `,
          "app/routes/redirect.jsx": js`
            import { redirect } from "@remix-run/node";
            export const loader = () => redirect("/redirect-target");
            export default () => <div>Yo</div>
          `,
          "app/routes/redirect-target.jsx": js`
            export default () => <div>${REDIRECT_TARGET_TEXT}</div>
          `,
          "app/routes/fetch.jsx": js`
            export function loader({ request }) {
              return fetch(new URL(request.url).origin + '/fetch-target');
            }
          `,

          "app/routes/fetch-target.jsx": js`
            import { json } from "@remix-run/node";

            export function loader() {
              return json({ message: "${FETCH_TARGET_TEXT}" })
            }
          `,
        },
      })
    );
  });

  test.afterAll(() => {
    appFixture.close();
  });

  test("sends a redirect", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/redirect");
    expect(await app.getHtml()).toMatch(HOME_PAGE_TEXT);
    expect(await app.getHtml()).toMatch(REDIRECT_TARGET_TEXT);
  });

  test("handles raw fetch responses", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    let res = await app.goto(`/fetch`);
    expect((await res.json()).message).toBe(FETCH_TARGET_TEXT);
  });
});
