import http from "node:http";
import { setTimeout as wait } from "node:timers/promises";
import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import { type Fixture, type AppFixture, createAppFixture, createFixture, js } from "./helpers/create-fixture";
import { ServerMode } from "../packages/remix-server-runtime/mode";

let ports = {
  firefox: 10999,
  firefox_nojs: 11999,
  chromium: 10998,
  chromium_nojs: 11998,
  webkit: 10997,
  webkit_nojs: 11997,
  edge: 10996,
  edge_nojs: 11996,
} as const;

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

function runTest() {
  test("should fail with firefox with js enabled running in dev", async ({ page, javaScriptEnabled }, { project }) => {
    process.env.NODE_ENV = ServerMode.Development;
    let portKey = project.name;
    if (!javaScriptEnabled) {
      portKey += "_nojs";
    }
    let port = ports[portKey as keyof typeof ports];
    let fixture = await createFixture(
      {
        future: { v2_routeConvention: true },
        files: {
        "app/routes/race-condition.jsx": js`
          import { Form } from "@remix-run/react";
          export default function() {
            return (
              <>
                <Form method="post" action="/race-condition-action">
                  <button type="submit">Submit</button>
                </Form>
              </>
            )
          }
        `,
        "app/routes/race-condition-action.js": js`
          import { redirect } from "@remix-run/node";

          export async function loader() {
            return redirect("/race-condition");
          }

          export async function action() {
            return redirect("http://localhost:${port}/");
          }
        `,
        "app/routes/race-condition-callback.js": js`
          import { redirect } from "@remix-run/node";

          export async function loader() {
            return redirect("/race-condition-result?success=true");
          }
        `,
        "app/routes/race-condition-result.jsx": js`
          import { useSearchParams } from "@remix-run/react";

          export default function() {
            const [searchParams] = useSearchParams();

            return (
              <div>success = {searchParams.get("success") ?? "false"}</div>
            )
          }
        `,
      },
      },
	  ServerMode.Development,
    );
    let appFixture = await createAppFixture(fixture, ServerMode.Development);
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/race-condition");

    let baseUrl = page.url();
    let slowExternalServer = http.createServer(async (req, res) => {
      await wait(1000);
      res.writeHead(302, {
        "Location": baseUrl.replace("/race-condition", "/race-condition-callback"),
      });
      res.end();
    });
    slowExternalServer.listen(port);

    await app.clickSubmitButton("/race-condition-action", { wait: true });
    expect(page.url()).toMatch(/\/race-condition-result\?success=true$/);

    slowExternalServer.close();
    await appFixture.close();
  });
}

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

test.describe("with JS", () => {
  // it should fail only with firefox
  test.use({ javaScriptEnabled: true });
  runTest();
});

test.describe("without JS", () => {
  // no failure expected
  test.use({ javaScriptEnabled: false });
  runTest();
});


////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
