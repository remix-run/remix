import path from "path";
import fsp from "fs/promises";
import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

let fixture: Fixture;

beforeAll(async () => {
  fixture = await createFixture({
    sourcemap: true,
    files: {
      "app/routes/index.jsx": js`
        import { json, useLoaderData } from "remix";

        export function loader() {
          try {
            throw new Error("💩");
          } catch (err) {
            return json(err.stack);
          }
        }

        export default function Index() {
          let data = useLoaderData();
          return (
            <pre>
              {data}
            </pre>
          )
        }
      `,
    },
  });
});

it("re-writes stack traces to point to the correct file", async () => {
  let buildIndex = await fsp.readFile(
    path.join(fixture.projectDir, "build/index.js"),
    "utf-8"
  );
  expect(buildIndex).toMatch("//# sourceMappingURL=index.js.map");
});
