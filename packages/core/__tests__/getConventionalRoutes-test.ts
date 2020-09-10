import path from "path";

import { getConventionalRoutes } from "../routes";

describe("getConventionalRoutes", () => {
  it("returns an array of routes from the file system", async () => {
    let routes = await getConventionalRoutes(
      path.resolve(__dirname, "../__fixtures__/routes"),
      path.resolve(__dirname, "../__fixtures__/loaders")
    );

    expect(routes).toMatchInlineSnapshot(`
      Array [
        Object {
          "component": "routes/$courseId.$chapterId.js",
          "id": "routes/$courseId.$chapterId",
          "loader": "$courseId.$chapterId.js",
          "parentId": undefined,
          "path": ":courseId/:chapterId",
        },
        Object {
          "component": "routes/$courseId.js",
          "id": "routes/$courseId",
          "loader": null,
          "parentId": undefined,
          "path": ":courseId",
        },
        Object {
          "children": Array [
            Object {
              "component": "routes/checkout/index.js",
              "id": "routes/checkout/index",
              "loader": "checkout/index.js",
              "parentId": "routes/checkout",
              "path": "/",
            },
            Object {
              "component": "routes/checkout/payment.js",
              "id": "routes/checkout/payment",
              "loader": "checkout/payment.js",
              "parentId": "routes/checkout",
              "path": "payment",
            },
          ],
          "component": "routes/checkout.js",
          "id": "routes/checkout",
          "loader": null,
          "parentId": undefined,
          "path": "checkout",
        },
        Object {
          "component": "routes/index.js",
          "id": "routes/index",
          "loader": "index.js",
          "parentId": undefined,
          "path": "/",
        },
        Object {
          "children": Array [
            Object {
              "component": "routes/messages/$message.js",
              "id": "routes/messages/$message",
              "loader": "messages/$message.ts",
              "parentId": "$OUTLET$",
              "path": ":message",
            },
            Object {
              "component": "routes/messages/index.js",
              "id": "routes/messages/index",
              "loader": null,
              "parentId": "$OUTLET$",
              "path": "/",
            },
          ],
          "component": "$OUTLET$",
          "id": "$OUTLET$",
          "loader": null,
          "parentId": undefined,
          "path": "messages",
        },
      ]
    `);
  });
});
