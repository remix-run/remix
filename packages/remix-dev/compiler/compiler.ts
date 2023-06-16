import * as path from "path";
import prettyMs from "pretty-ms";
import pc from "picocolors";

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

let time = async <T>(ctx: Context, tag: string, callback: () => Promise<T>) => {
  let begin = performance.now();
  let result = await callback();
  let end = performance.now();
  if (ctx.options.perfDebug) {
    ctx.logger.debug(tag + pc.gray(` (${prettyMs(end - begin)})`));
  }
  return result;
};

let task = <T>(ctx: Context, tag: string, callback: () => Promise<T>) => {
  let result: Promise<T> | undefined = undefined;
  let start = () => {
    result = callback();
  };
  return {
    start,
    wait: async () =>
      time(ctx, tag, () => {
        if (result === undefined) start();
        return result!;
      }),
  };
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

  let subcompiler = {
    css: await CSS.createCompiler(ctx),
    js: await JS.createCompiler(ctx, refs),
    server: await Server.createCompiler(ctx, refs),
  };
  let cancel = async () => {
    // resolve channels with error so that downstream tasks don't hang waiting for results from upstream tasks
    refs.lazyCssBundleHref.cancel();
    refs.manifestChannel.err();

    // optimization: cancel tasks
    await Promise.all([
      subcompiler.css.cancel(),
      subcompiler.js.cancel(),
      subcompiler.server.cancel(),
    ]);
  };

  let compile = async (
    options: { onManifest?: (manifest: Manifest) => void } = {}
  ) => {
    if (ctx.options.perfDebug) {
      ctx.logger.warn(
        "running compiler serially, not in parallel" +
          pc.gray(" (--perf-debug)"),
        {
          details: [
            "Normally, subcompilations are run in parallel for speed.",
            "But execution can be interwoven so start/stop times won't be reliable.",
            "For perf debugging, subcompilations are run in series instead.",
            "That way, each subcompilation is independently measurable.",
          ],
        }
      );
    }

    let error: unknown | undefined = undefined;
    let errCancel = (thrown: unknown) => {
      if (error === undefined) {
        error = thrown;
      }
      cancel();
      return err(thrown);
    };

    // keep track of manually written artifacts
    let writes: {
      cssBundle?: Promise<void>;
      manifest?: Promise<void>;
      server?: Promise<void>;
    } = {};

    // reset refs for this compilation
    refs.manifestChannel = Channel.create();
    refs.lazyCssBundleHref = createLazyValue({
      async get() {
        let { bundleOutputFile, outputFiles } = await time(
          ctx,
          "css",
          subcompiler.css.compile
        );

        if (bundleOutputFile) {
          writes.cssBundle = CSS.writeBundle(ctx, outputFiles);
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

    if (ctx.options.perfDebug) {
      await refs.lazyCssBundleHref.get();
    }

    // kickoff compilations in parallel
    let tasks = {
      js: task(ctx, "js", () => subcompiler.js.compile().then(ok, errCancel)),
      server: task(ctx, "server", () =>
        subcompiler.server.compile().then(ok, errCancel)
      ),
    };

    if (!ctx.options.perfDebug) {
      tasks.js.start();
      tasks.server.start();
    }

    // js compilation (implicitly writes artifacts/js)
    let js = await tasks.js.wait();
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
    writes.manifest = writeManifest(ctx.config, manifest);

    // server compilation
    let server = await tasks.server.wait();
    if (!server.ok) throw error ?? server.error;
    // artifacts/server
    writes.server = Server.write(ctx.config, server.value);

    await Promise.all(Object.values(writes));
    return manifest;
  };
  return {
    compile,
    cancel,
    dispose: async () => {
      await Promise.all(Object.values(subcompiler).map((sub) => sub.dispose()));
    },
  };
};
