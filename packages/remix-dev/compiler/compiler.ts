import * as path from "node:path";

import type { Context } from "./context";
import * as CSS from "./css";
import * as JS from "./js";
import * as Server from "./server";
import * as Channel from "../channel";
import type { Manifest } from "../manifest";
import { create as createManifest, write as writeManifest } from "./manifest";
import type { LazyValue } from "./lazyValue";
import { createLazyValue } from "./lazyValue";
import { err, ok } from "../result";
import { Cancel } from "./cancel";

type Compiler = {
  compile: (options?: {
    onManifest?: (manifest: Manifest) => void;
  }) => Promise<Manifest>;
  cancel: () => Promise<void>;
  dispose: () => Promise<void>;
};

export let create = async (ctx: Context): Promise<Compiler> => {
  // these variables _should_ be scoped to a build, not a compiler
  // but esbuild doesn't have an API for passing build-specific arguments for rebuilds
  // so instead use a mutable reference (`refs`) that is compiler-scoped
  // and gets reset on each build
  let refs = {
    lazyCssBundleHref: undefined as unknown as LazyValue<string | undefined>,
    manifestChannel: undefined as unknown as Channel.Type<Manifest>,
  };

  let serverBundles = Array.isArray(ctx.config.serverBundles)
    ? ctx.config.serverBundles
    : [
        {
          serverBuildPath: ctx.config.serverBuildPath,
          routes: ctx.config.routes,
        },
      ];

  let subcompiler = {
    css: await CSS.createCompiler(ctx),
    js: await JS.createCompiler(ctx, refs),
    serverBundles: await Promise.all(
      serverBundles.map(({ routes, serverBuildPath }) =>
        Server.createCompiler(ctx, routes, serverBuildPath, refs)
      )
    ),
  };
  let cancel = async () => {
    // resolve channels with error so that downstream tasks don't hang waiting for results from upstream tasks
    refs.lazyCssBundleHref.cancel();
    refs.manifestChannel.err();

    // optimization: cancel tasks
    await Promise.all([
      subcompiler.css.cancel(),
      subcompiler.js.cancel(),
      ...subcompiler.serverBundles.map((server) => server.cancel()),
    ]);
  };

  let compile = async (
    options: { onManifest?: (manifest: Manifest) => void } = {}
  ) => {
    let error: unknown | undefined = undefined;
    let errCancel = (thrown: unknown) => {
      if (error === undefined) {
        error = thrown;
      }
      cancel();
      return err(thrown);
    };

    // keep track of manually written artifacts
    let writes: Promise<void>[] = [];

    // reset refs for this compilation
    refs.manifestChannel = Channel.create();
    refs.lazyCssBundleHref = createLazyValue({
      async get() {
        let { bundleOutputFile, outputFiles } = await subcompiler.css.compile();

        if (bundleOutputFile) {
          writes.push(CSS.writeBundle(ctx, outputFiles));
        }

        return (
          bundleOutputFile &&
          ctx.config.publicPath +
            path.relative(
              ctx.config.assetsBuildDirectory,
              path.resolve(bundleOutputFile.path)
            )
        );
      },
      onCancel: ({ reject }) => {
        reject(new Cancel("css-bundle"));
      },
    });

    // kickoff compilations in parallel
    let tasks = {
      js: subcompiler.js.compile().then(ok, errCancel),
      serverBundles: subcompiler.serverBundles.map((server) =>
        server.compile().then(ok, errCancel)
      ),
    };

    // js compilation (implicitly writes artifacts/js)
    let js = await tasks.js;
    if (!js.ok) throw error ?? js.error;
    let { metafile, hmr } = js.value;

    // artifacts/manifest
    let manifest = await createManifest({
      config: ctx.config,
      metafile,
      hmr,
      fileWatchCache: ctx.fileWatchCache,
    });
    refs.manifestChannel.ok(manifest);
    options.onManifest?.(manifest);
    writes.push(writeManifest(ctx.config, manifest));

    // server compilation
    await Promise.all(
      tasks.serverBundles.map(async (promise, i) => {
        let server = await promise;
        if (!server.ok) throw error ?? server.error;
        // artifacts/server
        let { serverBuildPath } = serverBundles[i];
        writes.push(Server.write(ctx.config, serverBuildPath, server.value));
      })
    );

    await Promise.all(writes);
    return manifest;
  };
  return {
    compile,
    cancel,
    dispose: async () => {
      await Promise.all([
        subcompiler.css.dispose(),
        subcompiler.js.dispose(),
        ...subcompiler.serverBundles.map((server) => server.dispose()),
      ]);
    },
  };
};
