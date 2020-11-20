import { defineRoutes } from "../routes";

describe("defineRoutes", () => {
  it("returns an array of routes", () => {
    let routes = defineRoutes(route => {
      route("/", "routes/home.js", { loader: "routes/home.js" });
      route("inbox", "routes/inbox.js", () => {
        route("/", "routes/inbox/index.js");
        route(":messageId", "routes/inbox/$messageId.js", {
          loader: "routes/inbox/$messageId.js"
        });
        route("archive", "routes/inbox/archive.js", {
          loader: "routes/inbox/archive.js"
        });
      });
    });

    expect(routes).toMatchInlineSnapshot(`
      Array [
        Object {
          "componentFile": "routes/home.js",
          "id": "routes/home",
          "loaderFile": "routes/home.js",
          "path": "/",
        },
        Object {
          "children": Array [
            Object {
              "componentFile": "routes/inbox/index.js",
              "id": "routes/inbox/index",
              "parentId": "routes/inbox",
              "path": "/",
            },
            Object {
              "componentFile": "routes/inbox/$messageId.js",
              "id": "routes/inbox/$messageId",
              "loaderFile": "routes/inbox/$messageId.js",
              "parentId": "routes/inbox",
              "path": ":messageId",
            },
            Object {
              "componentFile": "routes/inbox/archive.js",
              "id": "routes/inbox/archive",
              "loaderFile": "routes/inbox/archive.js",
              "parentId": "routes/inbox",
              "path": "archive",
            },
          ],
          "componentFile": "routes/inbox.js",
          "id": "routes/inbox",
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
          "componentFile": "one.md",
          "id": "one",
          "path": "one",
        },
        Object {
          "componentFile": "two.md",
          "id": "two",
          "path": "two",
        },
      ]
    `);
  });
});
