import type { Action, Location } from "history";
import type {
  FocusEventHandler,
  FormHTMLAttributes,
  MouseEventHandler,
  TouchEventHandler
} from "react";
import * as React from "react";
import type { Navigator } from "react-router";
import {
  Router,
  Link as RouterLink,
  NavLink as RouterNavLink,
  useLocation,
  useRoutes,
  useNavigate,
  useHref,
  useResolvedPath
} from "react-router-dom";
import type { LinkProps, NavLinkProps } from "react-router-dom";

import type { AppData, FormEncType, FormMethod } from "./data";
import type { EntryContext, AssetsManifest } from "./entry";
import type { AppState, SerializedError } from "./errors";
import {
  RemixRootDefaultErrorBoundary,
  RemixErrorBoundary,
  RemixRootDefaultCatchBoundary,
  RemixCatchBoundary
} from "./errorBoundaries";
import invariant from "./invariant";
import {
  getDataLinkHrefs,
  getLinksForMatches,
  getModuleLinkHrefs,
  getNewMatchesForLinks,
  getStylesheetPrefetchLinks,
  isPageLinkDescriptor
} from "./links";
import type { HtmlLinkDescriptor, PrefetchPageDescriptor } from "./links";
import { createHtml } from "./markup";
import type { ClientRoute } from "./routes";
import { createClientRoutes } from "./routes";
import type { RouteData } from "./routeData";
import type { RouteMatch } from "./routeMatching";
import { matchClientRoutes } from "./routeMatching";
import type { RouteModules, HtmlMetaDescriptor } from "./routeModules";
import { createTransitionManager } from "./transition";
import type { Transition, Fetcher, Submission } from "./transition";

////////////////////////////////////////////////////////////////////////////////
// RemixEntry

interface RemixEntryContextType {
  manifest: AssetsManifest;
  matches: RouteMatch<ClientRoute>[];
  routeData: { [routeId: string]: RouteData };
  actionData?: RouteData;
  pendingLocation?: Location;
  appState: AppState;
  routeModules: RouteModules;
  serverHandoffString?: string;
  clientRoutes: ClientRoute[];
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
  location: Location;
  navigator: Navigator;
  static?: boolean;
}) {
  let {
    manifest,
    routeData: documentLoaderData,
    actionData: documentActionData,
    routeModules,
    serverHandoffString,
    appState: entryComponentDidCatchEmulator
  } = entryContext;

  let clientRoutes = React.useMemo(
    () => createClientRoutes(manifest.routes, routeModules, RemixRoute),
    [manifest, routeModules]
  );

  let [clientState, setClientState] = React.useState(
    entryComponentDidCatchEmulator
  );

  let [transitionManager] = React.useState(() => {
    return createTransitionManager({
      routes: clientRoutes,
      actionData: documentActionData,
      loaderData: documentLoaderData,
      location: historyLocation,
      catch: entryComponentDidCatchEmulator.catch,
      catchBoundaryId: entryComponentDidCatchEmulator.catchBoundaryRouteId,
      onRedirect: _navigator.replace,
      onChange: state => {
        setClientState({
          catch: state.catch,
          error: state.error,
          catchBoundaryRouteId: state.catchBoundaryId,
          loaderBoundaryRouteId: state.errorBoundaryId,
          renderBoundaryRouteId: null,
          trackBoundaries: false,
          trackCatchBoundaries: false
        });
      }
    });
  });

  // Ensures pushes interrupting pending navigations use replace
  // TODO: Move this to React Router
  let navigator: Navigator = React.useMemo(() => {
    let push: Navigator["push"] = (to, state) => {
      return transitionManager.getState().transition.state !== "idle"
        ? _navigator.replace(to, state)
        : _navigator.push(to, state);
    };
    return { ..._navigator, push };
  }, [_navigator, transitionManager]);

  let { location, matches, loaderData, actionData } =
    transitionManager.getState();

  // Send new location to the transition manager
  React.useEffect(() => {
    let { location } = transitionManager.getState();
    if (historyLocation === location) return;
    transitionManager.send({
      type: "navigation",
      location: historyLocation,
      submission: consumeNextNavigationSubmission(),
      action
    });
  }, [transitionManager, historyLocation, action]);

  // If we tried to render and failed, and the app threw before rendering any
  // routes, get the error and pass it to the ErrorBoundary to emulate
  // `componentDidCatch`
  let ssrErrorBeforeRoutesRendered =
    clientState.error &&
    clientState.renderBoundaryRouteId === null &&
    clientState.loaderBoundaryRouteId === null
      ? deserializeError(clientState.error)
      : undefined;

  let ssrCatchBeforeRoutesRendered =
    clientState.catch && clientState.catchBoundaryRouteId === null
      ? clientState.catch
      : undefined;

  return (
    <RemixEntryContext.Provider
      value={{
        matches,
        manifest,
        appState: clientState,
        routeModules,
        serverHandoffString,
        clientRoutes,
        routeData: loaderData,
        actionData,
        transitionManager
      }}
    >
      <RemixErrorBoundary
        location={location}
        component={RemixRootDefaultErrorBoundary}
        error={ssrErrorBeforeRoutesRendered}
      >
        <RemixCatchBoundary
          location={location}
          component={RemixRootDefaultCatchBoundary}
          catch={ssrCatchBeforeRoutesRendered}
        >
          <Router
            navigationType={action}
            location={location}
            navigator={navigator}
            static={staticProp}
          >
            <Routes />
          </Router>
        </RemixCatchBoundary>
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
  // fallback to the root if we don't have a match
  let element = useRoutes(clientRoutes) || (clientRoutes[0].element as any);
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
    `Route "${id}" has no component! Please go add a \`default\` export in the route module file.\n` +
      "If you were trying to navigate or submit to a resource route, use `<a>` instead of `<Link>` or `<Form reloadDocument>`."
  );
}

