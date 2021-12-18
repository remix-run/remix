import type { ServerBuild } from "../build";
import { createRequestHandler } from "../server";

describe("loaders", () => {
  // so that HTML/Fetch requests are the same, and so redirects don't hang on to
  // this param for no reason
  it("removes _data from request.url", async () => {
    const loader = async ({ request }) => {
      return new URL(request.url).search;
    };

    const routeId = "routes/random";
    const build = {
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

    const handler = createRequestHandler(build, {});

    const request = new Request(
      "http://example.com/random?_data=routes/random&foo=bar",
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    const res = await handler(request);
    expect(await res.json()).toMatchInlineSnapshot(`"?foo=bar"`);
  });

  it("sets header for throw responses", async () => {
    const loader = async ({ request }) => {
      throw new Response("null", {
        headers: {
          "Content-type": "application/json"
        }
      });
    };

    const routeId = "routes/random";
    const build = {
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

    const handler = createRequestHandler(build, {});

    const request = new Request(
      "http://example.com/random?_data=routes/random&foo=bar",
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    const res = await handler(request);
    expect(await res.headers.get("X-Remix-Catch")).toBeTruthy();
  });

  it("removes index from request.url", async () => {
    const loader = async ({ request }) => {
      return new URL(request.url).search;
    };

    const routeId = "routes/random";
    const build = {
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

    const handler = createRequestHandler(build, {});

    const request = new Request(
      "http://example.com/random?_data=routes/random&index&foo=bar",
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    const res = await handler(request);
    expect(await res.json()).toMatchInlineSnapshot(`"?foo=bar"`);
  });

  it("removes index from request.url and keeps other values", async () => {
    const loader = async ({ request }) => {
      return new URL(request.url).search;
    };

    const routeId = "routes/random";
    const build = {
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

    const handler = createRequestHandler(build, {});

    const request = new Request(
      "http://example.com/random?_data=routes/random&index&foo=bar&index=test",
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    const res = await handler(request);
    expect(await res.json()).toMatchInlineSnapshot(`"?foo=bar&index=test"`);
  });
});
