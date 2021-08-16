/**
 * esm-hmr/runtime.ts
 * A client-side implementation of the ESM-HMR spec, for reference.
 */

function debug(...args: any[]) {
  console.log("[ESM-HMR]", ...args);
}
function reload() {
  location.reload(true);
}

const REGISTERED_MODULES: { [key: string]: HotModuleState } = {};

class HotModuleState {
  id: string;
  isLocked: boolean = false;
  acceptCallback?: true | ((args: { module: any; manifest?: string }) => void);
  disposeCallbacks: (() => void)[] = [];

  constructor(id: string) {
    this.id = id;
  }

  lock(): void {
    this.isLocked = true;
  }

  dispose(callback: () => void): void {
    this.disposeCallbacks.push(callback);
  }

  accept(
    callback: true | ((args: { module: any }) => void) = true
  ): () => void {
    if (!this.isLocked) {
      this.acceptCallback = callback;
    }
    this.isLocked = true;

    return () => {
      this.acceptCallback = undefined;
      this.isLocked = false;
    };
  }
  invalidate(): void {
    reload();
  }
}

export function createHotContext(id: string) {
  const existing = REGISTERED_MODULES[id];
  if (existing) {
    existing.lock();
    return existing;
  }
  const state = new HotModuleState(id);
  REGISTERED_MODULES[id] = state;
  return state;
}

async function applyUpdate(data: {
  id: string;
  mod: string;
  manifest?: string;
}) {
  const state = REGISTERED_MODULES[data.id];
  if (!state || !data.id.match(/\.[jt]sx?$/)) {
    return false;
  }

  const acceptCallback = state.acceptCallback;
  const disposeCallbacks = state.disposeCallbacks;
  state.disposeCallbacks = [];

  if (acceptCallback) {
    // @ts-ignore
    const module = await import(data.mod + `?mtime=${Date.now()}`);
    if (acceptCallback === true) {
      // Do nothing, importing the module side-effects was enough.
    } else {
      await acceptCallback({ module, manifest: data.manifest });
    }
  }
  await Promise.all(disposeCallbacks.map(cb => cb()));
  return true;
}

const source = new EventSource("/livereload");
source.onerror = () => (source.onopen = reload);
source.onmessage = async e => {
  const data = JSON.parse(e.data);
  if (data.type === "reload") {
    debug("message: reload");
    reload();
    return;
  }
  if (data.type === "LOG") {
    debug("log: ", data.message);
  }
  if (data.type !== "update") {
    // debug("message: unknown", data);
    return;
  }
  debug("message: update", data);
  // debug(data.id, Object.keys(REGISTERED_MODULES));
  applyUpdate(data)
    .then(ok => {
      if (!ok) {
        reload();
      }
    })
    .catch(err => {
      console.error(err);
      reload();
    });
};

debug("listening for file changes...");
