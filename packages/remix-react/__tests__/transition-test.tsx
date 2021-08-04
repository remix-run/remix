import type { Location } from "history";
import { parsePath } from "history";
import type {
  GenericGetSubmission,
  GenericSubmission,
  KeyedGetSubmission,
  KeyedPostSubmission,
  NormalGetSubmission,
  NormalPostSubmission
} from "../transition";

import { idleTransition } from "../transition";

import { createTransitionManager, TransitionRedirect } from "../transition";
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
  let { pathname, search, hash } = parsePath(path);

  return {
    pathname: pathname || "",
    search: search || "",
    hash: hash || "",
    key: String(++fakeKey),
    state
  };
}

function createActionLocation(
  path: string,
  submissionKey?: string,
  body?: string
) {
  let submission: GenericSubmission = {
    isSubmission: true,
    action: path,
    method: "POST",
    body: body || "gosh=dang",
    encType: "application/x-www-form-urlencoded",
    submissionKey
  };
  return createLocation(path, submission);
}

function createGetSubmission(
  path: string,
  submissionKey?: string,
  body?: string
) {
  let submission: GenericGetSubmission = {
    isSubmission: true,
    action: path,
    method: "GET",
    body: body || "gosh=dang",
    encType: "application/x-www-form-urlencoded",
    submissionKey
  };
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

let setupTest = ({ signals }: { signals?: boolean } = {}) => {
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

  let handleRedirect = jest.fn((location: Location<any>) => {
    lastRedirect = navigate(location);
  });

  let rootLoader = jest.fn(() => "PARENT");

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
        path: "/",
        id: "root",
        element: {},
        loader: rootLoader,
        children: [
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
      }
    ]
  });

  let get = (href: string) => navigate(href);
  let post = (href: string, key?: string, body?: string) =>
    navigate(createActionLocation(href, key, body));
  let submitGet = (href: string, key?: string, body?: string) =>
    navigate(createGetSubmission(href, key, body));

  let navigate = (location: string | Location<any>) => {
    if (typeof location === "string") location = createLocation(location);
    let id = ++guid;
    let loaderAbortHandler = jest.fn();
    let actionAbortHandler = jest.fn();

    if (location.state?.isSubmission && location.state.method !== "GET") {
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

    tm.send(location).then(() => navDeferreds.get(id).promise);

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
    submitGet,
    navigate,
    getState: tm.getState,
    handleChange,
    handleRedirect,
    rootLoaderMock: rootLoader.mock
  };
};

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
        "errorBoundaryId": null,
        "keyedActionData": Object {},
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
        "transition": Object {
          "formData": undefined,
          "method": undefined,
          "nextLocation": undefined,
          "state": "idle",
          "type": "idle",
        },
        "transitions": Map {},
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

  describe("Normal GET navigations", () => {
    describe("redirects", () => {
      it("redirects", async () => {
        let loaderDeferred = defer();
        let redirectDeferred = defer();
        let loader = () => loaderDeferred.promise.then(val => val);
        let handleRedirect = jest.fn((location: Location<any>) => {
          tm.send(location).then(() => redirectDeferred.promise);
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
        expect(handleRedirect.mock.calls[0][0].pathname).toBe(
          "/redirect-target"
        );
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

      describe("hash change", () => {
        it("does not load anything", async () => {
          let t = setup();
          await t.tm.send(createLocation("/p/one"));
          expect(t.parentLoader.mock.calls.length).toBe(0);
          expect(t.paramLoader.mock.calls.length).toBe(1);

          await t.tm.send(createLocation("/p/one#tacos"));
          expect(t.parentLoader.mock.calls.length).toBe(0);
          expect(t.paramLoader.mock.calls.length).toBe(1);

          await t.tm.send(createLocation("/p/one#burgers"));
          expect(t.parentLoader.mock.calls.length).toBe(0);
          expect(t.paramLoader.mock.calls.length).toBe(1);
        });
      });
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
        expect(reloadArg.prevParams).toEqual({
          param: "one"
        });
        expect(reloadArg.nextParams).toEqual({
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

  describe("Normal Submissions", () => {
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
      await tm.send(
        createLocation("/child", { isSubmission: true, method: "POST" })
      );
      expect(tm.getState().actionData).toBe("CHILD ACTION");

      await tm.send(createLocation("/child"));
      expect(tm.getState().actionData).toBeUndefined();
    });

    it("calls only the leaf route action", async () => {
      let t = setup();
      await t.tm.send(
        createLocation("/child", { isSubmission: true, method: "POST" })
      );
      expect(t.parentAction.mock.calls.length).toBe(0);
      expect(t.childAction.mock.calls.length).toBe(1);
    });

    it("reloads all routes after the action", async () => {
      let t = setup();
      await t.tm.send(
        createLocation("/child", { isSubmission: true, method: "POST" })
      );
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
      let redirectDeferred = defer();

      let action = jest.fn(() => actionDeferred.promise.then(val => val));
      let childLoader = jest.fn(() => "CHILD");
      let parentLoader = jest.fn(() => "PARENT");

      let tm = createTestTransitionManager("/", {
        onRedirect(location) {
          tm.send(location).then(() => redirectDeferred.promise);
        },
        routes: [
          {
            path: "/",
            id: "root",
            action,
            loader: parentLoader,
            element: {},
            children: [
              { path: "/a", id: "a", loader: childLoader, element: {} }
            ]
          }
        ],
        loaderData: {}
      });

      tm.send(createLocation("/", { isSubmission: true, method: "POST" }));
      await actionDeferred.resolve(new TransitionRedirect("/a"));
      await redirectDeferred.resolve();

      let state = tm.getState();
      expect(action.mock.calls.length).toBe(1);
      expect(parentLoader.mock.calls.length).toBe(1);
      expect(childLoader.mock.calls.length).toBe(1);
      expect(state.loaderData).toMatchInlineSnapshot(`
        Object {
          "a": "CHILD",
          "root": "PARENT",
        }
      `);
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
      tm.send(createLocation("/", { isSubmission: true, method: "POST" }));
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
          await tm.send(
            createLocation("/child", { isSubmission: true, method: "POST" })
          );
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
          await tm.send(
            createLocation("/child", { isSubmission: true, method: "POST" })
          );
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
          await tm.send(
            createLocation("/child", { isSubmission: true, method: "POST" })
          );
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
              isSubmission: true,
              method: "POST"
            })
          );
          let state = tm.getState();
          expect(state.errorBoundaryId).toBe("root");
          expect(state.error.message).toBe(ACTION_ERROR_MESSAGE);
        });
      });
    });

    it("updates the transition's state", async () => {
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

      let submission: NormalPostSubmission = {
        isSubmission: true,
        action: "/",
        method: "POST",
        body: "name=Ryan&age=40",
        encType: "application/x-www-form-urlencoded"
      };
      let location = createLocation("/", submission);
      tm.send(location);

      let transition = tm.getState().transition;
      expect(transition.state).toBe("submitting");
      expect(transition.nextLocation).toBe(location);
      // @ts-expect-error
      expect(new URLSearchParams(transition.formData).toString()).toBe(
        submission.body
      );
      expect(transition.method).toBe("POST");

      await actionDeferred.resolve("ACTION DATA");
      transition = tm.getState().transition;
      expect(transition.state).toBe("loading");
      expect(transition.type).toBe("actionReload");
      expect(transition.nextLocation).toBe(location);
      // @ts-expect-error
      expect(new URLSearchParams(transition.formData).toString()).toBe(
        submission.body
      );
      expect(transition.method).toBe("POST");
    });
  });

  describe("actions with submission keys", () => {
    const SUBMISSION_KEY = "key";

    let submission: KeyedPostSubmission = {
      isSubmission: true,
      action: "/",
      method: "POST",
      body: "name=Ryan&age=40",
      encType: "application/x-www-form-urlencoded",
      submissionKey: SUBMISSION_KEY
    };

    it("tracks transitions", async () => {
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

      let location = createLocation("/", submission);
      tm.send(location);

      let transition = tm.getState().transitions.get(SUBMISSION_KEY);
      expect(transition.state).toBe("submitting");
      expect(transition.nextLocation).toBe(location);
      // @ts-expect-error
      expect(new URLSearchParams(transition.formData).toString()).toBe(
        submission.body
      );
      expect(transition.method).toBe("POST");

      await actionDeferred.resolve("ACTION DATA");
      transition = tm.getState().transitions.get(SUBMISSION_KEY);
      expect(transition.state).toBe("loading");
      expect(transition.type).toBe("actionReload");
      expect(transition.nextLocation).toBe(location);
      // @ts-expect-error
      expect(new URLSearchParams(transition.formData).toString()).toBe(
        submission.body
      );
      expect(transition.method).toBe("POST");
    });

    it("cleans up completed submissions", async () => {
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

      await tm.send(createLocation("/", submission));
      expect(tm.getState().transitions).toMatchInlineSnapshot(`Map {}`);
    });

    it("cleans up completed submissions on redirects", async () => {
      let redirectDeferred = defer();
      let tm = createTestTransitionManager("/", {
        onRedirect(location) {
          tm.send(location).then(() => redirectDeferred.promise);
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

      await tm.send(createLocation("/", submission));
      await redirectDeferred.resolve();
      expect(tm.getState().transitions).toMatchInlineSnapshot(`Map {}`);
    });

    it("cleans up stale submissions on errors", async () => {
      let redirectDeferred = defer();
      let tm = createTestTransitionManager("/", {
        onRedirect(location) {
          tm.send(location).then(() => redirectDeferred.promise);
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

      await tm.send(createLocation("/", submission));
      expect(tm.getState().transitions).toMatchInlineSnapshot(`Map {}`);
    });

    it("tracks action data by key", async () => {
      let DATA = "KEY ACTION DATA";
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

      await tm.send(createLocation("/", submission));
      expect(tm.getState().keyedActionData[SUBMISSION_KEY]).toBe(DATA);
    });
  });

  describe("navigations while pending", () => {
    describe("interrupting submissions with GET", () => {
      // This is so that optimistic UI is more likely to be in sync with the
      // real data. The submission is aborted but it still hits the server, so
      // we want the next load to capture that if it actually completed.  We
      // might want to await any pending actions that currently are being read
      // from a `useTransition` to have the best chance of not getting the UI
      // out of sync, or even a `useCriticalSubmission()` that makes sure to
      // await before loading the next page.
      it("reloads all routes on GET", async () => {
        let t = setupTest({ signals: true });
        t.post("/foo");
        let B = t.get("/bar");
        await B.loader.resolve(null);
        expect(t.rootLoaderMock.calls.length).toBe(1);
      });

      it("with pending keyed submission, reloads all routes", async () => {
        let t = setupTest({ signals: true });
        let key = "A";
        t.post("/foo", key);
        let B = t.get("/bar");
        await B.loader.resolve(null);
        expect(t.rootLoaderMock.calls.length).toBe(1);
      });
    });

    describe(`
      GET /foo
      GET /foo
    `, () => {
      describe(`
        A) GET /foo |-:---X
        B) GET /foo   |------O
      `, () => {
        it("ignores A, commits B", async () => {
          let t = setupTest();

          let A = t.get("/foo");
          let B = t.get("/foo");

          await A.loader.resolve("A");
          expect(t.getState().loaderData).toEqual({});

          await B.loader.resolve("B");
          expect(t.getState().loaderData.foo).toBe("B");
        });

        it("updates state only when necessary", async () => {
          let t = setupTest();

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
          let t = setupTest();
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
            let t = setupTest({ signals: true });

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
          let t = setupTest();

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
          let t = setupTest();
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
          let t = setupTest();

          let A = t.get("/foo");
          let B = t.get("/bar");

          await A.loader.resolve("A");
          expect(t.getState().loaderData).toEqual({});

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
          let t = setupTest();

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
          let t = setupTest();

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
          let t = setupTest();
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
          let t = setupTest();

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
          let t = setupTest();

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
          let t = setupTest();

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
          let t = setupTest();

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
          let t = setupTest();

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
          let t = setupTest();

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
          let t = setupTest();

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
        A) POST /foo |----|----X
        B) POST /foo    |----|----O
      `, () => {
        it("ignores A, commits B", async () => {
          let t = setupTest();

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
            let t = setupTest({ signals: true });

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
          let t = setupTest();

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
          let t = setupTest();

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
          let t = setupTest();

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
          let t = setupTest();

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
            let t = setupTest({ signals: true });

            let A = t.post("/foo");
            await A.action.resolve("A ACTION");
            let B = t.post("/foo");
            await B.action.resolve("B ACTION");
            expect(A.action.abortMock.calls.length).toBe(0);

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
        let t = setupTest();

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
        let t = setupTest();

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
          let t = setupTest();

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

    describe("disposeSubmission", () => {
      it.todo("removes submission data");
      it.todo("removes pending submission");
    });

    describe("with submission keys", () => {
      describe(`
        POST /foo
        POST /foo
      `, () => {
        describe(`
          A) POST /foo |----|[A]----O
          B) POST /foo    |----|[A,B]----O
        `, () => {
          it.todo("aborts pending post with same key");

          it("overwrites resubmitting the same key", async () => {
            let t = setupTest();
            let keyA = "A";

            t.post("/foo", keyA, "submission=one");
            let submission1 = t.getState().transitions.get(keyA);
            expect(submission1.formData.get("submission")).toBe("one");

            t.post("/foo", keyA, "submission=two");
            let submission2 = t.getState().transitions.get(keyA);
            expect(submission2.formData.get("submission")).toBe("two");
          });

          it("commits action and loader data at every step", async () => {
            let t = setupTest();
            let originalLocation = t.getState().location;
            let keyA = "A";
            let keyB = "B";

            let A = t.post("/foo", keyA);
            expect(t.getState().nextLocation).toBe(A.location);
            expect(t.getState().transition).toBe(idleTransition);
            let B = t.post("/foo", keyB);
            expect(t.getState().nextLocation).toBe(B.location);
            expect(t.getState().transition).toBe(idleTransition);

            await A.action.resolve("A ACTION");
            expect(t.getState().keyedActionData[keyA]).toBe("A ACTION");
            expect(t.getState().actionData).toBeUndefined();
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);
            expect(t.getState().transition).toBe(idleTransition);

            await B.action.resolve("B ACTION");
            expect(t.getState().keyedActionData[keyB]).toBe("B ACTION");
            expect(t.getState().actionData).toBeUndefined();
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);
            expect(t.getState().transition).toBe(idleTransition);

            await A.loader.resolve("[A]");
            expect(t.getState().loaderData.foo).toBe("[A]");
            expect(t.getState().actionData).toBeUndefined();
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);
            expect(t.getState().transition).toBe(idleTransition);

            await B.loader.resolve("[A,B]");
            expect(t.getState().loaderData.foo).toBe("[A,B]");
            expect(t.getState().actionData).toBeUndefined();
            expect(t.getState().location).toBe(B.location);
            expect(t.getState().nextLocation).toBeUndefined();
            expect(t.getState().transition).toBe(idleTransition);
          });
        });

        describe(`
          A) POST /foo |----|[A]----------X
          B) POST /foo    |----|[A,B]---O
        `, () => {
          it("commits A action, B action/loader; ignores A loader", async () => {
            let t = setupTest();
            let keyA = "A";
            let keyB = "B";
            let originalLocation = t.getState().location;

            let A = t.post("/foo", keyA);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(A.location);
            let B = t.post("/foo", keyB);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await A.action.resolve("A ACTION");
            expect(t.getState().keyedActionData[keyA]).toBe("A ACTION");
            expect(t.getState().actionData).toBeUndefined();
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await B.action.resolve("B ACTION");
            expect(t.getState().keyedActionData[keyB]).toBe("B ACTION");
            expect(t.getState().actionData).toBeUndefined();
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await B.loader.resolve("[A,B]");
            expect(t.getState().loaderData.foo).toBe("[A,B]");
            expect(t.getState().actionData).toBeUndefined();
            expect(t.getState().location).toBe(B.location);
            expect(t.getState().nextLocation).toBeUndefined();

            await A.loader.resolve("[A]");
            expect(t.getState().loaderData.foo).toBe("[A,B]");
            expect(t.getState().actionData).toBeUndefined();
            expect(t.getState().location).toBe(B.location);
            expect(t.getState().nextLocation).toBeUndefined();
          });
        });

        describe(`
          A) POST /foo |-----------|[B,A]---O
          B) POST /foo    |----|[B]-----O
        `, () => {
          it("commits B, commits A", async () => {
            let t = setupTest();
            let keyA = "A";
            let keyB = "B";
            let originalLocation = t.getState().location;

            let A = t.post("/foo", keyA);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(A.location);

            let B = t.post("/foo", keyB);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await B.action.resolve("B ACTION");
            expect(t.getState().keyedActionData[keyB]).toBe("B ACTION");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await A.action.resolve("A ACTION");
            expect(t.getState().keyedActionData[keyA]).toBe("A ACTION");
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
          B) POST /foo    |---|[B]----------X
        `, () => {
          it("commits A, aborts B", async () => {
            let t = setupTest();
            let keyA = "A";
            let keyB = "B";
            let originalLocation = t.getState().location;

            let A = t.post("/foo", keyA);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(A.location);

            let B = t.post("/foo", keyB);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await B.action.resolve("B ACTION");
            expect(t.getState().keyedActionData[keyB]).toBe("B ACTION");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await A.action.resolve("A ACTION");
            expect(t.getState().keyedActionData[keyA]).toBe("A ACTION");
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

        describe(`
          A) POST /foo |-----|[A]--O
          B) POST /foo    |-----------|[A,B]--O
        `, () => {
          it("commits A, commits B", async () => {
            let t = setupTest();
            let keyA = "A";
            let keyB = "B";
            let originalLocation = t.getState().location;

            let A = t.post("/foo", keyA);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(A.location);

            let B = t.post("/foo", keyB);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await A.action.resolve("A ACTION");
            expect(t.getState().keyedActionData[keyA]).toBe("A ACTION");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await A.loader.resolve("[A]");
            expect(t.getState().loaderData.foo).toBe("[A]");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await B.action.resolve("B ACTION");
            expect(t.getState().keyedActionData[keyB]).toBe("B ACTION");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);

            await B.loader.resolve("[A,B]");
            expect(t.getState().loaderData.foo).toBe("[A,B]");
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
            let t = setupTest();
            let keyA = "A";
            let keyB = "B";
            let originalLocation = t.getState().location;

            let A = t.post("/foo", keyA);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(A.location);
            expect(t.getState().transitions.get(keyA)).toBeDefined();
            expect(t.getState().transitions.get(keyA).nextLocation).toBe(
              A.location
            );

            let B = t.post("/foo", keyB);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(B.location);
            expect(t.getState().transitions.get(keyB)).toBeDefined();

            let AR = await A.action.redirect("/foo");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(AR.location);
            expect(t.getState().transitions.get(keyA).nextLocation).toBe(
              AR.location
            );

            let BR = await B.action.redirect("/foo");
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(BR.location);
            expect(t.getState().transitions.get(keyB).nextLocation).toBe(
              BR.location
            );

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
            let t = setupTest();
            let keyA = "A";
            let keyB = "B";
            let originalLocation = t.getState().location;

            let A = t.post("/foo", keyA);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(A.location);

            let B = t.post("/foo", keyB);
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
            let t = setupTest();
            let keyA = "A";
            let keyB = "B";
            let originalLocation = t.getState().location;

            let A = t.post("/foo", keyA);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(A.location);

            let B = t.post("/foo", keyB);
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
            let t = setupTest();
            let keyA = "A";
            let keyB = "B";
            let originalLocation = t.getState().location;

            let A = t.post("/foo", keyA);
            expect(t.getState().location).toBe(originalLocation);
            expect(t.getState().nextLocation).toBe(A.location);

            let B = t.post("/foo", keyB);
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
              let t = setupTest({ signals: true });
              let keyA = "A";
              let keyB = "B";

              let A = t.post("/foo", keyA);
              let B = t.post("/foo", keyB);
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

      describe("keyed navigations with uncaught errors", () => {
        it.todo("takes the latest navigation errors, ignores all the rest");
        it.todo("or should it bail immediately upon error?!");
      });

      describe("navigating without a key after navigating with one", () => {
        describe(`
          A) POST /foo |--X
          B) GET  /bar    |--O
        `, () => {
          it("aborts A, commits B", async () => {
            let t = setupTest({ signals: true });
            let key = "A";
            let A = t.post("/foo", key);
            let B = t.get("/bar");
            expect(A.action.abortMock.calls.length).toBe(1);
            await B.loader.resolve("B");
            expect(t.getState().loaderData.bar).toBe("B");
          });

          it("clears pending submission A", async () => {
            let t = setupTest({ signals: true });
            let key = "A";
            let A = t.post("/foo", key);
            expect(t.getState().transitions.get(key).nextLocation).toBe(
              A.location
            );
            let B = t.get("/bar");
            expect(t.getState().transitions.get(key).nextLocation).toBe(
              A.location
            );
            await B.loader.resolve("B");
            expect(t.getState().transitions.get(key)).toBeUndefined();
          });
        });

        describe(`
          A) POST /foo |--|--X
          B) GET  /bar       |----O
        `, () => {
          it("aborts A, commits B", async () => {
            let t = setupTest({ signals: true });
            let key = "A";
            let A = t.post("/foo", key);
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
            let t = setupTest({ signals: true });
            let key = "A";
            let A = t.post("/foo", key);
            t.post("/bar");
            expect(A.action.abortMock.calls.length).toBe(1);
          });

          it("clears pending submission A", async () => {
            let t = setupTest({ signals: true });
            let key = "A";
            let A = t.post("/foo", key);
            expect(t.getState().transitions.get(key).nextLocation).toBe(
              A.location
            );
            let B = t.post("/bar");
            expect(t.getState().transitions.get(key).nextLocation).toBe(
              A.location
            );
            await B.action.resolve("B ACTION");
            await B.loader.resolve("B LOADER");
            expect(t.getState().transitions.get(key)).toBeUndefined();
          });
        });
      });
    });

    describe("interrupting the same key", () => {
      describe(`
        A) POST /foo(a) |--X
        B) POST /foo(a)    |----|---O
      `, () => {
        it("aborts A submission", async () => {
          let t = setupTest({ signals: true });
          let key = "same";

          let A = t.post("/foo", key, "which=A");
          expect(t.getState().transitions.get(key).nextLocation).toBe(
            A.location
          );

          let B = t.post("/foo", key, "which=B");
          expect(t.getState().transitions.get(key).nextLocation).toBe(
            B.location
          );
          expect(A.action.abortMock.calls.length).toBe(1);

          await B.action.resolve("B ACTION");
          expect(t.getState().keyedActionData[key]).toBe("B ACTION");

          await B.loader.resolve("B LOADER");
          expect(t.getState().loaderData.foo).toBe("B LOADER");
          expect(t.getState().matches).toBeDefined();
        });
      });

      describe(`
        A) POST /foo(a) |--|--X
        B) POST /foo(a)       |---|---O
      `, () => {
        it("aborts A load", async () => {
          let t = setupTest({ signals: true });
          let key = "same";

          let A = t.post("/foo", key, "which=A");
          expect(t.getState().transitions.get(key).nextLocation).toBe(
            A.location
          );

          await A.action.resolve("A ACTION");
          expect(t.getState().keyedActionData[key]).toBe("A ACTION");

          let B = t.post("/foo", key, "which=B");
          expect(t.getState().transitions.get(key).nextLocation).toBe(
            B.location
          );
          expect(A.loader.abortMock.calls.length).toBe(1);

          await B.action.resolve("B ACTION");
          expect(t.getState().keyedActionData[key]).toBe("B ACTION");

          await B.loader.resolve("B LOADER");
          expect(t.getState().loaderData.foo).toBe("B LOADER");
          expect(t.getState().matches).toBeDefined();
        });
      });
    });
  });

  describe("GET submissions", () => {
    it("tracks GET submissions", async () => {
      let navDeferred = defer();

      let tm = createTestTransitionManager("/", {
        routes: [{ path: "/", id: "root", element: {} }]
      });

      let submission: NormalGetSubmission = {
        isSubmission: true,
        action: "/",
        method: "GET",
        body: "gosh=dang",
        encType: "application/x-www-form-urlencoded"
      };

      tm.send(createLocation("/", submission)).then(() => navDeferred.promise);
      expect(tm.getState().transition).toBeDefined();
      expect(tm.getState().transition.nextLocation.state).toBe(submission);

      await navDeferred.resolve();
      expect(tm.getState().transition.state).toBe("idle");
    });

    it("tracks GET submissions by key", async () => {
      let navDeferred = defer();

      let tm = createTestTransitionManager("/", {
        routes: [{ path: "/", id: "root", element: {} }]
      });

      let submission: KeyedGetSubmission = {
        isSubmission: true,
        submissionKey: "key",
        action: "/",
        method: "GET",
        body: "gosh=dang",
        encType: "application/x-www-form-urlencoded"
      };

      tm.send(createLocation("/", submission)).then(() => navDeferred.promise);
      expect(
        tm.getState().transitions.get(submission.submissionKey).nextLocation
          .state
      ).toBe(submission);

      await navDeferred.resolve();
      expect(
        tm.getState().transitions.get(submission.submissionKey)
      ).toBeUndefined();
    });
  });

  describe("Transition States", () => {
    it("initialization", async () => {
      let t = setupTest();
      let transition = t.getState().transition;
      expect(transition.state).toBe("idle");
      expect(transition.type).toBe("idle");
      expect(transition.formData).toBeUndefined();
      expect(transition.method).toBeUndefined();
      expect(transition.nextLocation).toBeUndefined();
    });

    it("normal GET", async () => {
      let t = setupTest();
      let A = t.navigate("/foo");
      let transition = t.getState().transition;
      expect(transition.state).toBe("loading");
      expect(transition.type).toBe("load");
      expect(transition.formData).toBeUndefined();
      expect(transition.method).toBe("GET");
      expect(transition.nextLocation).toBe(A.location);

      await A.loader.resolve("A");
      transition = t.getState().transition;
      expect(transition.state).toBe("idle");
      expect(transition.type).toBe("idle");
      expect(transition.formData).toBeUndefined();
      expect(transition.method).toBeUndefined();
      expect(transition.nextLocation).toBeUndefined();
    });

    it("normal GET + redirect", async () => {
      let t = setupTest();

      let A = t.navigate("/foo");
      let B = await A.loader.redirect("/bar");

      let transition = t.getState().transition;
      expect(transition.state).toBe("loading");
      expect(transition.type).toBe("redirect");
      expect(transition.formData).toBeUndefined();
      expect(transition.method).toBe("GET");
      expect(transition.nextLocation).toBe(B.location);

      await B.loader.resolve("B");
      transition = t.getState().transition;
      expect(transition.state).toBe("idle");
      expect(transition.type).toBe("idle");
      expect(transition.formData).toBeUndefined();
      expect(transition.method).toBeUndefined();
      expect(transition.nextLocation).toBeUndefined();
    });

    it("normal POST", async () => {
      let t = setupTest();

      let A = t.post("/foo");
      let transition = t.getState().transition;
      expect(transition.state).toBe("submitting");
      expect(transition.type).toBe("submission");
      expect(
        // @ts-expect-error
        new URLSearchParams(transition.formData).toString()
      ).toBe("gosh=dang");
      expect(transition.method).toBe("POST");
      expect(transition.nextLocation).toBe(A.location);

      await A.action.resolve("A");
      transition = t.getState().transition;
      expect(transition.state).toBe("loading");
      expect(transition.type).toBe("actionReload");
      expect(
        // @ts-expect-error
        new URLSearchParams(transition.formData).toString()
      ).toBe("gosh=dang");
      expect(transition.method).toBe("POST");
      expect(transition.nextLocation).toBe(A.location);

      await A.loader.resolve("A");
      transition = t.getState().transition;
      expect(transition.state).toBe("idle");
      expect(transition.type).toBe("idle");
      expect(transition.formData).toBeUndefined();
      expect(transition.method).toBeUndefined();
      expect(transition.nextLocation).toBeUndefined();
    });

    it("normal POST + redirect", async () => {
      let t = setupTest();

      let A = t.post("/foo");
      let B = await A.action.redirect("/bar");

      let transition = t.getState().transition;
      expect(transition.state).toBe("loading");
      expect(transition.type).toBe("actionRedirect");
      expect(
        // @ts-expect-error
        new URLSearchParams(transition.formData).toString()
      ).toBe("gosh=dang");
      expect(transition.method).toBe("POST");
      expect(transition.nextLocation).toBe(B.location);

      await B.loader.resolve("B");
      transition = t.getState().transition;
      expect(transition.state).toBe("idle");
      expect(transition.type).toBe("idle");
      expect(transition.formData).toBeUndefined();
      expect(transition.method).toBeUndefined();
      expect(transition.nextLocation).toBeUndefined();
    });

    it("normal GET submission", async () => {
      let t = setupTest();
      let A = t.submitGet("/foo");
      let transition = t.getState().transition;
      expect(transition.state).toBe("loading");
      expect(transition.type).toBe("getSubmission");
      expect(
        // @ts-expect-error
        new URLSearchParams(transition.formData).toString()
      ).toBe("gosh=dang");
      expect(transition.method).toBe("GET");
      expect(transition.nextLocation).toBe(A.location);

      await A.loader.resolve("A");
      transition = t.getState().transition;
      expect(transition.state).toBe("idle");
      expect(transition.type).toBe("idle");
      expect(transition.formData).toBeUndefined();
      expect(transition.method).toBeUndefined();
      expect(transition.nextLocation).toBeUndefined();
    });

    it("normal GET submission + redirect", async () => {
      let t = setupTest();

      let A = t.submitGet("/foo");
      let B = await A.loader.redirect("/bar");

      let transition = t.getState().transition;
      expect(transition.state).toBe("loading");
      expect(transition.type).toBe("getSubmissionRedirect");
      expect(
        // @ts-expect-error
        new URLSearchParams(transition.formData).toString()
      ).toBe("gosh=dang");
      expect(transition.method).toBe("GET");
      expect(transition.nextLocation).toBe(B.location);

      await B.loader.resolve("B");
      transition = t.getState().transition;
      expect(transition.state).toBe("idle");
      expect(transition.type).toBe("idle");
      expect(transition.formData).toBeUndefined();
      expect(transition.method).toBeUndefined();
      expect(transition.nextLocation).toBeUndefined();
    });

    it("keyed GET submission", async () => {
      let key = "key";
      let t = setupTest();

      expect(t.getState().transitions.get(key)).toBeUndefined();

      let A = t.submitGet("/foo", key);
      let transition = t.getState().transitions.get(key);
      expect(transition.state).toBe("loading");
      expect(transition.type).toBe("getSubmission");
      expect(
        // @ts-expect-error
        new URLSearchParams(transition.formData).toString()
      ).toBe("gosh=dang");
      expect(transition.method).toBe("GET");
      expect(transition.nextLocation).toBe(A.location);

      await A.loader.resolve("A");
      transition = t.getState().transitions.get(key);
      expect(t.getState().transitions.get(key)).toBeUndefined();
    });

    it("keyed GET submission + redirect", async () => {
      let key = "key";
      let t = setupTest();

      let A = t.submitGet("/foo", key);
      let B = await A.loader.redirect("/bar");

      let transition = t.getState().transitions.get(key);
      expect(transition.state).toBe("loading");
      expect(transition.type).toBe("getSubmissionRedirect");
      expect(
        // @ts-expect-error
        new URLSearchParams(transition.formData).toString()
      ).toBe("gosh=dang");
      expect(transition.method).toBe("GET");
      expect(transition.nextLocation).toBe(B.location);

      await B.loader.resolve("B");
      expect(t.getState().transitions.get(key)).toBeUndefined();
    });

    it("keyed POST submission", async () => {
      let key = "key";
      let t = setupTest();

      let A = t.post("/foo", key);
      let transition = t.getState().transitions.get(key);
      expect(transition.state).toBe("submitting");
      expect(transition.type).toBe("submission");
      expect(
        // @ts-expect-error
        new URLSearchParams(transition.formData).toString()
      ).toBe("gosh=dang");
      expect(transition.method).toBe("POST");
      expect(transition.nextLocation).toBe(A.location);

      await A.action.resolve("A");
      transition = t.getState().transitions.get(key);
      expect(transition.state).toBe("loading");
      expect(transition.type).toBe("actionReload");
      expect(
        // @ts-expect-error
        new URLSearchParams(transition.formData).toString()
      ).toBe("gosh=dang");
      expect(transition.method).toBe("POST");
      expect(transition.nextLocation).toBe(A.location);

      await A.loader.resolve("A");
      expect(t.getState().transitions.get(key)).toBeUndefined();
    });

    it("keyed POST submission + redirect", async () => {
      let key = "key";
      let t = setupTest();

      let A = t.post("/foo", key);
      let B = await A.action.redirect("/bar");

      let transition = t.getState().transitions.get(key);
      expect(transition.state).toBe("loading");
      expect(transition.type).toBe("actionRedirect");
      expect(
        // @ts-expect-error
        new URLSearchParams(transition.formData).toString()
      ).toBe("gosh=dang");
      expect(transition.method).toBe("POST");
      expect(transition.nextLocation).toBe(B.location);

      await B.loader.resolve("B");
      expect(t.getState().transitions.get(key)).toBeUndefined();
    });
  });
});
