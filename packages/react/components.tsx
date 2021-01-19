import React from "react";
import type { Action, Location } from "history";
import type { Navigator } from "react-router";
import {
  Router,
  Link,
  useLocation,
  useRoutes,
  useNavigate,
  useResolvedPath
} from "react-router-dom";
import type { EntryContext, SerializedError } from "@remix-run/core";

import {
  AppData,
  RouteData,
  FormEncType,
  FormMethod,
  FormSubmit,
  loadRouteData,
  callRouteAction,
  extractData,
  isRedirectResponse
} from "./data";
import invariant from "./invariant";
import type { Manifest } from "./manifest";
import { loadManifest } from "./manifest";
import { createHtml } from "./markup";
import type { RouteModules } from "./routeModules";
import { loadRouteModule } from "./routeModules";
import type { ClientRouteMatch } from "./routes";
import {
  createClientRoutes,
  createClientMatches,
  matchClientRoutes
} from "./routes";
import { loadRouteStyleSheet } from "./stylesheets";
import {
  RemixRootDefaultErrorBoundary,
  RemixErrorBoundary
} from "./errorBoundaries";
import type { ComponentDidCatchEmulator } from "@remix-run/core/entry";

////////////////////////////////////////////////////////////////////////////////
// FormState

enum FormState {
  Idle = "idle",

  // non-get submits
  // - idle -> pending -> redirected -> idle
  // - reload data from all routes on the redirect
  Pending = "pending",
  Redirected = "redirected",

  // get submits
  // - idle -> pendingGet -> idle
  // - just normal navigation except store the FormSubmit for usePendingFormSubmit
  PendingGet = "pendingGet"
}

let pendingFormSubmit: FormSubmit | undefined = undefined;
let formState = FormState.Idle;

// 1. When a form is submitted, we go into a pending state
function setFormPending(
  method: FormMethod,
  data: FormData,
  encType: FormEncType
): void {
  pendingFormSubmit = { method, data, encType };
  formState = method === "get" ? FormState.PendingGet : FormState.Pending;
}

// 2. When the loader action redirects
function setFormRedirected() {
  formState = FormState.Redirected;
}

// 3. After Remix finishes the transition, we go back to idle
function setFormIdle() {
  pendingFormSubmit = undefined;
  formState = FormState.Idle;
}

////////////////////////////////////////////////////////////////////////////////
// RemixEntry

interface RemixEntryContextType {
  manifest: Manifest;
  matches: ClientRouteMatch[];
  componentDidCatchEmulator: ComponentDidCatchEmulator;
  routeData: RouteData;
  routeModules: RouteModules;
  serverHandoffString?: string;
  pendingLocation: Location | undefined;
}

const RemixEntryContext = React.createContext<
  RemixEntryContextType | undefined
>(undefined);

function useRemixEntryContext(): RemixEntryContextType {
  let context = React.useContext(RemixEntryContext);
  invariant(context, "You must render this element inside a <Remix> element");
  return context;
}

