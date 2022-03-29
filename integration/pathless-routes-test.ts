import type { Fixture } from "./helpers/create-fixture";
import { createFixture, js } from "./helpers/create-fixture";

describe("rendering", () => {
  let fixture: Fixture;

  let PARENT_LAYOUT = "PARENT_LAYOUT";
  let CHILD_LAYOUT = "CHILD_LAYOUT";
  let CHILD = "CHILD";

  beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/root.jsx": js`
          import { Links, Meta, Outlet, Scripts } from "remix";
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

        "app/routes/__layout.jsx": js`
          import { Outlet } from "remix";
          export default function() {
            return (
              <div>
                <h2>${PARENT_LAYOUT}</h2>
                <Outlet/>
              </div>
            )
          }
        `,

        "app/routes/__layout/__layout.jsx": js`
          import { Outlet } from "remix";
          export default function() {
            return (
              <div>
                <h3>${CHILD_LAYOUT}</h3>
                <Outlet/>
              </div>
            )
          }
        `,

        "app/routes/__layout/__layout/test.jsx": js`
          export default function() {
            return <h4>${CHILD}</h4>;
          }
        `,
      },
    });
  });

  test("child exact match", async () => {
    let res = await fixture.requestDocument("/test");
    expect(await res.text()).toMatch(CHILD);
  });
});
