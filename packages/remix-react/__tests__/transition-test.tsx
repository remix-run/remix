import { Action, parsePath } from "history";
import type { Location, State } from "history";

import type { Submission, TransitionManagerInit } from "../transition";
import {
  CatchValue,
  createTransitionManager,
  TransitionRedirect,
  IDLE_FETCHER,
  IDLE_TRANSITION
} from "../transition";

describe("init", () => {
  it("initializes with initial values", async () => {
    let tm = createTransitionManager({
      routes: [
        {
          element: {},
          id: "root",
          path: "/",
          ErrorBoundary: {},
          module: "",
          hasLoader: false
        }
      ],
      location: createLocation("/"),
      loaderData: { root: "LOADER DATA" },
      actionData: { root: "ACTION DATA" },
      error: new Error("lol"),
      errorBoundaryId: "root",
      onChange: () => {},
      onRedirect: () => {}
    });
    expect(tm.getState()).toMatchInlineSnapshot(`
      Object {
        "actionData": Object {
          "root": "ACTION DATA",
        },
        "catch": undefined,
        "catchBoundaryId": null,
        "error": [Error: lol],
        "errorBoundaryId": "root",
        "fetchers": Map {},
        "loaderData": Object {
          "root": "LOADER DATA",
        },
        "location": Object {
          "hash": "",
          "key": "1",
          "pathname": "/",
          "search": "",
          "state": null,
        },
        "matches": Array [
          Object {
            "params": Object {},
            "pathname": "/",
            "route": Object {
              "ErrorBoundary": Object {},
              "element": Object {},
              "hasLoader": false,
              "id": "root",
              "module": "",
              "path": "/",
            },
          },
        ],
        "nextMatches": undefined,
        "transition": Object {
          "location": undefined,
          "state": "idle",
          "submission": undefined,
          "type": "idle",
        },
      }
    `);
  });
});

describe("normal navigation", () => {
  it("fetches data on navigation", async () => {
    let t = setup();
    let A = t.navigate.get("/foo");
    await A.loader.resolve("FOO");
    expect(t.getState().loaderData).toMatchInlineSnapshot(`
      Object {
        "foo": "FOO",
        "root": "ROOT",
      }
    `);
  });

  it("allows `null` as a valid data value", async () => {
    let t = setup();
    let A = t.navigate.get("/foo");
    await A.loader.resolve(null);
    expect(t.getState().loaderData.foo).toBe(null);
  });

  it("does not fetch unchanging layout data", async () => {
    let t = setup();
    let A = t.navigate.get("/foo");
    await A.loader.resolve("FOO");
    expect(t.rootLoaderMock.calls.length).toBe(0);
    expect(t.getState().loaderData.root).toBe("ROOT");
  });

  it("reloads all routes on search changes", async () => {
    let t = setup();
    let A = t.navigate.get("/foo?q=1");
    await A.loader.resolve("1");
    expect(t.rootLoaderMock.calls.length).toBe(1);
    expect(t.getState().loaderData.foo).toBe("1");

    let B = t.navigate.get("/foo?q=2");
    await B.loader.resolve("2");
    expect(t.rootLoaderMock.calls.length).toBe(2);
    expect(t.getState().loaderData.foo).toBe("2");
  });

  it("reloads only routes with changed params", async () => {
    let t = setup();

    let A = t.navigate.get("/p/one");
    await A.loader.resolve("one");
    expect(t.rootLoaderMock.calls.length).toBe(0);
    expect(t.getState().loaderData.param).toBe("one");

    let B = t.navigate.get("/p/two");
    await B.loader.resolve("two");
    expect(t.rootLoaderMock.calls.length).toBe(0);
    expect(t.getState().loaderData.param).toBe("two");
  });

  it("reloads all routes on refresh", async () => {
    let t = setup();
    let url = "/p/same";

    let A = t.navigate.get(url);
    await A.loader.resolve("1");
    expect(t.rootLoaderMock.calls.length).toBe(0);
    expect(t.getState().loaderData.param).toBe("1");

    let B = t.navigate.get(url);
    await B.loader.resolve("2");
    expect(t.rootLoaderMock.calls.length).toBe(1);
    expect(t.getState().loaderData.param).toBe("2");
  });

  it("does not load anything on hash change only", async () => {
    let t = setup();
    t.navigate.get("/#bar");
    expect(t.rootLoaderMock.calls.length).toBe(0);
  });

  it("sets all right states on hash change only", async () => {
    let t = setup();
    t.navigate.get("/#bar");
    expect(t.getState().location.hash).toBe("");
    expect(t.getState().transition.state).toBe("loading");
    expect(t.getState().transition.location.hash).toBe("#bar");
    // await the internal forced async state
    await Promise.resolve();
    expect(t.getState().location.hash).toBe("#bar");
    expect(t.getState().transition.state).toBe("idle");
    expect(t.getState().location.hash).toBe("#bar");
  });

  it("loads new data on new routes even if there's also a hash change", async () => {
    let t = setup();
    let A = t.navigate.get("/foo#bar");
    await A.loader.resolve("A");
    expect(t.getState().loaderData.foo).toBe("A");
  });

  it("redirects from loaders", async () => {
    let t = setup();

    let A = t.navigate.get("/bar");
    let B = await A.loader.redirect("/baz");
    expect(t.getState().transition.type).toBe("normalRedirect");
    expect(t.getState().transition.location).toBe(B.location);

    await B.loader.resolve("B");
    expect(t.getState().location).toBe(B.location);
    expect(t.getState().loaderData.baz).toBe("B");
  });
});

describe("shouldReload", () => {
  it("delegates to the route if it should reload or not", async () => {
    let rootLoader = jest.fn();
    let childLoader = jest.fn(() => "CHILD");
    let shouldReload = jest.fn(({ url, prevUrl, submission }) => {
      return url.searchParams.get("reload") === "1";
    });
    let tm = createTestTransitionManager("/", {
      loaderData: {
        "/": "ROOT"
      },
      routes: [
        {
          path: "",
          id: "root",
          hasLoader: true,
          loader: rootLoader,
          shouldReload,
          element: {},
          module: "",
          children: [
            {
              path: "/",
              id: "index",
              action: () => null,
              element: {},
              module: "",
              hasLoader: false
            },
            {
              path: "/child",
              id: "child",
              hasLoader: true,
              loader: childLoader,
              action: () => null,
              element: {},
              module: ""
            }
          ]
        }
      ]
    });

    await tm.send({
      type: "navigation",
      location: createLocation("/child?reload=1"),
      action: Action.Push
    });
    expect(rootLoader.mock.calls.length).toBe(1);

    await tm.send({
      type: "navigation",
      location: createLocation("/child?reload=0"),
      action: Action.Push
    });
    expect(rootLoader.mock.calls.length).toBe(1);

    await tm.send({
      type: "navigation",
      location: createLocation("/child"),
      submission: createActionSubmission("/child"),
      action: Action.Push
    });

    let args = shouldReload.mock.calls[2][0];
    expect(args).toMatchInlineSnapshot(`
      Object {
        "params": Object {},
        "prevUrl": "http://localhost/child?reload=0",
        "submission": Object {
          "action": "/child",
          "encType": "application/x-www-form-urlencoded",
          "formData": FormData {},
          "key": "1",
          "method": "POST",
        },
        "url": "http://localhost/child",
      }
    `);
  });
});

