Q: who should be in charge of writing the assets manifest to disk? browser? server? build?
PC: I _think_ browser, since its written to `/public/build/`


channel -> [promise, resolve]

# compiler-kit

```ts
type Build = (remixConfig: RemixConfig, compiler: RemixCompiler) => Promise<void>

type Watch = (remixConfig: RemixConfig, createCompiler: {
  options: Options,
  browser: CreateCompiler<BrowserCompiler>,
  server: CreateCompiler<ServerCompiler>,
}) => Promise<void>
```

notes:
- we want `compiler` as a param for `build` so that we can reuse compilers
  - alternative would be for `build` to internally create a `RemixCompiler`... then we could't reuse compiler across builds.

# compiler-<implementation>

```ts
type CreateBrowserCompiler = (remixConfig: RemixConfig, options: Options) => BrowserCompiler
type CreateServerCompiler = (remixConfig: RemixConfig, options: Options) => ServerCompiler
```

# dev-server

```ts
type Serve = (
  config: RemixConfig,
  createCompiler: {
    options: Options;
    browser: CreateCompiler<BrowserCompiler>;
    server: CreateCompiler<ServerCompiler>;
  },
  port?: number
) => Promise<void>
```

# Open questions

Q1: who should be in charge of writing the assets manifest to disk? browser? server? build?
PC: I _think_ browser, since its written to `/public/build/`


Q2: channel -> [promise, resolve]?