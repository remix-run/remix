import type {
  FocusEventHandler,
  MouseEventHandler,
  TouchEventHandler,
} from "react";
import * as React from "react";
import type {
  AgnosticDataRouteMatch,
  UNSAFE_DeferredData as DeferredData,
  Navigation,
  TrackedPromise,
} from "@remix-run/router";
import type {
  LinkProps,
  NavLinkProps,
  FormProps,
  Params,
  SubmitFunction,
} from "react-router-dom";
import {
  Await as AwaitRR,
  Link as RouterLink,
  NavLink as RouterNavLink,
  Outlet,
  UNSAFE_DataRouterContext as DataRouterContext,
  UNSAFE_DataRouterStateContext as DataRouterStateContext,
  isRouteErrorResponse,
  matchRoutes,
  useAsyncError,
  useFetcher as useFetcherRR,
  useFetchers as useFetchersRR,
  useActionData as useActionDataRR,
  useLoaderData as useLoaderDataRR,
  useRouteLoaderData as useRouteLoaderDataRR,
  useMatches as useMatchesRR,
  useLocation,
  useNavigation,
  useHref,
  useRouteError,
} from "react-router-dom";
import type { SerializeFrom } from "@remix-run/server-runtime";

import type { AppData } from "./data";
import type { RemixContextObject } from "./entry";
import {
  RemixRootDefaultErrorBoundary,
  RemixRootDefaultCatchBoundary,
  RemixCatchBoundary,
  V2_RemixRootDefaultErrorBoundary,
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
import { createHtml, escapeHtml } from "./markup";
import type {
  V1_HtmlMetaDescriptor,
  V1_MetaFunction,
  V2_MetaDescriptor,
  V2_MetaFunction,
  V2_MetaMatch,
  V2_MetaMatches,
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
import { logDeprecationOnce } from "./warnings";

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
// RemixRoute

export function RemixRoute({ id }: { id: string }) {
  let { routeModules, future } = useRemixContext();

  invariant(
    routeModules,
    "Cannot initialize 'routeModules'. This normally occurs when you have server code in your client modules.\n" +
      "Check this link for more details:\nhttps://remix.run/pages/gotchas#server-code-in-client-bundles"
  );

  let { default: Component, ErrorBoundary, CatchBoundary } = routeModules[id];

  // Default Component to Outlet if we expose boundary UI components
  if (
    !Component &&
    (ErrorBoundary || (!future.v2_errorBoundary && CatchBoundary))
  ) {
    Component = Outlet;
  }

  invariant(
    Component,
    `Route "${id}" has no component! Please go add a \`default\` export in the route module file.\n` +
      "If you were trying to navigate or submit to a resource route, use `<a>` instead of `<Link>` or `<Form reloadDocument>`."
  );

  return <Component />;
}

export function RemixRouteError({ id }: { id: string }) {
  let { future, routeModules } = useRemixContext();

  // This checks prevent cryptic error messages such as: 'Cannot read properties of undefined (reading 'root')'
  invariant(
    routeModules,
    "Cannot initialize 'routeModules'. This normally occurs when you have server code in your client modules.\n" +
      "Check this link for more details:\nhttps://remix.run/pages/gotchas#server-code-in-client-bundles"
  );

  let error = useRouteError();
  let { CatchBoundary, ErrorBoundary } = routeModules[id];

  if (future.v2_errorBoundary) {
    // Provide defaults for the root route if they are not present
    if (id === "root") {
      ErrorBoundary ||= V2_RemixRootDefaultErrorBoundary;
    }
    if (ErrorBoundary) {
      // TODO: Unsure if we can satisfy the typings here
      // @ts-expect-error
      return <ErrorBoundary />;
    }
    throw error;
  }

  // Provide defaults for the root route if they are not present
  if (id === "root") {
    CatchBoundary ||= RemixRootDefaultCatchBoundary;
    ErrorBoundary ||= RemixRootDefaultErrorBoundary;
  }

  if (isRouteErrorResponse(error)) {
    let tError = error;
    if (!!tError?.error && tError.status !== 404 && ErrorBoundary) {
      // Internal framework-thrown ErrorResponses
      return <ErrorBoundary error={tError.error} />;
    }
    if (CatchBoundary) {
      // User-thrown ErrorResponses
      return <RemixCatchBoundary catch={error} component={CatchBoundary} />;
    }
  }

  if (error instanceof Error && ErrorBoundary) {
    // User- or framework-thrown Errors
    return <ErrorBoundary error={error} />;
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
type PrefetchBehavior = "intent" | "render" | "none" | "viewport";

export interface RemixLinkProps extends LinkProps {
  prefetch?: PrefetchBehavior;
}

export interface RemixNavLinkProps extends NavLinkProps {
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

/**
 * A special kind of `<Link>` that knows whether or not it is "active".
 *
 * @see https://remix.run/components/nav-link
 */
let NavLink = React.forwardRef<HTMLAnchorElement, RemixNavLinkProps>(
  ({ to, prefetch = "none", ...props }, forwardedRef) => {
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
  ({ to, prefetch = "none", ...props }, forwardedRef) => {
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

let linksWarning =
  "⚠️ REMIX FUTURE CHANGE: The behavior of links `imagesizes` and `imagesrcset` will be changing in v2. " +
  "Only the React camel case versions will be valid. Please change to `imageSizes` and `imageSrcSet`. " +
  "For instructions on making this change see " +
  "https://remix.run/docs/en/v1.15.0/pages/v2#links-imagesizes-and-imagesrcset";

let useTransitionWarning =
  "⚠️ REMIX FUTURE CHANGE: `useTransition` will be removed in v2 in favor of `useNavigation`. " +
  "You can prepare for this change at your convenience by updating to `useNavigation`. " +
  "For instructions on making this change see " +
  "https://remix.run/docs/en/v1.15.0/pages/v2#usetransition";

let fetcherTypeWarning =
  "⚠️ REMIX FUTURE CHANGE: `fetcher.type` will be removed in v2. " +
  "Please use `fetcher.state`, `fetcher.formData`, and `fetcher.data` to achieve the same UX. " +
  "For instructions on making this change see " +
  "https://remix.run/docs/en/v1.15.0/pages/v2#usefetcher";

let fetcherSubmissionWarning =
  "⚠️ REMIX FUTURE CHANGE : `fetcher.submission` will be removed in v2. " +
  "The submission fields are now part of the fetcher object itself (`fetcher.formData`). " +
  "For instructions on making this change see " +
  "https://remix.run/docs/en/v1.15.0/pages/v2#usefetcher";

/**
 * Renders the `<link>` tags for the current routes.
 *
 * @see https://remix.run/components/links
 */
export function Links() {
  let { manifest, routeModules } = useRemixContext();
  let { errors, matches: routerMatches } = useDataRouterStateContext();

  let matches = errors
    ? routerMatches.slice(
        0,
        routerMatches.findIndex((m) => errors![m.route.id]) + 1
      )
    : routerMatches;

  let links = React.useMemo(
    () => getLinksForMatches(matches, routeModules, manifest),
    [matches, routeModules, manifest]
  );

  React.useEffect(() => {
    if (links.some((link) => "imagesizes" in link || "imagesrcset" in link)) {
      logDeprecationOnce(linksWarning);
    }
  }, [links]);

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
 * @see https://remix.run/components/prefetch-page-links
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
    [page, nextMatches, matches, manifest, location]
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
    [page, nextMatches, matches, manifest, location]
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
 * @see https://remix.run/components/meta
 */
function V1Meta() {
  let { routeModules } = useRemixContext();
  let {
    errors,
    matches: routerMatches,
    loaderData,
  } = useDataRouterStateContext();
  let location = useLocation();

  let matches = errors
    ? routerMatches.slice(
        0,
        routerMatches.findIndex((m) => errors![m.route.id]) + 1
      )
    : routerMatches;

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
          ? (routeModule.meta as V1_MetaFunction)({
              data,
              parentsData,
              params,
              location,
            })
          : routeModule.meta;
      if (routeMeta && Array.isArray(routeMeta)) {
        throw new Error(
          "The route at " +
            match.route.path +
            " returns an array. This is only supported with the `v2_meta` future flag " +
            "in the Remix config. Either set the flag to `true` or update the route's " +
            "meta function to return an object." +
            "\n\nTo reference the v1 meta function API, see https://remix.run/route/meta"
          // TODO: Add link to the docs once they are written
          // + "\n\nTo reference future flags and the v2 meta API, see https://remix.run/file-conventions/remix-config#future-v2-meta."
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
          return <meta key="charSet" charSet={value as string} />;
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
  let {
    errors,
    matches: routerMatches,
    loaderData,
  } = useDataRouterStateContext();
  let location = useLocation();

  let _matches = errors
    ? routerMatches.slice(
        0,
        routerMatches.findIndex((m) => errors![m.route.id]) + 1
      )
    : routerMatches;

  let meta: V2_MetaDescriptor[] = [];
  let leafMeta: V2_MetaDescriptor[] | null = null;
  let matches: V2_MetaMatches = [];
  for (let i = 0; i < _matches.length; i++) {
    let _match = _matches[i];
    let routeId = _match.route.id;
    let data = loaderData[routeId];
    let params = _match.params;
    let routeModule = routeModules[routeId];
    let routeMeta: V2_MetaDescriptor[] | V1_HtmlMetaDescriptor | undefined = [];

    let match: V2_MetaMatch = {
      id: routeId,
      data,
      meta: [],
      params: _match.params,
      pathname: _match.pathname,
      handle: _match.route.handle,
      // TODO: Remove in v2. Only leaving it for now because we used it in
      // examples and there's no reason to crash someone's build for one line.
      // They'll get a TS error from the type updates anyway.
      // @ts-expect-error
      get route() {
        console.warn(
          "The meta function in " +
            _match.route.path +
            " accesses the `route` property on `matches`. This is deprecated and will be removed in Remix version 2. See"
        );
        return _match.route;
      },
    };
    matches[i] = match;

    if (routeModule?.meta) {
      routeMeta =
        typeof routeModule.meta === "function"
          ? (routeModule.meta as V2_MetaFunction)({
              data,
              params,
              location,
              matches,
            })
          : Array.isArray(routeModule.meta)
          ? [...routeModule.meta]
          : routeModule.meta;
    } else if (leafMeta) {
      // We only assign the route's meta to the nearest leaf if there is no meta
      // export in the route. The meta function may return a falsey value which
      // is effectively the same as an empty array.
      routeMeta = [...leafMeta];
    }

    routeMeta = routeMeta || [];
    if (!Array.isArray(routeMeta)) {
      throw new Error(
        "The `v2_meta` API is enabled in the Remix config, but the route at " +
          _match.route.path +
          " returns an invalid value. In v2, all route meta functions must " +
          "return an array of meta objects." +
          // TODO: Add link to the docs once they are written
          // "\n\nTo reference future flags and the v2 meta API, see https://remix.run/file-conventions/remix-config#future-v2-meta." +
          "\n\nTo reference the v1 meta function API, see https://remix.run/route/meta"
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
          let tagName = metaProps.tagName;
          delete metaProps.tagName;
          if (!isValidMetaTag(tagName)) {
            console.warn(
              `A meta object uses an invalid tagName: ${tagName}. Expected either 'link' or 'meta'`
            );
            return null;
          }
          let Comp = tagName;
          return <Comp key={JSON.stringify(metaProps)} {...metaProps} />;
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
          let json: string | null = null;
          try {
            json = JSON.stringify(metaProps["script:ld+json"]);
          } catch (err) {}
          return (
            json != null && (
              <script
                key="script:ld+json"
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify(metaProps["script:ld+json"]),
                }}
              />
            )
          );
        }
        return <meta key={JSON.stringify(metaProps)} {...metaProps} />;
      })}
    </>
  );
}

function isValidMetaTag(tagName: unknown): tagName is "meta" | "link" {
  return typeof tagName === "string" && /^(meta|link)$/.test(tagName);
}

export function Meta() {
  let { future } = useRemixContext();
  return future?.v2_meta ? <V2Meta /> : <V1Meta />;
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
  let { manifest, serverHandoffString, abortDelay, serializeError } =
    useRemixContext();
  let { router, static: isStatic, staticContext } = useDataRouterContext();
  let { matches } = useDataRouterStateContext();
  let navigation = useNavigation();

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
    let contextScript = staticContext
      ? `window.__remixContext = ${serverHandoffString};`
      : " ";

    let activeDeferreds = staticContext?.activeDeferreds;
    // This sets up the __remixContext with utility functions used by the
    // deferred scripts.
    // - __remixContext.p is a function that takes a resolved value or error and returns a promise.
    //   This is used for transmitting pre-resolved promises from the server to the client.
    // - __remixContext.n is a function that takes a routeID and key to returns a promise for later
    //   resolution by the subsequently streamed chunks.
    // - __remixContext.r is a function that takes a routeID, key and value or error and resolves
    //   the promise created by __remixContext.n.
    // - __remixContext.t is a a map or routeId to keys to an object containing `e` and `r` methods
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
        }import ${JSON.stringify(manifest.url)};
${matches
  .map(
    (match, index) =>
      `import * as route${index} from ${JSON.stringify(
        manifest.routes[match.route.id].module
      )};`
  )
  .join("\n")}
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

  let preloads = isHydrated ? [] : manifest.entry.imports.concat(routePreloads);

  return isHydrated ? null : (
    <>
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

// TODO: Can this be re-exported from RR?
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
   * @see https://remix.run/file-conventions/routes-files#dynamic-route-parameters
   */
  params: Params<string>;
  /**
   * Any route data associated with the matched route
   */
  data: any;
  /**
   * The exported `handle` object of the matched route.
   *
   * @see https://remix.run/route/handle
   */
  handle: undefined | { [key: string]: any };
}

export function useMatches(): RouteMatch[] {
  let { routeModules } = useRemixContext();
  let matches = useMatchesRR();
  return React.useMemo(
    () =>
      matches.map((match) => {
        let remixMatch: RouteMatch = {
          id: match.id,
          pathname: match.pathname,
          params: match.params,
          data: match.data,
          // Need to grab handle here since we don't have it at client-side route
          // creation time
          handle: routeModules[match.id].handle,
        };
        return remixMatch;
      }),
    [matches, routeModules]
  );
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
 * Returns everything you need to know about a page transition to build pending
 * navigation indicators and optimistic UI on data mutations.
 *
 * @deprecated in favor of useNavigation
 *
 * @see https://remix.run/hooks/use-transition
 */
export function useTransition(): Transition {
  let navigation = useNavigation();

  React.useEffect(() => {
    logDeprecationOnce(useTransitionWarning);
  }, []);

  return React.useMemo(
    () => convertNavigationToTransition(navigation),
    [navigation]
  );
}

function convertNavigationToTransition(navigation: Navigation): Transition {
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
          key: "",
        },
        type: "actionSubmission",
      };
      return transition;
    } else {
      // @remix-run/router doesn't mark loader submissions as state: "submitting"
      invariant(
        false,
        "Encountered an unexpected navigation scenario in useTransition()"
      );
    }
  }

  if (state === "loading") {
    let { _isRedirect, _isFetchActionRedirect } = location.state || {};
    if (formMethod && formAction && formEncType && formData) {
      if (!_isRedirect) {
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
              key: "",
            },
            type: "actionReload",
          };
          return transition;
        } else {
          // The new router fixes a bug in useTransition where the submission
          // "action" represents the request URL not the state of the <form> in
          // the DOM.  Back-port it here to maintain behavior, but useNavigation
          // will fix this bug.
          let url = new URL(formAction, window.location.origin);

          // This typing override should be safe since this is only running for
          // GET submissions and over in @remix-run/router we have an invariant
          // if you have any non-string values in your FormData when we attempt
          // to convert them to URLSearchParams
          url.search = new URLSearchParams(
            formData.entries() as unknown as [string, string][]
          ).toString();

          // Actively "submitting" to a loader
          let transition: TransitionStates["SubmittingLoader"] = {
            location,
            state: "submitting",
            submission: {
              method: formMethod.toUpperCase() as LoaderSubmission["method"],
              action: url.pathname + url.search,
              encType: formEncType,
              formData: formData,
              key: "",
            },
            type: "loaderSubmission",
          };
          return transition;
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
              key: "",
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
                key: "",
              },
              type: "loaderSubmissionRedirect",
            };
          return transition;
        }
      }
    } else if (_isRedirect) {
      if (_isFetchActionRedirect) {
        let transition: TransitionStates["LoadingFetchActionRedirect"] = {
          location,
          state,
          submission: undefined,
          type: "fetchActionRedirect",
        };
        return transition;
      } else {
        let transition: TransitionStates["LoadingRedirect"] = {
          location,
          state,
          submission: undefined,
          type: "normalRedirect",
        };
        return transition;
      }
    }
  }

  // If no scenarios above match, then it's a normal load!
  let transition: TransitionStates["Loading"] = {
    location,
    state: "loading",
    submission: undefined,
    type: "normalLoad",
  };
  return transition;
}