describe("no route match", () => {
  it("transitions to root catch", async () => {
    let t = setup();
    t.navigate.get("/not-found");
    let state = t.getState();
    expect(t.getState().location.hash).toBe("");
    expect(t.getState().transition.state).toBe("loading");

    // await the internal forced async state
    await Promise.resolve();

    state = t.getState();
    expect(state.catchBoundaryId).toBe("root");
    expect(state.catch).toEqual({
      data: null,
      status: 404,
      statusText: "Not Found"
    });
    expect(state.matches).toMatchInlineSnapshot(`
      Array [
        Object {
          "params": Object {},
          "pathname": "",
          "route": Object {
            "CatchBoundary": [Function],
            "ErrorBoundary": [Function],
            "children": Array [
              Object {
                "action": [MockFunction],
                "element": Object {},
                "hasLoader": true,
                "id": "index",
                "loader": [MockFunction],
                "module": "",
                "path": "/",
              },
              Object {
                "action": [MockFunction],
                "element": Object {},
                "hasLoader": true,
                "id": "foo",
                "loader": [MockFunction],
                "module": "",
                "path": "/foo",
              },
              Object {
                "action": [MockFunction],
                "element": Object {},
                "hasLoader": true,
                "id": "bar",
                "loader": [MockFunction],
                "module": "",
                "path": "/bar",
              },
              Object {
                "action": [MockFunction],
                "element": Object {},
                "hasLoader": true,
                "id": "baz",
                "loader": [MockFunction],
                "module": "",
                "path": "/baz",
              },
              Object {
                "action": [MockFunction],
                "element": Object {},
                "hasLoader": true,
                "id": "param",
                "loader": [MockFunction],
                "module": "",
                "path": "/p/:param",
              },
            ],
            "element": Object {},
            "hasLoader": true,
            "id": "root",
            "loader": [MockFunction],
            "module": "",
            "path": "",
          },
        },
      ]
    `);
  });
});

describe("errors on navigation", () => {
  describe("with an error boundary in the throwing route", () => {
    it("uses the throwing route's error boundary", async () => {
      let ERROR_MESSAGE = "Kaboom!";
      let loader = () => {
        throw new Error(ERROR_MESSAGE);
      };
      let tm = createTestTransitionManager("/", {
        routes: [
          {
            path: "/",
            id: "parent",
            element: {},
            module: "",
            hasLoader: false,
            children: [
              {
                path: "/child",
                id: "child",
                element: {},
                module: "",
                ErrorBoundary: FakeComponent,
                hasLoader: true,
                loader
              }
            ]
          }
        ]
      });
      await tm.send({
        type: "navigation",
        location: createLocation("/child"),
        action: Action.Push
      });
      let state = tm.getState();
      expect(state.errorBoundaryId).toBe("child");
      expect(state.error.message).toBe(ERROR_MESSAGE);
    });
  });

  describe("with an error boundary above the throwing route", () => {
    it("uses the nearest error boundary", async () => {
      let ERROR_MESSAGE = "Kaboom!";
      let loader = () => {
        throw new Error(ERROR_MESSAGE);
      };
      let child = {
        path: "/child",
        id: "child",
        element: {},
        module: "",
        hasLoader: true,
        loader
      };
      let parent = {
        path: "/",
        id: "parent",
        element: {},
        module: "",
        ErrorBoundary: FakeComponent,
        children: [child],
        hasLoader: false
      };

      let tm = createTestTransitionManager("/", {
        routes: [parent]
      });
      await tm.send({
        type: "navigation",
        location: createLocation("/child"),
        action: Action.Push
      });
      let state = tm.getState();
      expect(state.errorBoundaryId).toBe("parent");
      expect(state.error.message).toBe(ERROR_MESSAGE);
    });

    it("clears out the error on new locations", async () => {
      let ERROR_MESSAGE = "Kaboom!";
      let loader = () => {
        throw new Error(ERROR_MESSAGE);
      };
      let tm = createTestTransitionManager("/", {
        routes: [
          {
            path: "",
            id: "root",
            element: {},
            module: "",
            hasLoader: false,
            children: [
              {
                path: "/",
                id: "parent",
                element: {},
                module: "",
                hasLoader: false,
                children: [
                  {
                    path: "/child",
                    id: "child",
                    element: {},
                    module: "",
                    ErrorBoundary: FakeComponent,
                    hasLoader: true,
                    loader
                  }
                ]
              }
            ]
          }
        ]
      });

      await tm.send({
        type: "navigation",
        location: createLocation("/child"),
        action: Action.Push
      });
      expect(tm.getState().errorBoundaryId).toBeDefined();
      expect(tm.getState().error).toBeDefined();

      await tm.send({
        type: "navigation",
        location: createLocation("/"),
        action: Action.Push
      });
      expect(tm.getState().errorBoundaryId).toBeUndefined();
      expect(tm.getState().error).toBeUndefined();
    });

    // react rendering component's job?
    // it.todo("removes matches below error boundary route");
  });

  it("loads data above error boundary route", async () => {
    let loaderA = jest.fn(async () => "LOADER A");
    let loaderB = jest.fn(async () => "LOADER B");
    let loaderC = async () => {
      throw new Error("Kaboom!");
    };

    let tm = createTestTransitionManager("/", {
      loaderData: {
        a: await loaderA()
      },
      routes: [
        {
          path: "/",
          id: "a",
          element: {},
          module: "",
          loader: loaderA,
          hasLoader: true,
          children: [
            {
              path: "/b",
              id: "b",
              element: {},
              module: "",
              loader: loaderB,
              hasLoader: true,
              ErrorBoundary: FakeComponent,
              children: [
                {
                  path: "/b/c",
                  id: "c",
                  element: {},
                  module: "",
                  hasLoader: true,
                  loader: loaderC
                }
              ]
            }
          ]
        }
      ]
    });
    await tm.send({
      type: "navigation",
      location: createLocation("/b/c"),
      action: Action.Push
    });
    let state = tm.getState();
    expect(state.loaderData).toMatchInlineSnapshot(`
      Object {
        "a": "LOADER A",
        "b": "LOADER B",
        "c": [Error: Kaboom!],
      }
    `);
  });
});

describe("POP navigations after action redirect", () => {
  it("does a normal load when backing into an action redirect", async () => {
    let t = setup();
    let A = t.navigate.post("/foo");
    let B = await A.action.redirect("/bar");
    await B.loader.resolve(null);
    expect(t.rootLoaderMock.calls.length).toBe(1);

    let C = t.navigate.get("/baz");
    await C.loader.resolve(null);
    expect(t.rootLoaderMock.calls.length).toBe(1);

    let D = t.navigate.pop(B.location);
    await D.loader.resolve("D LOADER");
    expect(t.rootLoaderMock.calls.length).toBe(1);
    expect(t.getState().loaderData).toMatchInlineSnapshot(`
      Object {
        "bar": "D LOADER",
        "root": "ROOT",
      }
    `);
  });
});

