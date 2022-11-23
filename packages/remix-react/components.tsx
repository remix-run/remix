import type {
  FocusEventHandler,
  MouseEventHandler,
  TouchEventHandler,
} from "react";
import * as React from "react";
import type {
  AgnosticDataRouteMatch,
  AgnosticDataRouteObject,
} from "@remix-run/router";
import type {
  NavigationType,
  Navigator,
  Params,
  LinkProps,
  NavLinkProps,
  Location,
  FormProps,
  SubmitFunction,
} from "react-router-dom";
import {
  matchRoutes,
  useActionData as useActionDataRR,
  useLoaderData as useLoaderDataRR,
} from "react-router-dom";
import {
  Link as RouterLink,
  NavLink as RouterNavLink,
  UNSAFE_DataRouterContext as DataRouterContext,
  UNSAFE_DataRouterStateContext as DataRouterStateContext,
  useFetcher as useFetcherRR,
  useLocation,
  useNavigation,
  useHref,
  useRouteError,
} from "react-router-dom";
import type { SerializeFrom } from "@remix-run/server-runtime";

import type { AppData } from "./data";
import type { EntryContext, RemixContextObject } from "./entry";
import {
  RemixRootDefaultErrorBoundary,
  RemixErrorBoundary,
  RemixRootDefaultCatchBoundary,
  RemixCatchBoundary,
} from "./errorBoundaries";
import invariant from "./invariant";
import {
  getDataLinkHrefs,
  getLinksForMatches,
  getModuleLinkHrefs,
  getNewMatchesForLinks,
  getStylesheetPrefetchLinks,
  isPageLinkDescriptor,
} from "./links";
import type { HtmlLinkDescriptor, PrefetchPageDescriptor } from "./links";
import { createHtml } from "./markup";
import type { RouteData } from "./routeData";
import type {
  RouteMatchWithMeta,
  V1_HtmlMetaDescriptor,
  V2_HtmlMetaDescriptor,
} from "./routeModules";
import type {
  Transition,
  Fetcher,
  FetcherStates,
  LoaderSubmission,
  ActionSubmission,
  TransitionStates,
} from "./transition";
import { IDLE_TRANSITION, IDLE_FETCHER } from "./transition";

function useDataRouterContext() {
  let context = React.useContext(DataRouterContext);
  invariant(
    context,
    "You must render this element inside a <DataRouterContext.Provider> element"
  );
  return context;
}

function useDataRouterStateContext() {
  let context = React.useContext(DataRouterStateContext);
  invariant(
    context,
    "You must render this element inside a <DataRouterStateContext.Provider> element"
  );
  return context;
}

////////////////////////////////////////////////////////////////////////////////
// RemixContext

export const RemixContext = React.createContext<RemixContextObject | undefined>(
  undefined
);
RemixContext.displayName = "Remix";

function useRemixContext(): RemixContextObject {
  let context = React.useContext(RemixContext);
  invariant(context, "You must render this element inside a <Remix> element");
  return context;
}

////////////////////////////////////////////////////////////////////////////////
// RemixEntry

export function RemixEntry(props: {
  context: EntryContext;
  action: NavigationType;
  location: Location;
  navigator: Navigator;
  static?: boolean;
}) {
  return <h1>Not Implemented!</h1>;
}

////////////////////////////////////////////////////////////////////////////////
// RemixRoute

export function RemixRoute({ id }: { id: string }) {
  let { routeModules } = useRemixContext();

  invariant(
    routeModules,
    "Cannot initialize 'routeModules'. This normally occurs when you have server code in your client modules.\n" +
      "Check this link for more details:\nhttps://remix.run/pages/gotchas#server-code-in-client-bundles"
  );

  let { default: Component } = routeModules[id];

  invariant(
    Component,
    `Route "${id}" has no component! Please go add a \`default\` export in the route module file.\n` +
      "If you were trying to navigate or submit to a resource route, use `<a>` instead of `<Link>` or `<Form reloadDocument>`."
  );

  return <Component />;
}

