import type {
  FormProps as RRFormProps,
  Location as RRLocation,
  NavigateFunction as RRNavigateFunction,
  Path as RRPath,
  ShouldRevalidateFunction as RRShouldRevalidateFunction,
  SubmitFunction as RRSubmitFunction,
  SubmitOptions as RRSubmitOptions,
} from "react-router-dom";

export type { RemixBrowserProps } from "./browser";
export { RemixBrowser } from "./browser";
export type {
  ErrorResponse,
  Fetcher,
  FetcherWithComponents,
  FormEncType,
  FormMethod,
  Navigation,
  Params,
  unstable_Blocker,
  unstable_BlockerFunction,
} from "react-router-dom";
export type FormProps = RRFormProps;
export type Location = RRLocation;
export type NavigateFunction = RRNavigateFunction;
export type Path = RRPath;
export type ShouldRevalidateFunction = RRShouldRevalidateFunction;
export type SubmitFunction = RRSubmitFunction;
export type SubmitOptions = RRSubmitOptions;
export {
  createPath,
  generatePath,
  matchPath,
  matchRoutes,
  parsePath,
  resolvePath,
  Form,
  Outlet,
  useAsyncError,
  useAsyncValue,
  isRouteErrorResponse,
  useBeforeUnload,
  useFetchers,
  useFormAction,
  useHref,
  useLocation,
  useMatch,
  useMatches,
  useNavigate,
  useNavigation,
  useNavigationType,
  useOutlet,
  useOutletContext,
  useParams,
  useResolvedPath,
  useRevalidator,
  useRouteError,
  useSearchParams,
  useSubmit,
  unstable_useBlocker,
  unstable_usePrompt,
} from "react-router-dom";

export type {
  AwaitProps,
  RouteMatch,
  RemixNavLinkProps as NavLinkProps,
  RemixLinkProps as LinkProps,
} from "./components";
export {
  Await,
  Meta,
  Links,
  Scripts,
  Link,
  NavLink,
  PrefetchPageLinks,
  LiveReload,
  useFetcher,
  useLoaderData,
  useRouteLoaderData,
  useActionData,
  RemixContext as UNSAFE_RemixContext,
} from "./components";

export type { HtmlLinkDescriptor } from "./links";
export type {
  MetaArgs,
  MetaDescriptor,
  MetaFunction,
  RouteModules as UNSAFE_RouteModules,
} from "./routeModules";

export { ScrollRestoration } from "./scroll-restoration";

export type { RemixServerProps } from "./server";
export { RemixServer } from "./server";

export type {
  FutureConfig as UNSAFE_FutureConfig,
  AssetsManifest as UNSAFE_AssetsManifest,
  RemixContextObject as UNSAFE_RemixContextObject,
} from "./entry";

export type {
  EntryRoute as UNSAFE_EntryRoute,
  RouteManifest as UNSAFE_RouteManifest,
} from "./routes";
