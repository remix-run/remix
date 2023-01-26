import * as fs from "node:fs";
import * as path from "node:path";
import * as esbuild from "esbuild";

import type { RemixConfig } from "../../config";

export let hmrPlugin = ({
  remixConfig,
}: {
  remixConfig: RemixConfig;
}): esbuild.Plugin => {
  return {
    name: "remix-hmr",
    setup: async (build) => {
      build.onResolve({ filter: /^remix:hmr$/ }, (args) => {
        return {
          namespace: "remix-runtime",
          path: args.path,
        };
      });
      build.onLoad({ filter: /.*/, namespace: "remix-runtime" }, () => {
        let contents = `
import RefreshRuntime from "react-refresh/runtime";

declare global {
  interface Window {
    $RefreshReg$: any;
    $RefreshSig$: any;
  }
}

var prevRefreshReg = window.$RefreshReg$;
var prevRefreshSig = window.$RefreshSig$;

window.$RefreshReg$ = (type, id) => {
  const fullId = id;
  RefreshRuntime.register(type, fullId);
};
window.$RefreshReg$ = prevRefreshReg;
window.$RefreshSig$ = prevRefreshSig;
window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
window.$RefreshRuntime$ = RefreshRuntime;

window.$RefreshRuntime$.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;

if (!window.__hmr__) {
  window.__hmr__ = {
    contexts: {},
  };
}

export function createHotContext(id: string): ImportMetaHot {
  let callback: undefined | ((mod: ModuleNamespace) => void);
  let disposed = false;

  let hot = {
    accept: (dep, cb) => {
      if (typeof dep !== "string") {
        cb = dep;
        dep = undefined;
      }
      if (dep) {
        if (window.__hmr__.contexts[dep]) {
          window.__hmr__.contexts[dep].dispose();
        }
        window.__hmr__.contexts[dep] = createHotContext(dep);
        window.__hmr__.contexts[dep].accept(cb);
        return;
      }
      if (disposed) {
        throw new Error("import.meta.hot.accept() called after dispose()");
      }
      if (callback) {
        throw new Error("import.meta.hot.accept() already called");
      }
      callback = cb;
    },
    dispose: () => {
      disposed = true;
    },
    emit(self: ModuleNamespace) {
      if (callback) {
        callback(self);
        return true;
      }
      return false;
    },
  };

  if (window.__hmr__.contexts[id]) {
    window.__hmr__.contexts[id].dispose();
  }
  window.__hmr__.contexts[id] = hot;

  return hot;
}

declare global {
  interface Window {
    __hmr__: any;
  }
}

function remixLiveReloadConnect(config) {
  let protocol = location.protocol === "https:" ? "wss:" : "ws:";
  let host = location.hostname;
  let port = process.env.REMIX_DEV_SERVER_WS_PORT;
  let socketPath = protocol + "//" + host + ":" + port + "/socket";
  let ws = new WebSocket(socketPath);
  ws.onmessage = async (event) => {
    let payload = JSON.parse(event.data);

    switch (payload?.type) {
      case "LOG":
        console.log(payload.message);
        break;
      case "RELOAD":
        window.location.reload();
        break;
      case "HMR":
        if (!payload.updates?.length) return;

        let anyAccepted = false;
        for (let update of payload.updates) {
          if (window.__hmr__.contexts[update.id]) {
            let accepted = window.__hmr__.contexts[update.id].emit(
              await import(update.url + "?t=" + Date.now())
            );
            if (accepted) {
              console.log("[HMR] Updated accepted by", update.id);
              anyAccepted = true;
            }
          }
        }

        if (payload.assetsManifest && window.__hmr__.contexts["remix:manifest"]) {
          let accepted = window.__hmr__.contexts["remix:manifest"].emit(
            payload.assetsManifest
          );
          if (accepted && !anyAccepted) {
            console.log("[HMR] Only the manifest update was accepted, your application may be out of sync.");
            anyAccepted = true;
          }
        }

        if (!anyAccepted) {
          console.log("[HMR] Updated rejected, reloading...");
          window.location.reload();
        }
        break;
    }
  };
  ws.onopen = () => {
    if (config && typeof config.onOpen === "function") {
      config.onOpen();
    }
  };
  ws.onclose = (event) => {
    if (event.code === 1006) {
      console.log("Remix dev asset server web socket closed. Reconnecting...");
      setTimeout(
        () =>
          remixLiveReloadConnect({
            onOpen: () => window.location.reload(),
          }),
      5000
      );
    }
  };
  ws.onerror = (error) => {
    console.log("Remix dev asset server web socket error:");
    console.error(error);
  };
}
remixLiveReloadConnect();
        `;
        return { loader: "ts", contents, resolveDir: remixConfig.appDirectory };
      });

      build.onLoad({ filter: /.*/, namespace: "file" }, async (args) => {
        if (
          !args.path.match(
            /@remix-run[/\\]react[/\\]dist[/\\]esm[/\\]browser.js$/
          ) &&
          (!args.path.match(/\.[tj]sx?$/) ||
            !fs.existsSync(args.path) ||
            !args.path.startsWith(remixConfig.appDirectory))
        ) {
          return undefined;
        }

        let sourceCode = fs.readFileSync(args.path, "utf8");

        let resultCode = await applyHMR(
          sourceCode,
          args,
          remixConfig,
          !!build.initialOptions.sourcemap
        );

        return {
          contents: resultCode,
          loader: args.path.endsWith("x") ? "tsx" : "ts",
          resolveDir: path.dirname(args.path),
        };
      });
    },
  };
};