export function RemixRouteError({ id }: { id: string }) {
  let { routeModules } = useRemixContext();

  // This checks prevent cryptic error messages such as: 'Cannot read properties of undefined (reading 'root')'
  invariant(
    routeModules,
    "Cannot initialize 'routeModules'. This normally occurs when you have server code in your client modules.\n" +
      "Check this link for more details:\nhttps://remix.run/pages/gotchas#server-code-in-client-bundles"
  );

  let error = useRouteError();
  let location = useLocation();
  let { CatchBoundary, ErrorBoundary } = routeModules[id];

  // Provide defaults for the root route if they are not present
  if (id === "root") {
    CatchBoundary ||= RemixRootDefaultCatchBoundary;
    ErrorBoundary ||= RemixRootDefaultErrorBoundary;
  }

  // TODO: Temp hack to avoid instanceof check issues
  function isRouteErrorResponse(thing: unknown) {
    return (
      thing != null &&
      "status" in thing &&
      "statusText" in thing &&
      "data" in thing
    );
  }

  if (isRouteErrorResponse(error)) {
    if (error?.error && error.status !== 404) {
      return (
        // TODO: Handle error type?
        <RemixErrorBoundary
          location={location}
          component={ErrorBoundary}
          error={error.error}
        />
      );
    }
    return <RemixCatchBoundary component={CatchBoundary} catch={error} />;
  }

  if (!isRouteErrorResponse(error) && ErrorBoundary) {
    return (
      // TODO: Handle error type?
      <RemixErrorBoundary
        location={location}
        component={ErrorBoundary}
        error={error}
      />
    );
  }

  throw error;
}
////////////////////////////////////////////////////////////////////////////////
// Public API

/**
 * Defines the prefetching behavior of the link:
 *
 * - "intent": Fetched when the user focuses or hovers the link
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
): [boolean, Required<PrefetchHandlers>] {
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
      setShouldPrefetch(false);
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
      onTouchStart: composeEventHandlers(onTouchStart, setIntent),
    },
  ];
}

/**
 * A special kind of `<Link>` that knows whether or not it is "active".
 *
 * @see https://remix.run/api/remix#navlink
 */
let NavLink = React.forwardRef<HTMLAnchorElement, RemixNavLinkProps>(
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
          {...props}
          {...prefetchHandlers}
        />
        {shouldPrefetch ? <PrefetchPageLinks page={href} /> : null}
      </>
    );
  }
);
NavLink.displayName = "NavLink";
export { NavLink };
/**
 * This component renders an anchor tag and is the primary way the user will
 * navigate around your website.
 *
 * @see https://remix.run/api/remix#link
 */
let Link = React.forwardRef<HTMLAnchorElement, RemixLinkProps>(
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
          {...props}
          {...prefetchHandlers}
        />
        {shouldPrefetch ? <PrefetchPageLinks page={href} /> : null}
      </>
    );
  }
);
Link.displayName = "Link";
export { Link };

export function composeEventHandlers<
  EventType extends React.SyntheticEvent | Event
>(
  theirHandler: ((event: EventType) => any) | undefined,
  ourHandler: (event: EventType) => any
): (event: EventType) => any {
  return (event) => {
    theirHandler && theirHandler(event);
    if (!event.defaultPrevented) {
      ourHandler(event);
    }
  };
}

/**
 * Renders the `<link>` tags for the current routes.
 *
 * @see https://remix.run/api/remix#meta-links-scripts
 */
export function Links() {
  let { manifest, routeModules } = useRemixContext();
  let { matches } = useDataRouterStateContext();

  let links = React.useMemo(
    () => getLinksForMatches(matches, routeModules, manifest),
    [matches, routeModules, manifest]
  );

  return (
    <>
      {links.map((link) => {
        if (isPageLinkDescriptor(link)) {
          return <PrefetchPageLinks key={link.page} {...link} />;
        }

        let imageSrcSet: string | null = null;

        // In React 17, <link imageSrcSet> and <link imageSizes> will warn
        // because the DOM attributes aren't recognized, so users need to pass
        // them in all lowercase to forward the attributes to the node without a
        // warning. Normalize so that either property can be used in Remix.
        if ("useId" in React) {
          if (link.imagesrcset) {
            link.imageSrcSet = imageSrcSet = link.imagesrcset;
            delete link.imagesrcset;
          }

          if (link.imagesizes) {
            link.imageSizes = link.imagesizes;
            delete link.imagesizes;
          }
        } else {
          if (link.imageSrcSet) {
            link.imagesrcset = imageSrcSet = link.imageSrcSet;
            delete link.imageSrcSet;
          }

          if (link.imageSizes) {
            link.imagesizes = link.imageSizes;
            delete link.imageSizes;
          }
        }

        return (
          <link
            key={link.rel + (link.href || "") + (imageSrcSet || "")}
            {...link}
          />
        );
      })}
    </>
  );
}

