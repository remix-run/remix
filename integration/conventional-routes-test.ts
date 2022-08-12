import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { createAppFixture, createFixture, js } from "./helpers/create-fixture";

let fixture: Fixture;
let appFixture: AppFixture;

let appFiles = {
  "app/routes/nested/index.jsx": js`
    import { Link, useMatches } from '@remix-run/react';
    export default function Index() {
      let matches = 'Number of Matches: ' + useMatches().length;
      return (
        <>
          <div>Index</div>
          <p>{matches}</p>
        </>
      )
    }
  `,
  "app/routes/nested/__pathless.jsx": js`
    import { Outlet } from "@remix-run/react";
    export default function Layout() {
      return (
        <>
          <div>Pathless Layout</div>
          <Outlet />
        </>
      );
    }
  `,
  "app/routes/nested/__pathless/foo.jsx": js`
    import { Link, useMatches } from '@remix-run/react';
    export default function Foo() {
      let matches = 'Number of Matches: ' + useMatches().length;
      return (
        <>
          <div>Foo</div>
          <p>{matches}</p>
        </>
      );
    }
  `,
};

test.describe("No JS", () => {
  test.beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/root.tsx": js`
          import { Link, Outlet } from "@remix-run/react";

          export default function App() {
            return (
              <html lang="en">
                <body>
                  <nav>
                    <Link to="/nested">/nested</Link>
                    <br />
                    <Link to="/nested/foo">/nested/foo</Link>
                    <br />
                  </nav>
                  <Outlet />
                </body>
              </html>
            );
          }
        `,
        ...appFiles,
      },
    });

    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(async () => appFixture.close());

  test("displays index page and links to the pathless layout page", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/nested");
    expect(await app.getHtml()).toMatch("Index");
    expect(await app.getHtml()).not.toMatch("Pathless Layout");
    // We should have an injected folder match here in addition to root.tsx +
    // routes/nested/index.tsx
    expect(await app.getHtml()).toMatch("Number of Matches: 3");

    await app.clickLink("/nested/foo");
    expect(await app.getHtml()).not.toMatch("Index");
    expect(await app.getHtml()).toMatch("Pathless Layout");
    expect(await app.getHtml()).toMatch("Foo");
    // We should have an injected folder match here in addition to root.tsx +
    // routes/nested/__pathless.tsx + routes/nested/__pathless/foo.tsx
    expect(await app.getHtml()).toMatch("Number of Matches: 4");
  });
});

test.describe("With JS", () => {
  test.beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/root.tsx": js`
          import { Link, Outlet, Scripts } from "@remix-run/react";

          export default function App() {
            return (
              <html lang="en">
                <body>
                  <nav>
                    <Link to="/nested">/nested</Link>
                    <br />
                    <Link to="/nested/foo">/nested/foo</Link>
                    <br />
                  </nav>
                  <Outlet />
                  <Scripts />
                </body>
              </html>
            );
          }
        `,
        ...appFiles,
      },
    });

    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(async () => appFixture.close());

  test("displays index page and links to the pathless layout page", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/nested");
    expect(await app.getHtml()).toMatch("Index");
    expect(await app.getHtml()).not.toMatch("Pathless Layout");
    // We should have an injected folder match here in addition to root.tsx +
    // routes/nested/index.tsx
    expect(await app.getHtml()).toMatch("Number of Matches: 3");

    await app.clickLink("/nested/foo");
    expect(await app.getHtml()).not.toMatch("Index");
    expect(await app.getHtml()).toMatch("Pathless Layout");
    expect(await app.getHtml()).toMatch("Foo");
    // We should have an injected folder match here in addition to root.tsx +
    // routes/nested/__pathless.tsx + routes/nested/__pathless/foo.tsx
    expect(await app.getHtml()).toMatch("Number of Matches: 4");
  });
});
