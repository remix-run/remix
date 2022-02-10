import { createFixture, createAppFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

describe("node-esm", () => {
  let fixture: Fixture;
  let app: AppFixture;

  beforeAll(async () => {
    fixture = await createFixture({
      server: "remix-esm",
      files: {
        "app/routes/index.jsx": js`
          export default function Index() {
            return <div id="index">Hello, World!</div>
          }
        `
      }
    });

    app = await createAppFixture(fixture);
  });

  afterAll(async () => {
    await app.close();
  });

  it("boots and renders in ESM mode", async () => {
    let res = await app.goto("/", true);
    expect(res.status()).toBe(200); // server rendered fine

    // rendered the page instead of the error boundary
    expect(await app.getHtml("#index")).toMatchInlineSnapshot(
      `"<div id=\\"index\\">Hello, World!</div>"`
    );
  });
});
