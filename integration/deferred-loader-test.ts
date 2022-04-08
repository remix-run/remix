import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

let fixture: Fixture;
let app: AppFixture;

beforeAll(async () => {
  fixture = await createFixture({
    files: {
      "app/routes/index.jsx": js`
        import { deferred } from "@remix-run/node";
        import { useLoaderData, Link } from "@remix-run/react";

        export function loader() {
          return deferred("pizza");
        }

        export default function Index() {
          let data = useLoaderData();
          return (
            <div>
              <Link to="/deferred">Deferred Route</Link>
              {data}
            </div>
          )
        }
      `,

      "app/routes/object.jsx": js`
        import { deferred } from "@remix-run/node";
        import { useLoaderData, Link } from "@remix-run/react";

        export function loader() {
          return deferred({data: "pizza"});
        }

        export default function Index() {
          let {data} = useLoaderData();
          return (
            <div>
              {data}
            </div>
          )
        }
      `,

      "app/routes/deferred.jsx": js`
        import * as React from "react";
        import { deferred } from "@remix-run/node";
        import { useLoaderData, Link, Deferred, useDeferredLoaderData } from "@remix-run/react";

        export function loader() {
          return deferred({
            foo: "pizza",
            bar: new Promise(async resolve => {
              await new Promise(resolve => setTimeout(resolve, 3000));
              resolve("hamburger");
            }),
          });
        }

        function DeferredComponent() {
          // TODO: change to useDeferred();
          let deferred = useDeferredLoaderData();
          console.log({deferred})
          return <div>{deferred}</div>;
        }

        export default function Index() {
          let {foo, bar} = useLoaderData();
          let [count, setCount] = React.useState(0);

          return (
            <div>
              {foo}
              <button onClick={() => setCount(count + 1)}>{count} Count</button>
              <Deferred data={bar}>
                <DeferredComponent />
              </Deferred>
            </div>
          )
        }
      `,
    },
  });

  app = await createAppFixture(fixture);
});

afterAll(async () => app.close());

it("works the same as json with no promise keys", async () => {
  let response = await fixture.requestDocument("/");
  expect(await response.text()).toMatch("pizza");

  response = await fixture.requestDocument("/object");
  expect(await response.text()).toMatch("pizza");
});

it("loads critical data first", async () => {
  await app.poke(120, "/deferred");
  let response = await fixture.requestDocument("/deferred");
  let text = await response.text();
  console.log(text);
  expect(text).toMatch("pizza");
  expect(text).toMatch('<div hidden id="S:1"><div>hamburger</div>');
  expect(text).toMatch(
    'window.__remixDeferredData["routes/deferred"]["deferred"]'
  );
}, 120_000);