/**
 * This component renders all of the `<link rel="prefetch">` and
 * `<link rel="modulepreload"/>` tags for all the assets (data, modules, css) of
 * a given page.
 *
 * @param props
 * @param props.page
 * @see https://remix.run/api/remix#prefetchpagelinks-
 */
export function PrefetchPageLinks({
  page,
  ...dataLinkProps
}: PrefetchPageDescriptor) {
  let { router } = useDataRouterContext();
  let matches = React.useMemo(
    () => matchRoutes(router.routes, page),
    [router.routes, page]
  );

  if (!matches) {
    console.warn(`Tried to prefetch ${page} but no routes matched.`);
    return null;
  }

  return (
    <PrefetchPageLinksImpl page={page} matches={matches} {...dataLinkProps} />
  );
}

function usePrefetchedStylesheets(matches: AgnosticDataRouteMatch[]) {
  let { manifest, routeModules } = useRemixContext();

  let [styleLinks, setStyleLinks] = React.useState<HtmlLinkDescriptor[]>([]);

  React.useEffect(() => {
    let interrupted: boolean = false;

    getStylesheetPrefetchLinks(matches, manifest, routeModules).then(
      (links) => {
        if (!interrupted) setStyleLinks(links);
      }
    );

    return () => {
      interrupted = true;
    };
  }, [matches, manifest, routeModules]);

  return styleLinks;
}

function PrefetchPageLinksImpl({
  page,
  matches: nextMatches,
  ...linkProps
}: PrefetchPageDescriptor & {
  matches: AgnosticDataRouteMatch[];
}) {
  let location = useLocation();
  let { manifest } = useRemixContext();
  let { matches } = useDataRouterStateContext();

  let newMatchesForData = React.useMemo(
    () =>
      getNewMatchesForLinks(
        page,
        nextMatches,
        matches,
        manifest,
        location,
        "data"
      ),
    [page, nextMatches, matches, location]
  );

  let newMatchesForAssets = React.useMemo(
    () =>
      getNewMatchesForLinks(
        page,
        nextMatches,
        matches,
        manifest,
        location,
        "assets"
      ),
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
      {dataHrefs.map((href) => (
        <link key={href} rel="prefetch" as="fetch" href={href} {...linkProps} />
      ))}
      {moduleHrefs.map((href) => (
        <link key={href} rel="modulepreload" href={href} {...linkProps} />
      ))}
      {styleLinks.map((link) => (
        // these don't spread `linkProps` because they are full link descriptors
        // already with their own props
        <link key={link.href} {...link} />
      ))}
    </>
  );
}

/**
 * Renders the `<title>` and `<meta>` tags for the current routes.
 *
 * @see https://remix.run/api/remix#meta-links-scripts
 */
function V1Meta() {
  let { routeModules } = useRemixContext();
  let { matches, loaderData } = useDataRouterStateContext();
  let location = useLocation();

  let meta: V1_HtmlMetaDescriptor = {};
  let parentsData: { [routeId: string]: AppData } = {};

  for (let match of matches) {
    let routeId = match.route.id;
    let data = loaderData[routeId];
    let params = match.params;

    let routeModule = routeModules[routeId];

    if (routeModule.meta) {
      let routeMeta =
        typeof routeModule.meta === "function"
          ? routeModule.meta({
              data,
              parentsData,
              params,
              location,
              matches: undefined as any,
            })
          : routeModule.meta;
      if (routeMeta && Array.isArray(routeMeta)) {
        throw new Error(
          "The route at " +
            match.route.path +
            " returns an array. This is only supported with the `v2_meta` future flag " +
            "in the Remix config. Either set the flag to `true` or update the route's " +
            "meta function to return an object." +
            "\n\nTo reference the v1 meta function API, see https://remix.run/api/conventions#meta"
          // TODO: Add link to the docs once they are written
          // + "\n\nTo reference future flags and the v2 meta API, see https://remix.run/api/remix#future-v2-meta."
        );
      }
      Object.assign(meta, routeMeta);
    }

    parentsData[routeId] = data;
  }

  return (
    <>
      {Object.entries(meta).map(([name, value]) => {
        if (!value) {
          return null;
        }

        if (["charset", "charSet"].includes(name)) {
          return <meta key="charset" charSet={value as string} />;
        }

        if (name === "title") {
          return <title key="title">{String(value)}</title>;
        }

        // Open Graph tags use the `property` attribute, while other meta tags
        // use `name`. See https://ogp.me/
        //
        // Namespaced attributes:
        //  - https://ogp.me/#type_music
        //  - https://ogp.me/#type_video
        //  - https://ogp.me/#type_article
        //  - https://ogp.me/#type_book
        //  - https://ogp.me/#type_profile
        //
        // Facebook specific tags begin with `fb:` and also use the `property`
        // attribute.
        //
        // Twitter specific tags begin with `twitter:` but they use `name`, so
        // they are excluded.
        let isOpenGraphTag =
          /^(og|music|video|article|book|profile|fb):.+$/.test(name);

        return [value].flat().map((content) => {
          if (isOpenGraphTag) {
            return (
              <meta
                property={name}
                content={content as string}
                key={name + content}
              />
            );
          }

          if (typeof content === "string") {
            return <meta name={name} content={content} key={name + content} />;
          }

          return <meta key={name + JSON.stringify(content)} {...content} />;
        });
      })}
    </>
  );
}

