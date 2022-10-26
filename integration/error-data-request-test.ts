import { test, expect } from "@playwright/test";

import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

test.describe("ErrorBoundary", () => {
  let fixture: Fixture;
  let appFixture: AppFixture;
  let _consoleError: any;

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
            return <h1>Index</h1>
          }
        `,

        [`app/routes/loader-throw-error.jsx`]: js`
          export async function loader() {
            throw Error("BLARGH");
          }

          export default function () {
              return <h1>Hello</h1>
          }
        `,

        [`app/routes/loader-return-json.jsx`]: js`
          import { json } from "@remix-run/server-runtime";

          export async function loader() {
            return json({ ok: true });
          }

          export default function () {
              return <h1>Hello</h1>
          }
        `,

        [`app/routes/action-throw-error.jsx`]: js`
          export async function action() {
            throw Error("YOOOOOOOO WHAT ARE YOU DOING");
          }

          export default function () {
            return <h1>Goodbye</h1>;
          }
        `,

        [`app/routes/action-return-json.jsx`]: js`
          import { json } from "@remix-run/server-runtime";

          export async function action() {
            return json({ ok: true });
          }

          export default function () {
            return <h1>Hi!</h1>
          }
        `,
      },
    });
    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(async () => {
    console.error = _consoleError;
    await appFixture.close();
  });

  /**
   * TODO
   * end state
   *  - thrown 4xx responses go to catch
   *    - user thrown and router thrown
   *  - thrown 5xx responses go to catch
   *    - user thrown go to catch
   *    - router thrown go to catch - we don't have any of these use cases currently
   *  - thrown non responses go to error
   *
   * - Make test cases align to above
   * - Change remix code as needed
   * - Can we remove X-Remix-Router-Error header entirely?
   * - Fork off a callRouteLoaderRR and callRouteActionRR function for simplicity
   *
   * Eventually in user error boundaries (remix v2)
   *  - thrown ANYTHING goes to errorElement
   *    if (useRouteError() instanceof Response) {
   *      <CatchBoundary>
   *    } else {
   *      <ErrorBoundary>
   *    }
   */

  // test.skip(
  //   "returns a 500 x-remix-error on a data fetch to a path with no loader"
  // );
  // test.skip("returns a 405 x-remix-error on a data fetch with a bad method");
  // test.skip("returns a 404 x-remix-error on a data fetch to a bad path");
  // test.skip("returns a 403 x-remix-error on a data fetch to a bad routeId");

  test("returns a 500 x-remix-error on a data fetch to a path with no loader", async () => {
    let response = await fixture.requestData("/", "routes/index");
    expect(response.status).toBe(500);
    expect(response.headers.get("X-Remix-Error")).toBe("yes");
    expect(await response.text()).toMatch("Unexpected Server Error");
  });

  test("returns a 405 x-remix-catch on a data fetch POST to a path with no action", async () => {
    let response = await fixture.requestData("/", "routes/index", {
      method: "POST",
    });
    expect(response.status).toBe(405);
    expect(response.headers.get("X-Remix-Catch")).toBe("yes");
    expect(await response.text()).toBe("");
  });

  test("returns a 405 x-remix-error on a data fetch with a bad method", async () => {
    let response = await fixture.requestData(
      `/loader-return-json`,
      "routes/loader-return-json",
      {
        method: "OPTIONS",
      }
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("X-Remix-Error")).toBe("yes");
    expect(await response.text()).toMatch(
      'Invalid request method \\"OPTIONS\\"'
    );
  });

  // test("returns a 405 x-remix-error on a data fetch POST with a bad method", async () => {
  //   let response = await fixture.requestData(
  //     `/${NO_ROOT_BOUNDARY_ACTION}`,
  //     NO_ROOT_BOUNDARY_ACTION,
  //     {
  //       method: "POST",
  //     }
  //   );
  //   expect(response.status).toBe(405);
  //   expect(response.headers.get("X-Remix-Catch")).toBe("yes");
  // });

  // test("returns a 403 x-remix-error on a data fetch GET to a bad path", async () => {
  //   // just headers content-type mismatch but differs from POST below
  //   let response = await fixture.requestData(
  //     "/",
  //     `routes${NO_ROOT_BOUNDARY_LOADER}`
  //   );
  //   expect(response.status).toBe(403);
  //   expect(response.headers.get("X-Remix-Error")).toBe("yes");
  // });

  // test("returns a 405 x-remix-catch on a data fetch POST to a bad path", async () => {
  //   let response = await fixture.requestData(
  //     "/",
  //     `routes${NO_ROOT_BOUNDARY_LOADER}`,
  //     {
  //       method: "POST",
  //     }
  //   );
  //   expect(response.status).toBe(405);
  //   // This is a catch today and differs from above
  //   expect(response.headers.get("X-Remix-Catch")).toBe("yes");
  // });
});
