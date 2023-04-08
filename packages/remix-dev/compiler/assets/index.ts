import type { RemixConfig } from "../../config";
import type { Manifest } from "../../manifest";
import type { CompileOptions } from "../options";
import * as Channel from "../utils/channel";
import { ok, err } from "../utils/result";
import * as CssCompiler from "./css";
import * as JsCompiler from "./js";
import {
  create as createManifest,
  write as writeManifestFile,
} from "./manifest";

export let create = async (
  config: RemixConfig,
  options: CompileOptions,
  channels: { manifest: Channel.Type<Manifest> }
) => {
  // setup channels
  let _channels = {
    cssBundleHref: Channel.create<string | undefined>(),
  };

  // create subcompilers
  let compiler = {
    css: await CssCompiler.create(config, options, _channels),
    js: await JsCompiler.create(config, options, _channels),
  };

  let compile = async () => {
    // reset channels
    _channels.cssBundleHref = Channel.create();

    // parallel builds
    let [css, js] = await Promise.all([
      compiler.css.compile(),
      compiler.js.compile(),
    ]);

    if (!css.ok || !js.ok) {
      channels.manifest.reject();
      let errors: Record<string, unknown> = {};
      if (!css.ok) errors.css = css.error;
      if (!js.ok) errors.js = js.error;
      return err(errors);
    }

    // manifest
    let manifest = await createManifest({
      config,
      cssBundleHref: css.value,
      metafile: js.value.metafile,
      hmr: js.value.hmr,
    });
    channels.manifest.resolve(manifest);
    await writeManifestFile(config, manifest);

    return ok(manifest);
  };
  return {
    compile,
    dispose: async () => {
      await Promise.all([compiler.css.dispose(), compiler.js.dispose()]);
    },
  };
};