export function RemixRoute({ id }: { id: string }) {
  let location = useLocation();
  let { routeData, routeModules, appState } = useRemixEntryContext();

  let data = routeData[id];
  let { default: Component, CatchBoundary, ErrorBoundary } = routeModules[id];
  let element = Component ? <Component /> : <DefaultRouteComponent id={id} />;

  let context: RemixRouteContextType = { data, id };

  if (CatchBoundary) {
    // If we tried to render and failed, and this route threw the error, find it
    // and pass it to the ErrorBoundary to emulate `componentDidCatch`
    let maybeServerCaught =
      appState.catch && appState.catchBoundaryRouteId === id
        ? appState.catch
        : undefined;

    // This needs to run after we check for the error from a previous render,
    // otherwise we will incorrectly render this boundary for a loader error
    // deeper in the tree.
    if (appState.trackCatchBoundaries) {
      appState.catchBoundaryRouteId = id;
    }

    context = maybeServerCaught
      ? {
          id,
          get data() {
            console.error("You cannot `useLoaderData` in a catch boundary.");
            return undefined;
          }
        }
      : { id, data };

    element = (
      <RemixCatchBoundary
        location={location}
        component={CatchBoundary}
        catch={maybeServerCaught}
      >
        {element}
      </RemixCatchBoundary>
    );
  }

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

  if (ErrorBoundary) {
    // If we tried to render and failed, and this route threw the error, find it
    // and pass it to the ErrorBoundary to emulate `componentDidCatch`
    let maybeServerRenderError =
      appState.error &&
      (appState.renderBoundaryRouteId === id ||
        appState.loaderBoundaryRouteId === id)
        ? deserializeError(appState.error)
        : undefined;

    // This needs to run after we check for the error from a previous render,
    // otherwise we will incorrectly render this boundary for a loader error
    // deeper in the tree.
    if (appState.trackBoundaries) {
      appState.renderBoundaryRouteId = id;
    }

    context = maybeServerRenderError
      ? {
          id,
          get data() {
            console.error("You cannot `useLoaderData` in an error boundary.");
            return undefined;
          }
        }
      : { id, data };

    element = (
      <RemixErrorBoundary
        location={location}
        component={ErrorBoundary}
        error={maybeServerRenderError}
      >
        {element}
      </RemixErrorBoundary>
    );
  }

  // It's important for the route context to be above the error boundary so that
  // a call to `useLoaderData` doesn't accidentally get the parents route's data.
  return (
    <RemixRouteContext.Provider value={context}>
      {element}
    </RemixRouteContext.Provider>
  );
}

