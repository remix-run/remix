import * as path from "path";

import type { Context } from "./context";
import * as CSS from "./css";
import * as JS from "./js";
import * as Server from "./server";
import type { Channel } from "../channel";
import { createChannel } from "../channel";
import type { Manifest } from "../manifest";
import { create as createManifest, write as writeManifest } from "./manifest";

type Compiler = {
  compile: () => Promise<Manifest>;
  cancel: () => Promise<void>;
  dispose: () => Promise<void>;
};

export let create = async (ctx: Context): Promise<Compiler> => {
  // channels _should_ be scoped to a build, not a compiler
  // but esbuild doesn't have an API for passing build-specific arguments for rebuilds
  // so instead use a mutable reference (`channels`) that is compiler-scoped
  // and gets reset on each build
  let channels = {
    cssBundleHref: undefined as unknown as Channel<string | undefined>,
    manifest: undefined as unknown as Channel<Manifest>,
  };

  let subcompiler = {
    css: await CSS.createCompiler(ctx),
    js: await JS.createCompiler(ctx, channels),
    server: await Server.createCompiler(ctx, channels),
  };

  let compile = async () => {
    // reset channels
    channels.cssBundleHref = createChannel();
    channels.manifest = createChannel();

    // kickoff compilations in parallel
    let tasks = {
      css: subcompiler.css.compile(),
      js: subcompiler.js.compile(),
      server: subcompiler.server.compile(),
    };

    // keep track of manually written artifacts
    let writes: {
      cssBundle?: Promise<void>;
      manifest?: Promise<void>;
      server?: Promise<void>;
    } = {};

    // css compilation
    let css = await tasks.css.catch((error) => {
      subcompiler.js.cancel();
      subcompiler.server.cancel();
      throw error;
    });

    // css bundle
    let cssBundleHref =
      css.bundle &&
      ctx.config.publicPath +
        path.relative(
          ctx.config.assetsBuildDirectory,
          path.resolve(css.bundle.path)
        );
    channels.cssBundleHref.write(cssBundleHref);
    if (css.bundle) {
      writes.cssBundle = CSS.writeBundle(ctx, css.outputFiles);
    }

    // js compilation (implicitly writes artifacts/js)
    // TODO: js task should not return metafile, but rather js assets
    let { metafile, hmr } = await tasks.js.catch((error) => {
      subcompiler.server.cancel();
      throw error;
    });

    // artifacts/manifest
    let manifest = await createManifest({
      config: ctx.config,
      cssBundleHref,
      metafile,
      hmr,
    });
    channels.manifest.write(manifest);
    writes.manifest = writeManifest(ctx.config, manifest);

    // server compilation
    let serverFiles = await tasks.server;
    // artifacts/server
    writes.server = Server.write(ctx.config, serverFiles);

    await Promise.all(Object.values(writes));
    return manifest;
  };
  return {
    compile,
    cancel: async () => {
      await Promise.all(Object.values(subcompiler).map((sub) => sub.cancel()));
    },
    dispose: async () => {
      await Promise.all(Object.values(subcompiler).map((sub) => sub.dispose()));
    },
  };
};