describe("submission navigations", () => {
  it("reloads all routes when a loader during an actionReload redirects", async () => {
    let t = setup();
    let A = t.navigate.post("/foo");
    expect(t.rootLoaderMock.calls.length).toBe(0);

    await A.action.resolve(null);
    expect(t.rootLoaderMock.calls.length).toBe(1);

    let B = await A.loader.redirect("/bar");
    await B.loader.resolve("B LOADER");
    expect(t.rootLoaderMock.calls.length).toBe(2);
  });

  it("commits action data as soon as it lands", async () => {
    let t = setup();

    let A = t.navigate.post("/foo");
    expect(t.getState().actionData).toBeUndefined();

    await A.action.resolve("A");
    expect(t.getState().actionData.foo).toBe("A");
  });

  it("reloads all routes after the action", async () => {
    let t = setup();
    let A = t.navigate.post("/foo");
    expect(t.rootLoaderMock.calls.length).toBe(0);

    await A.action.resolve(null);
    expect(t.rootLoaderMock.calls.length).toBe(1);

    await A.loader.resolve("A LOADER");
    expect(t.getState().loaderData).toMatchInlineSnapshot(`
      Object {
        "foo": "A LOADER",
        "root": "ROOT",
      }
    `);
  });

  it("reloads all routes after action redirect", async () => {
    let t = setup();
    let A = t.navigate.post("/foo");
    expect(t.rootLoaderMock.calls.length).toBe(0);

    let B = await A.action.redirect("/bar");
    expect(t.rootLoaderMock.calls.length).toBe(1);

    await B.loader.resolve("B LOADER");
    expect(t.getState().loaderData).toMatchInlineSnapshot(`
      Object {
        "bar": "B LOADER",
        "root": "ROOT",
      }
    `);
  });

  it("removes action data at new locations", async () => {
    let t = setup();
    let A = t.navigate.post("/foo");
    await A.action.resolve("A ACTION");
    await A.loader.resolve("A LOADER");
    expect(t.getState().actionData).toBeDefined();

    let B = t.navigate.get("/bar");
    await B.loader.resolve("B LOADER");
    expect(t.getState().actionData).toBeUndefined();
  });
});

describe("action errors", () => {
  describe("with an error boundary in the action route", () => {
    it("uses the action route's error boundary", async () => {
      let ERROR_MESSAGE = "Kaboom!";
      let action = () => {
        throw new Error(ERROR_MESSAGE);
      };
      let tm = createTestTransitionManager("/", {
        routes: [
          {
            path: "/",
            id: "parent",
            element: {},
            module: "",
            hasLoader: false,
            children: [
              {
                path: "/child",
                id: "child",
                element: {},
                module: "",
                ErrorBoundary: FakeComponent,
                hasLoader: false,
                action
              }
            ]
          }
        ]
      });
      await tm.send({
        type: "navigation",
        location: createLocation("/child"),
        submission: createActionSubmission("/child"),
        action: Action.Push
      });
      let state = tm.getState();
      expect(state.errorBoundaryId).toBe("child");
      expect(state.error.message).toBe(ERROR_MESSAGE);
    });

    it("loads parent data, but not action data", async () => {
      let ERROR_MESSAGE = "Kaboom!";
      let action = () => {
        throw new Error(ERROR_MESSAGE);
      };
      let parentLoader = jest.fn(async () => "PARENT LOADER");
      let actionRouteLoader = jest.fn(async () => "CHILD LOADER");
      let tm = createTestTransitionManager("/", {
        routes: [
          {
            path: "/",
            id: "parent",
            element: {},
            module: "",
            hasLoader: true,
            loader: parentLoader,
            children: [
              {
                path: "/child",
                id: "child",
                element: {},
                module: "",
                ErrorBoundary: FakeComponent,
                hasLoader: false,
                action
              }
            ]
          }
        ]
      });
      await tm.send({
        type: "navigation",
        location: createLocation("/child"),
        submission: createActionSubmission("/child"),
        action: Action.Push
      });
      expect(parentLoader.mock.calls.length).toBe(1);
      expect(actionRouteLoader.mock.calls.length).toBe(0);
      expect(tm.getState().loaderData).toMatchInlineSnapshot(`
        Object {
          "parent": "PARENT LOADER",
        }
      `);
    });
  });

  describe("with an error boundary above the action route", () => {
    it("uses the nearest error boundary", async () => {
      let ERROR_MESSAGE = "Kaboom!";
      let action = () => {
        throw new Error(ERROR_MESSAGE);
      };
      let tm = createTestTransitionManager("/", {
        routes: [
          {
            path: "/",
            id: "parent",
            element: {},
            module: "",
            ErrorBoundary: FakeComponent,
            hasLoader: false,
            children: [
              {
                path: "/child",
                id: "child",
                element: {},
                module: "",
                hasLoader: false,
                action
              }
            ]
          }
        ]
      });
      await tm.send({
        type: "navigation",
        location: createLocation("/child"),
        submission: createActionSubmission("/child"),
        action: Action.Push
      });
      let state = tm.getState();
      expect(state.errorBoundaryId).toBe("parent");
      expect(state.error.message).toBe(ERROR_MESSAGE);
    });
  });

  describe("with a parent loader that throws also, good grief!", () => {
    it("uses action error but nearest errorBoundary to parent", async () => {
      let ACTION_ERROR_MESSAGE = "Kaboom!";
      let action = () => {
        throw new Error(ACTION_ERROR_MESSAGE);
      };
      let parentLoader = () => {
        throw new Error("Should Not See This");
      };

      let tm = createTestTransitionManager("/", {
        routes: [
          {
            path: "/",
            id: "root",
            element: {},
            module: "",
            ErrorBoundary: FakeComponent,
            hasLoader: false,
            children: [
              {
                path: "/parent",
                id: "parent",
                element: {},
                module: "",
                loader: parentLoader,
                hasLoader: true,
                children: [
                  {
                    path: "/parent/child",
                    id: "child",
                    element: {},
                    module: "",
                    action,
                    hasLoader: false,
                    ErrorBoundary: FakeComponent
                  }
                ]
              }
            ]
          }
        ]
      });

      await tm.send({
        type: "navigation",
        location: createLocation("/parent/child"),
        submission: createActionSubmission("/parent/child"),
        action: Action.Push
      });
      let state = tm.getState();
      expect(state.errorBoundaryId).toBe("root");
      expect(state.error.message).toBe(ACTION_ERROR_MESSAGE);
    });
  });
});

