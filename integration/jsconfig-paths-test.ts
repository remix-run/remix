import { test, expect } from "@playwright/test";

import { createFixture, js, json, mdx } from "./helpers/create-fixture";
import type { Fixture } from "./helpers/create-fixture";

let fixture: Fixture;

test.beforeAll(async () => {
  fixture = await createFixture({
    files: {
      "app/components/my-lib/index.js": js`
        export const pizza = "this is a pizza";
      `,

      "app/routes/index.jsx": js`
        import { pizza } from "@mylib";
        import { json } from "@remix-run/node";
        import { useLoaderData, Link } from "@remix-run/react";

        export function loader() {
          return json(pizza);
        }

        export default function Index() {
          let data = useLoaderData();
          return (
            <div>
              {data}
            </div>
          )
        }
      `,

      "app/routes/tilde-alias.jsx": js`
        import { pizza } from "~/components/my-lib";
        import { json } from "@remix-run/node";
        import { useLoaderData, Link } from "@remix-run/react";

        export function loader() {
          return json(pizza);
        }

        export default function Index() {
          let data = useLoaderData();
          return (
            <div>
              {data}
            </div>
          )
        }
      `,

      "app/components/component.jsx": js`
        export function PizzaComponent() {
          return <span>this is a pizza</span>
        }
      `,

      "app/routes/mdx.mdx": mdx`
        ---
        meta:
          title: My First Post
          description: Isn't this awesome?
        headers:
          Cache-Control: no-cache
        ---

        import { PizzaComponent } from "@component";

        # Hello MDX!

        This is my first post.

        <PizzaComponent />
      `,

      "jsconfig.json": json({
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "~/*": ["./app/*"],
            "@mylib": ["./app/components/my-lib/index"],
            "@component": ["./app/components/component.jsx"],
          },
        },
      }),
    },
  });
});

test("import internal library via ~ alias", async () => {
  let response = await fixture.requestDocument("/tilde-alias");
  expect(await response.text()).toMatch("this is a pizza");
});

test("import internal library via alias other than ~", async () => {
  let response = await fixture.requestDocument("/");
  expect(await response.text()).toMatch("this is a pizza");
});

test("works for mdx files", async () => {
  let response = await fixture.requestDocument("/mdx");
  expect(await response.text()).toMatch("this is a pizza");
});
