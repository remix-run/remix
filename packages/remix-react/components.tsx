import type { Action, Location } from "history";
import type { FormHTMLAttributes } from "react";
import React from "react";
import type { Navigator } from "react-router";
import {
  Router,
  Link,
  useLocation,
  useRoutes,
  useNavigate,
  useResolvedPath
} from "react-router-dom";

import { AppData } from "./data";
import { FormEncType, FormMethod } from "./data";
import type { EntryContext, AssetsManifest } from "./entry";
import type { ComponentDidCatchEmulator, SerializedError } from "./errors";
import {
  RemixRootDefaultErrorBoundary,
  RemixErrorBoundary
} from "./errorBoundaries";
import invariant from "./invariant";
import type { HTMLLinkDescriptor } from "./links";
import { getLinks } from "./linksPreloading";
import { createHtml } from "./markup";
import type { ClientRoute } from "./routes";
import { createClientRoutes } from "./routes";
import type { RouteData } from "./routeData";
import type { RouteMatch } from "./routeMatching";
import { matchClientRoutes } from "./routeMatching";
import type { RouteModules } from "./routeModules";
import {
  createTransitionManager,
  isPostSubmission,
  idleTransition,
  isSubmission,
  makeFormData
} from "./transition";
import type {
  Transition,
  GenericSubmission,
  SubmissionTransition
} from "./transition";

////////////////////////////////////////////////////////////////////////////////
// RemixEntry