describe("transition states", () => {
  it("initialization", async () => {
    let t = setup();
    let transition = t.getState().transition;
    expect(transition.state).toBe("idle");
    expect(transition.type).toBe("idle");
    expect(transition.submission).toBeUndefined();
    expect(transition.location).toBeUndefined();
  });

  it("get", async () => {
    let t = setup();
    let A = t.navigate.get("/foo");
    let transition = t.getState().transition;
    expect(transition.state).toBe("loading");
    expect(transition.type).toBe("normalLoad");
    expect(transition.submission).toBeUndefined();
    expect(transition.location).toBe(A.location);

    await A.loader.resolve("A");
    transition = t.getState().transition;
    expect(transition.state).toBe("idle");
    expect(transition.type).toBe("idle");
    expect(transition.submission).toBeUndefined();
    expect(transition.location).toBeUndefined();
  });

  it("get + redirect", async () => {
    let t = setup();

    let A = t.navigate.get("/foo");
    let B = await A.loader.redirect("/bar");

    let transition = t.getState().transition;
    expect(transition.state).toBe("loading");
    expect(transition.type).toBe("normalRedirect");
    expect(transition.submission).toBeUndefined();
    expect(transition.location).toBe(B.location);

    await B.loader.resolve("B");
    transition = t.getState().transition;
    expect(transition.state).toBe("idle");
    expect(transition.type).toBe("idle");
    expect(transition.submission).toBeUndefined();
    expect(transition.location).toBeUndefined();
  });

  it("action submission", async () => {
    let t = setup();

    let A = t.navigate.post("/foo");
    let transition = t.getState().transition;
    expect(transition.state).toBe("submitting");
    expect(transition.type).toBe("actionSubmission");

    expect(
      // @ts-expect-error
      new URLSearchParams(transition.submission.formData).toString()
    ).toBe("gosh=dang");
    expect(transition.submission.method).toBe("POST");
    expect(transition.location).toBe(A.location);

    await A.action.resolve("A");
    transition = t.getState().transition;
    expect(transition.state).toBe("loading");
    expect(transition.type).toBe("actionReload");
    expect(
      // @ts-expect-error
      new URLSearchParams(transition.submission.formData).toString()
    ).toBe("gosh=dang");
    expect(transition.submission.method).toBe("POST");
    expect(transition.location).toBe(A.location);

    await A.loader.resolve("A");
    transition = t.getState().transition;
    expect(transition.state).toBe("idle");
    expect(transition.type).toBe("idle");
    expect(transition.submission).toBeUndefined();
    expect(transition.location).toBeUndefined();
  });

  it("action submission + redirect", async () => {
    let t = setup();

    let A = t.navigate.post("/foo");
    let B = await A.action.redirect("/bar");

    let transition = t.getState().transition;
    expect(transition.state).toBe("loading");
    expect(transition.type).toBe("actionRedirect");
    expect(
      // @ts-expect-error
      new URLSearchParams(transition.submission.formData).toString()
    ).toBe("gosh=dang");
    expect(transition.submission.method).toBe("POST");
    expect(transition.location).toBe(B.location);

    await B.loader.resolve("B");
    transition = t.getState().transition;
    expect(transition.state).toBe("idle");
    expect(transition.type).toBe("idle");
    expect(transition.submission).toBeUndefined();
    expect(transition.location).toBeUndefined();
  });

  it("loader submission", async () => {
    let t = setup();
    let A = t.navigate.submitGet("/foo");
    let transition = t.getState().transition;
    expect(transition.state).toBe("submitting");
    expect(transition.type).toBe("loaderSubmission");
    expect(
      // @ts-expect-error
      new URLSearchParams(transition.submission.formData).toString()
    ).toBe("gosh=dang");
    expect(transition.submission.method).toBe("GET");
    expect(transition.location).toBe(A.location);

    await A.loader.resolve("A");
    transition = t.getState().transition;
    expect(transition.state).toBe("idle");
    expect(transition.type).toBe("idle");
    expect(transition.submission).toBeUndefined();
    expect(transition.location).toBeUndefined();
  });

  it("loader submission + redirect", async () => {
    let t = setup();

    let A = t.navigate.submitGet("/foo");
    let B = await A.loader.redirect("/bar");

    let transition = t.getState().transition;
    expect(transition.state).toBe("loading");
    expect(transition.type).toBe("loaderSubmissionRedirect");
    expect(
      // @ts-expect-error
      new URLSearchParams(transition.submission.formData).toString()
    ).toBe("gosh=dang");
    expect(transition.submission.method).toBe("GET");
    expect(transition.location).toBe(B.location);

    await B.loader.resolve("B");
    transition = t.getState().transition;
    expect(transition.state).toBe("idle");
    expect(transition.type).toBe("idle");
    expect(transition.submission).toBeUndefined();
    expect(transition.location).toBeUndefined();
  });
});

describe("interruptions", () => {
  describe(`
    A) GET /foo |---X
    B) GET /bar     |---O
  `, () => {
    it("aborts previous load", async () => {
      let t = setup();
      let A = t.navigate.get("/foo");
      t.navigate.get("/bar");
      expect(A.loader.abortMock.calls.length).toBe(1);
    });
  });

  describe(`
    A) GET  /foo |---X
    B) POST /bar     |---O
  `, () => {
    it("aborts previous load", async () => {
      let t = setup();
      let A = t.navigate.get("/foo");
      t.navigate.post("/bar");
      expect(A.loader.abortMock.calls.length).toBe(1);
    });
  });

  describe(`
    A) POST /foo |---X
    B) POST /bar     |---O
  `, () => {
    it("aborts previous action", async () => {
      let t = setup();
      let A = t.navigate.post("/foo");
      t.navigate.post("/bar");
      expect(A.action.abortMock.calls.length).toBe(1);
    });
  });

  describe(`
    A) POST /foo |--|--X
    B) GET  /bar       |---O
  `, () => {
    it("aborts previous action reload", async () => {
      let t = setup();
      let A = t.navigate.post("/foo");
      await A.action.resolve("A ACTION");
      t.navigate.get("/bar");
      expect(A.loader.abortMock.calls.length).toBe(1);
    });
  });

  describe(`
    A) POST /foo |--|--X
    B) POST /bar       |---O
  `, () => {
    it("aborts previous action reload", async () => {
      let t = setup();
      let A = t.navigate.post("/foo");
      await A.action.resolve("A ACTION");
      t.navigate.post("/bar");
      expect(A.loader.abortMock.calls.length).toBe(1);
    });
  });

  describe(`
    A) GET /foo |--/bar--X
    B) GET /baz          |---O
  `, () => {
    it("aborts previous action redirect load", async () => {
      let t = setup();
      let A = t.navigate.get("/foo");
      let AR = await A.loader.redirect("/bar");
      t.navigate.get("/baz");
      expect(AR.loader.abortMock.calls.length).toBe(1);
    });
  });

  describe(`
    A) POST /foo |--/bar--X
    B) GET  /baz          |---O
  `, () => {
    it("aborts previous action redirect load", async () => {
      let t = setup();
      let A = t.navigate.post("/foo");
      let AR = await A.action.redirect("/bar");
      t.navigate.get("/baz");
      expect(AR.loader.abortMock.calls.length).toBe(1);
    });
  });
});

describe("fetcher states", () => {
  test("loader fetch", async () => {
    let t = setup({ url: "/foo" });

    let A = t.fetch.get("/foo");
    let fetcher = t.getFetcher(A.key);
    expect(fetcher.state).toBe("loading");
    expect(fetcher.type).toBe("normalLoad");

    await A.loader.resolve("A DATA");
    fetcher = t.getFetcher(A.key);
    expect(fetcher.state).toBe("idle");
    expect(fetcher.type).toBe("done");
    expect(fetcher.data).toBe("A DATA");
  });

  test("loader submission fetch", async () => {
    let t = setup({ url: "/foo" });

    let A = t.fetch.submitGet("/foo");
    let fetcher = t.getFetcher(A.key);
    expect(fetcher.state).toBe("submitting");
    expect(fetcher.type).toBe("loaderSubmission");

    await A.loader.resolve("A DATA");
    fetcher = t.getFetcher(A.key);
    expect(fetcher.state).toBe("idle");
    expect(fetcher.type).toBe("done");
    expect(fetcher.data).toBe("A DATA");
  });

  test("action fetch", async () => {
    let t = setup({ url: "/foo" });

    let A = t.fetch.post("/foo");
    let fetcher = t.getFetcher(A.key);
    expect(fetcher.state).toBe("submitting");
    expect(fetcher.type).toBe("actionSubmission");

    await A.action.resolve("A ACTION");
    fetcher = t.getFetcher(A.key);
    expect(fetcher.state).toBe("loading");
    expect(fetcher.type).toBe("actionReload");
    expect(fetcher.data).toBe("A ACTION");

    await A.loader.resolve("A DATA");
    fetcher = t.getFetcher(A.key);
    expect(fetcher.state).toBe("idle");
    expect(fetcher.type).toBe("done");
    expect(fetcher.data).toBe("A ACTION");
    expect(t.getState().loaderData).toMatchInlineSnapshot(`
      Object {
        "foo": "A DATA",
        "root": "ROOT",
      }
    `);
  });
});

