// This file lists all exports from this package that are available to `import
// "remix"`. We need to name all exports individually so esbuild is able to
// remove the ones we don't need in the browser builds.

export type {
  RemixBrowserProps,
  FormProps,
  SubmitOptions,
  SubmitFunction,
  FormMethod,
  FormEncType,
  RemixServerProps,
  ShouldReloadFunction,
  ThrownResponse,
  LinkProps,
  NavLinkProps
} from "@remix-run/react";

export {
  RemixBrowser,
  Meta,
  Links,
  Scripts,
  Link,
  NavLink,
  Form,
  PrefetchPageLinks,
  ScrollRestoration,
  LiveReload,
  useFormAction,
  useSubmit,
  useTransition,
  useFetcher,
  useFetchers,
  useCatch,
  useLoaderData,
  useActionData,
  useBeforeUnload,
  useMatches,
  RemixServer
} from "@remix-run/react";

// react-router-dom exports
export {
  Outlet,
  useHref,
  useLocation,
  useNavigate,
  useNavigationType,
  useOutlet,
  useParams,
  useResolvedPath,
  useSearchParams
} from "@remix-run/react";