////////////////////////////////////////////////////////////////////////////////
// Public API

/**
 * Defines the prefetching behavior of the link:
 *
 * - "intent": Default, fetched when the user focuses or hovers the link
 * - "render": Fetched when the link is rendered
 * - "none": Never fetched
 */
type PrefetchBehavior = "intent" | "render" | "none";

export interface RemixLinkProps extends LinkProps {
  prefetch?: PrefetchBehavior;
}

export interface RemixNavLinkProps extends NavLinkProps {
  prefetch?: PrefetchBehavior;
}

interface PrefetchHandlers {
  onFocus?: FocusEventHandler<Element>;
  onBlur?: FocusEventHandler<Element>;
  onMouseEnter?: MouseEventHandler<Element>;
  onMouseLeave?: MouseEventHandler<Element>;
  onTouchStart?: TouchEventHandler<Element>;
}

function usePrefetchBehavior(
  prefetch: PrefetchBehavior,
  theirElementProps: PrefetchHandlers
) {
  let [maybePrefetch, setMaybePrefetch] = React.useState(false);
  let [shouldPrefetch, setShouldPrefetch] = React.useState(false);
  let { onFocus, onBlur, onMouseEnter, onMouseLeave, onTouchStart } =
    theirElementProps;

  React.useEffect(() => {
    if (prefetch === "render") {
      setShouldPrefetch(true);
    }
  }, [prefetch]);

  let setIntent = () => {
    if (prefetch === "intent") {
      setMaybePrefetch(true);
    }
  };

  let cancelIntent = () => {
    if (prefetch === "intent") {
      setMaybePrefetch(false);
    }
  };

  React.useEffect(() => {
    if (maybePrefetch) {
      let id = setTimeout(() => {
        setShouldPrefetch(true);
      }, 100);
      return () => {
        clearTimeout(id);
      };
    }
  }, [maybePrefetch]);

  return [
    shouldPrefetch,
    {
      onFocus: composeEventHandlers(onFocus, setIntent),
      onBlur: composeEventHandlers(onBlur, cancelIntent),
      onMouseEnter: composeEventHandlers(onMouseEnter, setIntent),
      onMouseLeave: composeEventHandlers(onMouseLeave, cancelIntent),
      onTouchStart: composeEventHandlers(onTouchStart, setIntent)
    }
  ];
}

export let NavLink = React.forwardRef<HTMLAnchorElement, RemixNavLinkProps>(
  ({ to, prefetch = "none", ...props }, forwardedRef) => {
    let href = useHref(to);
    let [shouldPrefetch, prefetchHandlers] = usePrefetchBehavior(
      prefetch,
      props
    );
    return (
      <>
        <RouterNavLink
          ref={forwardedRef}
          to={to}
          {...prefetchHandlers}
          {...props}
        />
        {shouldPrefetch ? <PrefetchPageLinks page={href} /> : null}
      </>
    );
  }
);

export let Link = React.forwardRef<HTMLAnchorElement, RemixLinkProps>(
  ({ to, prefetch = "none", ...props }, forwardedRef) => {
    let href = useHref(to);
    let [shouldPrefetch, prefetchHandlers] = usePrefetchBehavior(
      prefetch,
      props
    );
    return (
      <>
        <RouterLink
          ref={forwardedRef}
          to={to}
          {...prefetchHandlers}
          {...props}
        />
        {shouldPrefetch ? <PrefetchPageLinks page={href} /> : null}
      </>
    );
  }
);