describe("fetchers", () => {
  it("gives an idle fetcher before submission", async () => {
    let t = setup();
    let fetcher = t.getFetcher("randomKey");
    expect(fetcher).toBe(IDLE_FETCHER);
  });

  it("removes fetchers", async () => {
    let t = setup();
    let A = t.fetch.get("/foo");
    await A.loader.resolve("A");
    expect(t.getFetcher(A.key).data).toBe("A");

    t.tm.deleteFetcher(A.key);
    expect(t.getFetcher(A.key)).toBe(IDLE_FETCHER);
  });

  it("cleans up abort controllers", async () => {
    let t = setup();
    let A = t.fetch.get("/foo");
    expect(t.tm._internalFetchControllers.size).toBe(1);
    let B = t.fetch.get("/bar");
    expect(t.tm._internalFetchControllers.size).toBe(2);
    await A.loader.resolve();
    expect(t.tm._internalFetchControllers.size).toBe(1);
    await B.loader.resolve();
    expect(t.tm._internalFetchControllers.size).toBe(0);
  });

  it("uses current page matches and URL when reloading routes after submissions", async () => {
    let pagePathname = "/foo";
    let t = setup({ url: pagePathname });
    let A = t.fetch.post("/bar");
    await A.action.resolve("ACTION");
    await A.loader.resolve("LOADER");
    let expectedReloadedRoute = "foo";
    expect(t.getState().loaderData[expectedReloadedRoute]).toBe("LOADER");
    // @ts-expect-error
    let urlArg = t.rootLoaderMock.calls[0][0].url as URL;
    expect(urlArg.pathname).toBe(pagePathname);
  });
});

describe("fetcher catch states", () => {
  test("loader fetch", async () => {
    let t = setup({ url: "/foo" });
    let A = t.fetch.get("/foo");
    await A.loader.catch();
    let fetcher = t.getFetcher(A.key);
    expect(fetcher).toBe(IDLE_FETCHER);
    expect(t.getState().catch).toBeDefined();
    expect(t.getState().catchBoundaryId).toBe(t.routes[0].id);
  });

  test("loader submission fetch", async () => {
    let t = setup({ url: "/foo" });
    let A = t.fetch.submitGet("/foo");
    await A.loader.catch();
    let fetcher = t.getFetcher(A.key);
    expect(fetcher).toBe(IDLE_FETCHER);
    expect(t.getState().catch).toBeDefined();
    expect(t.getState().catchBoundaryId).toBe(t.routes[0].id);
  });

  test("action fetch", async () => {
    let t = setup({ url: "/foo" });
    let A = t.fetch.post("/foo");
    await A.action.catch();
    let fetcher = t.getFetcher(A.key);
    expect(fetcher).toBe(IDLE_FETCHER);
    expect(t.getState().catch).toBeDefined();
    expect(t.getState().catchBoundaryId).toBe(t.routes[0].id);
  });
});

describe("fetcher error states", () => {
  test("loader fetch", async () => {
    let t = setup({ url: "/foo" });
    let A = t.fetch.get("/foo");
    await A.loader.throw();
    let fetcher = t.getFetcher(A.key);
    expect(fetcher).toBe(IDLE_FETCHER);
    expect(t.getState().error).toBeDefined();
    expect(t.getState().errorBoundaryId).toBe(t.routes[0].id);
  });

  test("loader submission fetch", async () => {
    let t = setup({ url: "/foo" });
    let A = t.fetch.submitGet("/foo");
    await A.loader.throw();
    let fetcher = t.getFetcher(A.key);
    expect(fetcher).toBe(IDLE_FETCHER);
    expect(t.getState().error).toBeDefined();
    expect(t.getState().errorBoundaryId).toBe(t.routes[0].id);
  });

  test("action fetch", async () => {
    let t = setup({ url: "/foo" });
    let A = t.fetch.post("/foo");
    await A.action.throw();
    let fetcher = t.getFetcher(A.key);
    expect(fetcher).toBe(IDLE_FETCHER);
    expect(t.getState().error).toBeDefined();
    expect(t.getState().errorBoundaryId).toBe(t.routes[0].id);
  });
});

describe("fetcher redirects", () => {
  test("loader fetch", async () => {
    let t = setup({ url: "/foo" });
    let A = t.fetch.get("/foo");
    let fetcher = t.getFetcher(A.key);
    let AR = await A.loader.redirect("/bar");
    expect(t.getFetcher(A.key)).toBe(fetcher);
    expect(t.getState().transition.type).toBe("normalRedirect");
    expect(t.getState().transition.location).toBe(AR.location);
  });

  test("loader submission fetch", async () => {
    let t = setup({ url: "/foo" });
    let A = t.fetch.submitGet("/foo");
    let fetcher = t.getFetcher(A.key);
    let AR = await A.loader.redirect("/bar");
    expect(t.getFetcher(A.key)).toBe(fetcher);
    expect(t.getState().transition.type).toBe("normalRedirect");
    expect(t.getState().transition.location).toBe(AR.location);
  });

  test("action fetch", async () => {
    let t = setup({ url: "/foo" });
    let A = t.fetch.post("/foo");
    let fetcher = t.getFetcher(A.key);
    let AR = await A.action.redirect("/bar");
    expect(t.getFetcher(A.key)).toBe(fetcher);
    expect(t.getState().transition.type).toBe("fetchActionRedirect");
    expect(t.getState().transition.location).toBe(AR.location);
  });
});