export function RemixEntry({
  context: entryContext,
  action: nextAction,
  location: nextLocation,
  navigator,
  static: staticProp = false
}: {
  context: EntryContext;
  action: Action;
  location: Location;
  navigator: Navigator;
  static?: boolean;
}) {
  let {
    manifest,
    matches: entryMatches,
    routeData: entryRouteData,
    routeModules,
    serverHandoffString,
    componentDidCatchEmulator: entryComponentDidCatchEmulator
  } = entryContext;

  let [state, setState] = React.useState({
    action: nextAction,
    location: nextLocation,
    matches: createClientMatches(entryMatches, RemixRoute),
    routeData: entryRouteData,
    componentDidCatchEmulator: entryComponentDidCatchEmulator
  });

  let {
    action,
    location,
    matches,
    routeData,
    componentDidCatchEmulator
  } = state;

  React.useEffect(() => {
    if (location === nextLocation) return;

    let isCurrent = true;

    (async () => {
      await loadManifest(manifest, nextLocation.pathname);

      let routes = createClientRoutes(manifest.routes, RemixRoute);
      let nextMatches = matchClientRoutes(routes, nextLocation);

      let didRedirect = false;
      function handleDataRedirect(response: Response) {
        let url = new URL(
          response.headers.get("X-Remix-Redirect")!,
          window.location.origin
        );

        didRedirect = true;

        if (formState === FormState.Pending) {
          setFormRedirected();
        }

        // TODO: navigator.replace() should just handle different origins
        if (url.origin !== window.location.origin) {
          window.location.replace(url.href);
        } else {
          navigator.replace(url.pathname + url.search);
        }
      }

      if (formState === FormState.Pending) {
        let leafMatch = nextMatches[nextMatches.length - 1];
        let route = manifest.routes[leafMatch.route.id];

        if (!route.actionUrl) {
          throw new Error(
            `Route "${route.id}" does not have an action handler, but you are trying ` +
              `to submit to it. To fix this, please add an \`action\` function to your ` +
              `route module.`
          );
        }

        let response = await callRouteAction(
          route,
          nextLocation,
          leafMatch.params,
          pendingFormSubmit!
        );

        // TODO: Handle error responses here...
        handleDataRedirect(response as Response);

        // Expecting handleDataRedirect to be called, so we don't need to worry
        // about doing anything else in here.
        return;
      }

      function maybeHandleDataRedirect(response: any) {
        if (!didRedirect) handleDataRedirect(response);
      }

      let styleSheetsPromise = Promise.all(
        nextMatches.map(match =>
          loadRouteStyleSheet(manifest.routes[match.route.id])
        )
      );

      let modulesPromise = Promise.all(
        nextMatches.map(match =>
          loadRouteModule(manifest.routes[match.route.id], routeModules)
        )
      );

      let nextRouteData: RouteData;
      let componentDidCatchEmulator: ComponentDidCatchEmulator = {
        trackBoundaries: false,
        renderBoundaryRouteId: null,
        loaderBoundaryRouteId: null,
        error: undefined
      };

      if (formState === FormState.Redirected) {
        // Reload all data after a <Form> submit.
        let routeDataPromises = nextMatches.map(match =>
          loadRouteData(
            manifest.routes[match.route.id],
            nextLocation,
            match.params
          )
        );

        await styleSheetsPromise;
        await modulesPromise;

        let routeDataResponses = await Promise.all(routeDataPromises);
        for (let [index, response] of routeDataResponses.entries()) {
          if (componentDidCatchEmulator.error) {
            continue;
          }

          let route = nextMatches[index].route;
          let routeModule = routeModules[route.id];

          if (routeModule.ErrorBoundary) {
            componentDidCatchEmulator.loaderBoundaryRouteId = route.id;
          }

          if (response instanceof Error) {
            componentDidCatchEmulator.error = response;
          } else if (isRedirectResponse(response)) {
            maybeHandleDataRedirect(response);
          }
        }

        nextRouteData = (
          await Promise.all(
            routeDataResponses.map(
              response => response && extractData(response)
            )
          )
        ).reduce((memo, data, index) => {
          let match = nextMatches[index];
          memo[match.route.id] = data;
          return memo;
        }, {} as RouteData);
      } else {
        let routeDataPromise = Promise.all(
          nextMatches.map((match, index) =>
            location.search === nextLocation.search &&
            matches[index] &&
            matches[index].pathname === match.pathname
              ? // Re-use data we already have for routes already on the page
                // if the URL hasn't changed for that route.
                routeData[match.route.id]
              : loadRouteData(
                  manifest.routes[match.route.id],
                  nextLocation,
                  match.params
                )
          )
        );

        await styleSheetsPromise;
        await modulesPromise;

        let routeDataResults = await routeDataPromise;
        for (let [index, result] of routeDataResults.entries()) {
          if (!(result instanceof Response || result instanceof Error)) {
            continue;
          }

          if (componentDidCatchEmulator.error) {
            continue;
          }

          let route = nextMatches[index].route;
          let routeModule = routeModules[route.id];

          if (routeModule.ErrorBoundary) {
            componentDidCatchEmulator.loaderBoundaryRouteId = route.id;
          }

          if (result instanceof Error) {
            componentDidCatchEmulator.error = result;
          } else if (isRedirectResponse(result)) {
            maybeHandleDataRedirect(result);
          }
        }

        nextRouteData = (
          await Promise.all(
            routeDataResults.map(
              result =>
                result &&
                (result instanceof Response || result instanceof Error
                  ? extractData(result)
                  : result)
            )
          )
        ).reduce((memo, data, index) => {
          let match = nextMatches[index];
          memo[match.route.id] = data;
          return memo;
        }, {} as RouteData);
      }

      if (isCurrent && !didRedirect) {
        if (
          formState === FormState.Redirected ||
          formState === FormState.PendingGet
        ) {
          setFormIdle();
        }

        setState({
          action: nextAction,
          location: nextLocation,
          matches: nextMatches,
          routeData: nextRouteData,
          componentDidCatchEmulator
        });
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, [
    nextAction,
    nextLocation,
    location,
    matches,
    routeData,
    navigator,
    manifest,
    routeModules
  ]);

  let context: RemixEntryContextType = {
    manifest,
    matches,
    componentDidCatchEmulator,
    routeData,
    routeModules,
    serverHandoffString,
    pendingLocation: nextLocation !== location ? nextLocation : undefined
  };

  // If we tried to render and failed, and the app threw before rendering any
  // routes, get the error and pass it to the ErrorBoundary to emulate
  // `componentDidCatch`
  let maybeServerRenderError =
    componentDidCatchEmulator.error &&
    componentDidCatchEmulator.renderBoundaryRouteId === null &&
    componentDidCatchEmulator.loaderBoundaryRouteId === null
      ? deserializeError(componentDidCatchEmulator.error)
      : undefined;

  return (
    <RemixEntryContext.Provider value={context}>
      <RemixErrorBoundary
        location={location}
        component={RemixRootDefaultErrorBoundary}
        error={maybeServerRenderError}
      >
        <Router
          action={action}
          location={location}
          navigator={navigator}
          static={staticProp}
        >
          <Routes />
        </Router>
      </RemixErrorBoundary>
    </RemixEntryContext.Provider>
  );
}

function deserializeError(data: SerializedError): Error {
  let error = new Error(data.message);
  error.stack = data.stack;
  return error;
}

////////////////////////////////////////////////////////////////////////////////
// RemixRoute

interface RemixRouteContextType {
  data: AppData;
  id: string;
}

const RemixRouteContext = React.createContext<
  RemixRouteContextType | undefined
>(undefined);

function useRemixRouteContext(): RemixRouteContextType {
  let context = React.useContext(RemixRouteContext);
  invariant(context, "You must render this element in a remix route element");
  return context;
}

export function RemixRoute({ id: routeId }: { id: string }) {
  let location = useLocation();
  let {
    routeData,
    routeModules,
    componentDidCatchEmulator
  } = useRemixEntryContext();

  let data = routeData[routeId];
  let routeModule = routeModules[routeId];

  let context: RemixRouteContextType = {
    data,
    id: routeId
  };

  let element = (
    <RemixRouteContext.Provider value={context}>
      <routeModule.default />
    </RemixRouteContext.Provider>
  );

  if (routeModule.ErrorBoundary) {
    // Only wrap in error boundary if the route defined one, otherwise let the
    // error bubble to the parent boundary. We could default to using error
    // boundaries around every route, but now if the app doesn't want users
    // seeing the default Remix ErrorBoundary component, they *must* define an
    // error boundary for *every* route and that would be annoying. Might as
    // well make it required at that point.
    //
    // By conditionally wrapping like this, we allow apps to define a top level
    // ErrorBoundary component and be done with it. Then, if they want to, they
    // can add more specific boundaries by exporting ErrorBoundary components
    // for whichever routes they please.

    // If we tried to render and failed, and this route threw the error, find it
    // and pass it to the ErrorBoundary to emulate `componentDidCatch`
    let maybeServerRenderError =
      componentDidCatchEmulator.error &&
      (componentDidCatchEmulator.renderBoundaryRouteId === routeId ||
        componentDidCatchEmulator.loaderBoundaryRouteId === routeId)
        ? deserializeError(componentDidCatchEmulator.error)
        : undefined;

    // This needs to run after we check for the error from a previous render,
    // otherwise we will incorrectly render this boundary for a loader error
    // deeper in the tree.
    if (componentDidCatchEmulator.trackBoundaries) {
      componentDidCatchEmulator.renderBoundaryRouteId = routeId;
    }

    return (
      <RemixErrorBoundary
        location={location}
        component={routeModule.ErrorBoundary}
        error={maybeServerRenderError}
      >
        {element}
      </RemixErrorBoundary>
    );
  }

  return element;
}

////////////////////////////////////////////////////////////////////////////////
// Public API

export { Link };

/**
 * Renders the `<title>` and `<meta>` tags for the current routes.
 */
export function Meta() {
  let { matches, routeData, routeModules } = useRemixEntryContext();
  let location = useLocation();

  let meta: { [name: string]: string } = {};
  let parentsData: { [routeId: string]: AppData } = {};

  for (let match of matches) {
    let routeId = match.route.id;
    let data = routeData[routeId];
    let params = match.params;

    let routeModule = routeModules[routeId];

    if (typeof routeModule.meta === "function") {
      let routeMeta = routeModule.meta({ data, parentsData, params, location });
      Object.assign(meta, routeMeta);
    }

    parentsData[routeId] = data;
  }

  return (
    <>
      {Object.keys(meta).map(name =>
        name === "title" ? (
          <title key="title">{meta[name]}</title>
        ) : (
          <meta key={name} name={name} content={meta[name]} />
        )
      )}
    </>
  );
}

/**
 * Renders the <script> tags needed for the initial render of this page.
 * Bundles for additional routes are loaded later as needed.
 */
export function Scripts() {
  let { manifest, serverHandoffString } = useRemixEntryContext();

  let browserIsHydrating = false;
  if (!serverHandoffString) {
    browserIsHydrating = true;
    serverHandoffString = "{}";
  }

  let contextScript = `window.__remixContext = ${serverHandoffString};`;

  let routeIds = Object.keys(manifest.routes).filter(
    routeId => manifest.routes[routeId].moduleUrl != null
  );
  let routeModulesScript = `${routeIds
    .map(
      (routeId, index) =>
        `import * as route${index} from ${JSON.stringify(
          manifest.routes[routeId].moduleUrl
        )};`
    )
    .join("\n")}
    window.__remixRouteModules = {${routeIds
      .map((routeId, index) => `${JSON.stringify(routeId)}:route${index}`)
      .join(",")}};`;

  return React.useMemo(
    () => (
      <>
        <script
          suppressHydrationWarning={browserIsHydrating}
          dangerouslySetInnerHTML={createHtml(contextScript)}
        />
        <script
          dangerouslySetInnerHTML={createHtml(routeModulesScript)}
          type="module"
        />
        <script src={manifest.entryModuleUrl} type="module" />
      </>
    ),
    [] // eslint-disable-line
  );
}

/**
 * Renders the <link> tags for the stylesheets of the current routes.
 */
export function Styles() {
  let { manifest, matches } = useRemixEntryContext();

  let stylesUrls = [];

  if (manifest.globalStylesUrl) {
    stylesUrls.push(manifest.globalStylesUrl);
  }

  for (let match of matches) {
    let route = manifest.routes[match.route.id];
    if (route.stylesUrl) {
      stylesUrls.push(route.stylesUrl);
    }
  }

  return (
    <>
      {stylesUrls.map(href => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
    </>
  );
}

/**
 * Renders the routes for this page. Suspends if we don't yet have the manifest
 * or routes for this page and need to get them from the server.
 */
function Routes() {
  // TODO: Add `renderMatches` function to RR that we can use and then we don't need this component,
  // we can just `renderMatches` from RemixEntry
  let { manifest } = useRemixEntryContext();
  let routes = createClientRoutes(manifest.routes, RemixRoute);
  let element = useRoutes(routes);
  return element;
}

export interface FormProps extends Omit<HTMLFormElement, "method"> {
  /**
   * The HTTP verb to use when the form is submit. If JavaScript is disabled,
   * you'll need to implement your own "method override". Supports "get",
   * "post", "put", "delete", "patch".
   */
  method?: FormMethod;

  /**
   * Normal form "action" but allows for React Router's relative paths.
   */
  action?: string;

  /**
   * Forces a full document navigation instead of a fetch.
   */
  forceRefresh?: boolean;

  /**
   * Replaces the current entry in the browser history stack when the form
   * navigates. Use this if you don't want the user to be able to click "back"
   * to the page with the form on it.
   */
  replace?: boolean;

  /**
   * Normal form encType, Remix only supports
   * `application/x-www-form-urlencoded` right now but will soon support
   * `multipart/form-data` as well.
   */
  encType?: FormEncType;

  /**
   * A function to call when the form is submitted. If you call
   * `event.preventDefault()` then this form will not do anything.
   */
  onSubmit?: React.FormEventHandler;
}

/**
 * A Remix-aware `<form>`. It behaves like a normal form except that the
 * interaction with the server is with `fetch` instead of new document
 * requests, allowing components to add nicer UX to the page as the form is
 * submitted and returns with data.
 */
let Form = React.forwardRef<HTMLFormElement, FormProps>(
  (
    {
      forceRefresh = false,
      replace = false,
      action = ".",
      method = "get",
      encType = "application/x-www-form-urlencoded",
      onSubmit,
      ...props
    },
    forwardedRef
  ) => {
    let navigate = useNavigate();
    let path = useResolvedPath(action);
    let formMethod = method.toLowerCase() === "get" ? "get" : "post";

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
      onSubmit && onSubmit(event);
      if (event.defaultPrevented) return;

      event.preventDefault();
      let data = new FormData(event.currentTarget);

      setFormPending(method, data, encType);

      if (method.toLowerCase() === "get") {
        // TODO: Patch the URLSearchParams constructor type to accept FormData
        // @ts-ignore
        let searchParams = new URLSearchParams(data);
        path.search = "?" + searchParams.toString();
      }

      navigate(path, { replace });
    }

    return (
      <form
        ref={forwardedRef}
        method={formMethod}
        action={path.pathname}
        encType={encType}
        onSubmit={forceRefresh ? undefined : handleSubmit}
        {...props}
      />
    );
  }
);

export { Form };

/**
 * Setup a callback to be fired on the window's `beforeunload` event. This is
 * useful for saving some data to `window.localStorage` just before the page
 * refreshes, which automatically happens on the next `<Link>` click when Remix
 * detects a new version of the app is available on the server.
 *
 * Note: The `callback` argument should be a function created with
 * `React.useCallback()`.
 */
export function useBeforeUnload(callback: () => any): void {
  React.useEffect(() => {
    window.addEventListener("beforeunload", callback);
    return () => {
      window.removeEventListener("beforeunload", callback);
    };
  }, [callback]);
}

/**
 * Returns the data for the current route from `data/routes/*`.
 */
export function useRouteData<T = AppData>(): T {
  return useRemixRouteContext().data;
}

/**
 * Returns the `{ method, data, encType }` that are currently being used to
 * submit a `<Form>`. This is useful for showing e.g. a pending indicator or
 * animation for some newly created/destroyed data.
 */
export function usePendingFormSubmit(): FormSubmit | undefined {
  return pendingFormSubmit ? pendingFormSubmit : undefined;
}

/**
 * Returns the next location if a location change is pending. This is useful
 * for showing loading indicators during route transitions from `<Link>` clicks.
 */
export function usePendingLocation(): Location | undefined {
  return useRemixEntryContext().pendingLocation;
}