export function composeEventHandlers<
  EventType extends React.SyntheticEvent | Event
>(
  theirHandler: ((event: EventType) => any) | undefined,
  ourHandler: (event: EventType) => any
): (event: EventType) => any {
  return event => {
    theirHandler && theirHandler(event);
    if (!event.defaultPrevented) {
      ourHandler(event);
    }
  };
}

/**
 * Renders the `<link>` tags for the current routes.
 */
export function Links() {
  let { matches, routeModules, manifest } = useRemixEntryContext();

  let links = React.useMemo(
    () => getLinksForMatches(matches, routeModules, manifest),
    [matches, routeModules, manifest]
  );

  return (
    <>
      {links.map(link =>
        isPageLinkDescriptor(link) ? (
          <PrefetchPageLinks key={link.page} {...link} />
        ) : (
          <link key={link.rel + link.href} {...link} />
        )
      )}
    </>
  );
}

export function PrefetchPageLinks({
  page,
  ...dataLinkProps
}: PrefetchPageDescriptor) {
  let { clientRoutes } = useRemixEntryContext();
  let matches = React.useMemo(
    () => matchClientRoutes(clientRoutes, page),
    [clientRoutes, page]
  );

  if (!matches) {
    console.warn(`Tried to prefetch ${page} but no routes matched.`);
    return null;
  }

  return (
    <PrefetchPageLinksImpl page={page} matches={matches} {...dataLinkProps} />
  );
}

function usePrefetchedStylesheets(matches: RouteMatch<ClientRoute>[]) {
  let { routeModules } = useRemixEntryContext();

  let [styleLinks, setStyleLinks] = React.useState<HtmlLinkDescriptor[]>([]);

  React.useEffect(() => {
    let interrupted: boolean = false;

    getStylesheetPrefetchLinks(matches, routeModules).then(links => {
      if (!interrupted) setStyleLinks(links);
    });

    return () => {
      interrupted = true;
    };
  }, [matches, routeModules]);

  return styleLinks;
}

