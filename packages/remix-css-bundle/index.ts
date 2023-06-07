declare const __INJECT_CSS_BUNDLE_HREF__: string | undefined;

// Injected by `cssBundlePlugin`
let cssBundleHref: string | undefined =
  typeof __INJECT_CSS_BUNDLE_HREF__ === "string"
    ? __INJECT_CSS_BUNDLE_HREF__
    : undefined;

export { cssBundleHref };
