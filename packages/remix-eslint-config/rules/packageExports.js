const defaultAdapterExports = {
  value: ["createRequestHandler"],
  type: ["GetLoadContextFunction", "RequestHandler"],
};

const defaultRuntimeExports = {
  value: [
    "createCookie",
    "createCookieSessionStorage",
    "createMemorySessionStorage",
    "createSessionStorage",
    "createRequestHandler",
    "createSession",
    "isCookie",
    "isSession",
    "json",
    "redirect",
    "unstable_composeUploadHandlers",
    "unstable_createMemoryUploadHandler",
    "unstable_parseMultipartFormData",
  ],
  type: [
    "ActionFunction",
    "AppData",
    "AppLoadContext",
    "CreateRequestHandlerFunction",
    "Cookie",
    "CookieOptions",
    "CookieParseOptions",
    "CookieSerializeOptions",
    "CookieSignatureOptions",
    "DataFunctionArgs",
    "EntryContext",
    "ErrorBoundaryComponent",
    "HandleDataRequestFunction",
    "HandleDocumentRequestFunction",
    "HeadersFunction",
    "HtmlLinkDescriptor",
    "HtmlMetaDescriptor",
    "LinkDescriptor",
    "LinksFunction",
    "LoaderFunction",
    "MetaDescriptor",
    "MetaFunction",
    "PageLinkDescriptor",
    "RequestHandler",
    "RouteComponent",
    "RouteHandle",
    "ServerBuild",
    "ServerEntryModule",
    "Session",
    "SessionData",
    "SessionIdStorageStrategy",
    "SessionStorage",
  ],
};

const architectSpecificExports = {
  value: ["createArcTableSessionStorage"],
  type: [],
};

const cloudflareSpecificExports = {
  value: ["createCloudflareKVSessionStorage"],
  type: [],
};

const cloudflarePagesSpecificExports = {
  value: ["createPagesFunctionHandler"],
  type: ["createPagesFunctionHandlerParams"],
};

const cloudflareWorkersSpecificExports = {
  value: ["createEventHandler", "handleAsset"],
  type: [],
};

const nodeSpecificExports = {
  value: [
    "AbortController",
    "createFileSessionStorage",
    "fetch",
    "FormData",
    "Headers",
    "NodeOnDiskFile",
    "Request",
    "Response",
    "unstable_createFileUploadHandler",
  ],
  type: [
    "HeadersInit",
    "RequestInfo",
    "RequestInit",
    "ResponseInit",
    "UploadHandler",
    "UploadHandlerArgs",
  ],
};

const reactSpecificExports = {
  value: [
    "Form",
    "Link",
    "Links",
    "LiveReload",
    "Meta",
    "NavLink",
    "Outlet",
    "PrefetchPageLinks",
    "RemixBrowser",
    "RemixServer",
    "Scripts",
    "ScrollRestoration",
    "useActionData",
    "useBeforeUnload",
    "useCatch",
    "useFetcher",
    "useFetchers",
    "useFormAction",
    "useHref",
    "useLoaderData",
    "useLocation",
    "useMatches",
    "useNavigate",
    "useNavigationType",
    "useOutlet",
    "useOutletContext",
    "useParams",
    "useResolvedPath",
    "useSearchParams",
    "useSubmit",
    "useTransition",
  ],
  type: [
    "FormEncType",
    "FormMethod",
    "FormProps",
    "HtmlLinkDescriptor",
    "HtmlMetaDescriptor",
    "LinkProps",
    "NavLinkProps",
    "RemixBrowserProps",
    "RemixServerProps",
    "ShouldReloadFunction",
    "SubmitFunction",
    "SubmitOptions",
    "ThrownResponse",
  ],
};

module.exports = {
  defaultAdapterExports,
  defaultRuntimeExports,
  architectSpecificExports,
  cloudflareSpecificExports,
  cloudflarePagesSpecificExports,
  cloudflareWorkersSpecificExports,
  nodeSpecificExports,
  reactSpecificExports,
};