function PrefetchPageLinksImpl({
  page,
  matches: nextMatches,
  ...linkProps
}: PrefetchPageDescriptor & {
  matches: RouteMatch<ClientRoute>[];
}) {
  let location = useLocation();
  let { matches, manifest } = useRemixEntryContext();

  let newMatchesForData = React.useMemo(
    () => getNewMatchesForLinks(page, nextMatches, matches, location, "data"),
    [page, nextMatches, matches, location]
  );

  let newMatchesForAssets = React.useMemo(
    () => getNewMatchesForLinks(page, nextMatches, matches, location, "assets"),
    [page, nextMatches, matches, location]
  );

  let dataHrefs = React.useMemo(
    () => getDataLinkHrefs(page, newMatchesForData, manifest),
    [newMatchesForData, page, manifest]
  );

  let moduleHrefs = React.useMemo(
    () => getModuleLinkHrefs(newMatchesForAssets, manifest),
    [newMatchesForAssets, manifest]
  );

  // needs to be a hook with async behavior because we need the modules, not
  // just the manifest like the other links in here.
  let styleLinks = usePrefetchedStylesheets(newMatchesForAssets);

  return (
    <>
      {dataHrefs.map(href => (
        <link key={href} rel="prefetch" as="fetch" href={href} {...linkProps} />
      ))}
      {moduleHrefs.map(href => (
        <link key={href} rel="modulepreload" href={href} {...linkProps} />
      ))}
      {styleLinks.map(link => (
        // these don't spread `linkProps` because they are full link descriptors
        // already with their own props
        <link key={link.href} {...link} />
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

  let meta: HtmlMetaDescriptor = {};
  let parentsData: { [routeId: string]: AppData } = {};

  for (let match of matches) {
    let routeId = match.route.id;
    let data = routeData[routeId];
    let params = match.params;

    let routeModule = routeModules[routeId];

    if (routeModule.meta) {
      let routeMeta =
        typeof routeModule.meta === "function"
          ? routeModule.meta({ data, parentsData, params, location })
          : routeModule.meta;
      Object.assign(meta, routeMeta);
    }

    parentsData[routeId] = data;
  }

  return (
    <>
      {Object.entries(meta).map(([name, value]) => {
        // Open Graph tags use the `property` attribute, while other meta tags
        // use `name`. See https://ogp.me/
        let isOpenGraphTag = name.startsWith("og:");
        return name === "title" ? (
          <title key="title">{value}</title>
        ) : Array.isArray(value) ? (
          value.map(content =>
            isOpenGraphTag ? (
              <meta key={name + content} property={name} content={content} />
            ) : (
              <meta key={name + content} name={name} content={content} />
            )
          )
        ) : isOpenGraphTag ? (
          <meta key={name} property={name} content={value} />
        ) : (
          <meta key={name} name={name} content={value} />
        );
      })}
    </>
  );
}

/**
 * Tracks whether Remix has finished hydrating or not, so scripts can be skipped
 * during client-side updates.
 */
let isHydrated = false;

type ScriptProps = Omit<
  React.HTMLProps<HTMLScriptElement>,
  | "children"
  | "async"
  | "defer"
  | "src"
  | "type"
  | "noModule"
  | "dangerouslySetInnerHTML"
  | "suppressHydrationWarning"
>;

/**
 * Renders the `<script>` tags needed for the initial render. Bundles for
 * additional routes are loaded later as needed.
 *
 * @param props Additional properties to add to each script tag that is rendered.
 * In addition to scripts, \<link rel="modulepreload"> tags receive the crossOrigin
 * property if provided.
 */
export function Scripts(props: ScriptProps) {
  let {
    manifest,
    matches,
    pendingLocation,
    clientRoutes,
    serverHandoffString
  } = useRemixEntryContext();

  React.useEffect(() => {
    isHydrated = true;
  }, []);

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
          {...props}
          suppressHydrationWarning
          dangerouslySetInnerHTML={createHtml(contextScript)}
        />
        <script {...props} src={manifest.url} />
        <script
          {...props}
          dangerouslySetInnerHTML={createHtml(routeModulesScript)}
          type="module"
        />
        <script {...props} src={manifest.entry.module} type="module" />
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
        <link
          key={path}
          rel="modulepreload"
          href={path}
          crossOrigin={props.crossOrigin}
        />
      ))}
      {isHydrated ? null : initialScripts}
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
  reloadDocument?: boolean;

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
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
}

/**
 * A Remix-aware `<form>`. It behaves like a normal form except that the
 * interaction with the server is with `fetch` instead of new document
 * requests, allowing components to add nicer UX to the page as the form is
 * submitted and returns with data.
 */
export let Form = React.forwardRef<HTMLFormElement, FormProps>((props, ref) => {
  return <FormImpl {...props} ref={ref} />;
});

interface FormImplProps extends FormProps {
  fetchKey?: string;
}

export let FormImpl = React.forwardRef<HTMLFormElement, FormImplProps>(
  (
    {
      reloadDocument = false,
      replace = false,
      method = "get",
      action = ".",
      encType = "application/x-www-form-urlencoded",
      fetchKey,
      onSubmit,
      ...props
    },
    forwardedRef
  ) => {
    let submit = useSubmitImpl(fetchKey);
    let formMethod: FormMethod =
      method.toLowerCase() === "get" ? "get" : "post";
    let formAction = useFormAction(action, formMethod);
    let formRef = React.useRef<HTMLFormElement>();
    let ref = useComposedRefs(forwardedRef, formRef);

    // When calling `submit` on the form element itself, we don't get data from
    // the button that submitted the event. For example:
    //
    //   <Form>
    //     <button name="something" value="whatever">Submit</button>
    //   </Form>
    //
    // formData.get("something") should be "whatever", but we don't get that
    // unless we call submit on the clicked button itself.
    //
    // To figure out which button triggered the submit, we'll attach a click
    // event listener to the form. The click event is always triggered before
    // the submit event (even when submitting via keyboard when focused on
    // another form field, yeeeeet) so we should have access to that button's
    // data for use in the submit handler.
    let clickedButtonRef = React.useRef<any>();

    React.useEffect(() => {
      let form = formRef.current;
      if (!form) return;

      function handleClick(event: MouseEvent) {
        if (!(event.target instanceof HTMLElement)) return;
        let submitButton = event.target.closest<
          HTMLButtonElement | HTMLInputElement
        >("button,input[type=submit]");

        if (
          submitButton &&
          submitButton.form === form &&
          submitButton.type === "submit"
        ) {
          clickedButtonRef.current = submitButton;
        }
      }

      window.addEventListener("click", handleClick);
      return () => {
        window.removeEventListener("click", handleClick);
      };
    }, []);

    return (
      <form
        ref={ref}
        method={formMethod}
        action={formAction}
        encType={encType}
        onSubmit={
          reloadDocument
            ? undefined
            : event => {
                onSubmit && onSubmit(event);
                if (event.defaultPrevented) return;
                event.preventDefault();

                submit(clickedButtonRef.current || event.currentTarget, {
                  method,
                  replace
                });
                clickedButtonRef.current = null;
              }
        }
        {...props}
      />
    );
  }
);

function isActionRequestMethod(method: string): boolean {
  method = method.toLowerCase();
  return (
    method === "post" ||
    method === "put" ||
    method === "patch" ||
    method === "delete"
  );
}

/**
 * Resolves a `<form action>` path relative to the current route.
 */
export function useFormAction(
  action = ".",
  method: FormMethod = "get"
): string {
  let { id } = useRemixRouteContext();
  let path = useResolvedPath(action);
  let search = path.search;
  let isIndexRoute = id.endsWith("/index");

  if (action === "." && isIndexRoute && isActionRequestMethod(method)) {
    search = search ? search.replace(/^\?/, "?index&") : "?index";
  }

  return path.pathname + search;
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
  return useSubmitImpl();
}

export function useSubmitImpl(key?: string): SubmitFunction {
  let navigate = useNavigate();
  let defaultAction = useFormAction();
  let { transitionManager } = useRemixEntryContext();

  return React.useCallback(
    (target, options = {}) => {
      let method: string;
      let action: string;
      let encType: string;
      let formData: FormData;

      if (isFormElement(target)) {
        let submissionTrigger: HTMLButtonElement | HTMLInputElement = (
          options as any
        ).submissionTrigger;

        method = options.method || target.method;
        action = options.action || target.action;
        encType = options.encType || target.enctype;
        formData = new FormData(target);

        if (submissionTrigger && submissionTrigger.name) {
          formData.append(submissionTrigger.name, submissionTrigger.value);
        }
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

        method =
          options.method || target.getAttribute("formmethod") || form.method;
        action =
          options.action || target.getAttribute("formaction") || form.action;
        encType =
          options.encType || target.getAttribute("formenctype") || form.enctype;
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
              formData.append(name, value);
            }
          } else if (target != null) {
            for (let name of Object.keys(target)) {
              formData.append(name, target[name]);
            }
          }
        }
      }

      let { protocol, host } = window.location;
      let url = new URL(action, `${protocol}//${host}`);

      if (method.toLowerCase() === "get") {
        for (let [name, value] of formData) {
          if (typeof value === "string") {
            url.searchParams.append(name, value);
          } else {
            throw new Error(`Cannot submit binary form data using GET`);
          }
        }
      }

      let submission: Submission = {
        formData,
        action: url.pathname + url.search,
        method: method.toUpperCase(),
        encType,
        key: Math.random().toString(36).substr(2, 8)
      };

      if (key) {
        transitionManager.send({
          type: "fetcher",
          href: submission.action,
          submission,
          key
        });
      } else {
        setNextNavigationSubmission(submission);
        navigate(url.pathname + url.search, { replace: options.replace });
      }
    },
    [defaultAction, key, navigate, transitionManager]
  );
}

