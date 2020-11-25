import type { ReactNode } from "react";
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
import type { EntryContext } from "@remix-run/core";

import {
  AppData,
  RouteData,
  FormEncType,
  FormMethod,
  FormSubmit,
  loadGlobalData,
  loadRouteData
} from "./data";
import defaultRouteModule from "./defaultRouteModule";
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
  console.log("setFormPending");
  pendingFormSubmit = { method, data, encType };
  formState = method === "get" ? FormState.PendingGet : FormState.Pending;
}

// 2. When the loader action redirects
function setFormRedirected() {
  console.log("setFormRedirected");
  formState = FormState.Redirected;
}

// 3. After Remix finishes the transition, we go back to idle
function setFormIdle() {
  console.log("setFormIdle");
  pendingFormSubmit = undefined;
  formState = FormState.Idle;
}

////////////////////////////////////////////////////////////////////////////////
// RemixEntry

interface RemixEntryContextType {
  globalData: AppData;
  manifest: Manifest;
  matches: ClientRouteMatch[];
  nextLocation: Location | undefined;
  routeData: RouteData;
  routeModules: RouteModules;
  serverHandoffString?: string;
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
  children,
  context: entryContext,
  action: nextAction,
  location: nextLocation,
  navigator,
  static: staticProp = false
}: {
  children: ReactNode;
  context: EntryContext;
  action: Action;
  location: Location;
  navigator: Navigator;
  static?: boolean;
}) {
  let {
    manifest,
    matches: entryMatches,
    globalData: entryGlobalData,
    routeData: entryRouteData,
    routeModules,
    serverHandoffString
  } = entryContext;

  let [state, setState] = React.useState({
    action: nextAction,
    location: nextLocation,
    matches: createClientMatches(entryMatches, RemixRoute),
    globalData: entryGlobalData,
    routeData: entryRouteData
  });
  let { action, location, matches, globalData, routeData } = state;

  React.useEffect(() => {
    if (location === nextLocation) return;

    let isCurrent = true;

    (async () => {
      await loadManifest(manifest, nextLocation.pathname);

      let routes = createClientRoutes(manifest.routes, RemixRoute);
      let nextMatches = matchClientRoutes(routes, nextLocation);

      let didRedirect = false;
      function handleDataRedirect(url: URL) {
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

        await loadRouteData(
          manifest.routes[leafMatch.route.id],
          nextLocation,
          leafMatch.params,
          handleDataRedirect,
          pendingFormSubmit
        );

        // Expecting handleDataRedirect to be called, so we don't need to worry
        // about doing anything else in here.
        return;
      }

      // Reload global data after a <Form> submit.
      let globalDataPromise =
        formState === FormState.Redirected
          ? loadGlobalData(
              manifest.globalLoaderUrl,
              nextLocation,
              handleDataRedirect
            )
          : Promise.resolve(globalData);

      let routeDataPromise = Promise.all(
        // Reload all route data after a <Form> submit.
        formState === FormState.Redirected
          ? nextMatches.map(match =>
              loadRouteData(
                manifest.routes[match.route.id],
                nextLocation,
                match.params,
                handleDataRedirect
              )
            )
          : nextMatches.map((match, index) =>
              location.search === nextLocation.search &&
              matches[index] &&
              matches[index].pathname === match.pathname
                ? // Re-use data we already have for routes already on the page
                  // if the URL hasn't changed for that route.
                  routeData[match.route.id]
                : loadRouteData(
                    manifest.routes[match.route.id],
                    nextLocation,
                    match.params,
                    handleDataRedirect
                  )
            )
      );

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

      let globalDataResult = await globalDataPromise;
      let dataResults = await routeDataPromise;
      await styleSheetsPromise;
      await modulesPromise;

      if (isCurrent && !didRedirect) {
        let nextGlobalData = globalDataResult;
        let nextRouteData = nextMatches.reduce((routeData, match, index) => {
          routeData[match.route.id] = dataResults[index];
          return routeData;
        }, {} as RouteData);

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
          globalData: nextGlobalData,
          routeData: nextRouteData
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
    globalData,
    routeData,
    navigator,
    manifest,
    routeModules
  ]);

  let context: RemixEntryContextType = {
    manifest,
    matches,
    globalData,
    routeData,
    routeModules,
    serverHandoffString,
    nextLocation: nextLocation !== location ? nextLocation : undefined
  };

  return (
    <Router
      action={action}
      location={location}
      navigator={navigator}
      static={staticProp}
    >
      <RemixEntryContext.Provider value={context} children={children} />
    </Router>
  );
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
  let { routeData, routeModules } = useRemixEntryContext();

  let data = routeData[routeId];
  let routeModule = routeModules[routeId];

  if (!routeModule) {
    return (
      <defaultRouteModule.default>
        <RemixRouteMissing id={routeId} />
      </defaultRouteModule.default>
    );
  }

  let context: RemixRouteContextType = {
    data,
    id: routeId
  };

  return (
    <RemixRouteContext.Provider value={context}>
      <routeModule.default />
    </RemixRouteContext.Provider>
  );
}

function RemixRouteMissing({ id: routeId }: { id: string }) {
  return <p>Missing route "{routeId}"!</p>;
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

    let routeModule = routeModules[routeId] || defaultRouteModule;

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
  let contextRouteModulesScript = `${routeIds
    .map(
      (routeId, index) =>
        `import * as route${index} from ${JSON.stringify(
          manifest.routes[routeId].moduleUrl
        )};`
    )
    .join("\n")}
    window.__remixContext.routeModules = {${routeIds
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
          dangerouslySetInnerHTML={createHtml(contextRouteModulesScript)}
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
export function Routes() {
  // TODO: Add `renderMatches` function to RR that we
  // can use here with the matches we get from context.
  let { manifest } = useRemixEntryContext();
  let routes = createClientRoutes(manifest.routes, RemixRoute);
  return useRoutes(routes);
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
export function Form({
  forceRefresh = false,
  replace = false,
  action = ".",
  method = "get",
  encType = "application/x-www-form-urlencoded",
  onSubmit,
  ...props
}: FormProps) {
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
      method={formMethod}
      action={path.pathname}
      encType={encType}
      onSubmit={forceRefresh ? undefined : handleSubmit}
      {...props}
    />
  );
}

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
 * Returns the data from `data/global.js`.
 */
export function useGlobalData<T = AppData>(): T {
  return useRemixEntryContext().globalData;
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
  return useRemixEntryContext().nextLocation;
}
