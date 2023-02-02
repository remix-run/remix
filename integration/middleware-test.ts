import type { Page } from "@playwright/test";
import { test, expect } from "@playwright/test";
import { ServerMode } from "@remix-run/server-runtime/mode";

import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { PlaywrightFixture } from "./helpers/playwright-fixture";

test.describe("Middleware", () => {
  let fixture: Fixture;
  let appFixture: AppFixture;

  test.beforeAll(async () => {
    fixture = await createFixture({
      future: {
        unstable_middleware: true,
      },
      files: {
        "app/root.jsx": js`
          import { Link, Links, Meta, Outlet, Scripts, useNavigation } from "@remix-run/react";

          export default function Root() {
            let navigation = useNavigation();

            return (
              <html lang="en">
                <head>
                  <Meta />
                  <Links />
                </head>
                <body>
                  <nav>
                    <ul>
                      <li><Link to="/parent">parent</Link></li>
                      <li><Link to="/parent/child">child</Link></li>
                      <li><Link to="/parent/child/grandchild">grandchild</Link></li>
                    </ul>
                  </nav>
                  {navigation.state === "idle" ? <p id="idle">IDLE</p> : null}
                  <main>
                    <Outlet />
                  </main>
                  <Scripts />
                </body>
              </html>
            );
          }
        `,

        "app/context.js": js`
          import { createMiddlewareContext } from "@remix-run/node"
          export const countContext = createMiddlewareContext(0);
        `,

        "app/routes/parent.jsx": js`
          import { json } from "@remix-run/node";
          import { Outlet, useLoaderData } from "@remix-run/react";
          import { countContext } from '~/context';

          export async function middleware({ context, request }) {
            let count = context.get(countContext);
            if (request.method === "POST") {
              count = Number((await request.formData()).get("count"));
            } else if (new URL(request.url).searchParams.has('count')) {
              count = Number(new URL(request.url).searchParams.get('count'))
            }
            context.set(countContext, count + 1);
          }

          export function loader({ context }) {
            return json({ count: context.get(countContext) + 1 });
          }

          export default function Component() {
            return (
              <div>
                <p id="parent-data">{JSON.stringify(useLoaderData())}</p>
                <Outlet />
              </div>
            )
          }
        `,

        "app/routes/parent/child.jsx": js`
          import { json } from "@remix-run/node";
          import { Outlet, useLoaderData } from "@remix-run/react";
          import { countContext } from '~/context';

          export async function middleware({ context }) {
            let count = context.get(countContext);
            context.set(countContext, count + 1);
          }

          export function loader({ context }) {
            return json({ count: context.get(countContext) + 1 });
          }

          export default function Component() {
            return (
              <div>
                <p id="child-data">{JSON.stringify(useLoaderData())}</p>
                <Outlet />
              </div>
            )
          }
        `,

        "app/routes/parent/child/grandchild.jsx": js`
          import { json } from "@remix-run/node";
          import { Form, useActionData, useLoaderData } from "@remix-run/react";
          import { countContext } from '~/context';

          export async function middleware({ context }) {
            let count = context.get(countContext);
            context.set(countContext, count + 1);
          }

          export function action({ context }) {
            let count = context.get(countContext);
            return json({ count: count + 1 });
          }

          export function loader({ context }) {
            return json({ count: context.get(countContext) + 1 });
          }

          export default function Component() {
            let data = useLoaderData();
            let actionData = useActionData();
            return (
              <div>
                <p id="grandchild-data">{JSON.stringify(data)}</p>
                <p id="grandchild-action-data">{actionData ? JSON.stringify(actionData) : 'empty'}</p>
                <Form action={"?count=" + data.count} method="post">
                  <button type="submit" name="count" value="100">Submit</button>
                </Form>
              </div>
            )
          }
        `,

        "app/routes/parent-response.jsx": js`
          import { json } from "@remix-run/node";
          import { Outlet, useLoaderData } from "@remix-run/react";
          import { countContext } from '~/context';

          export function headers({ loaderHeaders }) {
            return { 'x-count': loaderHeaders.get('x-count') };
          }

          export async function middleware({ context, request }) {
            let count = context.get(countContext);
            if (request.method === "POST") {
              let fd = await request.formData();
              count = Number(fd.get("count"));
            } else if (new URL(request.url).searchParams.has('count')) {
              count = Number(new URL(request.url).searchParams.get('count'))
            }
            context.set(countContext, count + 1);

            let res = await context.next();

            count = context.get(countContext);
            context.set(countContext, ++count)
            res.headers.set('x-count', count);
            return res;
          }

          export function loader({ context }) {
            return json({ count: context.get(countContext) + 1 });
          }

          export default function Component() {
            return (
              <div>
                <p id="parent-data">{JSON.stringify(useLoaderData())}</p>
                <Outlet />
              </div>
            )
          }
        `,

        "app/routes/parent-response/child.jsx": js`
          import { json } from "@remix-run/node";
          import { Outlet, useLoaderData } from "@remix-run/react";
          import { countContext } from '~/context';

          export function headers({ loaderHeaders }) {
            return { 'x-count': loaderHeaders.get('x-count') };
          }

          export async function middleware({ context }) {
            let count = context.get(countContext);
            context.set(countContext, count + 1);

            let res = await context.next();

            count = context.get(countContext);
            context.set(countContext, ++count)
            res.headers.set('x-count', count);
            return res;
          }

          export function loader({ context }) {
            return json({ count: context.get(countContext) + 1 });
          }

          export default function Component() {
            return (
              <div>
                <p id="child-data">{JSON.stringify(useLoaderData())}</p>
                <Outlet />
              </div>
            )
          }
        `,

        "app/routes/parent-response/child/grandchild.jsx": js`
          import { json } from "@remix-run/node";
          import { Form, useActionData, useLoaderData } from "@remix-run/react";
          import { countContext } from '~/context';

          export function headers({ actionHeaders, loaderHeaders }) {
            return {
              'x-count':
                actionHeaders.get('x-count') || loaderHeaders.get('x-count'),
            };
          }

          export async function middleware({ context }) {
            let count = context.get(countContext);
            context.set(countContext, count + 1);

            let res = await context.next();

            count = context.get(countContext);
            context.set(countContext, ++count)
            res.headers.set('x-count', count);
            return res;
          }

          export function action({ context }) {
            let count = context.get(countContext);
            return json({ count: count + 1 });
          }

          export function loader({ context }) {
            return json({ count: context.get(countContext) + 1 });
          }

          export default function Component() {
            let data = useLoaderData();
            let actionData = useActionData();
            return (
              <div>
                <p id="grandchild-data">{JSON.stringify(data)}</p>
                <p id="grandchild-action-data">{actionData ? JSON.stringify(actionData) : 'empty'}</p>
                <Form action={"?count=" + data.count} method="post">
                  <button type="submit" name="count" value="100">Submit</button>
                </Form>
              </div>
            )
          }
        `,
      },
    });

    appFixture = await createAppFixture(fixture, ServerMode.Development);
  });

  test.afterAll(() => {
    appFixture.close();
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });
    runMiddlewareTests();
  });

  test.describe("with JavaScript", () => {
    test.use({ javaScriptEnabled: true });
    runMiddlewareTests();
  });

  test.describe("Response Headers", () => {
    // These middlewares increment on the way down, in actions/loaders, and on
    // the way back up and set count in a response header

    test("Allows middleware to alter loader responses (document requests)", async () => {
      let response;

      response = await fixture.requestDocument("/parent-response");
      expect(response.headers.get("x-count")).toBe("2");

      response = await fixture.requestDocument("/parent-response/child");
      expect(response.headers.get("x-count")).toBe("4");

      response = await fixture.requestDocument(
        "/parent-response/child/grandchild"
      );
      expect(response.headers.get("x-count")).toBe("6");
    });

    test("Allows middleware to alter action responses (document requests)", async () => {
      let response;

      let formData = new FormData();
      formData.set("count", "100");
      response = await fixture.requestDocument(
        "/parent-response/child/grandchild",
        {
          method: "post",
          body: formData,
        }
      );
      expect(response.headers.get("x-count")).toBe("106");
    });

    test("Allows middleware to alter loader responses (data requests)", async () => {
      let response;

      response = await fixture.requestData(
        "/parent-response",
        "routes/parent-response"
      );
      expect(response.headers.get("x-count")).toBe("2");

      response = await fixture.requestData(
        "/parent-response/child",
        "routes/parent-response/child"
      );
      expect(response.headers.get("x-count")).toBe("4");

      response = await fixture.requestData(
        "/parent-response/child/grandchild",
        "routes/parent-response/child/grandchild"
      );
      expect(response.headers.get("x-count")).toBe("6");
    });

    test("Allows middleware to alter action responses (data requests)", async () => {
      let response;

      let formData = new FormData();
      formData.set("count", "100");
      response = await fixture.requestData(
        "/parent-response/child/grandchild",
        "routes/parent-response/child/grandchild",
        { method: "post", body: formData }
      );
      expect(response.headers.get("x-count")).toBe("106");
    });
  });

  function runMiddlewareTests() {
    // These middlewares increment on the way down and in the action/loaders and
    // do not do anything with responses

    test("Passes data to loaders through middleware context", async ({
      page,
    }) => {
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/");
      await app.clickLink("/parent/child/grandchild");
      await page.waitForSelector("#idle");
      expect(await app.getHtml("#parent-data")).toMatch('{"count":2}');
      expect(await app.getHtml("#child-data")).toMatch('{"count":3}');
      expect(await app.getHtml("#grandchild-data")).toMatch('{"count":4}');
    });

    test("Passes data to actions through middleware context", async ({
      page,
    }) => {
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/");
      await app.clickLink("/parent/child/grandchild");
      expect(await app.getHtml("#parent-data")).toMatch('{"count":2}');
      expect(await app.getHtml("#child-data")).toMatch('{"count":3}');
      expect(await app.getHtml("#grandchild-data")).toMatch('{"count":4}');
      expect(await app.getHtml("#grandchild-action-data")).toMatch("empty");

      await app.clickSubmitButton("/parent/child/grandchild?count=4");
      await page.waitForSelector("#idle");
      // Action data is 104 since we submit 100, then increment in 3 middlewares
      // and the action
      expect(await app.getHtml("#grandchild-action-data")).toMatch(
        '{"count":104}'
      );
      // Loaders pick up where they left off (4) and increment for each
      // middleware and the loader
      expect(await app.getHtml("#parent-data")).toMatch('{"count":6}');
      expect(await app.getHtml("#child-data")).toMatch('{"count":7}');
      expect(await app.getHtml("#grandchild-data")).toMatch('{"count":8}');
    });
  }
});