export async function applyHMR(
  sourceCode: string,
  args: esbuild.OnLoadArgs,
  remixConfig: RemixConfig,
  sourcemap: boolean
) {
  let babel = await import("@babel/core");
  // @ts-expect-error
  let reactRefresh = await import("react-refresh/babel");

  let IS_FAST_REFRESH_ENABLED = /\$RefreshReg\$\(/;

  let argsPath = args.path;
  let hmrId = JSON.stringify(
    path.relative(remixConfig.rootDirectory, argsPath)
  );
  let hmrPrefix = `import * as __hmr__ from "remix:hmr";
if (import.meta) {
import.meta.hot = __hmr__.createHotContext(
//@ts-expect-error
$id$
);
}`.replace(/\$id\$/g, hmrId);

  let sourceCodeWithHMR = hmrPrefix + sourceCode;

  let jsWithHMR = esbuild.transformSync(sourceCodeWithHMR, {
    loader: argsPath.endsWith("x") ? "tsx" : "ts",
    format: args.pluginData?.format || "esm",
    jsx: "automatic",
  }).code;
  let resultCode = jsWithHMR;

  let transformResult = babel.transformSync(jsWithHMR, {
    filename: argsPath,
    ast: false,
    compact: false,
    sourceMaps: sourcemap,
    configFile: false,
    babelrc: false,
    plugins: [[reactRefresh.default, { skipEnvCheck: true }]],
  });

  let jsWithReactRefresh = transformResult?.code || jsWithHMR;

  if (IS_FAST_REFRESH_ENABLED.test(jsWithReactRefresh)) {
    resultCode =
      `
        if (!window.$RefreshReg$ || !window.$RefreshSig$ || !window.$RefreshRuntime$) {
          console.warn('@remix-run/react-refresh: HTML setup script not run. React Fast Refresh only works when Remix serves your HTML routes. You may want to remove this plugin.');
        } else {
          var prevRefreshReg = window.$RefreshReg$;
          var prevRefreshSig = window.$RefreshSig$;
          window.$RefreshReg$ = (type, id) => {
            window.$RefreshRuntime$.register(type, ${JSON.stringify(
              hmrId
            )} + id);
          }
          window.$RefreshSig$ = window.$RefreshRuntime$.createSignatureFunctionForTransform;
        }
      ` +
      jsWithReactRefresh +
      `
        window.$RefreshReg$ = prevRefreshReg;
        window.$RefreshSig$ = prevRefreshSig;
        import.meta.hot.accept(({ module }) => {
          window.$RefreshRuntime$.performReactRefresh();
        });
      `;
  }

  return resultCode;
}
