// TODO: Does this belong here or in @remix-run/data?
export type {
  RouteComponent,
  ErrorBoundaryComponent,
  HeadersFunction,
  MetaFunction,
  LinksFunction,
  LoaderFunction,
  ActionFunction,
  // shorthand
  LoaderFunction as Loader,
  ActionFunction as Action
} from "@remix-run/node";

export type {
  LinkDescriptor,
  HTMLLinkDescriptor,
  BlockLinkDescriptor,
  PageLinkDescriptor
} from "@remix-run/node";

export type { FormProps, SubmitOptions, SubmitFunction } from "./components";
export {
  Meta,
  Links,
  Scripts,
  Link,
  Form,
  useFormAction,
  useSubmit,
  usePendingFormSubmit,
  useRouteData,
  usePendingLocation,
  useBeforeUnload,
  useMatches
} from "./components";

export type { FormMethod, FormEncType, FormSubmit } from "./data";

export { block } from "./links";