function V2Meta() {
  let { routeModules } = useRemixContext();
  let { matches, loaderData } = useDataRouterStateContext();
  let location = useLocation();

  let meta: V2_HtmlMetaDescriptor[] = [];
  let parentsData: { [routeId: string]: AppData } = {};

  let matchesWithMeta: RouteMatchWithMeta<AgnosticDataRouteObject>[] =
    matches.map((match) => ({ ...match, meta: [] }));

  let index = -1;
  for (let match of matches) {
    index++;
    let routeId = match.route.id;
    let data = loaderData[routeId];
    let params = match.params;

    let routeModule = routeModules[routeId];

    let routeMeta: V2_HtmlMetaDescriptor[] | V1_HtmlMetaDescriptor | undefined =
      [];

    if (routeModule?.meta) {
      routeMeta =
        typeof routeModule.meta === "function"
          ? routeModule.meta({
              data,
              parentsData,
              params,
              location,
              matches: matchesWithMeta,
            })
          : routeModule.meta;
    }

    routeMeta = routeMeta || [];
    if (!Array.isArray(routeMeta)) {
      throw new Error(
        "The `v2_meta` API is enabled in the Remix config, but the route at " +
          match.route.path +
          " returns an invalid value. In v2, all route meta functions must " +
          "return an array of meta objects." +
          // TODO: Add link to the docs once they are written
          // "\n\nTo reference future flags and the v2 meta API, see https://remix.run/api/remix#future-v2-meta." +
          "\n\nTo reference the v1 meta function API, see https://remix.run/api/conventions#meta"
      );
    }

    matchesWithMeta[index].meta = routeMeta;
    meta = routeMeta;
    parentsData[routeId] = data;
  }

  return (
    <>
      {meta.flat().map((metaProps) => {
        if (!metaProps) {
          return null;
        }

        if ("title" in metaProps) {
          return <title key="title">{String(metaProps.title)}</title>;
        }

        if ("charSet" in metaProps || "charset" in metaProps) {
          // TODO: We normalize this for the user in v1, but should we continue
          // to do that? Seems like a nice convenience IMO.
          return (
            <meta
              key="charset"
              charSet={metaProps.charSet || (metaProps as any).charset}
            />
          );
        }
        return <meta key={JSON.stringify(metaProps)} {...metaProps} />;
      })}
    </>
  );
}

export function Meta() {
  let { future } = useRemixContext();
  return future.v2_meta ? <V2Meta /> : <V1Meta />;
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
 *
 * @see https://remix.run/api/remix#meta-links-scripts
 */
export function Scripts(props: ScriptProps) {
  let { manifest, serverHandoffString } = useRemixContext();
  let { router } = useDataRouterContext();
  let { matches } = useDataRouterStateContext();
  let navigation = useNavigation();

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
          `import ${JSON.stringify(manifest.url)};
import * as route${index} from ${JSON.stringify(
            manifest.routes[match.route.id].module
          )};`
      )
      .join("\n")}
window.__remixRouteModules = {${matches
      .map((match, index) => `${JSON.stringify(match.route.id)}:route${index}`)
      .join(",")}};