interface RemixEntryContextType {
  manifest: AssetsManifest;
  matches: RouteMatch<ClientRoute>[];
  routeData: { [routeId: string]: RouteData };
  actionData?: RouteData;
  pendingLocation?: Location;
  componentDidCatchEmulator: ComponentDidCatchEmulator;
  routeModules: RouteModules;
  serverHandoffString?: string;
  clientRoutes: ClientRoute[];
  links: HTMLLinkDescriptor[];
  transitionManager: ReturnType<typeof createTransitionManager>;
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
  action,
  location: historyLocation,
  navigator: _navigator,
  static: staticProp = false
}: {
  context: EntryContext;
  action: Action;
  location: Location<any>;
  navigator: Navigator;
  static?: boolean;
}) {
  let {
    manifest,
    routeData: documentLoaderData,
    actionData: documentActionData,
    routeModules,
    serverHandoffString,
    componentDidCatchEmulator: entryComponentDidCatchEmulator
  } = entryContext;

  let clientRoutes = React.useMemo(
    () => createClientRoutes(manifest.routes, routeModules, RemixRoute),
    [manifest, routeModules]
  );

  let [, forceUpdate] = React.useState({});

  let [
    componentDidCatchEmulator,
    setComponentDidCatchEmulator
  ] = React.useState(entryComponentDidCatchEmulator);

  let [transitionManager] = React.useState(() => {
    return createTransitionManager({
      routes: clientRoutes,
      actionData: documentActionData,
      loaderData: documentLoaderData,
      location: historyLocation,
      onRedirect: _navigator.replace,
      onChange: state => {
        setComponentDidCatchEmulator({
          error: state.error,
          loaderBoundaryRouteId: state.errorBoundaryId,
          renderBoundaryRouteId: null,
          trackBoundaries: false
        });
        forceUpdate({});
      }
    });
  });

  // Ensures pushes interrupting pending navigations use replace
  // TODO: Move this to React Router
  let navigator: Navigator = React.useMemo(() => {
    let push: Navigator["push"] = (to, state) => {
      return transitionManager.getState().nextLocation
        ? _navigator.replace(to, state)
        : _navigator.push(to, state);
    };
    return { ..._navigator, push };
  }, [_navigator, transitionManager]);

  let {
    location,
    nextLocation,
    matches,
    loaderData,
    actionData
  } = transitionManager.getState();

  React.useEffect(() => {
    // Repost actions on initial load (refresh or pop from different document)
    if (isPostSubmission(location)) {
      let { pathname, search, hash, state } = location;
      navigator.replace({ pathname, search, hash }, state);
    }
    // eslint-disable-next-line
  }, []); // not synchronization, only do it on mount

  // Send new location to the transition manager
  React.useEffect(() => {
    let { location } = transitionManager.getState();
    if (historyLocation === location) return;
    transitionManager.send(historyLocation);
  }, [transitionManager, historyLocation]);

  let links = React.useMemo(() => {
    return getLinks(
      location,
      matches,
      loaderData,
      routeModules,
      manifest,
      clientRoutes
    );
  }, [location, matches, loaderData, routeModules, manifest, clientRoutes]);

  // If we tried to render and failed, and the app threw before rendering any
  // routes, get the error and pass it to the ErrorBoundary to emulate
  // `componentDidCatch`
  let ssrErrorBeforeRoutesRendered =
    componentDidCatchEmulator.error &&
    componentDidCatchEmulator.renderBoundaryRouteId === null &&
    componentDidCatchEmulator.loaderBoundaryRouteId === null
      ? deserializeError(componentDidCatchEmulator.error)
      : undefined;

  return (
    <RemixEntryContext.Provider
      value={{
        matches,
        manifest,
        componentDidCatchEmulator,
        routeModules,
        serverHandoffString,
        clientRoutes,
        links,
        routeData: loaderData,
        actionData,
        pendingLocation: nextLocation,
        transitionManager
      }}
    >
      <RemixErrorBoundary
        location={location}
        component={RemixRootDefaultErrorBoundary}
        error={ssrErrorBeforeRoutesRendered}
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

function Routes() {
  // TODO: Add `renderMatches` function to RR that we can use and then we don't
  // need this component, we can just `renderMatches` from RemixEntry
  let { clientRoutes } = useRemixEntryContext();
  let element = useRoutes(clientRoutes);
  return element;
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

function DefaultRouteComponent({ id }: { id: string }): React.ReactElement {
  throw new Error(
    `Route "${id}" has no component! Please go add a \`default\` export in the route module file.`
  );
}

export function RemixRoute({ id }: { id: string }) {
  let location = useLocation();
  let {
    routeData,
    routeModules,
    componentDidCatchEmulator
  } = useRemixEntryContext();

  let data = routeData[id];
  let { default: Component, ErrorBoundary } = routeModules[id];
  let element = Component ? <Component /> : <DefaultRouteComponent id={id} />;

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
  //
  // NOTE: this kind of logic will move into React Router
  if (!ErrorBoundary) {
    return (
      <RemixRouteContext.Provider value={{ data, id }} children={element} />
    );
  }

  // If we tried to render and failed, and this route threw the error, find it
  // and pass it to the ErrorBoundary to emulate `componentDidCatch`
  let maybeServerRenderError =
    componentDidCatchEmulator.error &&
    (componentDidCatchEmulator.renderBoundaryRouteId === id ||
      componentDidCatchEmulator.loaderBoundaryRouteId === id)
      ? deserializeError(componentDidCatchEmulator.error)
      : undefined;

  // This needs to run after we check for the error from a previous render,
  // otherwise we will incorrectly render this boundary for a loader error
  // deeper in the tree.
  if (componentDidCatchEmulator.trackBoundaries) {
    componentDidCatchEmulator.renderBoundaryRouteId = id;
  }

  let context = maybeServerRenderError
    ? {
        id,
        get data() {
          console.error("You cannot `useLoaderData` in an error boundary.");
          return undefined;
        }
      }
    : { id, data };

  // It's important for the route context to be above the error boundary so that
  // a call to `useRouteData` doesn't accidentally get the parents route's data.
  return (
    <RemixRouteContext.Provider value={context}>
      <RemixErrorBoundary
        location={location}
        component={ErrorBoundary}
        error={maybeServerRenderError}
      >
        {element}
      </RemixErrorBoundary>
    </RemixRouteContext.Provider>
  );
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
        ) : name.startsWith("og:") ? (
          // Open Graph protocol - https://ogp.me/
          <meta key={name} property={name} content={meta[name]} />
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
            manifest.routes[match.route.id].module
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
        <script src={manifest.url} />
        <script
          dangerouslySetInnerHTML={createHtml(routeModulesScript)}
          type="module"
        />
        <script src={manifest.entry.module} type="module" />
      </>
    );
    // disabled deps array because we are purposefully only rendering this once
    // for hydration, after that we want to just continue rendering the initial
    // scripts as they were when the page first loaded
    // eslint-disable-next-line
  }, []);

  // avoid waterfall when importing the next route module
  let nextMatches = React.useMemo(() => {
    if (pendingLocation) {
      // FIXME: can probably use transitionManager `nextMatches`
      let matches = matchClientRoutes(clientRoutes, pendingLocation);
      invariant(matches, `No routes match path "${pendingLocation.pathname}"`);
      return matches;
    }

    return [];
  }, [pendingLocation, clientRoutes]);

  let routePreloads = matches
    .concat(nextMatches)
    .map(match => {
      let route = manifest.routes[match.route.id];
      return (route.imports || []).concat([route.module]);
    })
    .flat(1);

  let preloads = manifest.entry.imports.concat(routePreloads);

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
   * Allows components to track pending submissions and action data for this
   * form by passing the same submission key to useTransition and useActionData.
   */
  submissionKey?: string;

  /**
   * A function to call when the form is submitted. If you call
   * `event.preventDefault()` then this form will not do anything.
   */
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
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
      submissionKey,
      method = "get",
      action = ".",
      encType = "application/x-www-form-urlencoded",
      onSubmit,
      ...props
    },
    forwardedRef
  ) => {
    let submit = useSubmit(submissionKey);
    let formMethod = method.toLowerCase() === "get" ? "get" : "post";
    let formAction = useFormAction(action);

    return (
      <form
        ref={forwardedRef}
        method={formMethod}
        action={formAction}
        encType={encType}
        onSubmit={
          forceRefresh
            ? undefined
            : event => {
                onSubmit && onSubmit(event);
                if (event.defaultPrevented) return;
                event.preventDefault();
                submit(event.currentTarget, {
                  method,
                  replace,
                  // FIXME: I only want RefObject, not any ref, not sure what to
                  // do about forwardRef
                  // @ts-ignore
                  ref: forwardedRef
                });
              }
        }
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
  let location = useLocation();
  return path.pathname + location.search;
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
export function useSubmit(submissionKey?: string): SubmitFunction {
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

      method = options.method || "get";
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

    let { protocol, host } = window.location;
    let url = new URL(action, `${protocol}//${host}`);

    if (method.toLowerCase() === "get") {
      for (let [name, value] of formData) {
        if (typeof value === "string") {
          url.searchParams.set(name, value);
        } else {
          throw new Error(`Cannot submit binary form data using GET`);
        }
      }
    }

    let state: GenericSubmission = {
      isSubmission: true,
      // @ts-expect-error
      body: new URLSearchParams(formData).toString(),
      action,
      method: method.toUpperCase(),
      encType,
      submissionKey
    };

    navigate(url.pathname + url.search, { replace: options.replace, state });
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

export function useMatches() {
  let { matches, routeData, routeModules } = useRemixEntryContext();
  return matches.map(match => {
    let { pathname, params } = match;
    return {
      pathname,
      params,
      data: routeData[match.route.id],
      handle: routeModules[match.route.id].handle
    };
  });
}

/**
 * Returns the data from the current route's `loader`.
 */
export function useLoaderData<T = AppData>(): T {
  return useRemixRouteContext().data;
}

export function useActionData<T = AppData>(
  submissionKey?: string
): T | undefined {
  let { transitionManager } = useRemixEntryContext();
  React.useEffect(() => {
    if (submissionKey) {
      return transitionManager.registerKeyedActionDataRead(submissionKey);
    }
  }, [submissionKey, transitionManager]);

  return submissionKey
    ? transitionManager.getState().keyedActionData[submissionKey]
    : transitionManager.getState().actionData;
}

/**
 * Returns the `{ method, data, encType }` that are currently being used to
 * submit a `<Form>`. This is useful for showing e.g. a pending indicator or
 * animation for some newly created/destroyed data.
 */
export interface SubmissionWithData extends GenericSubmission {
  data: URLSearchParams;
}

export function useTransition(submissionKey?: string): Transition {
  let { transitionManager } = useRemixEntryContext();
  let state = transitionManager.getState();

  if (submissionKey) {
    let transition = state.transitions.get(submissionKey);
    return transition || idleTransition;
  }

  return state.transition;
}

export function useTransitions(): Map<string, SubmissionTransition> {
  let { transitionManager } = useRemixEntryContext();
  return transitionManager.getState().transitions;
}

/**
 * @deprecated replaced by `useTransition`
 */
export function usePendingFormSubmit() {
  let { transitionManager } = useRemixEntryContext();
  let { nextLocation } = transitionManager.getState().transition;

  if (nextLocation && isSubmission(nextLocation)) {
    let { body, encType, action, method } = nextLocation.state;
    return {
      data: makeFormData(body),
      method: method.toLowerCase(),
      encType,
      action
    };
  }

  return undefined;
}

/**
 * Returns the next location if a location change is pending. This is useful
 * for showing loading indicators during route transitions from `<Link>`
 * clicks.
 *
 * @deprecated use `useTransition().nextLocation`
 */
export function usePendingLocation(): Location<any> | undefined {
  let { transitionManager } = useRemixEntryContext();
  return transitionManager.getState().transition.nextLocation;
}

export function LiveReload() {
  if (process.env.NODE_ENV !== "development") return null;
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          let ws = new WebSocket("ws://localhost:3001/socket");
          ws.onmessage = message => {
            let event = JSON.parse(message.data);
            if (event.type === "LOG") {
              console.log(event.message);
            }
            if (event.type === "RELOAD") {
              console.log("💿 Reloading window ...");
              window.location.reload();
            }
          };
          ws.onerror = error => {
            console.log("Remix dev asset server web socket error:");
            console.error(error);
          };
      `
      }}
    />
  );
}
