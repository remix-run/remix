import { test, expect } from "@playwright/test";
import { ServerMode } from "@remix-run/server-runtime/mode";

import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { PlaywrightFixture } from "./helpers/playwright-fixture";

test.describe("ErrorBoundary", () => {
  let fixture: Fixture;
  let appFixture: AppFixture;
  let _consoleError: any;

  let ROOT_BOUNDARY_TEXT = "ROOT_BOUNDARY_TEXT";
  let OWN_BOUNDARY_TEXT = "OWN_BOUNDARY_TEXT";

  let HAS_BOUNDARY_LOADER = "/yes/loader";
  let HAS_BOUNDARY_ACTION = "/yes/action";
  let HAS_BOUNDARY_RENDER = "/yes/render";
  let HAS_BOUNDARY_NO_LOADER_OR_ACTION = "/yes/no-loader-or-action";

  let NO_BOUNDARY_ACTION = "/no/action";
  let NO_BOUNDARY_LOADER = "/no/loader";
  let NO_BOUNDARY_RENDER = "/no/render";
  let NO_BOUNDARY_NO_LOADER_OR_ACTION = "/no/no-loader-or-action";

  let NOT_FOUND_HREF = "/not/found";

  // packages/remix-react/errorBoundaries.tsx
  let INTERNAL_ERROR_BOUNDARY_HEADING = "Application Error";

  test.beforeAll(async () => {
    _consoleError = console.error;
    console.error = () => {};
    fixture = await createFixture({
      files: {
        "app/root.jsx": js`
          import { Links, Meta, Outlet, Scripts } from "@remix-run/react";

          export default function Root() {
            return (
              <html lang="en">
                <head>
                  <Meta />
                  <Links />
                </head>
                <body>
                  <main>
                    <Outlet />
                  </main>
                  <Scripts />
                </body>
              </html>
            );
          }

          export function ErrorBoundary() {
            return (
              <html>
                <head />
                <body>
                  <main>
                    <div id="root-boundary">${ROOT_BOUNDARY_TEXT}</div>
                  </main>
                  <Scripts />
                </body>
              </html>
            )
          }
        `,

        "app/routes/index.jsx": js`
          import { Link, Form } from "@remix-run/react";
          export default function () {
            return (
              <div>
                <Link to="${NOT_FOUND_HREF}">${NOT_FOUND_HREF}</Link>

                <Form method="post">
                  <button formAction="${HAS_BOUNDARY_ACTION}" type="submit">
                    Own Boundary
                  </button>
                  <button formAction="${NO_BOUNDARY_ACTION}" type="submit">
                    No Boundary
                  </button>
                  <button formAction="${HAS_BOUNDARY_NO_LOADER_OR_ACTION}" type="submit">
                    Has Boundary No Loader or Action
                  </button>
                  <button formAction="${NO_BOUNDARY_NO_LOADER_OR_ACTION}" type="submit">
                    No Boundary No Loader or Action
                  </button>
                </Form>

                <Link to="${HAS_BOUNDARY_LOADER}">
                  ${HAS_BOUNDARY_LOADER}
                </Link>
                <Link to="${NO_BOUNDARY_LOADER}">
                  ${NO_BOUNDARY_LOADER}
                </Link>
                <Link to="${HAS_BOUNDARY_RENDER}">
                  ${HAS_BOUNDARY_RENDER}
                </Link>
                <Link to="${NO_BOUNDARY_RENDER}">
                  ${NO_BOUNDARY_RENDER}
                </Link>
              </div>
            )
          }
        `,

        [`app/routes${HAS_BOUNDARY_ACTION}.jsx`]: js`
          import { Form } from "@remix-run/react";
          export async function action() {
            throw new Error("Kaboom!")
          }
          export function ErrorBoundary() {
            return <p id="own-boundary">${OWN_BOUNDARY_TEXT}</p>
          }
          export default function () {
            return (
              <Form method="post">
                <button type="submit" formAction="${HAS_BOUNDARY_ACTION}">
                  Go
                </button>
              </Form>
            );
          }
        `,

        [`app/routes${NO_BOUNDARY_ACTION}.jsx`]: js`
          import { Form } from "@remix-run/react";
          export function action() {
            throw new Error("Kaboom!")
          }
          export default function () {
            return (
              <Form method="post">
                <button type="submit" formAction="${NO_BOUNDARY_ACTION}">
                  Go
                </button>
              </Form>
            )
          }
        `,

        [`app/routes${HAS_BOUNDARY_LOADER}.jsx`]: js`
          export function loader() {
            throw new Error("Kaboom!")
          }
          export function ErrorBoundary() {
            return <div id="own-boundary">${OWN_BOUNDARY_TEXT}</div>
          }
          export default function () {
            return <div/>
          }
        `,

        [`app/routes${NO_BOUNDARY_LOADER}.jsx`]: js`
          export function loader() {
            throw new Error("Kaboom!")
          }
          export default function () {
            return <div/>
          }
        `,

        [`app/routes${NO_BOUNDARY_RENDER}.jsx`]: js`
          export default function () {
            throw new Error("Kaboom!")
            return <div/>
          }
        `,

        [`app/routes${HAS_BOUNDARY_RENDER}.jsx`]: js`
          export default function () {
            throw new Error("Kaboom!")
            return <div/>
          }

          export function ErrorBoundary() {
            return <div id="own-boundary">${OWN_BOUNDARY_TEXT}</div>
          }
        `,

        [`app/routes${HAS_BOUNDARY_NO_LOADER_OR_ACTION}.jsx`]: js`
          export function ErrorBoundary() {
            return <div id="boundary-no-loader-or-action">${OWN_BOUNDARY_TEXT}</div>
          }
          export default function Index() {
            return <div/>
          }
        `,

        [`app/routes${NO_BOUNDARY_NO_LOADER_OR_ACTION}.jsx`]: js`
          export default function Index() {
            return <div/>
          }
        `,

        "app/routes/fetcher-boundary.jsx": js`
          import { useFetcher } from "@remix-run/react";
          export function ErrorBoundary() {
            return <p id="fetcher-boundary">${OWN_BOUNDARY_TEXT}</p>
          }
          export default function() {
            let fetcher = useFetcher();

            return (
              <div>
                <fetcher.Form method="post">
                  <button formAction="${NO_BOUNDARY_NO_LOADER_OR_ACTION}" type="submit" />
                </fetcher.Form>
              </div>
            )
          }
        `,

        "app/routes/fetcher-no-boundary.jsx": js`
          import { useFetcher } from "@remix-run/react";
          export default function() {
            let fetcher = useFetcher();

            return (
              <div>
                <fetcher.Form method="post">
                  <button formAction="${NO_BOUNDARY_NO_LOADER_OR_ACTION}" type="submit">
                    No Loader or Action
                  </button>
                </fetcher.Form>
              </div>
            )
          }
        `,

        "app/routes/action.jsx": js`
          import { Outlet, useLoaderData } from "@remix-run/react";

          export function loader() {
            return "PARENT";
          }

          export default function () {
            return (
              <div>
                <p id="parent-data">{useLoaderData()}</p>
                <Outlet />
              </div>
            )
          }
        `,

        "app/routes/action/child-error.jsx": js`
          import { Form, useLoaderData } from "@remix-run/react";

          export function loader() {
            return "CHILD";
          }

          export function action() {
            throw new Error("Broken!");
          }

          export default function () {
            return (
              <>
                <p id="child-data">{useLoaderData()}</p>
                <Form method="post" reloadDocument={true}>
                  <button type="submit" name="key" value="value">
                    Submit
                  </button>
                </Form>
              </>
            )
          }

          export function ErrorBoundary({ error }) {
            return <p id="child-error">{error.message}</p>;
          }
        `,
      },
    });

    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(() => {
    console.error = _consoleError;
    appFixture.close();
  });

  test("invalid request methods", async () => {
    let res = await fixture.requestDocument("/", { method: "OPTIONS" });
    expect(res.status).toBe(405);
    expect(await res.text()).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("own boundary, action, document request", async () => {
    let params = new URLSearchParams();
    let res = await fixture.postDocument(HAS_BOUNDARY_ACTION, params);
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(OWN_BOUNDARY_TEXT);
  });

  test("own boundary, action, client transition from other route", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    await app.clickSubmitButton(HAS_BOUNDARY_ACTION);
    await page.waitForSelector(`text=${OWN_BOUNDARY_TEXT}`);
    expect(await app.getHtml("main")).toMatch(OWN_BOUNDARY_TEXT);
  });

  test("own boundary, action, client transition from itself", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto(HAS_BOUNDARY_ACTION);
    await app.clickSubmitButton(HAS_BOUNDARY_ACTION);
    await page.waitForSelector(`text=${OWN_BOUNDARY_TEXT}`);
    expect(await app.getHtml("main")).toMatch(OWN_BOUNDARY_TEXT);
  });

  test("bubbles to parent in action document requests", async () => {
    let params = new URLSearchParams();
    let res = await fixture.postDocument(NO_BOUNDARY_ACTION, params);
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("bubbles to parent in action script transitions from other routes", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    await app.clickSubmitButton(NO_BOUNDARY_ACTION);
    await page.waitForSelector(`text=${ROOT_BOUNDARY_TEXT}`);
    expect(await app.getHtml("main")).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("bubbles to parent in action script transitions from self", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto(NO_BOUNDARY_ACTION);
    await app.clickSubmitButton(NO_BOUNDARY_ACTION);
    await page.waitForSelector(`text=${ROOT_BOUNDARY_TEXT}`);
    expect(await app.getHtml("main")).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("own boundary, loader, document request", async () => {
    let res = await fixture.requestDocument(HAS_BOUNDARY_LOADER);
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(OWN_BOUNDARY_TEXT);
  });

  test("own boundary, loader, client transition", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    await app.clickLink(HAS_BOUNDARY_LOADER);
    await page.waitForSelector(`text=${OWN_BOUNDARY_TEXT}`);
    expect(await app.getHtml("main")).toMatch(OWN_BOUNDARY_TEXT);
  });

  test("bubbles to parent in loader document requests", async () => {
    let res = await fixture.requestDocument(NO_BOUNDARY_LOADER);
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("bubbles to parent in loader script transitions from other routes", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    await app.clickLink(NO_BOUNDARY_LOADER);
    await page.waitForSelector(`text=${ROOT_BOUNDARY_TEXT}`);
    expect(await app.getHtml("main")).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("ssr rendering errors with no boundary", async () => {
    let res = await fixture.requestDocument(NO_BOUNDARY_RENDER);
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("script transition rendering errors with no boundary", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    await app.clickLink(NO_BOUNDARY_RENDER);
    await page.waitForSelector(`text=${ROOT_BOUNDARY_TEXT}`);
    expect(await app.getHtml("main")).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("ssr rendering errors with boundary", async () => {
    let res = await fixture.requestDocument(HAS_BOUNDARY_RENDER);
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(OWN_BOUNDARY_TEXT);
  });

  test("script transition rendering errors with boundary", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    await app.clickLink(HAS_BOUNDARY_RENDER);
    await page.waitForSelector(`text=${OWN_BOUNDARY_TEXT}`);
    expect(await app.getHtml("main")).toMatch(OWN_BOUNDARY_TEXT);
  });

  test("uses correct error boundary on server action errors in nested routes", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto(`/action/child-error`);
    expect(await app.getHtml("#parent-data")).toMatch("PARENT");
    expect(await app.getHtml("#child-data")).toMatch("CHILD");
    await page.click("button[type=submit]");
    await page.waitForSelector("#child-error");
    // Preserves parent loader data
    expect(await app.getHtml("#parent-data")).toMatch("PARENT");
    expect(await app.getHtml("#child-error")).toMatch("Broken!");
  });

  test("renders own boundary in fetcher action submission without action from other routes", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/fetcher-boundary");
    await app.clickSubmitButton(NO_BOUNDARY_NO_LOADER_OR_ACTION);
    await page.waitForSelector("#fetcher-boundary");
  });

  test("renders root boundary in fetcher action submission without action from other routes", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/fetcher-no-boundary");
    await app.clickSubmitButton(NO_BOUNDARY_NO_LOADER_OR_ACTION);
    await page.waitForSelector(`text=${ROOT_BOUNDARY_TEXT}`);
  });

  test("renders root boundary in document POST without action requests", async () => {
    let res = await fixture.requestDocument(NO_BOUNDARY_NO_LOADER_OR_ACTION, {
      method: "post",
    });
    expect(res.status).toBe(405);
    expect(await res.text()).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("renders root boundary in action script transitions without action from other routes", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    await app.clickSubmitButton(NO_BOUNDARY_NO_LOADER_OR_ACTION);
    await page.waitForSelector(`text=${ROOT_BOUNDARY_TEXT}`);
  });

  test("renders own boundary in document POST without action requests", async () => {
    let res = await fixture.requestDocument(HAS_BOUNDARY_NO_LOADER_OR_ACTION, {
      method: "post",
    });
    expect(res.status).toBe(405);
    expect(await res.text()).toMatch(OWN_BOUNDARY_TEXT);
  });

  test("renders own boundary in action script transitions without action from other routes", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    await app.clickSubmitButton(HAS_BOUNDARY_NO_LOADER_OR_ACTION);
    await page.waitForSelector("#boundary-no-loader-or-action");
  });

  test.describe("if no error boundary exists in the app", () => {
    let NO_ROOT_BOUNDARY_LOADER = "/loader-bad";
    let NO_ROOT_BOUNDARY_ACTION = "/action-bad";
    let NO_ROOT_BOUNDARY_LOADER_RETURN = "/loader-no-return";
    let NO_ROOT_BOUNDARY_ACTION_RETURN = "/action-no-return";

    test.beforeAll(async () => {
      fixture = await createFixture({
        files: {
          "app/root.jsx": js`
            import { Links, Meta, Outlet, Scripts } from "@remix-run/react";

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
            import { Link, Form } from "@remix-run/react";

            export default function () {
              return (
                <div>
                  <h1>Home</h1>
                  <Link to="${NO_ROOT_BOUNDARY_LOADER_RETURN}">Loader no return</Link>
                  <Form method="post">
                    <button formAction="${NO_ROOT_BOUNDARY_ACTION}" type="submit">
                      Action go boom
                    </button>
                    <button formAction="${NO_ROOT_BOUNDARY_ACTION_RETURN}" type="submit">
                      Action no return
                    </button>
                  </Form>
                </div>
              )
            }
          `,

          [`app/routes${NO_ROOT_BOUNDARY_LOADER}.jsx`]: js`
            export async function loader() {
              throw Error("BLARGH");
            }

            export default function () {
              return (
                <div>
                  <h1>Hello</h1>
                </div>
              )
            }
          `,

          [`app/routes${NO_ROOT_BOUNDARY_ACTION}.jsx`]: js`
            export async function action() {
              throw Error("YOOOOOOOO WHAT ARE YOU DOING");
            }

            export default function () {
              return (
                <div>
                  <h1>Goodbye</h1>
                </div>
              )
            }
          `,

          [`app/routes${NO_ROOT_BOUNDARY_LOADER_RETURN}.jsx`]: js`
            import { useLoaderData } from "@remix-run/react";

            export async function loader() {}

            export default function () {
              let data = useLoaderData();
              return (
                <div>
                  <h1>{data}</h1>
                </div>
              )
            }
          `,

          [`app/routes${NO_ROOT_BOUNDARY_ACTION_RETURN}.jsx`]: js`
            import { useActionData } from "@remix-run/react";

            export async function action() {}

            export default function () {
              let data = useActionData();
              return (
                <div>
                  <h1>{data}</h1>
                </div>
              )
            }
          `,
        },
      });
      appFixture = await createAppFixture(fixture);
    });

    test("bubbles to internal boundary in loader document requests", async ({
      page,
    }) => {
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto(NO_ROOT_BOUNDARY_LOADER);
      expect(await app.getHtml("h1")).toMatch(INTERNAL_ERROR_BOUNDARY_HEADING);
    });

    test("bubbles to internal boundary in action script transitions from other routes", async ({
      page,
    }) => {
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/");
      await app.clickSubmitButton(NO_ROOT_BOUNDARY_ACTION);
      await page.waitForSelector(`text=${INTERNAL_ERROR_BOUNDARY_HEADING}`);
      expect(await app.getHtml("h1")).toMatch(INTERNAL_ERROR_BOUNDARY_HEADING);
    });

    test("bubbles to internal boundary if loader doesn't return (document requests)", async () => {
      let res = await fixture.requestDocument(NO_ROOT_BOUNDARY_LOADER_RETURN);
      expect(res.status).toBe(500);
      expect(await res.text()).toMatch(INTERNAL_ERROR_BOUNDARY_HEADING);
    });

    test("bubbles to internal boundary if loader doesn't return", async ({
      page,
    }) => {
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/");
      await app.clickLink(NO_ROOT_BOUNDARY_LOADER_RETURN);
      await page.waitForSelector(`text=${INTERNAL_ERROR_BOUNDARY_HEADING}`);
      expect(await app.getHtml("h1")).toMatch(INTERNAL_ERROR_BOUNDARY_HEADING);
    });

    test("bubbles to internal boundary if action doesn't return (document requests)", async () => {
      let res = await fixture.requestDocument(NO_ROOT_BOUNDARY_ACTION_RETURN, {
        method: "post",
      });
      expect(res.status).toBe(500);
      expect(await res.text()).toMatch(INTERNAL_ERROR_BOUNDARY_HEADING);
    });

    test("bubbles to internal boundary if action doesn't return", async ({
      page,
    }) => {
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/");
      await app.clickSubmitButton(NO_ROOT_BOUNDARY_ACTION_RETURN);
      await page.waitForSelector(`text=${INTERNAL_ERROR_BOUNDARY_HEADING}`);
      expect(await app.getHtml("h1")).toMatch(INTERNAL_ERROR_BOUNDARY_HEADING);
    });
  });
});

test.describe("loaderData in ErrorBoundary", () => {
  let fixture: Fixture;
  let appFixture: AppFixture;
  let consoleErrors: string[];
  let oldConsoleError: () => void;

  test.beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/root.jsx": js`
          import { Links, Meta, Outlet, Scripts } from "@remix-run/react";

          export default function Root() {
            return (
              <html lang="en">
                <head>
                  <Meta />
                  <Links />
                </head>
                <body>
                  <main>
                    <Outlet />
                  </main>
                  <Scripts />
                </body>
              </html>
            );
          }
        `,

        "app/routes/parent.jsx": js`
          import { Outlet, useLoaderData, useMatches } from "@remix-run/react";

          export function loader() {
            return "PARENT";
          }

          export default function () {
            return (
              <div>
                <p id="parent-data">{useLoaderData()}</p>
                <Outlet />
              </div>
            )
          }

          export function ErrorBoundary({ error }) {
            return (
              <>
                <p id="parent-data">{useLoaderData()}</p>
                <p id="parent-matches-data">
                  {useMatches().find(m => m.id === 'routes/parent').data}
                </p>
                <p id="parent-error">{error.message}</p>
              </>
            );
          }
        `,

        "app/routes/parent/child-with-boundary.jsx": js`
          import { Form, useLoaderData } from "@remix-run/react";

          export function loader() {
            return "CHILD";
          }

          export function action() {
            throw new Error("Broken!");
          }

          export default function () {
            return (
              <>
                <p id="child-data">{useLoaderData()}</p>
                <Form method="post">
                  <button type="submit" name="key" value="value">
                    Submit
                  </button>
                </Form>
              </>
            )
          }

          export function ErrorBoundary({ error }) {
            return (
              <>
                <p id="child-data">{useLoaderData()}</p>
                <p id="child-error">{error.message}</p>
              </>
            );
          }
        `,

        "app/routes/parent/child-without-boundary.jsx": js`
          import { Form, useLoaderData } from "@remix-run/react";

          export function loader() {
            return "CHILD";
          }

          export function action() {
            throw new Error("Broken!");
          }

          export default function () {
            return (
              <>
                <p id="child-data">{useLoaderData()}</p>
                <Form method="post">
                  <button type="submit" name="key" value="value">
                    Submit
                  </button>
                </Form>
              </>
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

  test.beforeEach(({ page }) => {
    oldConsoleError = console.error;
    console.error = () => {};
    consoleErrors = [];
    // Listen for all console events and handle errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(() => {
    console.error = oldConsoleError;
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });
    runBoundaryTests();
  });

  test.describe("with JavaScript", () => {
    test.use({ javaScriptEnabled: true });
    runBoundaryTests();
  });

  function runBoundaryTests() {
    test("Prevents useLoaderData in self ErrorBoundary", async ({
      page,
      javaScriptEnabled,
    }) => {
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/parent/child-with-boundary");

      expect(await app.getHtml("#parent-data")).toEqual(
        '<p id="parent-data">PARENT</p>'
      );
      expect(await app.getHtml("#child-data")).toEqual(
        '<p id="child-data">CHILD</p>'
      );
      expect(consoleErrors).toEqual([]);

      await app.clickSubmitButton("/parent/child-with-boundary");
      await page.waitForSelector("#child-error");

      expect(await app.getHtml("#child-error")).toEqual(
        '<p id="child-error">Broken!</p>'
      );
      expect(await app.getHtml("#parent-data")).toEqual(
        '<p id="parent-data">PARENT</p>'
      );
      expect(await app.getHtml("#child-data")).toEqual(
        '<p id="child-data"></p>'
      );

      // Only look for this message.  Chromium browsers will also log the
      // network error but firefox does not
      //   "Failed to load resource: the server responded with a status of 500 (Internal Server Error)",
      let msg =
        "You cannot `useLoaderData` in an errorElement (routeId: routes/parent/child-with-boundary)";
      if (javaScriptEnabled) {
        expect(consoleErrors.filter((m) => m === msg)).toEqual([msg]);
      } else {
        // We don't get the useLoaderData message in the client when JS is disabled
        expect(consoleErrors.filter((m) => m === msg)).toEqual([]);
      }
    });

    test("Prevents useLoaderData in bubbled ErrorBoundary", async ({
      page,
      javaScriptEnabled,
    }) => {
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/parent/child-without-boundary");

      expect(await app.getHtml("#parent-data")).toEqual(
        '<p id="parent-data">PARENT</p>'
      );
      expect(await app.getHtml("#child-data")).toEqual(
        '<p id="child-data">CHILD</p>'
      );
      expect(consoleErrors).toEqual([]);

      await app.clickSubmitButton("/parent/child-without-boundary");
      await page.waitForSelector("#parent-error");

      expect(await app.getHtml("#parent-error")).toEqual(
        '<p id="parent-error">Broken!</p>'
      );
      expect(await app.getHtml("#parent-matches-data")).toEqual(
        '<p id="parent-matches-data"></p>'
      );
      expect(await app.getHtml("#parent-data")).toEqual(
        '<p id="parent-data"></p>'
      );

      // Only look for this message.  Chromium browsers will also log the
      // network error but firefox does not
      //   "Failed to load resource: the server responded with a status of 500 (Internal Server Error)",
      let msg =
        "You cannot `useLoaderData` in an errorElement (routeId: routes/parent)";
      if (javaScriptEnabled) {
        expect(consoleErrors.filter((m) => m === msg)).toEqual([msg]);
      } else {
        // We don't get the useLoaderData message in the client when JS is disabled
        expect(consoleErrors.filter((m) => m === msg)).toEqual([]);
      }
    });
  }
});

test.describe("Default ErrorBoundary", () => {
  let fixture: Fixture;
  let appFixture: AppFixture;
  let _consoleError: any;

  function getFiles({
    includeRootErrorBoundary = false,
    rootErrorBoundaryThrows = false,
  } = {}) {
    let errorBoundaryCode = !includeRootErrorBoundary
      ? ""
      : rootErrorBoundaryThrows
      ? js`
      export function ErrorBoundary({ error }) {
        return (
          <html>
            <head />
            <body>
              <main>
                <div>Root Error Boundary</div>
                <p id="root-error-boundary">{error.message}</p>
                <p>{oh.no.what.have.i.done}</p>
              </main>
              <Scripts />
            </body>
          </html>
        )
      }
    `
      : js`
      export function ErrorBoundary({ error }) {
        return (
          <html>
            <head />
            <body>
              <main>
                <div>Root Error Boundary</div>
                <p id="root-error-boundary">{error.message}</p>
              </main>
              <Scripts />
            </body>
          </html>
        )
      }
    `;

    return {
      "app/root.jsx": js`
        import { Links, Meta, Outlet, Scripts } from "@remix-run/react";

        export default function Root() {
          return (
            <html lang="en">
              <head>
                <Meta />
                <Links />
              </head>
              <body>
                <main>
                  <Outlet />
                </main>
                <Scripts />
              </body>
            </html>
          );
        }

        ${errorBoundaryCode}
      `,

      "app/routes/index.jsx": js`
        import { Link } from "@remix-run/react";
        export default function () {
          return (
            <div>
              <h1 id="index">Index</h1>
              <Link to="/loader-error">Loader Error</Link>
              <Link to="/render-error">Render Error</Link>
            </div>
          );
        }
      `,

      "app/routes/loader-error.jsx": js`
        export function loader() {
          throw new Error('Loader Error');
        }
        export default function () {
          return <h1 id="loader-error">Loader Error</h1>
        }
      `,

      "app/routes/render-error.jsx": js`
        export default function () {
          throw new Error("Render Error")
        }
      `,
    };
  }

  test.beforeAll(async () => {
    _consoleError = console.error;
    console.error = () => {};
  });

  test.afterAll(async () => {
    console.error = _consoleError;
    await appFixture.close();
  });

  test.describe("When the root route does not have a boundary", () => {
    test.beforeAll(async () => {
      fixture = await createFixture({
        files: getFiles({ includeRootErrorBoundary: false }),
      });
      appFixture = await createAppFixture(fixture, ServerMode.Development);
    });

    test.afterAll(async () => {
      await appFixture.close();
    });

    test.describe("document requests", () => {
      test("renders default boundary on loader errors", async () => {
        let res = await fixture.requestDocument("/loader-error");
        expect(res.status).toBe(500);
        let text = await res.text();
        expect(text).toMatch("Application Error");
        expect(text).toMatch("Loader Error");
        expect(text).not.toMatch("Root Error Boundary");
      });

      test("renders default boundary on render errors", async () => {
        let res = await fixture.requestDocument("/render-error");
        expect(res.status).toBe(500);
        let text = await res.text();
        expect(text).toMatch("Application Error");
        expect(text).toMatch("Render Error");
        expect(text).not.toMatch("Root Error Boundary");
      });
    });

    test.describe("SPA navigations", () => {
      test("renders default boundary on loader errors", async ({ page }) => {
        let app = new PlaywrightFixture(appFixture, page);
        await app.goto("/");
        await app.clickLink("/loader-error");
        await page.waitForSelector("pre");
        let html = await app.getHtml();
        expect(html).toMatch("Application Error");
        expect(html).toMatch("Loader Error");
        expect(html).not.toMatch("Root Error Boundary");

        // Ensure we can click back to our prior page
        await app.goBack();
        await page.waitForSelector("h1#index");
      });

      test("renders default boundary on render errors", async ({
        page,
      }, workerInfo) => {
        let app = new PlaywrightFixture(appFixture, page);
        await app.goto("/");
        await app.clickLink("/render-error");
        await page.waitForSelector("pre");
        let html = await app.getHtml();
        expect(html).toMatch("Application Error");
        // Chromium seems to be the only one that includes the message in the stack
        if (workerInfo.project.name === "chromium") {
          expect(html).toMatch("Render Error");
        }
        expect(html).not.toMatch("Root Error Boundary");

        // Ensure we can click back to our prior page
        await app.goBack();
        await page.waitForSelector("h1#index");
      });
    });
  });

  test.describe("When the root route has a boundary", () => {
    test.beforeAll(async () => {
      fixture = await createFixture({
        files: getFiles({ includeRootErrorBoundary: true }),
      });
      appFixture = await createAppFixture(fixture, ServerMode.Development);
    });

    test.afterAll(async () => {
      await appFixture.close();
    });

    test.describe("document requests", () => {
      test("renders root boundary on loader errors", async () => {
        let res = await fixture.requestDocument("/loader-error");
        expect(res.status).toBe(500);
        let text = await res.text();
        expect(text).toMatch("Root Error Boundary");
        expect(text).toMatch("Loader Error");
        expect(text).not.toMatch("Application Error");
      });

      test("renders root boundary on render errors", async () => {
        let res = await fixture.requestDocument("/render-error");
        expect(res.status).toBe(500);
        let text = await res.text();
        expect(text).toMatch("Root Error Boundary");
        expect(text).toMatch("Render Error");
        expect(text).not.toMatch("Application Error");
      });
    });

    test.describe("SPA navigations", () => {
      test("renders root boundary on loader errors", async ({ page }) => {
        let app = new PlaywrightFixture(appFixture, page);
        await app.goto("/");
        await app.clickLink("/loader-error");
        await page.waitForSelector("#root-error-boundary");
        let html = await app.getHtml();
        expect(html).toMatch("Root Error Boundary");
        expect(html).toMatch("Loader Error");
        expect(html).not.toMatch("Application Error");

        // Ensure we can click back to our prior page
        await app.goBack();
        await page.waitForSelector("h1#index");
      });

      test("renders root boundary on render errors", async ({ page }) => {
        let app = new PlaywrightFixture(appFixture, page);
        await app.goto("/");
        await app.clickLink("/render-error");
        await page.waitForSelector("#root-error-boundary");
        let html = await app.getHtml();
        expect(html).toMatch("Root Error Boundary");
        expect(html).toMatch("Render Error");
        expect(html).not.toMatch("Application Error");

        // Ensure we can click back to our prior page
        await app.goBack();
        await page.waitForSelector("h1#index");
      });
    });
  });

  test.describe("When the root route has a boundary but it also throws 😦", () => {
    test.beforeAll(async () => {
      fixture = await createFixture({
        files: getFiles({
          includeRootErrorBoundary: true,
          rootErrorBoundaryThrows: true,
        }),
      });
      appFixture = await createAppFixture(fixture, ServerMode.Development);
    });

    test.afterAll(async () => {
      await appFixture.close();
    });

    test.describe("document requests", () => {
      test("tries to render root boundary on loader errors but bubbles to default boundary", async () => {
        let res = await fixture.requestDocument("/loader-error");
        expect(res.status).toBe(500);
        let text = await res.text();
        expect(text).toMatch("Unexpected Server Error");
        expect(text).not.toMatch("Application Error");
        expect(text).not.toMatch("Loader Error");
        expect(text).not.toMatch("Root Error Boundary");
      });

      test("tries to render root boundary on render errors but bubbles to default boundary", async () => {
        let res = await fixture.requestDocument("/render-error");
        expect(res.status).toBe(500);
        let text = await res.text();
        expect(text).toMatch("Unexpected Server Error");
        expect(text).not.toMatch("Application Error");
        expect(text).not.toMatch("Render Error");
        expect(text).not.toMatch("Root Error Boundary");
      });
    });

    test.describe("SPA navigations", () => {
      test("tries to render root boundary on loader errors but bubbles to default boundary", async ({
        page,
      }, workerInfo) => {
        let app = new PlaywrightFixture(appFixture, page);
        await app.goto("/");
        await app.clickLink("/loader-error");
        await page.waitForSelector("pre");
        let html = await app.getHtml();
        expect(html).toMatch("Application Error");
        if (workerInfo.project.name === "chromium") {
          expect(html).toMatch("ReferenceError: oh is not defined");
        }
        expect(html).not.toMatch("Loader Error");
        expect(html).not.toMatch("Root Error Boundary");

        // Ensure we can click back to our prior page
        await app.goBack();
        await page.waitForSelector("h1#index");
      });

      test("tries to render root boundary on render errors but bubbles to default boundary", async ({
        page,
      }, workerInfo) => {
        let app = new PlaywrightFixture(appFixture, page);
        await app.goto("/");
        await app.clickLink("/render-error");
        await page.waitForSelector("pre");
        let html = await app.getHtml();
        expect(html).toMatch("Application Error");
        if (workerInfo.project.name === "chromium") {
          expect(html).toMatch("ReferenceError: oh is not defined");
        }
        expect(html).not.toMatch("Render Error");
        expect(html).not.toMatch("Root Error Boundary");

        // Ensure we can click back to our prior page
        await app.goBack();
        await page.waitForSelector("h1#index");
      });
    });
  });
});
