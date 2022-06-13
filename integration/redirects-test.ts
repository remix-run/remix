import { test, expect } from "@playwright/test";

import { createFixture, createAppFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { PlaywrightFixture } from "./helpers/playwright-fixture";

test.describe("redirects", () => {
  let fixture: Fixture;
  let appFixture: AppFixture;

  test.beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/routes/action-submission.jsx": js`
          import { Outlet, useLoaderData } from "@remix-run/react";

          if (typeof global.count === "undefined") {
            global.count = 0;
          }

          export async function loader({ request }) {
            return { count: ++count };
          };

          export default function Parent() {
            let data = useLoaderData();
            return (
              <div id="app">
                <p id="count">{data.count}</p>
                <Outlet/>
              </div>
            );
          }
        `,

        [`app/routes/action-submission/form.jsx`]: js`
          import { redirect } from "@remix-run/node";
          import { Form } from "@remix-run/react";

          export async function action({ request }) {
            return redirect("/action-submission/1");
          };

          export default function Login() {
            return (
              <Form method="post" action="/action-submission/form">
                <input type="hidden" name="key" value="value" />
                <button type="submit">Submit</button>
              </Form>
            );
          }
        `,

        [`app/routes/action-submission/1.jsx`]: js`
          import { redirect } from "@remix-run/node";

          export async function loader({ request }) {
            return redirect("/action-submission/2");
          };
        `,

        [`app/routes/action-submission/2.jsx`]: js`
          export default function () {
            return <h1>Page 2</h1>
          }
        `,

        "app/session.server.js": js`
          import { createCookie } from "@remix-run/node";
          export const session = createCookie("session");
        `,

        "app/routes/loader-cookie.jsx": js`
          import { Outlet, useLoaderData } from "@remix-run/react";
          import { session } from "~/session.server";

          if (typeof global.count === "undefined") {
            global.count = 0;
          }

          export async function loader({ request }) {
            const cookieHeader = request.headers.get("Cookie");
            const { value } = (await session.parse(cookieHeader)) || {};
            return { count: ++global.count, value };
          };

          export default function Parent() {
            let data = useLoaderData();
            return (
              <div id="app">
                {data.value ? <p>{data.value}</p> : null}
                <Outlet/>
              </div>
            );
          }
        `,

        [`app/routes/loader-cookie/login.jsx`]: js`
          import { redirect } from "@remix-run/node";
          import { Form } from "@remix-run/react";
          import { session } from "~/session.server";

          export async function loader({ request }) {
            const cookieHeader = request.headers.get("Cookie");
            const cookie = (await session.parse(cookieHeader)) || {};
            cookie.value = 'cookie-value';
            return redirect("/loader-cookie/1", {
              headers: {
                "Set-Cookie": await session.serialize(cookie),
              },
            });
          };
        `,

        [`app/routes/loader-cookie/1.jsx`]: js`
          import { redirect } from "@remix-run/node";

          export async function loader({ request }) {
            return redirect("/loader-cookie/2");
          };
        `,

        [`app/routes/loader-cookie/2.jsx`]: js`
          export default function () {
            return <h1>Page 2</h1>
          }
        `,
      },
    });

    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(async () => {
    await appFixture.close();
  });

  test("preserves revalidation across action multi-redirects", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto(`/action-submission/form`);
    expect(await app.getHtml("#count")).toMatch(">1<");
    expect(await app.getHtml("#app")).toMatch("Submit");
    // Submitting this form will trigger an action -> actionRedirect -> normalRedirect
    // and we need to ensure that the parent loader is called on both redirects
    await app.clickElement('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 1000));
    expect(await app.getHtml("#app")).toMatch("Page 2");
    // Loader called twice
    expect(await app.getHtml("#count")).toMatch(">3<");
  });

  test("preserves revalidation across loader multi-redirects with cookies set", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    // Loading this page will trigger an normalRedirect -> normalRedirect with
    // a cookie set on the first one, and we need to ensure that the parent
    // loader is called on both redirects
    await app.goto(`/loader-cookie/login`);
    expect(await app.getHtml("#app")).toMatch("Page 2");
    expect(await app.getHtml("#app")).toMatch("cookie-value");
  });
});