import(${JSON.stringify(manifest.entry.module)});`;

    return (
      <>
        <script
          {...props}
          suppressHydrationWarning
          dangerouslySetInnerHTML={createHtml(contextScript)}
          type={undefined}
        />
        <script
          {...props}
          dangerouslySetInnerHTML={createHtml(routeModulesScript)}
          type="module"
          async
        />
      </>
    );
    // disabled deps array because we are purposefully only rendering this once
    // for hydration, after that we want to just continue rendering the initial
    // scripts as they were when the page first loaded
    // eslint-disable-next-line
  }, []);

  // avoid waterfall when importing the next route module
  let nextMatches = React.useMemo(() => {
    if (navigation.location) {
      // FIXME: can probably use transitionManager `nextMatches`
      let matches = matchRoutes(router.routes, navigation.location);
      invariant(
        matches,
        `No routes match path "${navigation.location.pathname}"`
      );
      return matches;
    }

    return [];
  }, [navigation.location, router.routes]);

  let routePreloads = matches
    .concat(nextMatches)
    .map((match) => {
      let route = manifest.routes[match.route.id];
      return (route.imports || []).concat([route.module]);
    })
    .flat(1);

  let preloads = manifest.entry.imports.concat(routePreloads);

  return (
    <>
      <link
        rel="modulepreload"
        href={manifest.url}
        crossOrigin={props.crossOrigin}
      />
      <link
        rel="modulepreload"
        href={manifest.entry.module}
        crossOrigin={props.crossOrigin}
      />
      {dedupe(preloads).map((path) => (
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

/**
 * Setup a callback to be fired on the window's `beforeunload` event. This is
 * useful for saving some data to `window.localStorage` just before the page
 * refreshes, which automatically happens on the next `<Link>` click when Remix
 * detects a new version of the app is available on the server.
 *
 * Note: The `callback` argument should be a function created with
 * `React.useCallback()`.
 *
 * @see https://remix.run/api/remix#usebeforeunload
 */
export function useBeforeUnload(
  callback: (event: BeforeUnloadEvent) => any
): void {
  // TODO: Export from react-router-dom
  React.useEffect(() => {
    window.addEventListener("beforeunload", callback);
    return () => {
      window.removeEventListener("beforeunload", callback);
    };
  }, [callback]);
}

// TODO: Handle this typing
export interface RouteMatch {
  /**
   * The id of the matched route
   */
  id: string;
  /**
   * The pathname of the matched route
   */
  pathname: string;
  /**
   * The dynamic parameters of the matched route
   *
   * @see https://remix.run/docs/api/conventions#dynamic-route-parameters
   */
  params: Params<string>;
  /**
   * Any route data associated with the matched route
   */
  data: RouteData;
  /**
   * The exported `handle` object of the matched route.
   *
   * @see https://remix.run/docs/api/conventions#handle
   */
  handle: undefined | { [key: string]: any };
}

/**
 * Returns the JSON parsed data from the current route's `loader`.
 *
 * @see https://remix.run/api/remix#useloaderdata
 */
export function useLoaderData<T = AppData>(): SerializeFrom<T> {
  return useLoaderDataRR() as SerializeFrom<T>;
}

/**
 * Returns the JSON parsed data from the current route's `action`.
 *
 * @see https://remix.run/api/remix#useactiondata
 */
export function useActionData<T = AppData>(): SerializeFrom<T> | undefined {
  return useActionDataRR() as SerializeFrom<T> | undefined;
}

/**
 * Returns everything you need to know about a page transition to build pending
 * navigation indicators and optimistic UI on data mutations.
 *
 * @see https://remix.run/api/remix#usetransition
 */
export function useTransition(): Transition {
  let navigation = useNavigation();

  // TODO: Should we populate navigation.formData on <Form method="get"> even
  // though we've already move the data onto URLSearchParams.
  // Reason would be to provide a consistent optimistic UI DX regardless of form method
  // Downside is that it arguably deviates from how the browser would handle it since there would
  //   be no request body/FormData.  We _do_ strip formData from the Request passed to your loader
  //   but we could keep it on the navigation object for DX

  let { location, state, formMethod, formAction, formEncType, formData } =
    navigation;

  if (!location) {
    return IDLE_TRANSITION;
  }

  let isActionSubmission =
    formMethod != null &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(formMethod.toUpperCase());

  if (
    state === "submitting" &&
    formMethod &&
    formAction &&
    formEncType &&
    formData
  ) {
    if (isActionSubmission) {
      // Actively submitting to an action
      let transition: TransitionStates["SubmittingAction"] = {
        location,
        state,
        submission: {
          method: formMethod.toUpperCase() as ActionSubmission["method"],
          action: formAction,
          encType: formEncType,
          formData: formData,
          key: location.key,
        },
        type: "actionSubmission",
      };
      return transition;
    } else {
      // TODO if we don't update the router to keep formData on loader
      // submissions then we can recreate it here from URLSearchParams

      // Actively "submitting" to a loader
      let transition: TransitionStates["SubmittingLoader"] = {
        location,
        state,
        submission: {
          method: formMethod.toUpperCase() as LoaderSubmission["method"],
          action: formAction,
          encType: formEncType,
          // TODO: Recreate from params
          formData: formData,
          key: location.key,
        },
        type: "loaderSubmission",
      };
      return transition;
    }
  }

  if (state === "loading") {
    if (formMethod && formAction && formEncType && formData) {
      if (formAction === location.pathname + location.search) {
        // TODO: How would we detect a redirect to the same location from an
        // action?  Might need local state ion this hook to track the previous
        // "transition"
        if (isActionSubmission) {
          // We're reloading the same location after an action submission
          let transition: TransitionStates["LoadingAction"] = {
            location,
            state,
            submission: {
              method: formMethod.toUpperCase() as ActionSubmission["method"],
              action: formAction,
              encType: formEncType,
              formData: formData,
              key: location.key,
            },
            type: "actionReload",
          };
          return transition;
        } else {
          // I don't think this is possible?  This is just a loader submission
          // which goes idle -> submitting -> idle?
          invariant(
            false,
            "Encountered an unexpected navigation scenario in useTransition()"
          );
        }
      } else {
        // Redirecting after a submission
        if (isActionSubmission) {
          let transition: TransitionStates["LoadingActionRedirect"] = {
            location,
            state,
            submission: {
              method: formMethod.toUpperCase() as ActionSubmission["method"],
              action: formAction,
              encType: formEncType,
              formData: formData,
              key: location.key,
            },
            type: "actionRedirect",
          };
          return transition;
        } else {
          let transition: TransitionStates["LoadingLoaderSubmissionRedirect"] =
            {
              location,
              state,
              submission: {
                method: formMethod.toUpperCase() as LoaderSubmission["method"],
                action: formAction,
                encType: formEncType,
                formData: formData,
                key: location.key,
              },
              type: "loaderSubmissionRedirect",
            };
          return transition;
        }
      }
    } else {
      // TODO: How can we detect a fetch action redirect???  Do we need to
      // check useFetchers?  Or could we somehow look at location key?

      let transition: TransitionStates["LoadingRedirect"] = {
        location,
        state,
        submission: undefined,
        type: "normalRedirect",
      };
      return transition;
    }
  }

  // If all else fails, it's a normal load!
  let transition: TransitionStates["Loading"] = {
    location,
    state: "loading",
    submission: undefined,
    type: "normalLoad",
  };
  return transition;
}

export type FetcherWithComponents<TData> = Fetcher<TData> & {
  Form: React.ForwardRefExoticComponent<
    FormProps & React.RefAttributes<HTMLFormElement>
  >;
  submit: SubmitFunction;
  load: (href: string) => void;
};

/**
 * Interacts with route loaders and actions without causing a navigation. Great
 * for any interaction that stays on the same page.
 *
 * @see https://remix.run/api/remix#usefetcher
 */
export function useFetcher<TData = any>(): FetcherWithComponents<
  SerializeFrom<TData>
> {
  let fetcherRR = useFetcherRR();

  let {
    state,
    formMethod,
    formAction,
    formEncType,
    formData,
    data,
    Form,
    submit,
    load,
  } = fetcherRR;

  let isActionSubmission =
    formMethod != null &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(formMethod.toUpperCase());

  if (state === "idle") {
    if (data === undefined) {
      let fetcher: FetcherStates["Idle"] = IDLE_FETCHER;
      return {
        Form,
        submit,
        load,
        ...fetcher,
      };
    } else {
      let fetcher: FetcherStates["Done"] = {
        state: "idle",
        type: "done",
        submission: undefined,
        data,
      };
      return {
        Form,
        submit,
        load,
        ...fetcher,
      };
    }
  }

  if (
    state === "submitting" &&
    formMethod &&
    formAction &&
    formEncType &&
    formData
  ) {
    if (isActionSubmission) {
      // Actively submitting to an action
      let fetcher: FetcherStates["SubmittingAction"] = {
        state,
        type: "actionSubmission",
        submission: {
          method: formMethod.toUpperCase() as ActionSubmission["method"],
          action: formAction,
          encType: formEncType,
          formData: formData,
          // TODO???
          // This looks like something that's created as a random hash value in
          // useSubmitImpl in Remix today. we do not have this key in react router
          // as we flattened submissions down onto the fetcher.  Can we recreate
          // one here in a stable manner? Or do we need to re-add this key to RR?
          key: "todo-what-is-this?",
        },
        data: undefined,
      };
      return {
        Form,
        submit,
        load,
        ...fetcher,
      };
    } else {
      // Actively "submitting" to a loader
      let fetcher: FetcherStates["SubmittingLoader"] = {
        state,
        type: "loaderSubmission",
        submission: {
          method: formMethod.toUpperCase() as LoaderSubmission["method"],
          action: formAction,
          encType: formEncType,
          // TODO: Recreate from params
          formData: formData,
          // TODO???
          key: "todo-what-is-this?",
        },
        data: undefined,
      };
      return {
        Form,
        submit,
        load,
        ...fetcher,
      };
    }
  }

  if (state === "loading") {
    if (
      formMethod &&
      formAction &&
      formEncType &&
      formData &&
      isActionSubmission
    ) {
      if (data) {
        // In a loading state but we have data - must be an actionReload
        let fetcher: FetcherStates["ReloadingAction"] = {
          state,
          type: "actionReload",
          submission: {
            method: formMethod.toUpperCase() as ActionSubmission["method"],
            action: formAction,
            encType: formEncType,
            formData: formData,
            // TODO???
            key: "todo-what-is-this?",
          },
          data: undefined,
        };
        return {
          Form,
          submit,
          load,
          ...fetcher,
        };
      } else {
        let fetcher: FetcherStates["LoadingActionRedirect"] = {
          state,
          type: "actionRedirect",
          submission: {
            method: formMethod.toUpperCase() as ActionSubmission["method"],
            action: formAction,
            encType: formEncType,
            formData: formData,
            // TODO???
            key: "todo-what-is-this?",
          },
          data: undefined,
        };
        return {
          Form,
          submit,
          load,
          ...fetcher,
        };
      }
    }
  }

  // If all else fails, it's a normal load!
  let fetcher: FetcherStates["Loading"] = {
    state: "loading",
    type: "normalLoad",
    submission: undefined,
    data: undefined,
  };
  return {
    Form,
    submit,
    load,
    ...fetcher,
  };
}

// Dead Code Elimination magic for production builds.
// This way devs don't have to worry about doing the NODE_ENV check themselves.
// If running an un-bundled server outside of `remix dev` you will still need
// to set the REMIX_DEV_SERVER_WS_PORT manually.
export const LiveReload =
  process.env.NODE_ENV !== "development"
    ? () => null
    : function LiveReload({
        port = Number(process.env.REMIX_DEV_SERVER_WS_PORT || 8002),
        nonce = undefined,
      }: {
        port?: number;
        /**
         * @deprecated this property is no longer relevant.
         */
        nonce?: string;
      }) {
        let js = String.raw;
        return (
          <script
            nonce={nonce}
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
              __html: js`
                function remixLiveReloadConnect(config) {
                  let protocol = location.protocol === "https:" ? "wss:" : "ws:";
                  let host = location.hostname;
                  let socketPath = protocol + "//" + host + ":" + ${String(
                    port
                  )} + "/socket";

                  let ws = new WebSocket(socketPath);
                  ws.onmessage = (message) => {
                    let event = JSON.parse(message.data);
                    if (event.type === "LOG") {
                      console.log(event.message);
                    }
                    if (event.type === "RELOAD") {
                      console.log("💿 Reloading window ...");
                      window.location.reload();
                    }
                  };
                  ws.onopen = () => {
                    if (config && typeof config.onOpen === "function") {
                      config.onOpen();
                    }
                  };
                  ws.onclose = (error) => {
                    console.log("Remix dev asset server web socket closed. Reconnecting...");
                    setTimeout(
                      () =>
                        remixLiveReloadConnect({
                          onOpen: () => window.location.reload(),
                        }),
                      1000
                    );
                  };
                  ws.onerror = (error) => {
                    console.log("Remix dev asset server web socket error:");
                    console.error(error);
                  };
                }
                remixLiveReloadConnect();
              `,
            }}
          />
        );
      };
