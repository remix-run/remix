import defineRoutes from "../defineRoutes";

describe("defineRoutes", () => {
  it("returns an array of routes", () => {
    let routes = defineRoutes(route => {
      route("/", "routes/home.js", "home.js");
      route("inbox", "routes/messages.js", () => {
        route("/", "routes/message-index.js");
        route(":message", "routes/message.js", "message.js");
        route("archive", "routes/archive.js", "archive.js");
      });
    });

    expect(routes).toMatchInlineSnapshot(`
      Array [
        Object {
          "component": "routes/home.js",
          "id": "routes/home",
          "loader": "home.js",
          "parentId": null,
          "path": "/",
        },
        Object {
          "children": Array [
            Object {
              "component": "routes/message-index.js",
              "id": "routes/message-index",
              "loader": null,
              "parentId": "routes/messages",
              "path": "/",
            },
            Object {
              "component": "routes/message.js",
              "id": "routes/message",
              "loader": "message.js",
              "parentId": "routes/messages",
              "path": ":message",
            },
            Object {
              "component": "routes/archive.js",
              "id": "routes/archive",
              "loader": "archive.js",
              "parentId": "routes/messages",
              "path": "archive",
            },
          ],
          "component": "routes/messages.js",
          "id": "routes/messages",
          "loader": null,
          "parentId": null,
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
          "component": "one.md",
          "id": "one",
          "loader": null,
          "parentId": null,
          "path": "one",
        },
        Object {
          "component": "two.md",
          "id": "two",
          "loader": null,
          "parentId": null,
          "path": "two",
        },
      ]
    `);
  });
});