describe("fetcher resubmissions/re-gets", () => {
  it("aborts re-gets", async () => {
    let t = setup();
    let key = "KEY";
    let A = t.fetch.get("/foo", key);
    let B = t.fetch.get("/foo", key);
    await A.loader.resolve(null);
    let C = t.fetch.get("/foo", key);
    await B.loader.resolve(null);
    await C.loader.resolve(null);
    expect(A.loader.abortMock.calls.length).toBe(1);
    expect(B.loader.abortMock.calls.length).toBe(1);
    expect(C.loader.abortMock.calls.length).toBe(0);
  });

  it("aborts re-get-submissions", async () => {
    let t = setup();
    let key = "KEY";
    let A = t.fetch.submitGet("/foo", key);
    let B = t.fetch.submitGet("/foo", key);
    t.fetch.get("/foo", key);
    expect(A.loader.abortMock.calls.length).toBe(1);
    expect(B.loader.abortMock.calls.length).toBe(1);
  });

  it("aborts resubmissions action call", async () => {
    let t = setup();
    let key = "KEY";
    let A = t.fetch.post("/foo", key);
    let B = t.fetch.post("/foo", key);
    t.fetch.post("/foo", key);
    expect(A.action.abortMock.calls.length).toBe(1);
    expect(B.action.abortMock.calls.length).toBe(1);
  });

  it("aborts resubmissions loader call", async () => {
    let t = setup({ url: "/foo" });
    let key = "KEY";
    let A = t.fetch.post("/foo", key);
    await A.action.resolve("A ACTION");
    t.fetch.post("/foo", key);
    expect(A.loader.abortMock.calls.length).toBe(1);
  });

  describe(`
    A) POST |--|--XXX
    B) POST       |----XXX|XXX
    C) POST            |----|---O
  `, () => {
    it("aborts A load, ignores A resolve, aborts B action", async () => {
      let t = setup({ url: "/foo" });
      let key = "KEY";

      let A = t.fetch.post("/foo", key);
      await A.action.resolve("A ACTION");
      expect(t.getFetcher(key).data).toBe("A ACTION");

      let B = t.fetch.post("/foo", key);
      expect(A.loader.abortMock.calls.length).toBe(1);
      expect(t.getFetcher(key).data).toBeUndefined();

      await A.loader.resolve("A LOADER");
      expect(t.getState().loaderData.foo).toBeUndefined();

      let C = t.fetch.post("/foo", key);
      expect(B.action.abortMock.calls.length).toBe(1);

      await B.action.resolve("B ACTION");
      expect(t.getFetcher(key).data).toBeUndefined();

      await C.action.resolve("C ACTION");
      expect(t.getFetcher(key).data).toBe("C ACTION");

      await B.loader.resolve("B LOADER");
      expect(t.getState().loaderData.foo).toBeUndefined();

      await C.loader.resolve("C LOADER");
      expect(t.getFetcher(key).data).toBe("C ACTION");
      expect(t.getState().loaderData.foo).toBe("C LOADER");
    });
  });

  describe(`
    A) k1 |----|----X
    B) k2   |----|-----O
    C) k1           |-----|---O
  `, () => {
    it("aborts A load, commits B and C loads", async () => {
      let t = setup({ url: "/foo" });
      let k1 = "1";
      let k2 = "2";

      let Ak1 = t.fetch.post("/foo", k1);
      let Bk2 = t.fetch.post("/foo", k2);

      await Ak1.action.resolve("A ACTION");
      await Bk2.action.resolve("B ACTION");
      expect(t.getFetcher(k2).data).toBe("B ACTION");

      let Ck1 = t.fetch.post("/foo", k1);
      expect(Ak1.loader.abortMock.calls.length).toBe(1);

      await Ak1.loader.resolve("A LOADER");
      expect(t.getState().loaderData.foo).toBeUndefined();

      await Bk2.loader.resolve("B LOADER");
      expect(Ck1.action.abortMock.calls.length).toBe(0);
      expect(t.getState().loaderData.foo).toBe("B LOADER");

      await Ck1.action.resolve("C ACTION");
      await Ck1.loader.resolve("C LOADER");

      expect(t.getFetcher(k1).data).toBe("C ACTION");
      expect(t.getState().loaderData.foo).toBe("C LOADER");
    });
  });
});

describe("multiple fetcher action reloads", () => {
  describe(`
    A) POST /foo |---[A]------O
    B) POST /foo   |-----[A,B]---O
  `, () => {
    it("commits A, commits B", async () => {
      let t = setup({ url: "/foo" });
      let A = t.fetch.post("/foo");
      let B = t.fetch.post("/foo");
      await A.action.resolve();
      await B.action.resolve();

      await A.loader.resolve("A");
      expect(t.getState().loaderData.foo).toBe("A");

      await B.loader.resolve("A,B");
      expect(t.getState().loaderData.foo).toBe("A,B");
    });
  });

  describe(`
    A) POST /foo |----🧤
    B) POST /foo   |--X
  `, () => {
    it("catches A, persists boundary for B", async () => {
      let t = setup({ url: "/foo" });
      let A = t.fetch.post("/foo");
      let B = t.fetch.post("/foo");

      await A.action.catch();
      let catchVal = t.getState().catch;
      expect(catchVal).toBeDefined();
      expect(t.getState().catchBoundaryId).toBe(t.routes[0].id);

      await B.action.resolve();
      expect(t.getState().catch).toBe(catchVal);
      expect(t.getState().catchBoundaryId).toBe(t.routes[0].id);
    });
  });

  describe(`
    A) POST /foo |----[A]-|
    B) POST /foo   |------🧤
  `, () => {
    it("commits A, catches B", async () => {
      let t = setup({ url: "/foo" });
      let A = t.fetch.post("/foo");
      let B = t.fetch.post("/foo");

      await A.action.resolve();
      await A.loader.resolve("A");
      expect(t.getState().loaderData.foo).toBe("A");

      await B.action.catch();
      expect(t.getState().catch).toBeDefined();
      expect(t.getState().catchBoundaryId).toBe(t.routes[0].id);
    });
  });

  describe(`
    A) POST /foo |---[A]-------X
    B) POST /foo   |----[A,B]--O
  `, () => {
    it("aborts A, commits B, sets A done", async () => {
      let t = setup({ url: "/foo" });
      let A = t.fetch.post("/foo");
      let B = t.fetch.post("/foo");
      await A.action.resolve("A");
      await B.action.resolve();

      await B.loader.resolve("A,B");
      expect(t.getState().loaderData.foo).toBe("A,B");
      expect(A.loader.abortMock.calls.length).toBe(1);
      expect(t.getFetcher(A.key).type).toBe("done");
      expect(t.getFetcher(A.key).data).toBe("A");
    });
  });

  describe(`
    A) POST /foo |--------[B,A]---O
    B) POST /foo   |--[B]-------O
  `, () => {
    it("commits B, commits A", async () => {
      let t = setup({ url: "/foo" });
      let A = t.fetch.post("/foo");
      let B = t.fetch.post("/foo");

      await B.action.resolve();
      await A.action.resolve();

      await B.loader.resolve("B");
      expect(t.getState().loaderData.foo).toBe("B");

      await A.loader.resolve("B,A");
      expect(t.getState().loaderData.foo).toBe("B,A");
    });
  });

  describe(`
    A) POST /foo |------|---O
    B) POST /foo   |--|-----X
  `, () => {
    it("aborts B, commits A, sets B done", async () => {
      let t = setup({ url: "/foo" });

      let A = t.fetch.post("/foo");
      let B = t.fetch.post("/foo");

      await B.action.resolve("B");
      await A.action.resolve();

      await A.loader.resolve("B,A");
      expect(t.getState().loaderData.foo).toBe("B,A");
      expect(B.loader.abortMock.calls.length).toBe(1);
      expect(t.getFetcher(B.key).type).toBe("done");
      expect(t.getFetcher(B.key).data).toBe("B");
    });
  });
});

