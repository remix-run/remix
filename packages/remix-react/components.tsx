import type {
  FocusEventHandler,
  MouseEventHandler,
  TouchEventHandler,
} from "react";
import * as React from "react";
import type {
  AgnosticDataRouteMatch,
  UNSAFE_DeferredData as DeferredData,
  RouterState,
  TrackedPromise,
  UIMatch as UIMatchRR,
} from "@remix-run/router";
import type {
  FetcherWithComponents,
  FormProps,
  LinkProps,
  NavLinkProps,
} from "react-router-dom";
import {
  Await as AwaitRR,
  Form as RouterForm,
  Link as RouterLink,
  NavLink as RouterNavLink,
  UNSAFE_DataRouterContext as DataRouterContext,
  UNSAFE_DataRouterStateContext as DataRouterStateContext,
  matchRoutes,
  useAsyncError,
  useActionData as useActionDataRR,
  useFetcher as useFetcherRR,
  useLoaderData as useLoaderDataRR,
  useMatches as useMatchesRR,
  useRouteLoaderData as useRouteLoaderDataRR,
  useLocation,
  useHref,
} from "react-router-dom";
import type { SerializeFrom } from "@remix-run/server-runtime";

import type { AppData } from "./data";
import type { RemixContextObject } from "./entry";
import invariant from "./invariant";
import {
  getDataLinkHrefs,
  getKeyedLinksForMatches,
  getKeyedPrefetchLinks,
  getModuleLinkHrefs,
  getNewMatchesForLinks,
  isPageLinkDescriptor,
} from "./links";
import type { KeyedHtmlLinkDescriptor, PrefetchPageDescriptor } from "./links";
import { createHtml, escapeHtml } from "./markup";
import type {
  MetaFunction,
  MetaDescriptor,
  MetaMatch,
  MetaMatches,
  RouteHandle,
} from "./routeModules";
import { singleFetchUrl } from "./single-fetch";
import { getPartialManifest, isFogOfWarEnabled } from "./fog-of-war";

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

export function useRemixContext(): RemixContextObject {
  let context = React.useContext(RemixContext);
  invariant(context, "You must render this element inside a <Remix> element");
  return context;
}

////////////////////////////////////////////////////////////////////////////////
// Public API

/**
 * Defines the discovery behavior of the link:
 *
 * - "render": Eagerly discover when the link is rendered (default)
 * - "none": No eager discovery - discover when the link is clicked
 */
export type DiscoverBehavior = "render" | "none";

/**
 * Defines the prefetching behavior of the link:
 *
 * - "none": Never fetched
 * - "intent": Fetched when the user focuses or hovers the link
 * - "render": Fetched when the link is rendered
 * - "viewport": Fetched when the link is in the viewport
 */
type PrefetchBehavior = "intent" | "render" | "none" | "viewport";

export interface RemixLinkProps extends LinkProps {
  discover?: DiscoverBehavior;
  prefetch?: PrefetchBehavior;
}

export interface RemixNavLinkProps extends NavLinkProps {
  discover?: DiscoverBehavior;
  prefetch?: PrefetchBehavior;
}

interface PrefetchHandlers {
  onFocus?: FocusEventHandler;
  onBlur?: FocusEventHandler;
  onMouseEnter?: MouseEventHandler;
  onMouseLeave?: MouseEventHandler;
  onTouchStart?: TouchEventHandler;
}

