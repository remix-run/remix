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
  let parentLoader: jest.Mock<string>;
  let childLoader: jest.Mock<string>;
  let paramLoader: jest.Mock<string>;
  let tm: ReturnType<typeof createTestTransitionManager>;

  beforeEach(() => {
    fakeKey = 0;
    parentLoader = jest.fn(() => "PARENT");
    childLoader = jest.fn(() => "CHILD");
    paramLoader = jest.fn(() => "PARAM");
    tm = createTestTransitionManager("/", {
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
  });

  it("initializes state", async () => {
    expect(tm.getState()).toMatchInlineSnapshot(`
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
    tm.send(createLocation("/a"));
    let state = tm.getState();
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

        tm = createTestTransitionManager("/", {
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
      await tm.send(createLocation("/a"));
      let state = tm.getState();
      expect(state.loaderData).toMatchInlineSnapshot(`
        Object {
          "child": "CHILD",
          "parent": "PARENT",
        }
      `);
    });

    describe("parent -> child transition", () => {
      it("only fetches child data", async () => {
        await tm.send(createLocation("/a"));
        let state = tm.getState();
        expect(parentLoader.mock.calls.length).toBe(0);
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
        await tm.send(createLocation("/a?foo"));
        expect(parentLoader.mock.calls.length).toBe(1);
        expect(childLoader.mock.calls.length).toBe(1);

        await tm.send(createLocation("/a?bar"));
        expect(parentLoader.mock.calls.length).toBe(2);
        expect(childLoader.mock.calls.length).toBe(2);
      });
    });

    describe("param change", () => {
      it("reloads only routes with changed params", async () => {
        await tm.send(createLocation("/p/one"));
        expect(parentLoader.mock.calls.length).toBe(0);
        expect(paramLoader.mock.calls.length).toBe(1);

        await tm.send(createLocation("/p/two"));
        expect(parentLoader.mock.calls.length).toBe(0);
        expect(paramLoader.mock.calls.length).toBe(2);
      });
    });

    describe("same url", () => {
      it("reloads all routes", async () => {
        await tm.send(createLocation("/p/one"));
        expect(parentLoader.mock.calls.length).toBe(0);
        expect(paramLoader.mock.calls.length).toBe(1);

        await tm.send(createLocation("/p/one"));
        expect(parentLoader.mock.calls.length).toBe(1);
        expect(paramLoader.mock.calls.length).toBe(2);
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
    let parentLoader: jest.Mock;
    let parentAction: jest.Mock;
    let childLoader: jest.Mock;
    let childAction: jest.Mock;
    let tm: ReturnType<typeof createTestTransitionManager>;

    beforeEach(() => {
      parentLoader = jest.fn(() => "PARENT LOADER");
      childLoader = jest.fn(() => "CHILD LOADER");
      parentAction = jest.fn(() => "PARENT ACTION");
      childAction = jest.fn(() => "CHILD ACTION");
      tm = createTestTransitionManager("/", {
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
    });

    it("removes action data at new locations", async () => {
      await tm.send(createLocation("/child", { isAction: true }));
      expect(tm.getState().actionData).toBe("CHILD ACTION");

      await tm.send(createLocation("/child"));
      expect(tm.getState().actionData).toBeUndefined();
    });

    it("calls only the leaf route action", async () => {
      await tm.send(createLocation("/child", { isAction: true }));
      expect(parentAction.mock.calls.length).toBe(0);
      expect(childAction.mock.calls.length).toBe(1);
    });

    it("reloads all routes after the action", async () => {
      await tm.send(createLocation("/child", { isAction: true }));
      expect(parentLoader.mock.calls.length).toBe(1);
      expect(childLoader.mock.calls.length).toBe(1);
      expect(tm.getState().actionData).toMatchInlineSnapshot(`"CHILD ACTION"`);
      expect(tm.getState().loaderData).toMatchInlineSnapshot(`
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

    let setup = () => {
      let c = -1;
      let loaderDeferreds: Deferred[] = [];
      let navDeferreds: Deferred[] = [];
      let abortHandlers: jest.Mock[] = [];
      let handleChange = jest.fn();
      let loader = async ({ signal }: { signal: AbortSignal }) => {
        signal.onabort = abortHandlers[c];
        return loaderDeferreds[c].promise.then((val: any) => val);
      };

      let tm = createTestTransitionManager("/foo", {
        onChange: handleChange,
        loaderData: undefined,
        routes: [
          { path: "/foo", id: "foo", loader, element: {} },
          { path: "/bar", id: "bar", loader, element: {} }
        ]
      });

      let navigate = async (location: Location<any>) => {
        c++;
        loaderDeferreds.push(defer());
        navDeferreds.push(defer());
        abortHandlers.push(jest.fn());
        tm.send(location).then(() => navDeferreds[c].promise);
      };

      let resolveNav = async (navIndex: number, loaderVal: any) => {
        await loaderDeferreds[navIndex].resolve(loaderVal);
        await navDeferreds[navIndex].resolve();
      };

      return { abortHandlers, handleChange, tm, navigate, resolveNav };
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
          // TODO: figure out how to abort A and still let action loads fill in data
          let t = setup();

          t.navigate(createLocation("/foo"));
          t.navigate(createLocation("/foo"));

          await t.resolveNav(0, "A");
          expect(t.tm.getState().loaderData).toBeUndefined();

          await t.resolveNav(1, "B");
          expect(t.tm.getState().loaderData.foo).toBe("B");
          expect(t.abortHandlers[0].mock.calls.length).toBe(1);
          expect(t.abortHandlers[1].mock.calls.length).toBe(0);
        });

        it("updates state only when necessary", async () => {
          let t = setup();

          t.navigate(createLocation("/foo"));
          expect(t.handleChange.mock.calls.length).toBe(1);

          t.navigate(createLocation("/foo"));
          expect(t.handleChange.mock.calls.length).toBe(2);

          await t.resolveNav(0, "A");
          expect(t.handleChange.mock.calls.length).toBe(2);

          await t.resolveNav(1, "B");
          expect(t.handleChange.mock.calls.length).toBe(3);
        });

        it("updates the correct location and nextLocation", async () => {
          let t = setup();
          let originalLocation = t.tm.getState().location;

          let firstLocation = createLocation("/foo");
          t.navigate(firstLocation);
          expect(t.tm.getState().nextLocation).toBe(firstLocation);
          expect(t.tm.getState().location).toBe(originalLocation);

          let secondLocation = createLocation("/foo");
          t.navigate(secondLocation);
          expect(t.tm.getState().nextLocation).toBe(secondLocation);
          expect(t.tm.getState().location).toBe(originalLocation);

          await t.resolveNav(0, "A");
          expect(t.tm.getState().location).toBe(originalLocation);
          expect(t.tm.getState().nextLocation).toBe(secondLocation);

          await t.resolveNav(1, "B");
          expect(t.tm.getState().location).toBe(secondLocation);
          expect(t.tm.getState().nextLocation).toBeUndefined();
        });
      });

      describe(`
        A) GET /foo |----------X
        B) GET /foo   |------O
      `, () => {
        it("aborts A, commits B", async () => {
          let t = setup();

          t.navigate(createLocation("/foo"));
          t.navigate(createLocation("/foo"));

          await t.resolveNav(1, "B");
          expect(t.tm.getState().loaderData.foo).toBe("B");
          expect(t.handleChange.mock.calls.length).toBe(3);
          expect(t.abortHandlers[0].mock.calls.length).toBe(1);

          await t.resolveNav(0, "A");
          expect(t.tm.getState().loaderData.foo).toBe("B");
          expect(t.handleChange.mock.calls.length).toBe(3);
        });

        it("updates the correct location and nextLocation", async () => {
          let t = setup();
          let originalLocation = t.tm.getState().location;

          let firstLocation = createLocation("/foo");
          t.navigate(firstLocation);
          expect(t.tm.getState().nextLocation).toBe(firstLocation);
          expect(t.tm.getState().location).toBe(originalLocation);

          let secondLocation = createLocation("/foo");
          t.navigate(secondLocation);
          expect(t.tm.getState().nextLocation).toBe(secondLocation);
          expect(t.tm.getState().location).toBe(originalLocation);

          await t.resolveNav(1, "B");
          expect(t.tm.getState().nextLocation).toBeUndefined();
          expect(t.tm.getState().location).toBe(secondLocation);

          await t.resolveNav(0, "A");
          expect(t.tm.getState().nextLocation).toBeUndefined();
          expect(t.tm.getState().location).toBe(secondLocation);
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

          t.navigate(createLocation("/foo"));
          t.navigate(createLocation("/bar"));

          await t.resolveNav(0, "A");
          expect(t.tm.getState().loaderData).toBeUndefined();

          await t.resolveNav(1, "B");
          expect(t.tm.getState().loaderData.bar).toBe("B");
          expect(t.tm.getState().loaderData.foo).toBeUndefined();
          // kind of pointless that it was aborted since it landed first, TODO:
          // figure out if we can abort this the second "GET /bar" comes
          // through, (right after the navigation). Wait until all the action
          // stuff is done though, cause I think it might affect this
          expect(t.abortHandlers[0].mock.calls.length).toBe(1);
        });
      });

      describe(`
        A) GET /foo |------------X
        B) GET /bar    |------O
      `, () => {
        it("ignores A, commits B", async () => {
          let t = setup();

          t.navigate(createLocation("/foo"));
          t.navigate(createLocation("/bar"));

          await t.resolveNav(1, "B");
          expect(t.tm.getState().loaderData.bar).toBe("B");
          // TODO: should we abort loads to different URLs? What if we end up
          // back here in an action? Gonna let the action stuff play out first,
          // then come back and see if we should have aborted here. Even if you
          // end up in a third navigation back to /foo, I can't see how the
          // original /foo could be fresher.
          // expect(t.abortHandlers[0].mock.calls.length).toBe(1);

          await t.resolveNav(0, "A");
          expect(t.tm.getState().loaderData.bar).toBe("B");
          expect(t.tm.getState().loaderData.foo).toBeUndefined();
        });
      });
    });

    // describe(`
    //   GET /foo > 303 /c
    //   GET /bar
    // `, () => {
    //   describe(`
    //     A) GET /foo |-------/c--X
    //     B) GET /bar   |---O
    //   `, () => {
    //     it.todo("aborts A, commits B");
    //   });

    //   describe(`
    //     A) GET /foo |-------/c--X
    //     B) GET /bar   |---------------O
    //   `, () => {
    //     it.todo("aborts A, commits B");
    //   });

    //   describe(`
    //     A) GET /foo |--/c--------X
    //     B) GET /bar           |---O
    //   `, () => {
    //     it.todo("aborts A, commits B");
    //   });

    //   describe(`
    //     A) GET /foo |--/c--------X
    //     B) GET /bar           |---------O
    //   `, () => {
    //     it.todo("aborts A, commits B");
    //   });
    // });

    // describe(`
    //   GET /foo > 303 /b
    //   GET /bar
    // `, () => {
    //   describe(`
    //     A) GET /foo |-------/b--X
    //     B) GET /bar   |---O
    //   `, () => {
    //     it.todo("aborts A, commits B");
    //   });

    //   describe(`
    //     A) GET /foo |-------/b--X
    //     B) GET /bar   |---------------O
    //   `, () => {
    //     it.todo("aborts A, commits B");
    //   });

    //   describe(`
    //     A) GET /foo |--/b--------X
    //     B) GET /bar            |---O
    //   `, () => {
    //     it.todo("aborts A, commits B");
    //   });

    //   describe(`
    //     A) GET /foo |--/b3--------X
    //     B) GET /bar            |---------O
    //   `, () => {
    //     it.todo("aborts A, commits B");
    //   });
    // });

    // describe(`
    //   POST /a
    //   POST /a
    // `, () => {
    //   describe(`
    //     A) POST /a |----|----O
    //     B) POST /a    |----|----O
    //   `, () => {
    //     it.todo("commits A, commits B");
    //   });

    //   describe(`
    //     A) POST /a |----|----------X
    //     B) POST /a    |----|----O
    //   `, () => {
    //     it.todo("commits B, aborts A");
    //   });

    //   describe(`
    //     A) POST /a |-----------|---O
    //     B) POST /a    |----|-----O
    //   `, () => {
    //     it.todo("commits B, commits A");
    //   });

    //   describe(`
    //     A) POST /a |-----------|---O
    //     B) POST /a    |----|----------X
    //   `, () => {
    //     it.todo("commits A, aborts B");
    //   });
    // });

    // describe(`
    //   POST /a > 303 /a
    //   POST /a > 303 /a
    // `, () => {
    //   describe(`
    //     A) POST /a |----/a----O
    //     B) POST /a    |----/a----O
    //   `, () => {
    //     it.todo("commits A, commits B");
    //   });

    //   describe(`
    //     A) POST /a |----/a----------X
    //     B) POST /a    |----/a----O
    //   `, () => {
    //     it.todo("commits B, aborts A");
    //   });

    //   describe(`
    //     A) POST /a |-----------/a---O
    //     B) POST /a    |----/a-----O
    //   `, () => {
    //     it.todo("commits B, commits A");
    //   });

    //   describe(`
    //     A) POST /a |-----------/a---O
    //     B) POST /a    |----/a----------X
    //   `, () => {
    //     it.todo("commits A, aborts B");
    //   });
    // });

    // describe(`
    //   @    /a
    //   POST /b > 303 /a
    //   POST /b > 303 /a
    // `, () => {
    //   describe(`
    //     A) POST /b |----/a----O
    //     B) POST /b    |----/a----O
    //   `, () => {
    //     it.todo("commits A, commits B");
    //   });

    //   describe(`
    //     A) POST /b |----/a----------X
    //     B) POST /b    |----/a----O
    //   `, () => {
    //     it.todo("commits B, aborts A");
    //   });

    //   describe(`
    //     A) POST /b |-----------/a---O
    //     B) POST /b    |----/a-----O
    //   `, () => {
    //     it.todo("commits B, commits A");
    //   });

    //   describe(`
    //     A) POST /b |-----------/a---O
    //     B) POST /b    |----/a----------X
    //   `, () => {
    //     it.todo("commits A, aborts B");
    //   });
    // });
  });
});

// function defer() {
//   let resolve, reject;
//   let promise = new Promise((res, rej) => {
//     resolve = res;
//     reject = rej;
//   });
//   return { promise, resolve, reject };
// }

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