describe("navigating with inflight fetchers", () => {
  describe(`
    A) fetch POST |-------|--O
    B) nav GET      |---O
  `, () => {
    it("does not abort A action or data reload", async () => {
      let t = setup({ url: "/foo" });

      let A = t.fetch.post("/foo");
      let B = t.navigate.get("/foo");
      expect(A.action.abortMock.calls.length).toBe(0);
      expect(t.getState().transition.type).toBe("normalLoad");
      expect(t.getState().transition.location).toBe(B.location);

      await B.loader.resolve("B");
      expect(t.getState().transition.type).toBe("idle");
      expect(t.getState().location).toBe(B.location);
      expect(t.getState().loaderData.foo).toBe("B");
      expect(A.loader.abortMock.calls.length).toBe(0);

      await A.action.resolve();
      await A.loader.resolve("A");
      expect(t.getState().loaderData.foo).toBe("A");
    });
  });

  describe(`
    A) fetch POST |----|-----O
    B) nav GET      |-----O
  `, () => {
    it("Commits A and uses next matches", async () => {
      let t = setup({ url: "/" });

      let A = t.fetch.post("/foo");
      let B = t.navigate.get("/foo");
      await A.action.resolve();
      await B.loader.resolve("B");
      expect(A.action.abortMock.calls.length).toBe(0);
      expect(A.loader.abortMock.calls.length).toBe(0);
      expect(t.getState().transition.type).toBe("idle");
      expect(t.getState().location).toBe(B.location);
      expect(t.getState().loaderData.foo).toBe("B");

      await A.loader.resolve("A");
      expect(t.getState().loaderData.foo).toBe("A");
    });
  });

  describe(`
    A) fetch POST |--|----X
    B) nav GET         |--O
  `, () => {
    it("aborts A, sets fetcher done", async () => {
      let t = setup({ url: "/foo" });

      let A = t.fetch.post("/foo");
      await A.action.resolve("A");
      let B = t.navigate.get("/foo");
      await B.loader.resolve("B");
      expect(t.getState().transition.type).toBe("idle");
      expect(t.getState().location).toBe(B.location);
      expect(t.getState().loaderData.foo).toBe("B");
      expect(A.loader.abortMock.calls.length).toBe(1);
      expect(t.getFetcher(A.key).type).toBe("done");
      expect(t.getFetcher(A.key).data).toBe("A");
    });
  });

  describe(`
    A) fetch POST |--|---O
    B) nav GET         |---O
  `, () => {
    it("commits both", async () => {
      let t = setup({ url: "/foo" });

      let A = t.fetch.post("/foo");
      await A.action.resolve();
      let B = t.navigate.get("/foo");
      await A.loader.resolve("A");
      expect(t.getState().loaderData.foo).toBe("A");

      await B.loader.resolve("B");
      expect(t.getState().loaderData.foo).toBe("B");
    });
  });

  describe(`
    A) fetch POST |---[A]---O
    B) nav POST           |---[A,B]--O
  `, () => {
    it("keeps both", async () => {
      let t = setup({ url: "/foo" });
      let A = t.fetch.post("/foo");
      await A.action.resolve();
      let B = t.navigate.post("/foo");
      await A.loader.resolve("A");
      expect(t.getState().loaderData.foo).toBe("A");

      await B.action.resolve();
      await B.loader.resolve("A,B");
      expect(t.getState().loaderData.foo).toBe("A,B");
    });
  });

  describe(`
    A) fetch POST |---[A]--------X
    B) nav POST     |-----[A,B]--O
  `, () => {
    it("aborts A, commits B, marks fetcher done", async () => {
      let t = setup({ url: "/foo" });
      let A = t.fetch.post("/foo");
      let B = t.navigate.post("/foo");
      await A.action.resolve("A");
      await B.action.resolve();
      await B.loader.resolve("A,B");
      expect(t.getState().loaderData.foo).toBe("A,B");
      expect(A.loader.abortMock.calls.length).toBe(1);
      let fetcher = t.getFetcher(A.key);
      expect(fetcher.type).toBe("done");
      expect(fetcher.data).toBe("A");
    });
  });

  describe(`
    A) fetch POST |-----------[B,A]--O
    B) nav POST     |--[B]--O
  `, () => {
    it("commits both, uses the nav's href", async () => {
      let t = setup({ url: "/foo" });
      let A = t.fetch.post("/foo");
      let B = t.navigate.post("/bar");
      await B.action.resolve();
      await B.loader.resolve("B");
      await A.action.resolve();
      await A.loader.resolve("B,A");
      expect(t.getState().loaderData.bar).toBe("B,A");
    });
  });

  describe(`
    A) fetch POST |-------[B,A]--O
    B) nav POST     |--[B]-------X
  `, () => {
    it("aborts B, commits A, uses the nav's href", async () => {
      let t = setup({ url: "/foo" });
      let A = t.fetch.post("/foo");
      let B = t.navigate.post("/bar");
      await B.action.resolve();
      await A.action.resolve();
      await A.loader.resolve("B,A");
      expect(B.loader.abortMock.calls.length).toBe(1);
      expect(t.getState().loaderData.foo).toBeUndefined();
      expect(t.getState().loaderData.bar).toBe("B,A");
      expect(t.getState().transition).toBe(IDLE_TRANSITION);
    });
  });
});

// describe("react-router", () => {
//   it.todo("replaces pending locations even on a push");
// });

////////////////////////////////////////////////////////////////////////////////
type Deferred = ReturnType<typeof defer>;

function defer() {
  let resolve: (val?: any) => Promise<void>;
  let reject: (error?: Error) => Promise<void>;
  let promise = new Promise((res, rej) => {
    resolve = async (val: any) => {
      res(val);
      await (async () => promise)();
    };
    reject = async (error?: Error) => {
      rej(error);
      await (async () => promise)();
    };
  });
  return { promise, resolve, reject };
}

let fakeKey = 0;
function createLocation(path: string, state: any = null): Location {
  let { pathname, search, hash } = parsePath(path);

  return {
    pathname: pathname || "",
    search: search || "",
    hash: hash || "",
    key: String(++fakeKey),
    state
  };
}

function makeFormDataFromBody(body: string) {
  let params = new URLSearchParams(body);
  let formData = new FormData();
  for (let [k, v] of params) {
    formData.set(k, v);
  }
  return formData;
}

let incrementingSubmissionKey = 0;
function createActionSubmission(action: string, body: string = "gosh=dang") {
  let submission: Submission = {
    action,
    formData: makeFormDataFromBody(body),
    method: "POST",
    encType: "application/x-www-form-urlencoded",
    key: String(++incrementingSubmissionKey)
  };
  return submission;
}

function createLoaderSubmission(action: string, body: string = "gosh=dang") {
  let submission: Submission = {
    action,
    formData: makeFormDataFromBody(body),
    method: "GET",
    encType: "application/x-www-form-urlencoded",
    key: String(++incrementingSubmissionKey)
  };
  return submission;
}

function createTestTransitionManager(
  pathname: string,
  init?: Partial<TransitionManagerInit>
) {
  let location = createLocation(pathname);
  return createTransitionManager({
    actionData: undefined,
    loaderData: { root: "ROOT" },
    location,
    routes: [],
    onChange() {},
    onRedirect() {},
    ...init
  });
}

