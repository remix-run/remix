import { Location } from "history";
import {
  createTransitionManager,
  SubmissionState,
  TransitionRedirect
} from "../transition";
import type { TransitionManagerInit } from "../transition";

let routes = [
  {
    path: "/",
    id: "root",
    loader: async () => "ROOT",
    action: async () => "ROOT",
    element: {},
    children: [
      {
        path: "a",
        id: "routes/a",
        loader: async () => ({ fakeLoaderDataFor: "routes/a" }),
        action: async () => ({ fakeActionDataFor: "routes/a" }),
        element: {}
      }
    ]
  }
];

let fakeKey = 0;
function createLocation(path: string, state: any = null): Location {
  let [pathname, search] = path.split("?");
  return {
    pathname,
    search: search ? `?${search}` : "",
    hash: "",
    key: String(++fakeKey),
    state
  };
}

let submissionId = 0;
function createActionLocation(path: string, state?: Partial<SubmissionState>) {
  let submission: SubmissionState = Object.assign(
    {
      isAction: true,
      action: path,
      method: "post",
      body: "gosh=dang",
      encType: "application/x-www-form-urlencoded",
      id: ++submissionId
    },
    state
  );
  return createLocation(path, submission);
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
    routes,
    onChange() {},
    onRedirect() {},
    ...init
  });
}