function usePrefetchBehavior<T extends HTMLAnchorElement>(
  prefetch: PrefetchBehavior,
  theirElementProps: PrefetchHandlers
): [boolean, React.RefObject<T>, Required<PrefetchHandlers>] {
  let [maybePrefetch, setMaybePrefetch] = React.useState(false);
  let [shouldPrefetch, setShouldPrefetch] = React.useState(false);
  let { onFocus, onBlur, onMouseEnter, onMouseLeave, onTouchStart } =
    theirElementProps;

  let ref = React.useRef<T>(null);

  React.useEffect(() => {
    if (prefetch === "render") {
      setShouldPrefetch(true);
    }

    if (prefetch === "viewport") {
      let callback: IntersectionObserverCallback = (entries) => {
        entries.forEach((entry) => {
          setShouldPrefetch(entry.isIntersecting);
        });
      };
      let observer = new IntersectionObserver(callback, { threshold: 0.5 });
      if (ref.current) observer.observe(ref.current);

      return () => {
        observer.disconnect();
      };
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
    ref,
    {
      onFocus: composeEventHandlers(onFocus, setIntent),
      onBlur: composeEventHandlers(onBlur, cancelIntent),
      onMouseEnter: composeEventHandlers(onMouseEnter, setIntent),
      onMouseLeave: composeEventHandlers(onMouseLeave, cancelIntent),
      onTouchStart: composeEventHandlers(onTouchStart, setIntent),
    },
  ];
}

const ABSOLUTE_URL_REGEX = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

function getDiscoverAttr(
  discover: DiscoverBehavior,
  isAbsolute: boolean,
  reloadDocument: boolean | undefined
) {
  return discover === "render" && !isAbsolute && !reloadDocument
    ? "true"
    : undefined;
}

/**
 * A special kind of `<Link>` that knows whether it is "active".
 *
 * @see https://remix.run/components/nav-link
 */
let NavLink = React.forwardRef<HTMLAnchorElement, RemixNavLinkProps>(
  ({ to, prefetch = "none", discover = "render", ...props }, forwardedRef) => {
    let isAbsolute = typeof to === "string" && ABSOLUTE_URL_REGEX.test(to);

    let href = useHref(to);
    let [shouldPrefetch, ref, prefetchHandlers] = usePrefetchBehavior(
      prefetch,
      props
    );

    return (
      <>
        <RouterNavLink
          {...props}
          {...prefetchHandlers}
          ref={mergeRefs(forwardedRef, ref)}
          to={to}
          data-discover={getDiscoverAttr(
            discover,
            isAbsolute,
            props.reloadDocument
          )}
        />
        {shouldPrefetch && !isAbsolute ? (
          <PrefetchPageLinks page={href} />
        ) : null}
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
 * @see https://remix.run/components/link
 */
let Link = React.forwardRef<HTMLAnchorElement, RemixLinkProps>(
  ({ to, prefetch = "none", discover = "render", ...props }, forwardedRef) => {
    let isAbsolute = typeof to === "string" && ABSOLUTE_URL_REGEX.test(to);

    let href = useHref(to);
    let [shouldPrefetch, ref, prefetchHandlers] = usePrefetchBehavior(
      prefetch,
      props
    );

    return (
      <>
        <RouterLink
          {...props}
          {...prefetchHandlers}
          ref={mergeRefs(forwardedRef, ref)}
          to={to}
          data-discover={getDiscoverAttr(
            discover,
            isAbsolute,
            props.reloadDocument
          )}
        />
        {shouldPrefetch && !isAbsolute ? (
          <PrefetchPageLinks page={href} />
        ) : null}
      </>
    );
  }
);
Link.displayName = "Link";
export { Link };

export interface RemixFormProps extends FormProps {
  discover?: DiscoverBehavior;
}

/**
 * This component renders a form tag and is the primary way the user will
 * submit information via your website.
 *
 * @see https://remix.run/components/form
 */
let Form = React.forwardRef<HTMLFormElement, RemixFormProps>(
  ({ discover = "render", ...props }, forwardedRef) => {
    let isAbsolute =
      typeof props.action === "string" && ABSOLUTE_URL_REGEX.test(props.action);
    return (
      <RouterForm
        {...props}
        ref={forwardedRef}
        data-discover={getDiscoverAttr(
          discover,
          isAbsolute,
          props.reloadDocument
        )}
      />
    );
  }
);
Form.displayName = "Form";
export { Form };

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

// Return the matches actively being displayed:
// - In SPA Mode we only SSR/hydrate the root match, and include all matches
//   after hydration. This lets the router handle initial match loads via lazy().
// - When an error boundary is rendered, we slice off matches up to the
//   boundary for <Links>/<Meta>
function getActiveMatches(
  matches: RouterState["matches"],
  errors: RouterState["errors"],
  isSpaMode: boolean
) {
  if (isSpaMode && !isHydrated) {
    return [matches[0]];
  }

  if (errors) {
    let errorIdx = matches.findIndex((m) => errors[m.route.id] !== undefined);
    return matches.slice(0, errorIdx + 1);
  }

  return matches;
}

/**
 * Renders the `<link>` tags for the current routes.
 *
 * @see https://remix.run/components/links
 */
export function Links() {
  let { isSpaMode, manifest, routeModules, criticalCss } = useRemixContext();
  let { errors, matches: routerMatches } = useDataRouterStateContext();

  let matches = getActiveMatches(routerMatches, errors, isSpaMode);

  let keyedLinks = React.useMemo(
    () => getKeyedLinksForMatches(matches, routeModules, manifest),
    [matches, routeModules, manifest]
  );

  return (
    <>
      {criticalCss ? (
        <style dangerouslySetInnerHTML={{ __html: criticalCss }} />
      ) : null}
      {keyedLinks.map(({ key, link }) =>
        isPageLinkDescriptor(link) ? (
          <PrefetchPageLinks key={key} {...link} />
        ) : (
          <link key={key} {...link} />
        )
      )}
    </>
  );
}

/**
 * This component renders all the `<link rel="prefetch">` and
 * `<link rel="modulepreload"/>` tags for all the assets (data, modules, css) of
 * a given page.
 *
 * @param props
 * @param props.page
 * @see https://remix.run/components/prefetch-page-links
 */
export function PrefetchPageLinks({
  page,
  ...dataLinkProps
}: PrefetchPageDescriptor) {
  let { router } = useDataRouterContext();
  let matches = React.useMemo(
    () => matchRoutes(router.routes, page, router.basename),
    [router.routes, page, router.basename]
  );

  if (!matches) {
    console.warn(`Tried to prefetch ${page} but no routes matched.`);
    return null;
  }

  return (
    <PrefetchPageLinksImpl page={page} matches={matches} {...dataLinkProps} />
  );
}

function useKeyedPrefetchLinks(matches: AgnosticDataRouteMatch[]) {
  let { manifest, routeModules } = useRemixContext();

  let [keyedPrefetchLinks, setKeyedPrefetchLinks] = React.useState<
    KeyedHtmlLinkDescriptor[]
  >([]);

  React.useEffect(() => {
    let interrupted: boolean = false;

    void getKeyedPrefetchLinks(matches, manifest, routeModules).then(
      (links) => {
        if (!interrupted) {
          setKeyedPrefetchLinks(links);
        }
      }
    );

    return () => {
      interrupted = true;
    };
  }, [matches, manifest, routeModules]);

  return keyedPrefetchLinks;
}

function PrefetchPageLinksImpl({
  page,
  matches: nextMatches,
  ...linkProps
}: PrefetchPageDescriptor & {
  matches: AgnosticDataRouteMatch[];
}) {
  let location = useLocation();
  let { future, manifest, routeModules } = useRemixContext();
  let { loaderData, matches } = useDataRouterStateContext();

  let newMatchesForData = React.useMemo(
    () =>
      getNewMatchesForLinks(
        page,
        nextMatches,
        matches,
        manifest,
        location,
        future,
        "data"
      ),
    [page, nextMatches, matches, manifest, location, future]
  );

  let dataHrefs = React.useMemo(() => {
    if (!future.v3_singleFetch) {
      return getDataLinkHrefs(page, newMatchesForData, manifest);
    }

    if (page === location.pathname + location.search + location.hash) {
      // Because we opt-into revalidation, don't compute this for the current page
      // since it would always trigger a prefetch of the existing loaders
      return [];
    }

    // Single-fetch is harder :)
    // This parallels the logic in the single fetch data strategy
    let routesParams = new Set<string>();
    let foundOptOutRoute = false;
    nextMatches.forEach((m) => {
      if (!manifest.routes[m.route.id].hasLoader) {
        return;
      }

      if (
        !newMatchesForData.some((m2) => m2.route.id === m.route.id) &&
        m.route.id in loaderData &&
        routeModules[m.route.id]?.shouldRevalidate
      ) {
        foundOptOutRoute = true;
      } else if (manifest.routes[m.route.id].hasClientLoader) {
        foundOptOutRoute = true;
      } else {
        routesParams.add(m.route.id);
      }
    });

    if (routesParams.size === 0) {
      return [];
    }

    let url = singleFetchUrl(page);
    // When one or more routes have opted out, we add a _routes param to
    // limit the loaders to those that have a server loader and did not
    // opt out
    if (foundOptOutRoute && routesParams.size > 0) {
      url.searchParams.set(
        "_routes",
        nextMatches
          .filter((m) => routesParams.has(m.route.id))
          .map((m) => m.route.id)
          .join(",")
      );
    }

    return [url.pathname + url.search];
  }, [
    future.v3_singleFetch,
    loaderData,
    location,
    manifest,
    newMatchesForData,
    nextMatches,
    page,
    routeModules,
  ]);

  let newMatchesForAssets = React.useMemo(
    () =>
      getNewMatchesForLinks(
        page,
        nextMatches,
        matches,
        manifest,
        location,
        future,
        "assets"
      ),
    [page, nextMatches, matches, manifest, location, future]
  );

  let moduleHrefs = React.useMemo(
    () => getModuleLinkHrefs(newMatchesForAssets, manifest),
    [newMatchesForAssets, manifest]
  );

  // needs to be a hook with async behavior because we need the modules, not
  // just the manifest like the other links in here.
  let keyedPrefetchLinks = useKeyedPrefetchLinks(newMatchesForAssets);

  return (
    <>
      {dataHrefs.map((href) => (
        <link key={href} rel="prefetch" as="fetch" href={href} {...linkProps} />
      ))}
      {moduleHrefs.map((href) => (
        <link key={href} rel="modulepreload" href={href} {...linkProps} />
      ))}
      {keyedPrefetchLinks.map(({ key, link }) => (
        // these don't spread `linkProps` because they are full link descriptors
        // already with their own props
        <link key={key} {...link} />
      ))}
    </>
  );
}

/**
 * Renders HTML tags related to metadata for the current route.
 *
 * @see https://remix.run/components/meta
 */
export function Meta() {
  let { isSpaMode, routeModules } = useRemixContext();
  let {
    errors,
    matches: routerMatches,
    loaderData,
  } = useDataRouterStateContext();
  let location = useLocation();

  let _matches = getActiveMatches(routerMatches, errors, isSpaMode);

  let error: any = null;
  if (errors) {
    error = errors[_matches[_matches.length - 1].route.id];
  }

  let meta: MetaDescriptor[] = [];
  let leafMeta: MetaDescriptor[] | null = null;
  let matches: MetaMatches = [];
  for (let i = 0; i < _matches.length; i++) {
    let _match = _matches[i];
    let routeId = _match.route.id;
    let data = loaderData[routeId];
    let params = _match.params;
    let routeModule = routeModules[routeId];
    let routeMeta: MetaDescriptor[] | undefined = [];

    let match: MetaMatch = {
      id: routeId,
      data,
      meta: [],
      params: _match.params,
      pathname: _match.pathname,
      handle: _match.route.handle,
      error,
    };
    matches[i] = match;

    if (routeModule?.meta) {
      routeMeta =
        typeof routeModule.meta === "function"
          ? (routeModule.meta as MetaFunction)({
              data,
              params,
              location,
              matches,
              error,
            })
          : Array.isArray(routeModule.meta)
          ? [...routeModule.meta]
          : routeModule.meta;
    } else if (leafMeta) {
      // We only assign the route's meta to the nearest leaf if there is no meta
      // export in the route. The meta function may return a falsy value which
      // is effectively the same as an empty array.
      routeMeta = [...leafMeta];
    }

    routeMeta = routeMeta || [];
    if (!Array.isArray(routeMeta)) {
      throw new Error(
        "The route at " +
          _match.route.path +
          " returns an invalid value. All route meta functions must " +
          "return an array of meta objects." +
          "\n\nTo reference the meta function API, see https://remix.run/route/meta"
      );
    }

    match.meta = routeMeta;
    matches[i] = match;
    meta = [...routeMeta];
    leafMeta = meta;
  }

  return (
    <>
      {meta.flat().map((metaProps) => {
        if (!metaProps) {
          return null;
        }

        if ("tagName" in metaProps) {
          let { tagName, ...rest } = metaProps;
          if (!isValidMetaTag(tagName)) {
            console.warn(
              `A meta object uses an invalid tagName: ${tagName}. Expected either 'link' or 'meta'`
            );
            return null;
          }
          let Comp = tagName;
          return <Comp key={JSON.stringify(rest)} {...rest} />;
        }

        if ("title" in metaProps) {
          return <title key="title">{String(metaProps.title)}</title>;
        }

        if ("charset" in metaProps) {
          metaProps.charSet ??= metaProps.charset;
          delete metaProps.charset;
        }

        if ("charSet" in metaProps && metaProps.charSet != null) {
          return typeof metaProps.charSet === "string" ? (
            <meta key="charSet" charSet={metaProps.charSet} />
          ) : null;
        }

        if ("script:ld+json" in metaProps) {
          try {
            let json = JSON.stringify(metaProps["script:ld+json"]);
            return (
              <script
                key={`script:ld+json:${json}`}
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: json }}
              />
            );
          } catch (err) {
            return null;
          }
        }
        return <meta key={JSON.stringify(metaProps)} {...metaProps} />;
      })}
    </>
  );
}

function isValidMetaTag(tagName: unknown): tagName is "meta" | "link" {
  return typeof tagName === "string" && /^(meta|link)$/.test(tagName);
}

export interface AwaitProps<Resolve> {
  children: React.ReactNode | ((value: Awaited<Resolve>) => React.ReactNode);
  errorElement?: React.ReactNode;
  resolve: Resolve;
}

export function Await<Resolve>(props: AwaitProps<Resolve>) {
  return <AwaitRR {...props} />;
}

/**
 * Tracks whether Remix has finished hydrating or not, so scripts can be skipped
 * during client-side updates.
 */
let isHydrated = false;

export type ScriptProps = Omit<
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
 * @see https://remix.run/components/scripts
 */
export function Scripts(props: ScriptProps) {
  let {
    manifest,
    serverHandoffString,
    abortDelay,
    serializeError,
    isSpaMode,
    future,
    renderMeta,
  } = useRemixContext();
  let { router, static: isStatic, staticContext } = useDataRouterContext();
  let { matches: routerMatches } = useDataRouterStateContext();
  let enableFogOfWar = isFogOfWarEnabled(future, isSpaMode);

  // Let <RemixServer> know that we hydrated and we should render the single
  // fetch streaming scripts
  if (renderMeta) {
    renderMeta.didRenderScripts = true;
  }

  let matches = getActiveMatches(routerMatches, null, isSpaMode);

  React.useEffect(() => {
    isHydrated = true;
  }, []);

  let serializePreResolvedErrorImp = (key: string, error: unknown) => {
    let toSerialize: unknown;
    if (serializeError && error instanceof Error) {
      toSerialize = serializeError(error);
    } else {
      toSerialize = error;
    }
    return `${JSON.stringify(key)}:__remixContext.p(!1, ${escapeHtml(
      JSON.stringify(toSerialize)
    )})`;
  };

  let serializePreresolvedDataImp = (
    routeId: string,
    key: string,
    data: unknown
  ) => {
    let serializedData;
    try {
      serializedData = JSON.stringify(data);
    } catch (error) {
      return serializePreResolvedErrorImp(key, error);
    }
    return `${JSON.stringify(key)}:__remixContext.p(${escapeHtml(
      serializedData
    )})`;
  };

  let serializeErrorImp = (routeId: string, key: string, error: unknown) => {
    let toSerialize: unknown;
    if (serializeError && error instanceof Error) {
      toSerialize = serializeError(error);
    } else {
      toSerialize = error;
    }
    return `__remixContext.r(${JSON.stringify(routeId)}, ${JSON.stringify(
      key
    )}, !1, ${escapeHtml(JSON.stringify(toSerialize))})`;
  };

  let serializeDataImp = (routeId: string, key: string, data: unknown) => {
    let serializedData;
    try {
      serializedData = JSON.stringify(data);
    } catch (error) {
      return serializeErrorImp(routeId, key, error);
    }
    return `__remixContext.r(${JSON.stringify(routeId)}, ${JSON.stringify(
      key
    )}, ${escapeHtml(serializedData)})`;
  };

  let deferredScripts: any[] = [];
  let initialScripts = React.useMemo(() => {
    let streamScript = future.v3_singleFetch
      ? // prettier-ignore
        "window.__remixContext.stream = new ReadableStream({" +
          "start(controller){" +
            "window.__remixContext.streamController = controller;" +
          "}" +
        "}).pipeThrough(new TextEncoderStream());"
      : "";

    let contextScript = staticContext
      ? `window.__remixContext = ${serverHandoffString};${streamScript}`
      : " ";

    // When single fetch is enabled, deferred is handled by turbo-stream
    let activeDeferreds = future.v3_singleFetch
      ? undefined
      : staticContext?.activeDeferreds;

    // This sets up the __remixContext with utility functions used by the
    // deferred scripts.
    // - __remixContext.p is a function that takes a resolved value or error and returns a promise.
    //   This is used for transmitting pre-resolved promises from the server to the client.
    // - __remixContext.n is a function that takes a routeID and key to returns a promise for later
    //   resolution by the subsequently streamed chunks.
    // - __remixContext.r is a function that takes a routeID, key and value or error and resolves
    //   the promise created by __remixContext.n.
    // - __remixContext.t is a map or routeId to keys to an object containing `e` and `r` methods
    //   to resolve or reject the promise created by __remixContext.n.
    // - __remixContext.a is the active number of deferred scripts that should be rendered to match
    //   the SSR tree for hydration on the client.
    contextScript += !activeDeferreds
      ? ""
      : [
          "__remixContext.p = function(v,e,p,x) {",
          "  if (typeof e !== 'undefined') {",
          process.env.NODE_ENV === "development"
            ? "    x=new Error(e.message);\n    x.stack=e.stack;"
            : '    x=new Error("Unexpected Server Error");\n    x.stack=undefined;',
          "    p=Promise.reject(x);",
          "  } else {",
          "    p=Promise.resolve(v);",
          "  }",
          "  return p;",
          "};",
          "__remixContext.n = function(i,k) {",
          "  __remixContext.t = __remixContext.t || {};",
          "  __remixContext.t[i] = __remixContext.t[i] || {};",
          "  let p = new Promise((r, e) => {__remixContext.t[i][k] = {r:(v)=>{r(v);},e:(v)=>{e(v);}};});",
          typeof abortDelay === "number"
            ? `setTimeout(() => {if(typeof p._error !== "undefined" || typeof p._data !== "undefined"){return;} __remixContext.t[i][k].e(new Error("Server timeout."))}, ${abortDelay});`
            : "",
          "  return p;",
          "};",
          "__remixContext.r = function(i,k,v,e,p,x) {",
          "  p = __remixContext.t[i][k];",
          "  if (typeof e !== 'undefined') {",
          process.env.NODE_ENV === "development"
            ? "    x=new Error(e.message);\n    x.stack=e.stack;"
            : '    x=new Error("Unexpected Server Error");\n    x.stack=undefined;',
          "    p.e(x);",
          "  } else {",
          "    p.r(v);",
          "  }",
          "};",
        ].join("\n") +
        Object.entries(activeDeferreds)
          .map(([routeId, deferredData]) => {
            let pendingKeys = new Set(deferredData.pendingKeys);
            let promiseKeyValues = deferredData.deferredKeys
              .map((key) => {
                if (pendingKeys.has(key)) {
                  deferredScripts.push(
                    <DeferredHydrationScript
                      key={`${routeId} | ${key}`}
                      deferredData={deferredData}
                      routeId={routeId}
                      dataKey={key}
                      scriptProps={props}
                      serializeData={serializeDataImp}
                      serializeError={serializeErrorImp}
                    />
                  );

                  return `${JSON.stringify(
                    key
                  )}:__remixContext.n(${JSON.stringify(
                    routeId
                  )}, ${JSON.stringify(key)})`;
                } else {
                  let trackedPromise = deferredData.data[key] as TrackedPromise;
                  if (typeof trackedPromise._error !== "undefined") {
                    return serializePreResolvedErrorImp(
                      key,
                      trackedPromise._error
                    );
                  } else {
                    return serializePreresolvedDataImp(
                      routeId,
                      key,
                      trackedPromise._data
                    );
                  }
                }
              })
              .join(",\n");
            return `Object.assign(__remixContext.state.loaderData[${JSON.stringify(
              routeId
            )}], {${promiseKeyValues}});`;
          })
          .join("\n") +
        (deferredScripts.length > 0
          ? `__remixContext.a=${deferredScripts.length};`
          : "");

    let routeModulesScript = !isStatic
      ? " "
      : `${
          manifest.hmr?.runtime
            ? `import ${JSON.stringify(manifest.hmr.runtime)};`
            : ""
        }${enableFogOfWar ? "" : `import ${JSON.stringify(manifest.url)}`};
${matches
  .map(
    (match, index) =>
      `import * as route${index} from ${JSON.stringify(
        manifest.routes[match.route.id].module
      )};`
  )
  .join("\n")}
${
  enableFogOfWar
    ? // Inline a minimal manifest with the SSR matches
      `window.__remixManifest = ${JSON.stringify(
        getPartialManifest(manifest, router),
        null,
        2
      )};`
    : ""
}
window.__remixRouteModules = {${matches
          .map(
            (match, index) => `${JSON.stringify(match.route.id)}:route${index}`
          )
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
          suppressHydrationWarning
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

  if (!isStatic && typeof __remixContext === "object" && __remixContext.a) {
    for (let i = 0; i < __remixContext.a; i++) {
      deferredScripts.push(
        <DeferredHydrationScript
          key={i}
          scriptProps={props}
          serializeData={serializeDataImp}
          serializeError={serializeErrorImp}
        />
      );
    }
  }

  let routePreloads = matches
    .map((match) => {
      let route = manifest.routes[match.route.id];
      return (route.imports || []).concat([route.module]);
    })
    .flat(1);

  let preloads = isHydrated ? [] : manifest.entry.imports.concat(routePreloads);

  return isHydrated ? null : (
    <>
      {!enableFogOfWar ? (
        <link
          rel="modulepreload"
          href={manifest.url}
          crossOrigin={props.crossOrigin}
        />
      ) : null}
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
      {initialScripts}
      {deferredScripts}
    </>
  );
}

function DeferredHydrationScript({
  dataKey,
  deferredData,
  routeId,
  scriptProps,
  serializeData,
  serializeError,
}: {
  dataKey?: string;
  deferredData?: DeferredData;
  routeId?: string;
  scriptProps?: ScriptProps;
  serializeData: (routeId: string, key: string, data: unknown) => string;
  serializeError: (routeId: string, key: string, error: unknown) => string;
}) {
  if (typeof document === "undefined" && deferredData && dataKey && routeId) {
    invariant(
      deferredData.pendingKeys.includes(dataKey),
      `Deferred data for route ${routeId} with key ${dataKey} was not pending but tried to render a script for it.`
    );
  }

  return (
    <React.Suspense
      fallback={
        // This makes absolutely no sense. The server renders null as a fallback,
        // but when hydrating, we need to render a script tag to avoid a hydration issue.
        // To reproduce a hydration mismatch, just render null as a fallback.
        typeof document === "undefined" &&
        deferredData &&
        dataKey &&
        routeId ? null : (
          <script
            {...scriptProps}
            async
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: " " }}
          />
        )
      }
    >
      {typeof document === "undefined" && deferredData && dataKey && routeId ? (
        <Await
          resolve={deferredData.data[dataKey]}
          errorElement={
            <ErrorDeferredHydrationScript
              dataKey={dataKey}
              routeId={routeId}
              scriptProps={scriptProps}
              serializeError={serializeError}
            />
          }
          children={(data) => {
            return (
              <script
                {...scriptProps}
                async
                suppressHydrationWarning
                dangerouslySetInnerHTML={{
                  __html: serializeData(routeId, dataKey, data),
                }}
              />
            );
          }}
        />
      ) : (
        <script
          {...scriptProps}
          async
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: " " }}
        />
      )}
    </React.Suspense>
  );
}

function ErrorDeferredHydrationScript({
  dataKey,
  routeId,
  scriptProps,
  serializeError,
}: {
  dataKey: string;
  routeId: string;
  scriptProps?: ScriptProps;
  serializeError: (routeId: string, key: string, error: unknown) => string;
}) {
  let error = useAsyncError() as Error;

  return (
    <script
      {...scriptProps}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: serializeError(routeId, dataKey, error),
      }}
    />
  );
}

function dedupe(array: any[]) {
  return [...new Set(array)];
}

export type UIMatch<D = AppData, H = RouteHandle> = UIMatchRR<
  SerializeFrom<D>,
  H
>;

/**
 * Returns the active route matches, useful for accessing loaderData for
 * parent/child routes or the route "handle" property
 *
 * @see https://remix.run/hooks/use-matches
 */
export function useMatches(): UIMatch[] {
  return useMatchesRR() as UIMatch[];
}

/**
 * Returns the JSON parsed data from the current route's `loader`.
 *
 * @see https://remix.run/hooks/use-loader-data
 */
export function useLoaderData<T = AppData>(): SerializeFrom<T> {
  return useLoaderDataRR() as SerializeFrom<T>;
}

/**
 * Returns the loaderData for the given routeId.
 *
 * @see https://remix.run/hooks/use-route-loader-data
 */
export function useRouteLoaderData<T = AppData>(
  routeId: string
): SerializeFrom<T> | undefined {
  return useRouteLoaderDataRR(routeId) as SerializeFrom<T> | undefined;
}

/**
 * Returns the JSON parsed data from the current route's `action`.
 *
 * @see https://remix.run/hooks/use-action-data
 */
export function useActionData<T = AppData>(): SerializeFrom<T> | undefined {
  return useActionDataRR() as SerializeFrom<T> | undefined;
}

/**
 * Interacts with route loaders and actions without causing a navigation. Great
 * for any interaction that stays on the same page.
 *
 * @see https://remix.run/hooks/use-fetcher
 */
export function useFetcher<TData = AppData>(
  opts: Parameters<typeof useFetcherRR>[0] = {}
): FetcherWithComponents<SerializeFrom<TData>> {
  return useFetcherRR(opts);
}

/**
 * This component connects your app to the Remix asset server and
 * automatically reloads the page when files change in development.
 * In production, it renders null, so you can safely render it always in your root route.
 *
 * @see https://remix.run/docs/components/live-reload
 */
export const LiveReload =
  // Dead Code Elimination magic for production builds.
  // This way devs don't have to worry about doing the NODE_ENV check themselves.
  process.env.NODE_ENV !== "development"
    ? () => null
    : function LiveReload({
        origin,
        port,
        timeoutMs = 1000,
        nonce = undefined,
      }: {
        origin?: string;
        port?: number;
        timeoutMs?: number;
        nonce?: string;
      }) {
        // @ts-expect-error
        let isViteClient = import.meta && import.meta.env !== undefined;
        if (isViteClient) {
          console.warn(
            [
              "`<LiveReload />` is obsolete when using Vite and can conflict with Vite's built-in HMR runtime.",
              "",
              "Remove `<LiveReload />` from your code and instead only use `<Scripts />`.",
              "Then refresh the page to remove lingering scripts from `<LiveReload />`.",
            ].join("\n")
          );
          return null;
        }
        origin ??= process.env.REMIX_DEV_ORIGIN;
        let js = String.raw;
        return (
          <script
            nonce={nonce}
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
              __html: js`
                function remixLiveReloadConnect(config) {
                  let LIVE_RELOAD_ORIGIN = ${JSON.stringify(origin)};
                  let protocol =
                    LIVE_RELOAD_ORIGIN ? new URL(LIVE_RELOAD_ORIGIN).protocol.replace(/^http/, "ws") :
                    location.protocol === "https:" ? "wss:" : "ws:"; // remove in v2?
                  let hostname = LIVE_RELOAD_ORIGIN ? new URL(LIVE_RELOAD_ORIGIN).hostname : location.hostname;
                  let url = new URL(protocol + "//" + hostname + "/socket");

                  url.port =
                    ${port} ||
                    (LIVE_RELOAD_ORIGIN ? new URL(LIVE_RELOAD_ORIGIN).port : 8002);

                  let ws = new WebSocket(url.href);
                  ws.onmessage = async (message) => {
                    let event = JSON.parse(message.data);
                    if (event.type === "LOG") {
                      console.log(event.message);
                    }
                    if (event.type === "RELOAD") {
                      console.log("💿 Reloading window ...");
                      window.location.reload();
                    }
                    if (event.type === "HMR") {
                      if (!window.__hmr__ || !window.__hmr__.contexts) {
                        console.log("💿 [HMR] No HMR context, reloading window ...");
                        window.location.reload();
                        return;
                      }
                      if (!event.updates || !event.updates.length) return;
                      let updateAccepted = false;
                      let needsRevalidation = new Set();
                      for (let update of event.updates) {
                        console.log("[HMR] " + update.reason + " [" + update.id +"]")
                        if (update.revalidate) {
                          needsRevalidation.add(update.routeId);
                          console.log("[HMR] Revalidating [" + update.routeId + "]");
                        }
                        let imported = await import(update.url +  '?t=' + event.assetsManifest.hmr.timestamp);
                        if (window.__hmr__.contexts[update.id]) {
                          let accepted = window.__hmr__.contexts[update.id].emit(
                            imported
                          );
                          if (accepted) {
                            console.log("[HMR] Update accepted by", update.id);
                            updateAccepted = true;
                          }
                        }
                      }
                      if (event.assetsManifest && window.__hmr__.contexts["remix:manifest"]) {
                        let accepted = window.__hmr__.contexts["remix:manifest"].emit(
                          { needsRevalidation, assetsManifest: event.assetsManifest }
                        );
                        if (accepted) {
                          console.log("[HMR] Update accepted by", "remix:manifest");
                          updateAccepted = true;
                        }
                      }
                      if (!updateAccepted) {
                        console.log("[HMR] Update rejected, reloading...");
                        window.location.reload();
                      }
                    }
                  };
                  ws.onopen = () => {
                    if (config && typeof config.onOpen === "function") {
                      config.onOpen();
                    }
                  };
                  ws.onclose = (event) => {
                    if (event.code === 1006) {
                      console.log("Remix dev asset server web socket closed. Reconnecting...");
                      setTimeout(
                        () =>
                          remixLiveReloadConnect({
                            onOpen: () => window.location.reload(),
                          }),
                      ${String(timeoutMs)}
                      );
                    }
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

function mergeRefs<T = any>(
  ...refs: Array<React.MutableRefObject<T> | React.LegacyRef<T>>
): React.RefCallback<T> {
  return (value) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref != null) {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    });
  };
}