let nextNavigationSubmission: Submission | undefined;

function setNextNavigationSubmission(submission: Submission) {
  nextNavigationSubmission = submission;
}

function consumeNextNavigationSubmission() {
  let submission = nextNavigationSubmission;
  nextNavigationSubmission = undefined;
  return submission;
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
      id: match.route.id,
      pathname,
      params,
      data: routeData[match.route.id],
      // if the module fails to load or an error/response is thrown, the module
      // won't be defined.
      handle: routeModules[match.route.id]?.handle
    };
  });
}

/**
 * Returns the data from the current route's `loader`.
 */
export function useLoaderData<T = AppData>(): T {
  return useRemixRouteContext().data;
}

export function useActionData<T = AppData>(): T | undefined {
  let { id: routeId } = useRemixRouteContext();
  let { transitionManager } = useRemixEntryContext();
  let { actionData } = transitionManager.getState();
  return actionData ? actionData[routeId] : undefined;
}

export function useTransition(): Transition {
  let { transitionManager } = useRemixEntryContext();
  return transitionManager.getState().transition;
}

function createFetcherForm(fetchKey: string) {
  return React.forwardRef<HTMLFormElement, FormProps>((props, ref) => {
    // TODO: make ANOTHER form w/o a fetchKey prop
    return <FormImpl {...props} ref={ref} fetchKey={fetchKey} />;
  });
}