describe("transition manager", () => {
  let setup = () => {
    fakeKey = 0;
    let parentLoader = jest.fn(() => "PARENT");
    let childLoader = jest.fn(() => "CHILD");
    let paramLoader = jest.fn(() => "PARAM");
    let tm = createTestTransitionManager("/", {
      loaderData: { parent: "PARENT" },
      routes: [
        {
          path: "/",
          id: "parent",
          loader: parentLoader,
          element: {},
          children: [
            {
              path: "a",
              id: "child",
              loader: childLoader,
              element: {}
            },
            {
              path: "p/:param",
              id: "param-child",
              loader: paramLoader,
              element: {}
            }
          ]
        }
      ]
    });
    return {
      parentLoader,
      childLoader,
      paramLoader,
      tm,
      getState: tm.getState
    };
  };

  it("initializes state", async () => {
    let t = setup();
    expect(t.getState()).toMatchInlineSnapshot(`
      Object {
        "actionData": undefined,
        "error": undefined,
        "errorBoundaryId": undefined,
        "loaderData": Object {
          "parent": "PARENT",
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
              "children": Array [
                Object {
                  "element": Object {},
                  "id": "child",
                  "loader": [MockFunction],
                  "path": "a",
                },
                Object {
                  "element": Object {},
                  "id": "param-child",
                  "loader": [MockFunction],
                  "path": "p/:param",
                },
              ],
              "element": Object {},
              "id": "parent",
              "loader": [MockFunction],
              "path": "/",
            },
          },
        ],
        "nextLocation": undefined,
        "nextMatches": undefined,
        "pendingSubmissionRefs": Map {},
      }
    `);
  });

  it("updates state immediately after a new location comes through", () => {
    let t = setup();
    t.tm.send(createLocation("/a"));
    let state = t.getState();
    expect(state.nextLocation.pathname).toBe("/a");
    expect(state.nextMatches.length).toBe(2);
  });

  describe("GET navigation", () => {
    describe("redirects", () => {
      it("redirects", async () => {
        let loaderDeferred = defer();
        let redirectDeferred = defer();
        let loader = () => loaderDeferred.promise.then(val => val);
        let handleRedirect = jest.fn((href: string) => {
          tm.send(createLocation(href)).then(() => redirectDeferred.promise);
        });

        let tm = createTestTransitionManager("/", {
          onRedirect: handleRedirect,
          routes: [
            { path: "/", id: "root", element: {} },
            { path: "/will-redirect", id: "redirect", loader, element: {} },
            { path: "/redirect-target", id: "target", element: {} }
          ]
        });

        tm.send(createLocation("/will-redirect"));
        expect(tm.getState().nextLocation.pathname).toBe("/will-redirect");

        await loaderDeferred.resolve(
          new TransitionRedirect("/redirect-target")
        );
        await redirectDeferred.resolve();

        expect(handleRedirect.mock.calls.length).toBe(1);
        expect(handleRedirect.mock.calls[0][0]).toBe("/redirect-target");
        expect(tm.getState().nextLocation).toBeUndefined();
        expect(tm.getState().location.pathname).toBe("/redirect-target");
      });
    });

    it.todo("allows `null` as a valid data value");

    it("fetches data on new locations", async () => {
      let t = setup();
      await t.tm.send(createLocation("/a"));
      expect(t.getState().loaderData).toMatchInlineSnapshot(`
        Object {
          "child": "CHILD",
          "parent": "PARENT",
        }
      `);
    });

    describe("parent -> child transition", () => {
      it("only fetches child data", async () => {
        let t = setup();
        await t.tm.send(createLocation("/a"));
        let state = t.getState();
        expect(t.parentLoader.mock.calls.length).toBe(0);
        expect(state.loaderData).toMatchInlineSnapshot(`
          Object {
            "child": "CHILD",
            "parent": "PARENT",
          }
        `);
      });
    });

    describe("search change", () => {
      it("reloads all routes", async () => {
        let t = setup();
        await t.tm.send(createLocation("/a?foo"));
        expect(t.parentLoader.mock.calls.length).toBe(1);
        expect(t.childLoader.mock.calls.length).toBe(1);

        await t.tm.send(createLocation("/a?bar"));
        expect(t.parentLoader.mock.calls.length).toBe(2);
        expect(t.childLoader.mock.calls.length).toBe(2);
      });
    });

    describe("param change", () => {
      it("reloads only routes with changed params", async () => {
        let t = setup();
        await t.tm.send(createLocation("/p/one"));
        expect(t.parentLoader.mock.calls.length).toBe(0);
        expect(t.paramLoader.mock.calls.length).toBe(1);

        await t.tm.send(createLocation("/p/two"));
        expect(t.parentLoader.mock.calls.length).toBe(0);
        expect(t.paramLoader.mock.calls.length).toBe(2);
      });
    });

    describe("same url", () => {
      it("reloads all routes", async () => {
        let t = setup();
        await t.tm.send(createLocation("/p/one"));
        expect(t.parentLoader.mock.calls.length).toBe(0);
        expect(t.paramLoader.mock.calls.length).toBe(1);

        await t.tm.send(createLocation("/p/one"));
        expect(t.parentLoader.mock.calls.length).toBe(1);
        expect(t.paramLoader.mock.calls.length).toBe(2);
      });

      // describe("on push", () => {
      //   it.todo("reloads all data");
      // });

      // describe("on pop", () => {
      //   it.todo("uses cache"); // oof, not sure we want to bring this back!
      // });
    });

    // it.todo("delegates to the route if it should reload or not");

    describe("errors", () => {
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
                children: [
                  {
                    path: "/child",
                    id: "child",
                    element: {},
                    ErrorBoundary: FakeComponent,
                    loader
                  }
                ]
              }
            ]
          });
          await tm.send(createLocation("/child"));
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
          let child = { path: "/child", id: "child", element: {}, loader };
          let parent = {
            path: "/",
            id: "parent",
            element: {},
            ErrorBoundary: FakeComponent,
            children: [child]
          };

          let tm = createTestTransitionManager("/", { routes: [parent] });
          await tm.send(createLocation("/child"));
          let state = tm.getState();
          expect(state.errorBoundaryId).toBe("parent");
          expect(state.error.message).toBe(ERROR_MESSAGE);
        });

        // somebody elses job?
        // it.todo("removes matches below error boundary route");
      });
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
            loader: loaderA,
            children: [
              {
                path: "/b",
                id: "b",
                element: {},
                loader: loaderB,
                ErrorBoundary: FakeComponent,
                children: [
                  {
                    path: "/c",
                    id: "c",
                    element: {},
                    loader: loaderC
                  }
                ]
              }
            ]
          }
        ]
      });
      await tm.send(createLocation("/b/c"));
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

  describe("POST navigation", () => {
    let setup = () => {
      let parentLoader = jest.fn(() => "PARENT LOADER");
      let childLoader = jest.fn(() => "CHILD LOADER");
      let parentAction = jest.fn(() => "PARENT ACTION");
      let childAction = jest.fn(() => "CHILD ACTION");
      let tm = createTestTransitionManager("/", {
        loaderData: { parent: "PARENT" },
        routes: [
          {
            path: "/",
            id: "parent",
            element: {},
            loader: parentLoader,
            action: parentAction,
            children: [
              {
                path: "/child",
                id: "child",
                element: {},
                loader: childLoader,
                action: childAction
              }
            ]
          }
        ]
      });
      return {
        parentLoader,
        childLoader,
        parentAction,
        childAction,
        tm,
        getState: tm.getState
      };
    };

    it("removes action data at new locations", async () => {
      let { tm } = setup();
      await tm.send(createLocation("/child", { isAction: true }));
      expect(tm.getState().actionData).toBe("CHILD ACTION");

      await tm.send(createLocation("/child"));
      expect(tm.getState().actionData).toBeUndefined();
    });

    it("calls only the leaf route action", async () => {
      let t = setup();
      await t.tm.send(createLocation("/child", { isAction: true }));
      expect(t.parentAction.mock.calls.length).toBe(0);
      expect(t.childAction.mock.calls.length).toBe(1);
    });

    it("reloads all routes after the action", async () => {
      let t = setup();
      await t.tm.send(createLocation("/child", { isAction: true }));
      expect(t.parentLoader.mock.calls.length).toBe(1);
      expect(t.childLoader.mock.calls.length).toBe(1);
      expect(t.getState().actionData).toMatchInlineSnapshot(`"CHILD ACTION"`);
      expect(t.getState().loaderData).toMatchInlineSnapshot(`
          Object {
            "child": "CHILD LOADER",
            "parent": "PARENT LOADER",
          }
        `);
    });

    it("loads routes after action redirect", async () => {
      let actionDeferred = defer();
      let loaderDeferred = defer();
      let redirectDeferred = defer();

      let action = jest.fn(() => actionDeferred.promise.then(val => val));
      let loader = jest.fn(() => loaderDeferred.promise.then(val => val));

      let tm = createTestTransitionManager("/", {
        onRedirect(location) {
          tm.send(createLocation(location)).then(
            () => redirectDeferred.promise
          );
        },
        routes: [
          { path: "/", id: "root", action, element: {} },
          { path: "/a", id: "a", loader, element: {} }
        ],
        loaderData: {}
      });

      tm.send(createLocation("/", { isAction: true }));
      await actionDeferred.resolve(new TransitionRedirect("/a"));

      let state = tm.getState();
      expect(action.mock.calls.length).toBe(1);
      expect(loader.mock.calls.length).toBe(1);
      expect(state.actionData).toBeUndefined();
      expect(state.loaderData).toMatchInlineSnapshot(`Object {}`);
      expect(state.nextLocation.pathname).toBe("/a");

      await loaderDeferred.resolve("A");
      await redirectDeferred.resolve();
      state = tm.getState();
      expect(state.location.pathname).toBe("/a");
      expect(state.loaderData.a).toBe("A");
    });

    it("commits action data as soon as it lands", async () => {
      let { promise, resolve } = defer();
      let action = jest.fn(() => promise.then(val => val));
      let tm = createTestTransitionManager("/", {
        routes: [
          {
            element: {},
            id: "root",
            path: "/",
            action
          }
        ]
      });
      expect(tm.getState().actionData).toBeUndefined();
      tm.send(createLocation("/", { isAction: true }));
      let VALUE = "ACTION JACKSON";
      await resolve(VALUE);
      expect(tm.getState().actionData).toBe(VALUE);
    });

    describe("errors", () => {
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
                children: [
                  {
                    path: "/child",
                    id: "child",
                    element: {},
                    ErrorBoundary: FakeComponent,
                    action
                  }
                ]
              }
            ]
          });
          await tm.send(createLocation("/child", { isAction: true }));
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
                loader: parentLoader,
                children: [
                  {
                    path: "/child",
                    id: "child",
                    element: {},
                    ErrorBoundary: FakeComponent,
                    action
                  }
                ]
              }
            ]
          });
          await tm.send(createLocation("/child", { isAction: true }));
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
                ErrorBoundary: FakeComponent,
                children: [
                  {
                    path: "/child",
                    id: "child",
                    element: {},
                    action
                  }
                ]
              }
            ]
          });
          await tm.send(createLocation("/child", { isAction: true }));
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
                ErrorBoundary: FakeComponent,
                children: [
                  {
                    path: "/parent",
                    id: "parent",
                    element: {},
                    loader: parentLoader,
                    children: [
                      {
                        path: "/child",
                        id: "child",
                        element: {},
                        action,
                        ErrorBoundary: FakeComponent
                      }
                    ]
                  }
                ]
              }
            ]
          });

          await tm.send(createLocation("/parent/child", { isAction: true }));
          let state = tm.getState();
          expect(state.errorBoundaryId).toBe("root");
          expect(state.error.message).toBe(ACTION_ERROR_MESSAGE);
        });
      });
    });
  });

  describe("actions with refs", () => {
    let submission: SubmissionState = {
      isAction: true,
      action: "/",
      method: "post",
      body: "name=Ryan&age=40", // geez
      encType: "application/x-www-form-urlencoded",
      id: 1
    };

    it("tracks pending submissions by ref", async () => {
      let actionDeferred = defer();
      let tm = createTestTransitionManager("/", {
        routes: [
          {
            path: "/",
            id: "root",
            element: {},
            action: () => actionDeferred.promise.then(v => v)
          }
        ]
      });

      let ref = {};
      tm.send(createLocation("/", submission), ref);

      expect(tm.getState().pendingSubmissionRefs.get(ref))
        .toMatchInlineSnapshot(`
        Object {
          "action": "/",
          "body": "name=Ryan&age=40",
          "encType": "application/x-www-form-urlencoded",
          "id": 1,
          "isAction": true,
          "method": "post",
        }
      `);
    });

    it("overwrites a ref's pending submission when resubmit", async () => {
      let actionDeferred = defer();

      let ref = {};

      let submission1: SubmissionState = {
        isAction: true,
        action: "/",
        method: "post",
        body: "name=Ryan&age=40", // geez
        encType: "application/x-www-form-urlencoded",
        id: 1
      };

      let submission2: SubmissionState = {
        isAction: true,
        action: "/",
        method: "post",
        body: "name=Ryan&age=40", // geez
        encType: "application/x-www-form-urlencoded",
        id: 2
      };

      let tm = createTestTransitionManager("/", {
        routes: [
          {
            path: "/",
            id: "root",
            element: {},
            action: () => actionDeferred.promise.then(v => v)
          }
        ]
      });

      tm.send(createLocation("/", submission1), ref);
      expect(tm.getState().pendingSubmissionRefs.get(ref).id).toBe(1);

      tm.send(createLocation("/", submission2), ref);
      expect(tm.getState().pendingSubmissionRefs.get(ref).id).toBe(2);
    });

    it("cleans up stale submissions", async () => {
      let tm = createTestTransitionManager("/", {
        routes: [
          {
            path: "/",
            id: "root",
            element: {},
            action: () => "ACTION DATA"
          }
        ]
      });

      let ref = {};
      await tm.send(createLocation("/", submission), ref);
      expect(tm.getState().pendingSubmissionRefs).toMatchInlineSnapshot(
        `Map {}`
      );
    });

    it("cleans up stale submissions on redirects", async () => {
      let redirectDeferred = defer();
      let tm = createTestTransitionManager("/", {
        onRedirect(href) {
          tm.send(createLocation(href)).then(() => redirectDeferred.promise);
        },
        routes: [
          {
            path: "/",
            id: "root",
            element: {},
            action: () => new TransitionRedirect("/")
          }
        ]
      });

      await tm.send(createLocation("/", submission), {});
      await redirectDeferred.resolve();
      expect(tm.getState().pendingSubmissionRefs).toMatchInlineSnapshot(
        `Map {}`
      );
    });

    it("cleans up stale submissions on errors", async () => {
      let redirectDeferred = defer();
      let tm = createTestTransitionManager("/", {
        onRedirect(href) {
          tm.send(createLocation(href)).then(() => redirectDeferred.promise);
        },
        routes: [
          {
            path: "/",
            id: "root",
            element: {},
            action: () => {
              throw new Error("Kaboom!");
            }
          }
        ]
      });

      await tm.send(createLocation("/", submission), {});
      expect(tm.getState().pendingSubmissionRefs).toMatchInlineSnapshot(
        `Map {}`
      );
    });

    it("tracks action data by ref", async () => {
      let DATA = "REF ACTION DATA";
      let tm = createTestTransitionManager("/", {
        routes: [
          {
            path: "/",
            id: "root",
            element: {},
            action: () => DATA
          }
        ]
      });

      let ref = {};
      await tm.send(createLocation("/", submission), ref);

      expect(tm.getActionDataForRef(ref)).toBe(DATA);
    });

    it("cleans up stale action data when garbage collected", async () => {
      let DATA = "REF ACTION DATA";
      let tm = createTestTransitionManager("/", {
        routes: [
          {
            path: "/",
            id: "root",
            element: {},
            action: () => DATA
          }
        ]
      });

      let ref: { current?: Object } = {};
      ref.current = {};

      await tm.send(createLocation("/", submission), ref.current);
      expect(tm.getActionDataForRef(ref.current)).toBe(DATA);
      delete ref.current; // should garbage collect? 🤞

      await tm.send(createLocation("/"));
      expect(tm.getActionDataForRef(ref)).toBeUndefined();
    });
  });

  describe("navigations while pending", () => {
    it.todo("aborts pending actions without refs");
    it.todo("aborts pending actions with refs?");

    let setup = ({ signals }: { signals?: boolean } = {}) => {
      let guid = -1;

      let nextLoaderId = guid;
      let nextActionId = guid;
      let lastRedirect: ReturnType<typeof navigate>;

      let navDeferreds = new Map<number, Deferred>();
      let loaderDeferreds = new Map<number, Deferred>();
      let actionDeferreds = new Map<number, Deferred>();
      let loaderAbortHandlers = new Map<number, jest.Mock>();
      let actionAbortHandlers = new Map<number, jest.Mock>();

      let handleChange = jest.fn();

      let handleRedirect = jest.fn((href: string) => {
        lastRedirect = navigate(href);
      });

      let loader = async ({ signal }: { signal: AbortSignal }) => {
        if (signals) signal.onabort = loaderAbortHandlers.get(nextLoaderId);
        return loaderDeferreds
          .get(nextLoaderId)
          .promise.then((val: any) => val);
      };

      let action = async ({ signal }: { signal: AbortSignal }) => {
        if (signals) signal.onabort = actionAbortHandlers.get(nextActionId);
        return actionDeferreds.get(nextActionId).promise.then((val: any) => {
          nextLoaderId = nextActionId;
          return val;
        });
      };

      let tm = createTestTransitionManager("/", {
        onChange: handleChange,
        onRedirect: handleRedirect,
        loaderData: undefined,
        routes: [
          { path: "/", id: "root", element: {} },
          { path: "/foo", id: "foo", loader, action, element: {} },
          { path: "/bar", id: "bar", loader, action, element: {} },
          { path: "/baz", id: "baz", loader, action, element: {} }
        ]
      });

      let get = (href: string) => navigate(href);
      let post = (href: string) => navigate(createActionLocation(href));

      let navigate = (location: string | Location<any>, ref?: Object) => {
        if (typeof location === "string") location = createLocation(location);
        let id = ++guid;
        let loaderAbortHandler = jest.fn();
        let actionAbortHandler = jest.fn();

        if (location.state?.isAction) {
          nextActionId = id;
          actionDeferreds.set(id, defer());
          actionAbortHandlers.set(id, actionAbortHandler);
        } else {
          nextLoaderId = id;
        }

        navDeferreds.set(id, defer());
        loaderDeferreds.set(id, defer());
        loaderAbortHandlers.set(id, loaderAbortHandler);

        async function resolveAction(val: any) {
          await actionDeferreds.get(id).resolve(val);
        }

        async function resolveLoader(val: any) {
          await loaderDeferreds.get(id).resolve(val);
          await navDeferreds.get(id).resolve();
        }

        async function redirectAction(href: string) {
          await resolveAction(new TransitionRedirect(href));
          return lastRedirect;
        }

        async function redirectLoader(href: string) {
          await resolveLoader(new TransitionRedirect(href));
          return lastRedirect;
        }

        tm.send(location, ref).then(() => navDeferreds.get(id).promise);

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

      return {
        tm,
        get,
        post,
        navigate,
        getState: tm.getState,
        handleChange,
        handleRedirect
      };
    };

    describe(`
      GET /foo
      GET /foo
    `, () => {
      describe(`
        A) GET /foo |------X
        B) GET /foo   |------O
      `, () => {
        it("ignores A, commits B", async () => {
          let t = setup();

          let A = t.get("/foo");
          let B = t.get("/foo");

          await A.loader.resolve("A");
          expect(t.getState().loaderData).toBeUndefined();

          await B.loader.resolve("B");
          expect(t.getState().loaderData.foo).toBe("B");
        });

        it("updates state only when necessary", async () => {
          let t = setup();

          let A = t.get("/foo");
          expect(t.handleChange.mock.calls.length).toBe(1);

          let B = t.get("/foo");
          expect(t.handleChange.mock.calls.length).toBe(2);

          await A.loader.resolve("A");
          expect(t.handleChange.mock.calls.length).toBe(2);

          await B.loader.resolve("B");
          expect(t.handleChange.mock.calls.length).toBe(3);
        });

        it("updates the correct location and nextLocation", async () => {
          let t = setup();
          let originalLocation = t.getState().location;

          let A = t.get("/foo");
          expect(t.getState().nextLocation).toBe(A.location);
          expect(t.getState().location).toBe(originalLocation);

          let B = t.get("/foo");
          expect(t.getState().nextLocation).toBe(B.location);
          expect(t.getState().location).toBe(originalLocation);

          await A.loader.resolve("A");
          expect(t.getState().location).toBe(originalLocation);
          expect(t.getState().nextLocation).toBe(B.location);

          await B.loader.resolve("B");
          expect(t.getState().location).toBe(B.location);
          expect(t.getState().nextLocation).toBeUndefined();
        });

        describe("with abort controller signals", () => {
          it("aborts A, commits B", async () => {
            let t = setup({ signals: true });

            let A = t.get("/foo");
            let B = t.get("/foo");
            expect(A.loader.abortMock.calls.length).toBe(1);

            await B.loader.resolve("B");
            expect(t.getState().loaderData.foo).toBe("B");
            expect(B.loader.abortMock.calls.length).toBe(0);
          });
        });
      });

      describe(`
        A) GET /foo |----------X
        B) GET /foo   |------O
      `, () => {
        it("aborts A, commits B", async () => {
          let t = setup();

          let A = t.get("/foo");
          let B = t.get("/foo");

          await B.loader.resolve("B");
          expect(t.getState().loaderData.foo).toBe("B");
          expect(t.handleChange.mock.calls.length).toBe(3);

          await A.loader.resolve("A");
          expect(t.getState().loaderData.foo).toBe("B");
          expect(t.handleChange.mock.calls.length).toBe(3);
        });

        it("updates the correct location and nextLocation", async () => {
          let t = setup();
          let originalLocation = t.getState().location;

          let A = t.get("/foo");
          expect(t.getState().nextLocation).toBe(A.location);
          expect(t.getState().location).toBe(originalLocation);

          let B = t.get("/foo");
          expect(t.getState().nextLocation).toBe(B.location);
          expect(t.getState().location).toBe(originalLocation);

          await B.loader.resolve("B");
          expect(t.getState().nextLocation).toBeUndefined();
          expect(t.getState().location).toBe(B.location);

          await A.loader.resolve("A");
          expect(t.getState().nextLocation).toBeUndefined();
          expect(t.getState().location).toBe(B.location);
        });
      });
    });

    describe(`
      GET /foo
      GET /bar
    `, () => {
      describe(`
        A) GET /foo |------X
        B) GET /bar    |------O
      `, () => {
        it("ignores A, commits B", async () => {
          let t = setup();

          let A = t.get("/foo");
          let B = t.get("/bar");

          await A.loader.resolve("A");
          expect(t.getState().loaderData).toBeUndefined();

          await B.loader.resolve("B");
          expect(t.getState().loaderData.bar).toBe("B");
          expect(t.getState().loaderData.foo).toBeUndefined();
        });
      });

      describe(`
        A) GET /foo |------------X
        B) GET /bar    |------O
      `, () => {
        it("ignores A, commits B", async () => {
          let t = setup();

          let A = t.get("/foo");
          let B = t.get("/bar");

          await B.loader.resolve("B");
          expect(t.getState().loaderData.bar).toBe("B");

          await A.loader.resolve("A");
          expect(t.getState().loaderData.bar).toBe("B");
          expect(t.getState().loaderData.foo).toBeUndefined();
        });
      });
    });

    describe(`
      GET /foo > 303 /baz
      GET /bar
    `, () => {
      describe(`
        A) GET /foo |-------/baz--X
        B) GET /bar   |---O
      `, () => {
        it("ignores A, commits B", async () => {
          let t = setup();

          let A = t.get("/foo");
          let B = t.get("/bar");

          await B.loader.resolve("B");
          expect(t.getState().loaderData.bar).toBe("B");
          expect(t.getState().location.pathname).toBe("/bar");

          await A.loader.redirect("/baz");
          expect(t.getState().loaderData.bar).toBe("B");
          expect(t.getState().location.pathname).toBe("/bar");
          expect(t.handleChange.mock.calls.length).toBe(3);
          expect(t.handleRedirect.mock.calls.length).toBe(0);
        });
      });

      describe(`
        A) GET /foo |-------/baz--X
        B) GET /bar   |---------------O
      `, () => {
        it("ignores A, commits B", async () => {
          let t = setup();
          let A = t.get("/foo");
          let B = t.get("/bar");

          await A.loader.redirect("/baz");
          await B.loader.resolve("B");
          expect(t.getState().location).toBe(B.location);
          expect(t.handleRedirect.mock.calls.length).toBe(0);
        });
      });

      describe(`
        A) GET /foo |--/baz---------X
        B) GET /bar             |--O
      `, () => {
        it("ignores A, commits B", async () => {
          let t = setup();

          let A = t.get("/foo");
          let AR = await A.loader.redirect("/baz");
          let B = t.get("/bar");
          await B.loader.resolve("B");
          await AR.loader.resolve("C");

          expect(t.getState().location).toBe(B.location);
          expect(t.getState().loaderData.foo).toBeUndefined();
          expect(t.getState().loaderData.bar).toBe("B");
          expect(t.getState().loaderData.baz).toBeUndefined();
        });

        it("sets all the right states at the right time", async () => {
          let t = setup();

          let A = t.get("/foo");
          expect(t.handleChange.mock.calls.length).toBe(1);
          expect(t.getState().nextLocation.pathname).toBe("/foo");

          let AR = await A.loader.redirect("/baz");
          expect(t.handleChange.mock.calls.length).toBe(2);
          expect(t.getState().nextLocation).toBe(AR.location);

          let B = t.get("/bar");
          expect(t.handleChange.mock.calls.length).toBe(3);
          expect(t.getState().nextLocation).toBe(B.location);

          await B.loader.resolve("B");
          expect(t.handleChange.mock.calls.length).toBe(4);
          expect(t.getState().nextLocation).toBeUndefined();
          expect(t.getState().location).toBe(B.location);

          await AR.loader.resolve("A");
          expect(t.getState().nextLocation).toBeUndefined();
          expect(t.getState().location).toBe(B.location);
          expect(t.handleChange.mock.calls.length).toBe(4);
        });
      });

      describe(`
        A) GET /foo |--/baz----X
        B) GET /bar          |-----O
      `, () => {
        it("ignores A, commits B", async () => {
          let t = setup();

          let A = t.get("/foo");
          let AR = await A.loader.redirect("/baz");
          let B = t.get("/bar");
          await AR.loader.resolve("A");
          await B.loader.resolve("B");

          expect(t.getState().location).toBe(B.location);
          expect(t.getState().loaderData.foo).toBeUndefined();
          expect(t.getState().loaderData.bar).toBe("B");
          expect(t.getState().loaderData.baz).toBeUndefined();
        });
      });
    });

    describe(`
      GET /foo > 303 /bar
      GET /bar
    `, () => {
      describe(`
        A) GET /foo(0) |-------/bar(2)--X
        B) GET /bar(1)   |---O
      `, () => {
        it("ignores A, commits B", async () => {
          let t = setup();

          let A = t.get("/foo");
          let B = t.get("/bar");

          await B.loader.resolve("B");
          expect(t.getState().loaderData.bar).toBe("B");
          expect(t.getState().location).toBe(B.location);

          await A.loader.redirect("/bar");
          expect(t.getState().location).toBe(B.location);
          expect(t.handleRedirect.mock.calls.length).toBe(0);
        });
      });

      describe(`
        A) GET /foo |-----/bar--X
        B) GET /bar    |------------O
      `, () => {
        it("ignores A, commits B, does not redirect", async () => {
          let t = setup();

          let A = t.get("/foo");
          let B = t.get("/bar");
          await A.loader.redirect("/bar");
          await B.loader.resolve("B");

          expect(t.getState().location).toBe(B.location);
          expect(t.handleRedirect.mock.calls.length).toBe(0);
        });
      });

      describe(`
        A) GET /foo |--/bar-------X
        B) GET /bar         |--O
      `, () => {
        it("ignores A, commits B", async () => {
          let t = setup();

          let A = t.get("/foo");
          let AR = await A.loader.redirect("/bar");
          let B = t.get("/bar");
          await B.loader.resolve("B");
          await AR.loader.resolve("A");

          expect(t.getState().location).toBe(B.location);
        });
      });

      describe(`
        A) GET /foo |--/bar------X
        B) GET /bar          |-------O
      `, () => {
        it("ignores A, commits B", async () => {
          let t = setup();

          let A = t.get("/foo");
          let AR = await A.loader.redirect("/bar");
          let B = t.get("/bar");
          await AR.loader.resolve("A");
          await B.loader.resolve("B");

          expect(t.getState().location).toBe(B.location);
        });
      });
    });

    describe(`
      POST /foo
      POST /foo
    `, () => {
      describe(`
        A) POST /foo(0) |----|----X
        B) POST /foo(1)    |----|----O
      `, () => {
        it("ignores A, commits B", async () => {
          let t = setup();

          let A = t.post("/foo");
          let B = t.post("/foo");
          await A.action.resolve("A ACTION");
          await B.action.resolve("B ACTION");
          await A.loader.resolve("A LOADER");
          await B.loader.resolve("B LOADER");

          expect(t.getState().location).toBe(B.location);
          expect(t.getState().actionData).toBe("B ACTION");
          expect(t.getState().loaderData.foo).toBe("B LOADER");
        });

        describe("with signals", () => {
          it("aborts A, commits B", async () => {
            let t = setup({ signals: true });

            let A = t.post("/foo");
            let B = t.post("/foo");
            expect(A.action.abortMock.calls.length).toBe(1);

            await B.action.resolve("B ACTION");
            await B.loader.resolve("B LOADER");
            expect(t.getState().actionData).toBe("B ACTION");
            expect(t.getState().loaderData.foo).toBe("B LOADER");
          });
        });
      });

      describe(`
        A) POST /foo |----|----------X
        B) POST /foo    |----|----O
      `, () => {
        it("commits B, ignores A", async () => {
          let t = setup();

          let A = t.post("/foo");
          let B = t.post("/foo");

          await A.action.resolve("A ACTION");
          await B.action.resolve("B ACTION");
          await B.loader.resolve("B LOADER");
          await A.loader.resolve("A LOADER");

          expect(t.getState().location).toBe(B.location);
          expect(t.getState().actionData).toBe("B ACTION");
          expect(t.getState().loaderData.foo).toBe("B LOADER");
        });
      });

      describe(`
        A) POST /foo |-----------|---X
        B) POST /foo    |----|-----O
      `, () => {
        it("commits B, ignores A", async () => {
          let t = setup();

          let A = t.post("/foo");
          let B = t.post("/foo");

          await B.action.resolve("B ACTION");
          await A.action.resolve("A ACTION");
          await B.loader.resolve("B LOADER");
          await A.loader.resolve("A LOADER");

          expect(t.getState().location).toBe(B.location);
          expect(t.getState().actionData).toBe("B ACTION");
          expect(t.getState().loaderData.foo).toBe("B LOADER");
        });
      });

      describe(`
        A) POST /foo |-----------|---X
        B) POST /foo    |----|----------O
      `, () => {
        it("commits A, aborts B", async () => {
          let t = setup();

          let A = t.post("/foo");
          let B = t.post("/foo");

          await B.action.resolve("B ACTION");
          await A.action.resolve("A ACTION");
          await A.loader.resolve("A LOADER");
          await B.loader.resolve("B LOADER");

          expect(t.getState().location).toBe(B.location);
          expect(t.getState().actionData).toBe("B ACTION");
          expect(t.getState().loaderData.foo).toBe("B LOADER");
        });
      });

      describe(`
        A) POST /foo |--|----------X
        B) POST /foo       |----|-----O
      `, () => {
        it("commits B, ignores A", async () => {
          let t = setup();

          let A = t.post("/foo");
          await A.action.resolve("A ACTION");
          let B = t.post("/foo");
          await B.action.resolve("B ACTION");
          await A.loader.resolve("A LOADER");
          await B.loader.resolve("B LOADER");

          expect(t.getState().location).toBe(B.location);
          expect(t.getState().actionData).toBe("B ACTION");
          expect(t.getState().loaderData.foo).toBe("B LOADER");
        });

        describe("with signals", () => {
          it("commits B, ignores A action, aborts A load", async () => {
            let t = setup({ signals: true });

            let A = t.post("/foo");
            await A.action.resolve("A ACTION");
            let B = t.post("/foo");
            await B.action.resolve("B ACTION");
            expect(A.action.abortMock.calls.length).toBe(1);

            await B.loader.resolve("B LOADER");
            expect(t.getState().location).toBe(B.location);
          });
        });
      });
    });

    describe(`
      A) POST /foo |---|---X
      B) GET  /bar   |-------O
    `, () => {
      it("ignores POST /foo, commits GET /bar", async () => {
        let t = setup();

        let A = t.post("/foo");
        let B = t.get("/bar");
        await A.action.resolve("A ACTION");
        await A.loader.resolve("A LOADER");
        await B.loader.resolve("B LOADER");

        expect(t.getState().location).toBe(B.location);
        expect(t.getState().actionData).toBeUndefined();
        expect(t.getState().loaderData.bar).toBe("B LOADER");
      });
    });

    describe(`
      A) GET  /foo |-------X
      B) POST /bar   |--|-----O
    `, () => {
      it("ignores POST /foo, commits GET /bar", async () => {
        let t = setup();

        let A = t.get("/foo");
        let B = t.post("/bar");
        await B.action.resolve("B ACTION");
        await A.loader.resolve("A LOADER");
        await B.loader.resolve("B LOADER");

        expect(t.getState().location).toBe(B.location);
        expect(t.getState().actionData).toBe("B ACTION");
        expect(t.getState().loaderData.bar).toBe("B LOADER");
      });
    });

    describe(`
      POST /foo > 303 /foo
      POST /foo > 303 /foo
    `, () => {
      describe(`
        A) POST /foo |----/foo----X
        B) POST /foo    |----/foo----O
      `, () => {
        it("ignores A, does not redirect, commits B", async () => {
          let t = setup();

          let A = t.post("/foo");
          let B = t.post("/foo");

          await A.action.redirect("/foo");
          expect(t.handleRedirect.mock.calls.length).toBe(0);

          let BR = await B.action.redirect("/foo");
          expect(t.handleRedirect.mock.calls.length).toBe(1);

          await BR.loader.resolve("B");
          expect(t.getState().location).toBe(BR.location);
          expect(t.getState().loaderData.foo).toBe("B");
        });
      });
    });

    describe("with action refs it gets CUHRAZZZY", () => {
      describe(`
        POST /foo
        POST /foo
      `, () => {
        describe(`
          A) POST /foo(0) |----|----O
          B) POST /foo(1)    |----|----O
        `, () => {
          it.todo("aborts a load when a newer one lands");
          it.todo("sets pending submissions refs");
          it.todo("overwrites resubmitting the same ref");

          it.skip("commits A, commits B", async () => {
            let t = setup();
            let refA = { a: true };
            let refB = { b: true };

            t.navigate(createActionLocation("/foo"), refA);
            t.navigate(createActionLocation("/foo"), refB);

            await t.action.resolve(0, "A ACTION");
            expect(t.tm.getActionDataForRef(refA)).toBe("A ACTION");
            expect(t.getState().actionData.foo).toBeUndefined();
            // expect(t.getState().actionData.foo).toBe("A ACTION"); // better?

            await t.action.resolve(1, "B ACTION");
            expect(t.tm.getActionDataForRef(refB)).toBe("B ACTION");
            expect(t.getState().actionData.foo).toBeUndefined();
            // expect(t.getState().actionData.foo).toBe("B ACTION"); // better?

            await t.loader.resolve("[A]");
            expect(t.getState().loaderData.foo).toBe("[A]");

            // await t.loader.resolve("[A,B]");
            // expect(t.getState().actionData.foo).toBe("B ACTION");
            // expect(t.getState().loaderData.foo).toBe("[A,B]");
          });
        });

        describe(`
          A) POST /foo |----|----------X
          B) POST /foo    |----|----O
        `, () => {
          it.todo("commits B, aborts A");
        });
        describe(`
          A) POST /foo |-----------|---O
          B) POST /foo    |----|-----O
        `, () => {
          it.todo("commits B, commits A");
        });
        describe(`
          A) POST /foo |-----------|---O
          B) POST /foo    |----|----------X
        `, () => {
          it.todo("commits A, aborts B");
        });
      });
      describe(`
        POST /foo > 303 /foo
        POST /foo > 303 /foo
      `, () => {
        describe(`
          A) POST /foo |----/foo----O
          B) POST /foo    |----/foo----O
        `, () => {
          it.todo("commits A, commits B");
        });
        describe(`
          A) POST /foo |----/foo----------X
          B) POST /foo    |----/foo----O
        `, () => {
          it.todo("commits B, aborts A");
        });
        describe(`
          A) POST /foo |-----------/foo---O
          B) POST /foo    |----/foo-----O
        `, () => {
          it.todo("commits B, commits A");
        });
        describe(`
          A) POST /foo |-----------/foo---O
          B) POST /foo    |----/foo----------X
        `, () => {
          it.todo("commits A, aborts B");
        });
      });
      describe(`
        @    /foo
        POST /bar > 303 /foo
        POST /bar > 303 /foo
      `, () => {
        describe(`
          A) POST /bar(0) |----/foo(2)----O
          B) POST /bar(1)    |----/foo(3)----O
        `, () => {
          it.todo("commits A, commits B");
        });
        describe(`
          A) POST /bar |----/foo----------X
          B) POST /bar    |----/foo----O
        `, () => {
          it.todo("commits B, aborts A");
        });
        describe(`
          A) POST /bar |-----------/foo---O
          B) POST /bar    |----/foo-----O
        `, () => {
          it.todo("commits B, commits A");
        });
        describe(`
          A) POST /bar |-----------/foo---O
          B) POST /bar    |----/foo----------X
        `, () => {
          it.todo("commits A, aborts B");
        });
      });
    });
  });
});

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

type Deferred = ReturnType<typeof defer>;

function FakeComponent() {
  return null;
}
