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

import type { AppData, RouteData } from "./data";
import { loadRouteData } from "./data";
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

enum FormStates {
  idle = "idle",

  // non get submits
  // - idle -> pending -> redirected -> idle
  // - reload data from all routes on the redirect
  pending = "pending",
  redirected = "redirected",

  // get submits
  // - idle -> pendingGet -> idle
  // - just normal navigation except store the FormSubmit for usePendingFormSubmit
  pendingGet = "pendingGet"
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
    globalData,
    manifest,
    matches: entryMatches,
    routeData: entryRouteData,
    routeModules,
    serverHandoffString
  } = entryContext;

  let [state, setState] = React.useState({
    action: nextAction,
    location: nextLocation,
    matches: createClientMatches(entryMatches, RemixRoute),
    routeData: entryRouteData
  });
  let { action, location, matches, routeData } = state;

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
        if (formState === FormStates.pending) {
          setFormRedirected();
        }
        if (url.origin !== window.location.origin) {
          window.location.replace(url.href);
        } else {
          // TODO: navigator.replace() should just handle different origins
          navigator.replace(url.pathname + url.search);
        }
      }

      let isAction = formState === FormStates.pending;

      if (isAction) {
        let leafMatch = nextMatches[nextMatches.length - 1];

        await loadRouteData(
          manifest.routes[leafMatch.route.id],
          location,
          leafMatch.params,
          handleDataRedirect,
          pendingFormSubmit
        );

        // Expecting handleDataRedirect to be called, so we don't need to worry
        // about doing anything else in here.
        return;
      }

      let dataPromise = Promise.all(
        nextMatches.map((match, index) =>
          // reload all routes after a <Form> submit
          formState !== FormStates.redirected &&
          location.search === nextLocation.search &&
          matches[index] &&
          matches[index].pathname === match.pathname
            ? // Re-use data we already have for routes already on the page.
              routeData[match.route.id]
            : loadRouteData(
                manifest.routes[match.route.id],
                location,
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

      let dataResults = await dataPromise;
      await styleSheetsPromise;
      await modulesPromise;

      if (isCurrent && !didRedirect) {
        let nextRouteData = nextMatches.reduce((routeData, match, index) => {
          routeData[match.route.id] = dataResults[index];
          return routeData;
        }, {} as RouteData);

        if (
          formState === FormStates.redirected ||
          formState === FormStates.pendingGet
        ) {
          setFormIdle();
        }

        setState({
          action: nextAction,
          location: nextLocation,
          matches: nextMatches,
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
    routeData,
    navigator,
    manifest,
    routeModules
  ]);

  let context: RemixEntryContextType = {
    globalData,
    manifest,
    matches,
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
 * Returns the next location if a location change is pending. This is useful
 * for showing a "loading..." indicator during route transitions.
 *
 * TODO: Move this hook back into RR v6 beta (out of experimental)
 */
export function usePendingLocation() {
  return useRemixEntryContext().nextLocation;
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

////////////////////////////////////////////////////////////////////////////////
// <Form>
type MethodType = "get" | "post" | "put" | "patch" | "delete";
type FormEncType = "application/x-www-form-urlencoded" | "multipart/form-data";

export interface FormSubmit {
  method: MethodType;
  data: FormData;
  encType: FormEncType;
}

let pendingFormSubmit: FormSubmit | undefined = undefined;
let formState = FormStates.idle;

// 1. When a form is submit, we go into a pending state
function setFormPending(
  method: MethodType,
  data: FormData,
  encType: FormEncType
): void {
  pendingFormSubmit = { method, data, encType };
  formState = method === "get" ? FormStates.pendingGet : FormStates.pending;
}

// 2. When the loader action redirects
function setFormRedirected() {
  formState = FormStates.redirected;
}

// 3. After Remix finishes the transition, we go back to idle
function setFormIdle() {
  pendingFormSubmit = undefined;
  formState = FormStates.idle;
}

////////////////////////////////////////////////////////////////////////////////
export interface FormProps extends Omit<HTMLFormElement, "method"> {
  /**
   * Forces a full document navigation instead of a fetch.
   */
  forceRefresh?: boolean;

  /**
   * The HTTP verb to use when the form is submit. If JavaScript is disabled,
   * you'll need to implement your own "method override". Supports "get",
   * "post", "put", "delete", "patch".
   */
  method?: MethodType;

  /**
   * Replaces the current entry in the browser history stack when the form
   * navigates. Use this if you don't want the user to be able to click "back"
   * to the page with the form on it.
   */
  replace?: boolean;

  /**
   * Normal form "action" but allows for React Router's relative paths.
   */
  action?: string;

  /**
   * Normal form encType, Remix only supports
   * `application/x-www-form-urlencoded` right now but will soon support
   * `multipart/form-data` as well.
   */
  encType?: "application/x-www-form-urlencoded" | "multipart/form-data";

  /**
   * A function to call when the form is submit. If you call
   * `event.preventDefault()` then this form will not do anything.
   */
  onSubmit?: React.FormEventHandler;
}

/**
 * A Remix aware `<form>`. It behaves like a normal form except that the
 * interaction with the server is with `fetch` instead of new document
 * requests, allowing components to add nicer UX to the page as the form is
 * submit and returns with data.
 */
export let Form: React.FunctionComponent<FormProps> = ({
  forceRefresh = false,
  replace = false,
  action = ".",
  method = "get",
  encType = "application/x-www-form-urlencoded",
  onSubmit,
  ...props
}) => {
  let navigate = useNavigate();
  let path = useResolvedPath(action);
  let formMethod = method.toLowerCase() === "get" ? "get" : "post";

  let handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    onSubmit && onSubmit(event);
    if (event.defaultPrevented) return;

    event.preventDefault();
    let formData = new FormData(event.currentTarget);

    setFormPending(method, formData, encType);

    if (method === "get") {
      let formSearch = new URLSearchParams(formData as any);
      path.search = "?" + formSearch.toString();
    }

    navigate(path, { replace });
  };

  return (
    <form
      method={formMethod}
      action={path.pathname}
      encType={encType}
      onSubmit={forceRefresh ? undefined : handleSubmit}
      {...props}
    />
  );
};

export function usePendingFormSubmit() {
  return pendingFormSubmit ? pendingFormSubmit : undefined;
}
