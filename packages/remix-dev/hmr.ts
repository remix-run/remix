import type esbuild from "esbuild";
import path from "node:path";

import type { RemixConfig } from "./config";
import type { CompileResult } from "./compiler";

export let updates = (result: CompileResult, prevResult: CompileResult) => {
  let timestamp: number = 1;
  let remixConfig: RemixConfig = {} as any;

  // TODO update code below to use `result` and `prevResult`
  // instead of outdated references

  manifest.entry.module = manifest.entry.module + `?t=${timestamp}`;
  manifest.entry.imports = manifest.entry.imports.map(
    (imp) => imp + `?t=${timestamp}`
  );
  for (let routeId of Object.keys(manifest.routes)) {
    let route = manifest.routes[routeId];
    manifest.routes[routeId] = {
      ...route,
      module: route.module + `?t=${timestamp}`,
      imports: (route.imports ?? []).map((imp) => imp + `?t=${timestamp}`),
    };
  }
  let create_input2output = (
    metafile: esbuild.Metafile
  ): Record<string, string> => {
    let inputs = new Set(Object.keys(metafile.inputs));
    let input2output: Record<string, string> = {};
    for (let [outputPath, output] of Object.entries(metafile.outputs)) {
      for (let x of Object.keys(output.inputs)) {
        if (inputs.has(x)) {
          input2output[x] = outputPath + `?t=${timestamp}`;
        }
      }
    }
    return input2output;
  };

  // TODO: probably want another map to correlate every input file to the
  // routes that consume it
  // ^check if route chunk hash changes when its dependencies change, even in different chunks
  let filename2id = new Map<string, string>(
    Object.values(remixConfig.routes).map((r) => [r.file, r.id])
  );
  console.log("filename2id");
  console.log(filename2id.entries());
  console.log({
    prevLoaderHashes,
  });
  let updates = [];
  // let prev_i2o = create_input2output(prevMetafile);
  let i2o = create_input2output(metafile);
  for (let input of Object.keys(metafile.inputs)) {
    // let prev_o = prev_i2o[input];
    let o = i2o[input];
    if (o === undefined) {
      console.warn(`o is undefined: [input=${input}]`);
      continue;
    }
    let url =
      remixConfig.publicPath +
      path.relative(remixConfig.assetsBuildDirectory, path.resolve(o));
    let id = input;
    let revalidate: string[] = [];
    console.log({ input, id });
    if (id.startsWith("browser-route-module:")) {
      let filename = id
        .replace(/^browser-route-module:/, "")
        .replace(/\?browser$/, "");
      id = path.relative(
        remixConfig.rootDirectory,
        path.join(remixConfig.appDirectory, filename)
      );
      if (prevLoaderHashes) {
        let prevLoader = prevLoaderHashes[filename];
        let loader = loaderHashes[filename];
        console.log({
          prevLoader,
          loader,
          id,
          filename,
          url,
        });
        if (loader !== prevLoader) {
          let routeId = filename2id.get(filename);
          if (routeId) {
            revalidate.push(routeId);
          }
        }
      }
    }
    updates.push({
      id,
      url,
      revalidate,
    });
  }
  return updates;
};
