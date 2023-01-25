import type { Plugin } from "esbuild";

export let hmrPlugin = (): Plugin => {
  return {
    name: "remix-hmr",
    setup: (build) => {
      build.onResolve({ filter: /^remix:hmr$/ }, (args) => {
        return {
          namespace: "remix-hmr",
          path: args.path,
        };
      });
      build.onLoad({ filter: /.*/, namespace: "remix-hmr" }, () => {
        let contents = `
        if (!window.__hmr__) {
  window.__hmr__ = {
    contexts: {},
  };

  const socketURL = new URL(
    "/__hmr__",
    window.location.href.replace(/^http(s)?:/, "ws$1:")
  );
  const socket = (window.__hmr__.socket = new WebSocket(socketURL.href));
  socket.addEventListener("message", async (event) => {
    const payload = JSON.parse(event.data);

    switch (payload?.type) {
      case "reload":
        window.location.reload();
        break;
      case "hmr":
        if (!payload.updates?.length) return;

        let anyAccepted = false;
        for (const update of payload.updates) {
          if (window.__hmr__.contexts[update.id]) {
            const accepted = window.__hmr__.contexts[update.id].emit(
              await import(update.url + "?t=" + Date.now())
            );
            if (accepted) {
              console.log("[HMR] Updated accepted by", update.id);
              anyAccepted = true;
            }
          }
        }

        if (!anyAccepted) {
          console.log("[HMR] Updated rejected, reloading...");
          window.location.reload();
        }
        break;
    }
  });
}

export function createHotContext(id: string): ImportMetaHot {
  let callback: undefined | ((mod: ModuleNamespace) => void);
  let disposed = false;

  const hot = {
    accept: (cb) => {
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
      callback = undefined;
    },
    emit(self: ModuleNamespace) {
      if (disposed) {
        throw new Error("import.meta.hot.emit() called after dispose()");
      }

      if (callback) {
        callback(self);
        return true;
      }
      return false;
    },
  };

  if (window.__hmr__.contexts[id]) {
    window.__hmr__.contexts[id].dispose();
    window.__hmr__.contexts[id] = undefined;
  }
  window.__hmr__.contexts[id] = hot;

  return hot;
}

declare global {
  interface Window {
    __hmr__: any;
  }
}
        `;
        return { loader: "ts", contents };
      });
    },
  };
};