let setup = ({ url } = { url: "/" }) => {
  incrementingSubmissionKey = 0;
  let guid = 0;

  let nextActionType: "navigation" | "fetch";
  let nextLoaderType: "navigation" | "fetch";
  let nextLoaderId = guid;
  let nextActionId = guid;
  let nextLoaderFetchId = guid;
  let nextActionFetchId = guid;
  let lastRedirect: ReturnType<typeof navigate_>;

  let onChangeDeferreds = new Map<number, Deferred>();
  let loaderDeferreds = new Map<number, Deferred>();
  let actionDeferreds = new Map<number, Deferred>();
  let loaderAbortHandlers = new Map<number, jest.Mock>();
  let actionAbortHandlers = new Map<number, jest.Mock>();

  let handleChange = jest.fn();

  let handleRedirect = jest.fn((href: string, state: State) => {
    lastRedirect = navigate_(createLocation(href, state));
  });

  let rootLoader = jest.fn(() => "ROOT");

  let createLoader = () => {
    return jest.fn(async ({ signal }: { signal: AbortSignal }) => {
      let myId =
        nextLoaderType === "navigation" ? nextLoaderId : nextLoaderFetchId;
      signal.onabort = loaderAbortHandlers.get(myId);
      return loaderDeferreds.get(myId).promise.then(
        val => {
          return val;
        },
        error => error
      );
    });
  };

  let createAction = () => {
    return jest.fn(async ({ signal }: { signal: AbortSignal }) => {
      let myType = nextActionType;
      let myId = myType === "navigation" ? nextActionId : nextActionFetchId;
      signal.onabort = actionAbortHandlers.get(myId);
      return actionDeferreds.get(myId).promise.then(val => {
        if (myType === "navigation") {
          nextLoaderType = "navigation";
          nextLoaderId = myId;
        } else if (myType === "fetch") {
          nextLoaderType = "fetch";
          nextLoaderFetchId = myId;
        }
        return val;
      });
    });
  };

  let routes = [
    {
      path: "",
      id: "root",
      element: {},
      module: "",
      ErrorBoundary: FakeComponent,
      CatchBoundary: FakeComponent,
      hasLoader: true,
      loader: rootLoader,
      children: [
        {
          path: "/",
          id: "index",
          hasLoader: true,
          loader: createLoader(),
          action: createAction(),
          element: {},
          module: ""
        },
        {
          path: "/foo",
          id: "foo",
          hasLoader: true,
          loader: createLoader(),
          action: createAction(),
          element: {},
          module: ""
        },
        {
          path: "/bar",
          id: "bar",
          hasLoader: true,
          loader: createLoader(),
          action: createAction(),
          element: {},
          module: ""
        },
        {
          path: "/baz",
          id: "baz",
          hasLoader: true,
          loader: createLoader(),
          action: createAction(),
          element: {},
          module: ""
        },
        {
          path: "/p/:param",
          id: "param",
          hasLoader: true,
          loader: createLoader(),
          action: createAction(),
          element: {},
          module: ""
        }
      ]
    }
  ];

  let tm = createTestTransitionManager(url, {
    onChange: handleChange,
    onRedirect: handleRedirect,
    loaderData: { root: "ROOT" },
    routes
  });

  let navigate_ = (
    location: Location | string,
    submission?: Submission,
    action?: Action
  ) => {
    if (typeof location === "string") location = createLocation(location);

    let id = ++guid;
    let loaderAbortHandler = jest.fn();
    let actionAbortHandler = jest.fn();

    if (submission && submission.method !== "GET") {
      nextActionType = "navigation";
      nextActionId = id;
      actionDeferreds.set(id, defer());
      actionAbortHandlers.set(id, actionAbortHandler);
    } else {
      nextLoaderType = "navigation";
      nextLoaderId = id;
    }

    onChangeDeferreds.set(id, defer());
    loaderDeferreds.set(id, defer());
    loaderAbortHandlers.set(id, loaderAbortHandler);

    async function resolveAction(val: any = null) {
      await actionDeferreds.get(id).resolve(val);
    }

    async function resolveLoader(val: any) {
      await loaderDeferreds.get(id).resolve(val);
      await onChangeDeferreds.get(id).resolve();
    }

    async function redirectAction(href: string) {
      await resolveAction(new TransitionRedirect(href));
      return lastRedirect;
    }

    async function redirectLoader(href: string) {
      await resolveLoader(new TransitionRedirect(href));
      return lastRedirect;
    }

    tm.send({
      type: "navigation",
      location,
      submission,
      action: action || Action.Push
    }).then(() => onChangeDeferreds.get(id).promise);

    return {
      location,
      action: {
        resolve: resolveAction,
        redirect: redirectAction,
        abortMock: actionAbortHandler.mock
      },
      loader: {
        resolve: resolveLoader,
        redirect: redirectLoader,
        abortMock: loaderAbortHandler.mock
      }
    };
  };

  let navigate = {
    pop: (location: Location) => navigate_(location, undefined, Action.Pop),
    get: (href: string) => navigate_(href),
    post: (href: string, body?: string) =>
      navigate_(href, createActionSubmission(href, body)),
    submitGet: (href: string, body?: string) =>
      navigate_(href, createLoaderSubmission(href, body))
  };

  let fetch_ = (href: string, key?: string, submission?: Submission) => {
    let id = ++guid;
    key = key || String(id);
    let loaderAbortHandler = jest.fn();
    let actionAbortHandler = jest.fn();

    if (submission && submission.method !== "GET") {
      nextActionType = "fetch";
      nextActionFetchId = id;
      actionDeferreds.set(id, defer());
      actionAbortHandlers.set(id, actionAbortHandler);
    } else {
      nextLoaderType = "fetch";
      nextLoaderFetchId = id;
    }

    onChangeDeferreds.set(id, defer());
    loaderDeferreds.set(id, defer());
    loaderAbortHandlers.set(id, loaderAbortHandler);

    async function resolveAction(val: any = null) {
      await actionDeferreds.get(id).resolve(val);
    }

    async function resolveLoader(val: any = null) {
      await loaderDeferreds.get(id).resolve(val);
      await awaitChange();
    }

    async function throwLoaderCatch() {
      await loaderDeferreds
        .get(id)
        .resolve(new CatchValue(400, "Bad Request", null));
      await awaitChange();
    }

    async function throwLoaderError() {
      await loaderDeferreds.get(id).resolve(new Error("Kaboom!"));
      await awaitChange();
    }

    async function throwActionCatch() {
      await actionDeferreds
        .get(id)
        .resolve(new CatchValue(400, "Bad Request", null));
      await awaitChange();
    }

    async function throwActionError() {
      await actionDeferreds.get(id).resolve(new Error("Kaboom!"));
      await awaitChange();
    }

    async function redirectAction(href: string) {
      await resolveAction(new TransitionRedirect(href));
      return lastRedirect;
    }

    async function redirectLoader(href: string) {
      await resolveLoader(new TransitionRedirect(href));
      return lastRedirect;
    }

    async function awaitChange() {
      await onChangeDeferreds.get(id).resolve();
    }

    tm.send({ type: "fetcher", href, submission, key }).then(
      () => onChangeDeferreds.get(id).promise
    );

    return {
      key,
      location: href,
      action: {
        resolve: resolveAction,
        redirect: redirectAction,
        abortMock: actionAbortHandler.mock,
        catch: throwActionCatch,
        throw: throwActionError
      },
      loader: {
        resolve: resolveLoader,
        redirect: redirectLoader,
        abortMock: loaderAbortHandler.mock,
        catch: throwLoaderCatch,
        throw: throwLoaderError
      }
    };
  };

  let fetch = {
    get: (href: string, key?: string) => fetch_(href, key),
    post: (href: string, key?: string, body?: string) =>
      fetch_(href, key, createActionSubmission(href, body)),
    submitGet: (href: string, key?: string, body?: string) =>
      fetch_(href, key, createLoaderSubmission(href, body))
  };

  return {
    tm,
    navigate,
    fetch,
    getState: tm.getState,
    getFetcher: tm.getFetcher,
    handleChange,
    handleRedirect,
    rootLoaderMock: rootLoader.mock,
    routes
  };
};

function FakeComponent() {}