let fetcherId = 0;

type FetcherWithComponents<TData> = Fetcher<TData> & {
  Form: ReturnType<typeof createFetcherForm>;
  submit: ReturnType<typeof useSubmitImpl>;
  load: (href: string) => void;
};

/**
 * Interacts with route loaders and actions without causing a navigation. Great
 * for any interaction that stays on the same page.
 */
export function useFetcher<TData = any>(): FetcherWithComponents<TData> {
  let { transitionManager } = useRemixEntryContext();

  let [key] = React.useState(() => String(++fetcherId));
  let [Form] = React.useState(() => createFetcherForm(key));
  let [load] = React.useState(() => (href: string) => {
    transitionManager.send({ type: "fetcher", href, key });
  });
  let submit = useSubmitImpl(key);

  let fetcher = transitionManager.getFetcher<TData>(key);

  let fetcherWithComponents = React.useMemo(
    () => ({
      Form,
      submit,
      load,
      ...fetcher
    }),
    [fetcher, Form, submit, load]
  );

  React.useEffect(() => {
    // Is this busted when the React team gets real weird and calls effects
    // twice on mount?  We really just need to garbage collect here when this
    // fetcher is no longer around.
    return () => transitionManager.deleteFetcher(key);
  }, [transitionManager, key]);

  return fetcherWithComponents;
}

/**
 * Provides all fetchers currently on the page. Useful for layouts and parent
 * routes that need to provide pending/optimistic UI regarding the fetch.
 */
export function useFetchers(): Fetcher[] {
  let { transitionManager } = useRemixEntryContext();
  let { fetchers } = transitionManager.getState();
  return [...fetchers.values()];
}

// Dead Code Elimination magic for production builds.
// This way devs don't have to worry about doing the NODE_ENV check themselves.
export const LiveReload =
  process.env.NODE_ENV !== "development"
    ? () => null
    : function LiveReload({
        port = Number(process.env.REMIX_DEV_SERVER_WS_PORT || 8002)
      }: {
        port?: number;
      }) {
        return (
          <script
            dangerouslySetInnerHTML={{
              __html: `
let ws = new WebSocket("ws://localhost:${port}/socket");
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
              `.trim()
            }}
          />
        );
      };

function useComposedRefs<RefValueType = any>(
  ...refs: Array<React.Ref<RefValueType> | null | undefined>
): React.RefCallback<RefValueType> {
  return React.useCallback(node => {
    for (let ref of refs) {
      if (ref == null) continue;
      if (typeof ref === "function") {
        ref(node);
      } else {
        try {
          (ref as React.MutableRefObject<RefValueType>).current = node!;
        } catch (_) {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, refs);
}
