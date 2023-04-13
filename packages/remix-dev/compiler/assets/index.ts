import fse from "fs-extra";

import * as Channel from "../utils/channel";
import type { Result } from "../utils/result";
import { ok, err } from "../utils/result";
import type { Manifest } from "../../manifest";
import type { Context } from "../context";
import * as CssCompiler from "./css";
import * as JsCompiler from "./js";
import {
  create as createManifest,
  write as writeManifestFile,
} from "./manifest";

type Err = { css?: unknown; js?: unknown };

type Compiler = {
  compile: () => Promise<Result<Manifest, Err>>;
  dispose: () => Promise<void>;
};

export let create = async (
  ctx: Context,
  channels: { manifest: Channel.WriteRead<Manifest> }
): Promise<Compiler> => {
  // setup channels
  let _channels = {
    cssBundleHref: Channel.create<string | undefined>(),
  };

  // create subcompilers
  let compiler = {
    css: await CssCompiler.create(ctx, _channels),
    js: await JsCompiler.create(ctx, _channels),
  };

  let compile = async () => {
    fse.emptyDirSync(ctx.config.assetsBuildDirectory);

    // reset channels
    _channels.cssBundleHref = Channel.create();

    // parallel builds
    let [css, js] = await Promise.all([
      compiler.css.compile(),
      compiler.js.compile(),
    ]);

    // error handling
    if (!css.ok || !js.ok) {
      channels.manifest.reject();
      let errors: Err = {};
      if (!css.ok) errors.css = css.error;
      if (!js.ok) errors.js = js.error;
      return err(errors);
    }

    // manifest
    let manifest = await createManifest({
      config: ctx.config,
      cssBundleHref: css.value,
      metafile: js.value.metafile,
      hmr: js.value.hmr,
    });
    channels.manifest.resolve(manifest);
    await writeManifestFile(ctx.config, manifest);

    return ok(manifest);
  };
  return {
    compile,
    dispose: async () => {
      await Promise.all([compiler.css.dispose(), compiler.js.dispose()]);
    },
  };
};
