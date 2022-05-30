import { test, expect } from "@playwright/test";

import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { createAppFixture, createFixture, js } from "./helpers/create-fixture";

let fixture: Fixture;
let appFixture: AppFixture;

const TEXTS = {
  SLUG_LAYOUT: "Layout: slug",
  FOO_LAYOUT: "Layout: foo",
  FOO_CHILD: "deep foo",
  SLUG_CHILD: "Slug index from foo layout",
  BAR_LAYOUT: "Layout: foo",
  BAR_CHILD: "deep bar",
} as const

test.beforeAll(async () => {
  fixture = await createFixture({
    files: {
      "app/routes/slug.jsx": js`
        import { Outlet } from "@remix-run/react";
        export default () => {
          return (
            <div>
              <h1>${TEXTS.SLUG_LAYOUT}</h1>
              <Outlet/>
            </div>
          )
        }
      `,
      "app/routes/slug/__foo.jsx": js`
        import { Outlet } from "@remix-run/react";
        export default () => {
          return (
            <div>
              <h2>${TEXTS.FOO_LAYOUT}</h2>
              <Outlet/>
            </div>
          )
        }
      `,
      "app/routes/slug/__foo/foo.jsx": js`
        export default () => <h3>${TEXTS.FOO_CHILD}</h3>;
      `,
      "app/routes/slug/__foo/index.jsx": js`
        export default () => <h3>${TEXTS.SLUG_CHILD}</h3>;
      `,
      "app/routes/slug/__bar.jsx": js`
        import { Outlet } from "@remix-run/react";
        export default () => {
          return (
            <div>
              <h2>${TEXTS.BAR_LAYOUT}</h2>
              <Outlet/>
            </div>
          )
        }
      `,
      "app/routes/slug/__bar/bar.jsx": js`
        export default () => <h3>${TEXTS.BAR_CHILD}</h3>;
      `,
    },
  });

  appFixture = await createAppFixture(fixture);
});

test.afterAll(async () => appFixture.close());

test("slug index & foo layout", async () => {
  let res = await fixture.requestDocument("/slug");
  let text = await res.text();
  expect(text).toMatch(TEXTS.SLUG_LAYOUT);
  expect(text).toMatch(TEXTS.FOO_LAYOUT);
  expect(text).toMatch(TEXTS.SLUG_LAYOUT);
});

test("foo layout", async () => {
  let res = await fixture.requestDocument("/slug/foo");
  let text = await res.text();
  expect(text).toMatch(TEXTS.FOO_LAYOUT);
  expect(text).toMatch(TEXTS.FOO_CHILD);
});

test("bar layout", async () => {
  let res = await fixture.requestDocument("/slug/bar");
  let text = await res.text();
  expect(text).toMatch(TEXTS.BAR_LAYOUT);
  expect(text).toMatch(TEXTS.BAR_CHILD);
});
