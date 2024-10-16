import { validateRouteConfig } from "../config/routes";

describe("validateRouteConfig", () => {
  it("validates a route config", () => {
    expect(
      validateRouteConfig({
        routeConfigFile: "routes.ts",
        routeConfig: [
          {
            path: "parent",
            file: "parent.tsx",
            children: [
              {
                path: "child",
                file: "child.tsx",
              },
            ],
          },
        ],
      }).valid
    ).toBe(true);
  });

  it("is invalid when not an array", () => {
    let result = validateRouteConfig({
      routeConfigFile: "routes.ts",
      routeConfig: { path: "path", file: "file.tsx" },
    });

    expect(result.valid).toBe(false);
    expect(!result.valid && result.message).toMatchInlineSnapshot(
      `"Route config in "routes.ts" must be an array."`
    );
  });

  it("is invalid when route is a promise", () => {
    let result = validateRouteConfig({
      routeConfigFile: "routes.ts",
      routeConfig: [
        {
          path: "parent",
          file: "parent.tsx",
          children: [Promise.resolve({})],
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(!result.valid && result.message).toMatchInlineSnapshot(`
        "Route config in "routes.ts" is invalid.

        Path: routes.0.children.0
        Invalid type: Expected object but received a promise. Did you forget to await?"
      `);
  });

  it("is invalid when file is missing", () => {
    let result = validateRouteConfig({
      routeConfigFile: "routes.ts",
      routeConfig: [
        {
          path: "parent",
          file: "parent.tsx",
          children: [
            {
              id: "child",
            },
          ],
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(!result.valid && result.message).toMatchInlineSnapshot(`
        "Route config in "routes.ts" is invalid.

        Path: routes.0.children.0.file
        Invalid type: Expected string but received undefined"
      `);
  });

  it("is invalid when property is wrong type", () => {
    let result = validateRouteConfig({
      routeConfigFile: "routes.ts",
      routeConfig: [
        {
          path: "parent",
          file: "parent.tsx",
          children: [
            {
              file: 123,
            },
          ],
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(!result.valid && result.message).toMatchInlineSnapshot(`
        "Route config in "routes.ts" is invalid.

        Path: routes.0.children.0.file
        Invalid type: Expected string but received 123"
      `);
  });

  it("shows multiple error messages", () => {
    let result = validateRouteConfig({
      routeConfigFile: "routes.ts",
      routeConfig: [
        {
          path: "parent",
          file: "parent.tsx",
          children: [
            {
              id: "child",
            },
            {
              file: 123,
            },
            Promise.resolve(),
          ],
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(!result.valid && result.message).toMatchInlineSnapshot(`
        "Route config in "routes.ts" is invalid.

        Path: routes.0.children.0.file
        Invalid type: Expected string but received undefined

        Path: routes.0.children.1.file
        Invalid type: Expected string but received 123

        Path: routes.0.children.2
        Invalid type: Expected object but received a promise. Did you forget to await?"
      `);
  });
});
