import type { ServerBuild } from "../build";
import { createRequestHandler } from "../server";

describe("loaders", () => {
  // so that HTML/Fetch requests are the same, and so redirects don't hang on to
  // this param for no reason
  it("removes _data from request.url", async () => {
    let loader = async ({ request }) => {
      return new URL(request.url).search;
    };

    let routeId = "routes/random";
    let build = {
      routes: {
        [routeId]: {
          id: routeId,
          path: "/random",
          module: {
            loader
          }
        }
      },
      entry: { module: {} }
    } as unknown as ServerBuild;

    let handler = createRequestHandler(build, {});

    let request = new Request(
      "http://example.com/random?_data=routes/random&foo=bar",
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    let res = await handler(request);
    expect(await res.json()).toMatchInlineSnapshot(`"?foo=bar"`);
  });

  it("sets header for thrown responses", async () => {
    let loader = async ({ request }) => {
      throw new Response(null, {
        headers: {
          "Content-type": "application/json"
        }
      });
    };

    let routeId = "routes/random";
    let build = {
      routes: {
        [routeId]: {
          id: routeId,
          path: "/random",
          module: {
            loader
          }
        }
      },
      entry: { module: {} }
    } as unknown as ServerBuild;

    let handler = createRequestHandler(build, {});

    let request = new Request(
      "http://example.com/random?_data=routes/random&foo=bar",
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    let res = await handler(request);
    expect(await res.headers.get("X-Remix-Catch")).toBeTruthy();
  });

  it("doesn't set header for thrown 304 responses", async () => {
    let loader = async ({ request }) => {
      throw new Response(null, {
        status: 304,
        headers: {
          "Content-type": "application/json"
        }
      });
    };

    let routeId = "routes/random";
    let build = {
      routes: {
        [routeId]: {
          id: routeId,
          path: "/random",
          module: {
            loader
          }
        }
      },
      entry: { module: {} }
    } as unknown as ServerBuild;

    let handler = createRequestHandler(build, {});

    let request = new Request(
      "http://example.com/random?_data=routes/random&foo=bar",
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    let res = await handler(request);
    expect(await res.headers.get("X-Remix-Catch")).toBeFalsy();
  });

  it("removes index from request.url", async () => {
    let loader = async ({ request }) => {
      return new URL(request.url).search;
    };

    let routeId = "routes/random";
    let build = {
      routes: {
        [routeId]: {
          id: routeId,
          path: "/random",
          module: {
            loader
          }
        }
      },
      entry: { module: {} }
    } as unknown as ServerBuild;

    let handler = createRequestHandler(build, {});

    let request = new Request(
      "http://example.com/random?_data=routes/random&index&foo=bar",
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    let res = await handler(request);
    expect(await res.json()).toMatchInlineSnapshot(`"?foo=bar"`);
  });

  it("removes index from request.url and keeps other values", async () => {
    let loader = async ({ request }) => {
      return new URL(request.url).search;
    };

    let routeId = "routes/random";
    let build = {
      routes: {
        [routeId]: {
          id: routeId,
          path: "/random",
          module: {
            loader
          }
        }
      },
      entry: { module: {} }
    } as unknown as ServerBuild;

    let handler = createRequestHandler(build, {});

    let request = new Request(
      "http://example.com/random?_data=routes/random&index&foo=bar&index=test",
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    let res = await handler(request);
    expect(await res.json()).toMatchInlineSnapshot(`"?foo=bar&index=test"`);
  });
});
