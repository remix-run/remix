const defaultAdapterExports = {
  value: ["createRequestHandler"],
  type: ["GetLoadContextFunction", "RequestHandler"],
};

const defaultRuntimeExports = {
  value: [
    "createCookie",
    "createCookieSessionStorage",
    "createMemorySessionStorage",
    "createRequestHandler",
    "createSession",
    "createSessionStorage",
    "isCookie",
    "isSession",
    "json",
    "MaxPartSizeExceededError",
    "redirect",
    "unstable_composeUploadHandlers",
    "unstable_createMemoryUploadHandler",
    "unstable_parseMultipartFormData",
  ],
  type: [
    "ActionFunction",
    "AppData",
    "AppLoadContext",
    "Cookie",
    "CookieOptions",
    "CookieParseOptions",
    "CookieSerializeOptions",
    "CookieSignatureOptions",
    "CreateRequestHandlerFunction",
    "DataFunctionArgs",
    "EntryContext",
    "ErrorBoundaryComponent",
    "HandleDataRequestFunction",
    "HandleDocumentRequestFunction",
    "HeadersArgs",
    "HeadersFunction",
    "HtmlLinkDescriptor",
    "HtmlMetaDescriptor",
    "LinkDescriptor",
    "LinksFunction",
    "LoaderFunction",
    "MemoryUploadHandlerFilterArgs",
    "MemoryUploadHandlerOptions",
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
    "UploadHandler",
    "UploadHandlerPart",
  ],
};

const architectSpecificExports = {
  value: ["createArcTableSessionStorage"],
  type: [],
};

const cloudflareSpecificExports = {
  value: ["createCloudflareKVSessionStorage", "createWorkersKVSessionStorage"],
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
    "createReadableStreamFromReadable",
    "fetch",
    "FormData",
    "Headers",
    "installGlobals",
    "NodeOnDiskFile",
    "readableStreamToString",
    "Request",
    "Response",
    "unstable_createFileUploadHandler",
    "writeAsyncIterableToWritable",
    "writeReadableStreamToWritable",
  ],
  type: ["HeadersInit", "RequestInfo", "RequestInit", "ResponseInit"],
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
