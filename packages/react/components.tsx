import type { FormHTMLAttributes } from "react";
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
import type {
  EntryContext,
  SerializedError,
  HTMLLinkDescriptor,
  ComponentDidCatchEmulator,
  EntryManifest as Manifest
} from "@remix-run/core";

import {
  AppData,
  RouteData,
  FormEncType,
  FormMethod,
  FormSubmit,
  fetchData,
  extractData,
  isRedirectResponse
} from "./data";
import invariant from "./invariant";
import { createHtml } from "./markup";
import type { RouteModules } from "./routeModules";
import { loadRouteModule } from "./routeModules";
import type { ClientRouteMatch, ClientRouteObject } from "./routes";
import {
  createClientRoutes,
  createClientMatches,
  matchClientRoutes
} from "./routes";
import {
  RemixRootDefaultErrorBoundary,
  RemixErrorBoundary
} from "./errorBoundaries";
import { getLinks, preloadBlockingLinks } from "./links";

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
function setFormPending(method: string, encType: string, data: FormData): void {
  pendingFormSubmit = { method, encType, data };
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
  clientRoutes: ClientRouteObject[];
  links: HTMLLinkDescriptor[];
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

  let clientRoutes = React.useMemo(
    () => createClientRoutes(manifest.routes, RemixRoute),
    [manifest]
  );

  let links = React.useMemo(() => {
    return getLinks(
      location,
      matches,
      routeData,
      routeModules,
      manifest,
      clientRoutes
    );
  }, [location, matches, routeData, routeModules, manifest, clientRoutes]);

  React.useEffect(() => {
    if (location === nextLocation) return;

    let isCurrent = true;

    (async () => {
      let nextMatches = matchClientRoutes(clientRoutes, nextLocation);

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
        let leafRoute = manifest.routes[leafMatch.route.id];

        if (!leafRoute.hasAction) {
          throw new Error(
            `Route "${leafRoute.id}" does not have an action handler, but you are trying ` +
              `to submit to it. To fix this, please add an \`action\` function to the ` +
              `route module.`
          );
        }

        let response = await fetchData(
          nextLocation,
          leafRoute.id,
          pendingFormSubmit
        );

        // TODO: Handle error responses here...
        handleDataRedirect(response as Response);

        // Expecting handleDataRedirect to redirect, so we don't need to worry
        // about doing anything else in here.
        return;
      }

      function maybeHandleDataRedirect(response: any) {
        if (!didRedirect) handleDataRedirect(response);
      }

      let newMatches =
        // reload all routes on form submits and search changes
        formState === FormState.Redirected ||
        location.search !== nextLocation.search
          ? nextMatches
          : nextMatches.filter(
              (match, index) =>
                // new route
                !matches[index] ||
                // existing route but params changed
                matches[index].pathname !== match.pathname
            );

      let transitionResults = await Promise.all(
        newMatches.map(async match => {
          let routeId = match.route.id;
          let route = manifest.routes[routeId];

          // get data and module in parallel
          let [dataResult, routeModule] = await Promise.all([
            route.hasLoader ? fetchData(nextLocation, route.id) : undefined,
            loadRouteModule(route, routeModules)
          ]);

          // don't waste time w/ links for routes that won't render
          if (
            isRedirectResponse(dataResult) ||
            dataResult instanceof Error ||
            routeModule == null // how?
          ) {
            return { routeId, dataResult, links: [] };
          }

          if (routeModule.links) {
            await preloadBlockingLinks(
              routeModule,
              // clone so we don't empty the body for later code (refactor?)
              dataResult != null ? await extractData(dataResult.clone()) : null
            );
          }

          return { routeId, dataResult };
        })
      );

      let componentDidCatchEmulator: ComponentDidCatchEmulator = {
        trackBoundaries: false,
        renderBoundaryRouteId: null,
        loaderBoundaryRouteId: null,
        error: undefined
      };

      for (let { routeId, dataResult } of transitionResults) {
        if (
          !(dataResult instanceof Response || dataResult instanceof Error) ||
          componentDidCatchEmulator.error
        ) {
          continue;
        }

        let routeModule = routeModules[routeId];

        if (routeModule.ErrorBoundary) {
          componentDidCatchEmulator.loaderBoundaryRouteId = routeId;
        }

        if (dataResult instanceof Error) {
          componentDidCatchEmulator.error = dataResult;
        } else if (isRedirectResponse(dataResult)) {
          maybeHandleDataRedirect(dataResult);
        }
      }

      let newRouteData = (
        await Promise.all(
          transitionResults.map(async ({ routeId, dataResult }) => {
            if (dataResult instanceof Response || dataResult instanceof Error) {
              return [routeId, await extractData(dataResult)];
            }
            return [routeId, undefined];
          })
        )
      ).reduce((memo, [routeId, data]) => {
        if (data) memo[routeId] = data;
        return memo;
      }, {} as RouteData);

      let nextRouteData = nextMatches.reduce((memo, match) => {
        let routeId = match.route.id;
        memo[routeId] = newRouteData[routeId] || routeData[routeId];
        return memo;
      }, {} as RouteData);

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
    routeModules,
    clientRoutes
  ]);

  let context: RemixEntryContextType = {
    manifest,
    matches,
    componentDidCatchEmulator,
    routeData,
    routeModules,
    serverHandoffString,
    pendingLocation: nextLocation !== location ? nextLocation : undefined,
    clientRoutes,
    links
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
 * Renders the `<link>` tags for the current routes.
 */
export function Links() {
  let { links } = useRemixEntryContext();

  return (
    <>
      {links.map(link => (
        <link key={link.rel + link.href} {...link} />
      ))}
    </>
  );
}

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
 * Renders the `<script>` tags needed for the initial render. Bundles for
 * additional routes are loaded later as needed.
 */
export function Scripts() {
  let {
    manifest,
    matches,
    pendingLocation,
    clientRoutes,
    serverHandoffString
  } = useRemixEntryContext();

  let initialScripts = React.useMemo(() => {
    let contextScript = serverHandoffString
      ? `window.__remixContext = ${serverHandoffString};`
      : "";

    let routeModulesScript = `${matches
      .map(
        (match, index) =>
          `import * as route${index} from ${JSON.stringify(
            manifest.routes[match.route.id].moduleUrl
          )};`
      )
      .join("\n")}
    window.__remixRouteModules = {${matches
      .map((match, index) => `${JSON.stringify(match.route.id)}:route${index}`)
      .join(",")}};`;

    return (
      <>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={createHtml(contextScript)}
        />
        <script
          dangerouslySetInnerHTML={createHtml(routeModulesScript)}
          type="module"
        />
        <script src={manifest.manifestUrl} type="module" />
        <script src={manifest.entryModuleUrl} type="module" />
      </>
    );
    // disabled deps array because we are purposefully only rendering this once
    // for hydration, after that we want to just continue rendering the initial
    // scripts as they were when the page first loaded
    // eslint-disable-next-line
  }, []);

  // avoid waterfall when importing the next route module
  let nextMatches = React.useMemo(
    () =>
      pendingLocation ? matchClientRoutes(clientRoutes, pendingLocation) : [],
    [pendingLocation, clientRoutes]
  );

  let routePreloads = matches
    .concat(nextMatches)
    .map(match => {
      let route = manifest.routes[match.route.id];
      return (route.imports || []).concat([route.moduleUrl]);
    })
    .flat(1);

  let preloads = manifest.entryModuleImports.concat(routePreloads);

  return (
    <>
      {dedupe(preloads).map(path => (
        <link key={path} rel="modulepreload" href={path} />
      ))}
      {initialScripts}
    </>
  );
}

function dedupe(array: any[]) {
  return [...new Set(array)];
}

/**
 * Renders the routes for this page. Suspends if we don't yet have the manifest
 * or routes for this page and need to get them from the server.
 */
function Routes() {
  // TODO: Add `renderMatches` function to RR that we can use and then we don't
  // need this component, we can just `renderMatches` from RemixEntry
  let { clientRoutes } = useRemixEntryContext();
  let element = useRoutes(clientRoutes);
  return element;
}

export interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  /**
   * The HTTP verb to use when the form is submit. Supports "get", "post",
   * "put", "delete", "patch".
   *
   * Note: If JavaScript is disabled, you'll need to implement your own "method
   * override" to support more than just GET and POST.
   */
  method?: FormMethod;

  /**
   * Normal `<form action>` but supports React Router's relative paths.
   */
  action?: string;

  /**
   * Normal `<form encType>`.
   *
   * Note: Remix only supports `application/x-www-form-urlencoded` right now
   * but will soon support `multipart/form-data` as well.
   */
  encType?: FormEncType;

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
export let Form = React.forwardRef<HTMLFormElement, FormProps>(
  (
    {
      forceRefresh = false,
      replace = false,
      method = "get",
      action = ".",
      encType = "application/x-www-form-urlencoded",
      onSubmit,
      ...props
    },
    forwardedRef
  ) => {
    let submit = useSubmit();
    let formMethod = method.toLowerCase() === "get" ? "get" : "post";
    let formAction = useFormAction(action);

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
      onSubmit && onSubmit(event);
      if (event.defaultPrevented) return;
      event.preventDefault();
      submit(event.currentTarget, { method, replace });
    }

    return (
      <form
        ref={forwardedRef}
        method={formMethod}
        action={formAction}
        encType={encType}
        onSubmit={forceRefresh ? undefined : handleSubmit}
        {...props}
      />
    );
  }
);

/**
 * Resolves a `<form action>` path relative to the current route.
 */
export function useFormAction(action = "."): string {
  let path = useResolvedPath(action);
  return path.pathname + path.search;
}

export interface SubmitOptions {
  /**
   * The HTTP method used to submit the form. Overrides `<form method>`.
   * Defaults to "GET".
   */
  method?: FormMethod;

  /**
   * The action URL path used to submit the form. Overrides `<form action>`.
   * Defaults to the path of the current route.
   *
   * Note: It is assumed the path is already resolved. If you need to resolve a
   * relative path, use `useFormAction`.
   */
  action?: string;

  /**
   * The action URL used to submit the form. Overrides `<form encType>`.
   * Defaults to "application/x-www-form-urlencoded".
   */
  encType?: FormEncType;

  /**
   * Set `true` to replace the current entry in the browser's history stack
   * instead of creating a new one (i.e. stay on "the same page"). Defaults
   * to `false`.
   */
  replace?: boolean;
}

/**
 * Submits a HTML `<form>` to the server without reloading the page.
 */
export interface SubmitFunction {
  (
    /**
     * Specifies the `<form>` to be submitted to the server, a specific
     * `<button>` or `<input type="submit">` to use to submit the form, or some
     * arbitrary data to submit.
     *
     * Note: When using a `<button>` its `name` and `value` will also be
     * included in the form data that is submitted.
     */
    target:
      | HTMLFormElement
      | HTMLButtonElement
      | HTMLInputElement
      | FormData
      | URLSearchParams
      | { [name: string]: string }
      | null,

    /**
     * Options that override the `<form>`'s own attributes. Required when
     * submitting arbitrary data without a backing `<form>`.
     */
    options?: SubmitOptions
  ): void;
}

/**
 * Returns a function that may be used to programmatically submit a form (or
 * some arbitrary data) to the server.
 */
export function useSubmit(): SubmitFunction {
  let navigate = useNavigate();
  let defaultAction = useFormAction();

  return (target, options = {}) => {
    let method: string;
    let action: string;
    let encType: string;
    let formData: FormData;

    if (isFormElement(target)) {
      method = options.method || target.method;
      action = options.action || target.action;
      encType = options.encType || target.enctype;
      formData = new FormData(target);
    } else if (
      isButtonElement(target) ||
      (isInputElement(target) &&
        (target.type === "submit" || target.type === "image"))
    ) {
      let form = target.form;

      if (form == null) {
        throw new Error(`Cannot submit a <button> without a <form>`);
      }

      // <button>/<input type="submit"> may override attributes of <form>
      method = options.method || target.formMethod || form.method;
      action = options.action || target.formAction || form.action;
      encType = options.encType || target.formEnctype || form.enctype;
      formData = new FormData(form);

      // Include name + value from a <button>
      if (target.name) {
        formData.set(target.name, target.value);
      }
    } else {
      if (isHtmlElement(target)) {
        throw new Error(
          `Cannot submit element that is not <form>, <button>, or ` +
            `<input type="submit|image">`
        );
      }

      method = options.method || "GET";
      action = options.action || defaultAction;
      encType = options.encType || "application/x-www-form-urlencoded";

      if (target instanceof FormData) {
        formData = target;
      } else {
        formData = new FormData();

        if (target instanceof URLSearchParams) {
          for (let [name, value] of target) {
            formData.set(name, value);
          }
        } else if (target != null) {
          for (let name of Object.keys(target)) {
            formData.set(name, target[name]);
          }
        }
      }
    }

    setFormPending(method, encType, formData);

    let url = new URL(action);

    if (method === "get") {
      for (let [name, value] of formData) {
        if (typeof value === "string") {
          url.searchParams.set(name, value);
        } else {
          throw new Error(`Cannot submit binary form data using GET`);
        }
      }
    }

    navigate(url.pathname + url.search, { replace: options.replace });
  };
}

function isHtmlElement(object: any): object is HTMLElement {
  return object != null && typeof object.tagName === "string";
}

function isButtonElement(object: any): object is HTMLButtonElement {
  return isHtmlElement(object) && object.tagName.toLowerCase() === "button";
}

function isFormElement(object: any): object is HTMLFormElement {
  return isHtmlElement(object) && object.tagName.toLowerCase() === "form";
}

function isInputElement(object: any): object is HTMLInputElement {
  return isHtmlElement(object) && object.tagName.toLowerCase() === "input";
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