/**
 * Provides all fetchers currently on the page. Useful for layouts and parent
 * routes that need to provide pending/optimistic UI regarding the fetch.
 *
 * @see https://remix.run/api/remix#usefetchers
 */
export function useFetchers(): Fetcher[] {
  let fetchers = useFetchersRR();
  return fetchers.map((f) => {
    let fetcher = convertRouterFetcherToRemixFetcher({
      state: f.state,
      data: f.data,
      formMethod: f.formMethod,
      formAction: f.formAction,
      formEncType: f.formEncType,
      formData: f.formData,
      json: f.json,
      text: f.text,
      " _hasFetcherDoneAnything ": f[" _hasFetcherDoneAnything "],
    });
    addFetcherDeprecationWarnings(fetcher);
    return fetcher;
  });
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
 * @see https://remix.run/hooks/use-fetcher
 */
export function useFetcher<TData = any>(): FetcherWithComponents<
  SerializeFrom<TData>
> {
  let fetcherRR = useFetcherRR();

  return React.useMemo(() => {
    let remixFetcher = convertRouterFetcherToRemixFetcher({
      state: fetcherRR.state,
      data: fetcherRR.data,
      formMethod: fetcherRR.formMethod,
      formAction: fetcherRR.formAction,
      formEncType: fetcherRR.formEncType,
      formData: fetcherRR.formData,
      json: fetcherRR.json,
      text: fetcherRR.text,
      " _hasFetcherDoneAnything ": fetcherRR[" _hasFetcherDoneAnything "],
    });
    let fetcherWithComponents = {
      ...remixFetcher,
      load: fetcherRR.load,
      submit: fetcherRR.submit,
      Form: fetcherRR.Form,
    };
    addFetcherDeprecationWarnings(fetcherWithComponents);
    return fetcherWithComponents;
  }, [fetcherRR]);
}

function addFetcherDeprecationWarnings(fetcher: Fetcher) {
  let type: Fetcher["type"] = fetcher.type;
  Object.defineProperty(fetcher, "type", {
    get() {
      logDeprecationOnce(fetcherTypeWarning);
      return type;
    },
    set(value: Fetcher["type"]) {
      // Devs should *not* be doing this but we don't want to break their
      // current app if they are
      type = value;
    },
    // These settings should make this behave like a normal object `type` field
    configurable: true,
    enumerable: true,
  });

  let submission: Fetcher["submission"] = fetcher.submission;
  Object.defineProperty(fetcher, "submission", {
    get() {
      logDeprecationOnce(fetcherSubmissionWarning);
      return submission;
    },
    set(value: Fetcher["submission"]) {
      // Devs should *not* be doing this but we don't want to break their
      // current app if they are
      submission = value;
    },
    // These settings should make this behave like a normal object `type` field
    configurable: true,
    enumerable: true,
  });
}

function convertRouterFetcherToRemixFetcher(
  fetcherRR: Omit<ReturnType<typeof useFetcherRR>, "load" | "submit" | "Form">
): Fetcher {
  let {
    state,
    formMethod,
    formAction,
    formEncType,
    formData,
    json,
    text,
    data,
  } = fetcherRR;

  let isActionSubmission =
    formMethod != null &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(formMethod.toUpperCase());

  if (state === "idle") {
    if (fetcherRR[" _hasFetcherDoneAnything "] === true) {
      let fetcher: FetcherStates["Done"] = {
        state: "idle",
        type: "done",
        formMethod: undefined,
        formAction: undefined,
        formEncType: undefined,
        formData: undefined,
        json: undefined,
        text: undefined,
        submission: undefined,
        data,
      };
      return fetcher;
    } else {
      let fetcher: FetcherStates["Idle"] = IDLE_FETCHER;
      return fetcher;
    }
  }

  if (
    state === "submitting" &&
    formMethod &&
    formAction &&
    formEncType &&
    (formData || json !== undefined || text !== undefined)
  ) {
    if (isActionSubmission) {
      // Actively submitting to an action
      let fetcher: FetcherStates["SubmittingAction"] = {
        state,
        type: "actionSubmission",
        formMethod: formMethod.toUpperCase() as ActionSubmission["method"],
        formAction,
        formEncType,
        formData,
        json,
        text,
        // @ts-expect-error formData/json/text are mutually exclusive in the type,
        // so TS can't be sure these meet that criteria, but as a straight
        // assignment from the RR fetcher we know they will
        submission: {
          method: formMethod.toUpperCase() as ActionSubmission["method"],
          action: formAction,
          encType: formEncType,
          formData,
          json,
          text,
          key: "",
        },
        data,
      };
      return fetcher;
    } else {
      // @remix-run/router doesn't mark loader submissions as state: "submitting"
      invariant(
        false,
        "Encountered an unexpected fetcher scenario in useFetcher()"
      );
    }
  }

  if (state === "loading") {
    if (formMethod && formAction && formEncType) {
      if (isActionSubmission) {
        if (data) {
          // In a loading state but we have data - must be an actionReload
          let fetcher: FetcherStates["ReloadingAction"] = {
            state,
            type: "actionReload",
            formMethod: formMethod.toUpperCase() as ActionSubmission["method"],
            formAction,
            formEncType,
            formData,
            json,
            text,
            // @ts-expect-error formData/json/text are mutually exclusive in the type,
            // so TS can't be sure these meet that criteria, but as a straight
            // assignment from the RR fetcher we know they will
            submission: {
              method: formMethod.toUpperCase() as ActionSubmission["method"],
              action: formAction,
              encType: formEncType,
              formData,
              json,
              text,
              key: "",
            },
            data,
          };
          return fetcher;
        } else {
          let fetcher: FetcherStates["LoadingActionRedirect"] = {
            state,
            type: "actionRedirect",
            formMethod: formMethod.toUpperCase() as ActionSubmission["method"],
            formAction,
            formEncType,
            formData,
            json,
            text,
            // @ts-expect-error formData/json/text are mutually exclusive in the type,
            // so TS can't be sure these meet that criteria, but as a straight
            // assignment from the RR fetcher we know they will
            submission: {
              method: formMethod.toUpperCase() as ActionSubmission["method"],
              action: formAction,
              encType: formEncType,
              formData,
              json,
              text,
              key: "",
            },
            data: undefined,
          };
          return fetcher;
        }
      } else {
        // The new router fixes a bug in useTransition where the submission
        // "action" represents the request URL not the state of the <form> in
        // the DOM.  Back-port it here to maintain behavior, but useNavigation
        // will fix this bug.
        let url = new URL(formAction, window.location.origin);

        if (formData) {
          // This typing override should be safe since this is only running for
          // GET submissions and over in @remix-run/router we have an invariant
          // if you have any non-string values in your FormData when we attempt
          // to convert them to URLSearchParams
          url.search = new URLSearchParams(
            formData.entries() as unknown as [string, string][]
          ).toString();
        }

        // Actively "submitting" to a loader
        let fetcher: FetcherStates["SubmittingLoader"] = {
          state: "submitting",
          type: "loaderSubmission",
          formMethod: formMethod.toUpperCase() as LoaderSubmission["method"],
          formAction,
          formEncType,
          formData,
          json,
          text,
          // @ts-expect-error formData/json/text are mutually exclusive in the type,
          // so TS can't be sure these meet that criteria, but as a straight
          // assignment from the RR fetcher we know they will
          submission: {
            method: formMethod.toUpperCase() as LoaderSubmission["method"],
            action: url.pathname + url.search,
            encType: formEncType,
            formData,
            json,
            text,
            key: "",
          },
          data,
        };
        return fetcher;
      }
    }
  }

  // If all else fails, it's a normal load!
  let fetcher: FetcherStates["Loading"] = {
    state: "loading",
    type: "normalLoad",
    formMethod: undefined,
    formAction: undefined,
    formData: undefined,
    json: undefined,
    text: undefined,
    formEncType: undefined,
    submission: undefined,
    data,
  };
  return fetcher;
}

// Dead Code Elimination magic for production builds.
// This way devs don't have to worry about doing the NODE_ENV check themselves.
// If running an un-bundled server outside of `remix dev` you will still need
// to set the REMIX_DEV_SERVER_WS_PORT manually.
export const LiveReload =
  process.env.NODE_ENV !== "development"
    ? () => null
    : function LiveReload({
        port,
        timeoutMs = 1000,
        nonce = undefined,
      }: {
        port?: number;
        timeoutMs?: number;
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
                  let REMIX_DEV_ORIGIN = ${JSON.stringify(
                    process.env.REMIX_DEV_ORIGIN
                  )};
                  let protocol =
                    REMIX_DEV_ORIGIN ? new URL(REMIX_DEV_ORIGIN).protocol.replace(/^http/, "ws") :
                    location.protocol === "https:" ? "wss:" : "ws:"; // remove in v2?
                  let hostname = location.hostname;
                  let url = new URL(protocol + "//" + hostname + "/socket");

                  url.port =
                    ${port} ||
                    REMIX_DEV_ORIGIN ? new URL(REMIX_DEV_ORIGIN).port :
                    Number(${
                      // TODO: remove in v2
                      process.env.REMIX_DEV_SERVER_WS_PORT
                    }) ||
                    8002;

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
                            console.log("[HMR] Updated accepted by", update.id);
                            updateAccepted = true;
                          }
                        }
                      }
                      if (event.assetsManifest && window.__hmr__.contexts["remix:manifest"]) {
                        let accepted = window.__hmr__.contexts["remix:manifest"].emit(
                          { needsRevalidation, assetsManifest: event.assetsManifest }
                        );
                        if (accepted) {
                          console.log("[HMR] Updated accepted by", "remix:manifest");
                          updateAccepted = true;
                        }
                      }
                      if (!updateAccepted) {
                        console.log("[HMR] Updated rejected, reloading...");
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
