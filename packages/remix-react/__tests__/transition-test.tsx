import { Location } from "history";
import {
  createTransitionManager,
  SubmissionRef,
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
        loader: async () => ({
          fakeLoaderDataFor: "routes/a"
        }),
        action: async () => ({
          fakeActionDataFor: "routes/a"
        }),
        element: {}
      }
    ]
  }
];

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

describe("react-router", () => {
  it.todo("replaces pending locations even on a push");
});

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
            {
              path: "/will-redirect",
              id: "redirect",
              loader,
              element: {}
            },
            {
              path: "/redirect-target",
              id: "target",
              element: {}
            }
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

    it("allows `null` as a valid data value", async () => {
      let tm = createTestTransitionManager("/", {
        routes: [
          { path: "/", id: "root", element: {} },
          {
            path: "/test",
            id: "test",
            loader: () => Promise.resolve(null),
            element: {}
          }
        ]
      });

      await tm.send(createLocation("/test"));
      expect(tm.getState().loaderData.test).toBe(null);
    });

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

    describe("with shouldReload", () => {
      it("delegates to the route if it should reload or not", async () => {
        let rootLoader = jest.fn();
        let childLoader = jest.fn(() => "CHILD");
        let shouldReload = jest.fn(({ nextLocation }) => {
          let params = new URLSearchParams(nextLocation.search);
          return params.get("reload") === "1";
        });
        let tm = createTestTransitionManager("/", {
          loaderData: {
            "/": "ROOT"
          },
          routes: [
            {
              path: "/",
              id: "root",
              loader: rootLoader,
              shouldReload,
              element: {},
              children: [
                {
                  path: "/child",
                  id: "child",
                  loader: childLoader,
                  element: {}
                }
              ]
            }
          ]
        });

        await tm.send(createLocation("/child?reload=1"));
        expect(rootLoader.mock.calls.length).toBe(1);

        await tm.send(createLocation("/child?reload=0"));
        expect(rootLoader.mock.calls.length).toBe(1);
      });

      it("passes prev/next match to shouldReload", async () => {
        let loader = jest.fn(() => "PARAM");
        let shouldReload = jest.fn(() => true);

        let tm = createTestTransitionManager("/one", {
          loaderData: {
            "/:param": "PARAM"
          },
          routes: [
            {
              path: "/:param",
              id: "root",
              loader,
              shouldReload,
              element: {}
            }
          ]
        });

        await tm.send(createLocation("/two"));
        expect(loader.mock.calls.length).toBe(1);
        expect(shouldReload.mock.calls.length).toBe(1);
        // @ts-ignore
        let reloadArg = shouldReload.mock.calls[0][0] as any;
        expect(reloadArg.prevMatch.params).toEqual({
          param: "one"
        });
        expect(reloadArg.nextMatch.params).toEqual({
          param: "two"
        });
      });
    });

    describe("errors", () => {
      it.todo("clears out the error on new locations");
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
          let child = {
            path: "/child",
            id: "child",
            element: {},
            loader
          };
          let parent = {
            path: "/",
            id: "parent",
            element: {},
            ErrorBoundary: FakeComponent,
            children: [child]
          };

          let tm = createTestTransitionManager("/", {
            routes: [parent]
          });
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

          await tm.send(
            createLocation("/parent/child", {
              isAction: true
            })
          );
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
      expect(tm.getRefActionData(ref)).toBe(DATA);
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
      expect(tm.getRefActionData(ref.current)).toBe(DATA);
      delete ref.current; // should garbage collect 🤞

      await tm.send(createLocation("/"));
      expect(tm.getRefActionData(ref)).toBeUndefined();
    });
  });

  describe("navigations while pending", () => {
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

      let handleRedirect = jest.fn((href: string, ref?: SubmissionRef) => {
        lastRedirect = navigate(href, ref);
      });

      let loader = async ({ signal }: { signal: AbortSignal }) => {
        if (signals) signal.onabort = loaderAbortHandlers.get(nextLoaderId);
        return loaderDeferreds.get(nextLoaderId).promise.then((val: any) => {
          return val;
        });
      };

      let action = async ({ signal }: { signal: AbortSignal }) => {
        let myId = nextActionId;
        if (signals) signal.onabort = actionAbortHandlers.get(nextActionId);
        return actionDeferreds.get(nextActionId).promise.then((val: any) => {
          nextLoaderId = myId;
          return val;
        });
      };

      let tm = createTestTransitionManager("/foo", {
        onChange: handleChange,
        onRedirect: handleRedirect,
        loaderData: undefined,
        routes: [
          {
            path: "/foo",
            id: "foo",
            loader,
            action,
            element: {}
          },
          {
            path: "/bar",
            id: "bar",
            loader,
            action,
            element: {}
          },
          {
            path: "/baz",
            id: "baz",
            loader,
            action,
            element: {}
          }
        ]
      });

      let get = (href: string) => navigate(href);
      let post = (href: string, ref?: Object) =>
        navigate(createActionLocation(href), ref);

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

    describe("with action refs", () => {
      describe(`
        POST /foo
        POST /foo
      `, () => {
        describe(`
          A) POST /foo |----|[A]----O
          B) POST /foo    |----|[A,B]----O
        `, () => {
          it("overwrites resubmitting the same ref", async () => {
            let t = setup();
            let refA = {};
            t.post("/foo", refA);
            let submission = t.tm.getPendingRefSubmission(refA);
            expect(submission.id).toBeDefined();

            t.post("/foo", refA);
            let submission2 = t.tm.getPendingRefSubmission(refA);
            expect(submission2.id).not.toEqual(submission.id);
          });

          it("commits action and loader data at every step", async () => {
            let t = setup();
            let refA = { a: true };
            let refB = { b: true };
            let originalLocation = t.getState().location;

            let A = t.post("/foo", refA);
            expect(t.getState().nextLocation).toBe(A.location);
            let B = t.post("/foo", refB);
            expect(t.getState().nextLocation).toBe(B.location);

            await A.action.resolve("A ACTION");
            expect(t.tm.getRefActionData(refA)).toBe("A ACTION");
            expect(t.getState().actionData).toBe("A ACTION");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await B.action.resolve("B ACTION");
            expect(t.tm.getRefActionData(refB)).toBe("B ACTION");
            expect(t.getState().actionData).toBe("B ACTION");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await A.loader.resolve("[A]");
            expect(t.getState().loaderData.foo).toBe("[A]");
            expect(t.getState().actionData).toBe("B ACTION");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await B.loader.resolve("[A,B]");
            expect(t.getState().loaderData.foo).toBe("[A,B]");
            expect(t.getState().actionData).toBe("B ACTION");
            expect(t.getState().location).toBe(B.location);
            expect(t.getState().nextLocation).toBeUndefined();
          });
        });

        describe(`
          A) POST /foo |----|[A]----------X
          B) POST /foo    |----|[A,B]---O
        `, () => {
          it("commits A action, B action/loader; ignores A loader", async () => {
            let t = setup();
            let refA = {};
            let refB = {};
            let originalLocation = t.getState().location;

            let A = t.post("/foo", refA);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(A.location);
            let B = t.post("/foo", refB);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await A.action.resolve("A ACTION");
            expect(t.tm.getRefActionData(refA)).toBe("A ACTION");
            expect(t.getState().actionData).toBe("A ACTION");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await B.action.resolve("B ACTION");
            expect(t.tm.getRefActionData(refB)).toBe("B ACTION");
            expect(t.getState().actionData).toBe("B ACTION");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await B.loader.resolve("[A,B]");
            expect(t.getState().loaderData.foo).toBe("[A,B]");
            expect(t.getState().actionData).toBe("B ACTION");
            expect(t.getState().location).toBe(B.location);
            expect(t.getState().nextLocation).toBeUndefined();

            await A.loader.resolve("[A]");
            expect(t.getState().loaderData.foo).toBe("[A,B]");
            expect(t.getState().actionData).toBe("B ACTION");
            expect(t.getState().location).toBe(B.location);
            expect(t.getState().nextLocation).toBeUndefined();
          });
        });

        describe(`
          A) POST /foo |-----------|[B,A]---O
          B) POST /foo    |----|[B]-----O
        `, () => {
          it("commits B, commits A", async () => {
            let t = setup();
            let refA = {};
            let refB = {};
            let originalLocation = t.getState().location;

            let A = t.post("/foo", refA);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(A.location);

            let B = t.post("/foo", refB);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await B.action.resolve("B ACTION");
            expect(t.tm.getRefActionData(refB)).toBe("B ACTION");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await A.action.resolve("A ACTION");
            expect(t.tm.getRefActionData(refA)).toBe("A ACTION");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await B.loader.resolve("[B]");
            expect(t.getState().loaderData.foo).toBe("[B]");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await A.loader.resolve("[B,A]");
            expect(t.getState().loaderData.foo).toBe("[B,A]");
            expect(t.getState().nextLocation).toBeUndefined();
            expect(t.getState().location).toBe(B.location);
          });
        });

        describe(`
          A) POST /foo |-----------|[B,A]---O
          B) POST /foo    |---|[B]-------------X
        `, () => {
          it("commits A, aborts B", async () => {
            let t = setup();
            let refA = {};
            let refB = {};
            let originalLocation = t.getState().location;

            let A = t.post("/foo", refA);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(A.location);

            let B = t.post("/foo", refB);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await B.action.resolve("B ACTION");
            expect(t.tm.getRefActionData(refB)).toBe("B ACTION");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await A.action.resolve("A ACTION");
            expect(t.tm.getRefActionData(refA)).toBe("A ACTION");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await A.loader.resolve("[B,A]");
            expect(t.getState().loaderData.foo).toBe("[B,A]");
            expect(t.getState().location).toBe(B.location);
            expect(t.getState().nextLocation).toBeUndefined();

            await B.loader.resolve("[B]");
            expect(t.getState().loaderData.foo).toBe("[B,A]");
            expect(t.getState().location).toBe(B.location);
            expect(t.getState().nextLocation).toBeUndefined();
          });
        });
      });

      describe(`
        POST /foo > 303 /foo
        POST /foo > 303 /foo
      `, () => {
        describe(`
          A) POST /foo |-----/foo[A]------O
          B) POST /foo    |-----/foo[A,B]----O
        `, () => {
          it("commits A, commits B", async () => {
            let t = setup();
            let refA = { a: true };
            let refB = { b: true };
            let originalLocation = t.getState().location;

            let A = t.post("/foo", refA);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(A.location);
            expect(t.tm.getPendingRefSubmission(refA)).toBeDefined();
            expect(t.tm.getPendingRefSubmission(refA)).toBe(A.location.state);

            let B = t.post("/foo", refB);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);
            expect(t.tm.getPendingRefSubmission(refB)).toBeDefined();

            let AR = await A.action.redirect("/foo");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(AR.location);
            expect(t.tm.getPendingRefSubmission(refA)).toBeUndefined();

            let BR = await B.action.redirect("/foo");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(BR.location);
            expect(t.tm.getPendingRefSubmission(refB)).toBeUndefined();

            await AR.loader.resolve("[A]");
            expect(t.getState().loaderData.foo).toBe("[A]");

            await BR.loader.resolve("[A,B]");
            expect(t.getState().loaderData.foo).toBe("[A,B]");
            expect(t.getState().location).toBe(BR.location);
          });
        });
        describe(`
          A) POST /foo |----/foo[A]------------X
          B) POST /foo    |----/foo[A,B]----O
        `, () => {
          it("commits B, aborts A", async () => {
            let t = setup();
            let refA = { a: true };
            let refB = { b: true };
            let originalLocation = t.getState().location;

            let A = t.post("/foo", refA);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(A.location);

            let B = t.post("/foo", refB);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            let AR = await A.action.redirect("/foo");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(AR.location);

            let BR = await B.action.redirect("/foo");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(BR.location);

            await BR.loader.resolve("[A,B]");
            expect(t.getState().loaderData.foo).toBe("[A,B]");
            expect(t.getState().location).toBe(BR.location);

            await AR.loader.resolve("[A]");
            expect(t.getState().loaderData.foo).toBe("[A,B]");
            expect(t.getState().location).toBe(BR.location);
          });
        });
        describe(`
          A) POST /foo |-----------/foo[B,A]---O
          B) POST /foo    |----/foo[B]-----O
        `, () => {
          it("commits B, commits A", async () => {
            let t = setup();
            let refA = { a: true };
            let refB = { b: true };
            let originalLocation = t.getState().location;

            let A = t.post("/foo", refA);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(A.location);

            let B = t.post("/foo", refB);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            let BR = await B.action.redirect("/foo");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(BR.location);

            let AR = await A.action.redirect("/foo");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(AR.location);

            await BR.loader.resolve("[B]");
            expect(t.getState().loaderData.foo).toBe("[B]");
            expect(t.getState().nextLocation).toBe(AR.location);

            await AR.loader.resolve("[B,A]");
            expect(t.getState().loaderData.foo).toBe("[B,A]");
            expect(t.getState().location).toBe(AR.location);
          });
        });
        describe(`
          A) POST /foo |-----------/foo[B,A]---O
          B) POST /foo    |----/foo[B]------------X
        `, () => {
          it("commits A, ignores B", async () => {
            let t = setup();
            let refA = { a: true };
            let refB = { b: true };
            let originalLocation = t.getState().location;

            let A = t.post("/foo", refA);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(A.location);

            let B = t.post("/foo", refB);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            let BR = await B.action.redirect("/foo");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(BR.location);

            let AR = await A.action.redirect("/foo");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(AR.location);

            await AR.loader.resolve("[B,A]");
            expect(t.getState().loaderData.foo).toBe("[B,A]");
            expect(t.getState().location).toBe(AR.location);

            await BR.loader.resolve("[B]");
            expect(t.getState().loaderData.foo).toBe("[B,A]");
            expect(t.getState().location).toBe(AR.location);
          });
          describe("with signals", () => {
            it("aborts B redirect load", async () => {
              let t = setup({ signals: true });
              let refA = { a: true };
              let refB = { b: true };

              let A = t.post("/foo", refA);
              let B = t.post("/foo", refB);
              let BR = await B.action.redirect("/foo");
              let AR = await A.action.redirect("/foo");
              await AR.loader.resolve("[B,A]");

              expect(BR.loader.abortMock.calls.length).toBe(1);
              expect(t.getState().loaderData.foo).toBe("[B,A]");
              expect(t.getState().location).toBe(AR.location);
            });
          });
        });
      });

      describe("navigating without a ref after navigating with one", () => {
        describe(`
          A) POST /foo |--X
          B) GET  /bar    |--O
        `, () => {
          it("aborts A, commits B", async () => {
            let t = setup({ signals: true });
            let ref = {};
            let A = t.post("/foo", ref);
            let B = t.get("/bar");
            expect(A.action.abortMock.calls.length).toBe(1);
            await B.loader.resolve("B");
            expect(t.getState().loaderData.bar).toBe("B");
          });
          it("clears pending submission A", async () => {
            let t = setup({ signals: true });
            let ref = {};
            t.post("/foo", ref);
            expect(t.tm.getPendingRefSubmission(ref)).toBeDefined();
            t.get("/bar");
            expect(t.tm.getPendingRefSubmission(ref)).toBeUndefined();
          });
        });

        describe(`
          A) POST /foo |--|--X
          B) GET  /bar       |----O
        `, () => {
          it("aborts A, commits B", async () => {
            let t = setup({ signals: true });
            let ref = {};
            let A = t.post("/foo", ref);
            await A.action.resolve("A ACTION");
            let B = t.get("/bar");
            expect(A.loader.abortMock.calls.length).toBe(1);
            await B.loader.resolve("B");
            expect(t.getState().loaderData.bar).toBe("B");
          });
        });

        describe(`
          A) POST /foo |--X
          B) POST /bar    |---|---O
        `, () => {
          it("ignores A, commits B", async () => {
            let t = setup({ signals: true });
            let ref = {};
            let A = t.post("/foo", ref);
            t.post("/bar");
            expect(A.action.abortMock.calls.length).toBe(1);
          });
          it("clears pending submission A", async () => {
            let t = setup({ signals: true });
            let ref = {};
            t.post("/foo", ref);
            expect(t.tm.getPendingRefSubmission(ref)).toBeDefined();
            t.post("/bar");
            expect(t.tm.getPendingRefSubmission(ref)).toBeUndefined();
          });
        });
      });
    });
  });
});
