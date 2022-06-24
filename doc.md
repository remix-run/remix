# Bring your own Remix compiler (BYORC)

To run a Remix server, we need three things:
1. A server build exporting the necessary data to make a Remix request handler
2. A public directory with everything needed to run each route in the browser
3. An assets manifest describing the client entry and routes so that client-side transitions can emulate SSR

## Route

```ts
interface Route {
  /** The path this route uses to match on the URL pathname. */
  path?: string;

  /** Should be `true` if it is an index route. This disallows child routes. */
  index?: boolean;

  /** Should be `true` if the `path` is case-sensitive. Defaults to `false`. */
  caseSensitive?: boolean;

  /**
   * The unique id for this route, named like its `file` but without the
   * extension. For example, `app/routes/gists/$username.jsx` will have an `id` of
   * `routes/gists/$username`.
   */
  id: string;

  /** The unique `id` for this route's parent route, if there is one. */
  parentId?: string;
}
```

## Server build

```ts
interface ServerBuild {
  entry: {
    module: {
      /** Handle document requests aka do the nested routing thing and hydrate */
      default: HandleDocumentRequestFunction;
      handleDataRequest?: HandleDataRequestFunction;
    };
  };
  routes: Record<string, Route & { module: string }>;
  assets: AssetsManifest;
}
```

TODO: Seems like assets manifest is redundant as all the same information is already represented in `entry` and `routes`. Can we remove assets manifest from server build?

## Public directory
- static assets: favicon, images, fonts, etc...
- css
- js (optionally chunked)

## Assets manifest

```ts
interface AssetsManifest {
  /** Hash of the entry and routes described by this manifest. */
  version: string;

  // TODO: rename `url` to `path` or similar
  /** Absolute URL path for this manifest. */
  url: string;

  /** Metadata about the client entry file. */
  entry: {
    /** Absolute URL path to client entry file. */
    module: string;

    /** Absolute URL paths for client entry imports (i.e. chunks imported by the client entry module). */
    imports: string[];
  };

  /** Flattened map from route ID to route metadata */
  routes: {
    // Omit `file` since asset manifest cares about the location of the built module, not the location of the source module.
    [routeId: string]: Omit<Route, "file"> & {

      /** Absolute URL path to the module for this route. */
      module: string;

      /**
       * A list of absolute URL paths for modules imported by this route.
       * Used by the server to know which chunks to fetch for this route.
       */
      imports?: string[];

      /** Should be `true` if this route exports a action. */
      hasAction: boolean;

      /** Should be `true` if this route exports a loader. */
      hasLoader: boolean;

      /** Should be `true` if this route exports a catch boundary. */
      hasCatchBoundary: boolean;

      /** Should be `true` if this route exports an error boundary. */
      hasErrorBoundary: boolean;
    };
  };
}
```