import { defineRoutes } from "../routes";

describe("defineRoutes", () => {
  it("returns an array of routes", () => {
    let routes = defineRoutes(route => {
      route("/", "routes/home.js", { loader: "home.js" });
      route("inbox", "routes/messages.js", () => {
        route("/", "routes/message-index.js");
        route(":message", "routes/message.js", { loader: "message.js" });
        route("archive", "routes/archive.js", { loader: "archive.js" });
      });
    });

    expect(routes).toMatchInlineSnapshot(`
      Array [
        Object {
          "componentFile": "routes/home.js",
          "id": "routes/home",
          "loaderFile": "home.js",
          "path": "/",
        },
        Object {
          "children": Array [
            Object {
              "componentFile": "routes/message-index.js",
              "id": "routes/message-index",
              "parentId": "routes/messages",
              "path": "/",
            },
            Object {
              "componentFile": "routes/message.js",
              "id": "routes/message",
              "loaderFile": "message.js",
              "parentId": "routes/messages",
              "path": ":message",
            },
            Object {
              "componentFile": "routes/archive.js",
              "id": "routes/archive",
              "loaderFile": "archive.js",
              "parentId": "routes/messages",
              "path": "archive",
            },
          ],
          "componentFile": "routes/messages.js",
          "id": "routes/messages",
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
