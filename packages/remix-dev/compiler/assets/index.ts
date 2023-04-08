import type { RemixConfig } from "../../config";
import type { Manifest } from "../../manifest";
import type { CompileOptions } from "../options";
import * as Channel from "../utils/channel";
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

    // TODO error handling
    // if (!js.ok || !css.ok) {
    // }

    // manifest
    let manifest = await createManifest({
      config,
      cssBundleHref: css,
      metafile: js.metafile,
      hmr: js.hmr,
    });
    channels.manifest.resolve(manifest);
    await writeManifestFile(config, manifest);

    return manifest;
  };
  return {
    compile,
    dispose: () => {
      compiler.css.dispose();
      compiler.js.dispose();
    },
  };
};
