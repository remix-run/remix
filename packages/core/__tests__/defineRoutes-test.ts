import { defineRoutes } from "../routes";

describe("defineRoutes", () => {
  it("returns an array of routes", () => {
    let routes = defineRoutes(route => {
      route("/", "routes/home.js");
      route("inbox", "routes/inbox.js", () => {
        route("/", "routes/inbox/index.js");
        route(":messageId", "routes/inbox/$messageId.js");
        route("archive", "routes/inbox/archive.js");
      });
    });

    expect(routes).toMatchInlineSnapshot(`
      Array [
        Object {
          "id": "routes/home",
          "moduleFile": "routes/home.js",
          "path": "/",
        },
        Object {
          "children": Array [
            Object {
              "id": "routes/inbox/index",
              "moduleFile": "routes/inbox/index.js",
              "parentId": "routes/inbox",
              "path": "/",
            },
            Object {
              "id": "routes/inbox/$messageId",
              "moduleFile": "routes/inbox/$messageId.js",
              "parentId": "routes/inbox",
              "path": ":messageId",
            },
            Object {
              "id": "routes/inbox/archive",
              "moduleFile": "routes/inbox/archive.js",
              "parentId": "routes/inbox",
              "path": "archive",
            },
          ],
          "id": "routes/inbox",
          "moduleFile": "routes/inbox.js",
          "path": "inbox",
        },
      ]
    `);
  });

  it("works with async data", async () => {
    // Read everything *before* calling defineRoutes.
    let fakeDirectory = await Promise.resolve(["one.md", "two.md"]);
    let routes = defineRoutes(route => {
      for (let file of fakeDirectory) {
        route(file.replace(/\.md$/, ""), file);
      }
    });

    expect(routes).toMatchInlineSnapshot(`
      Array [
        Object {
          "id": "one",
          "moduleFile": "one.md",
          "path": "one",
        },
        Object {
          "id": "two",
          "moduleFile": "two.md",
          "path": "two",
        },
      ]
    `);
  });
});
