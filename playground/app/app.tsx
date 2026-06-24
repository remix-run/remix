import { css, type Handle } from "remix/ui";

import { normalizePath } from "./lib/paths.ts";
import { FileDialogs } from "./components/file-dialogs.tsx";
import { Layout } from "./components/layout.tsx";
import { ShareDialog } from "./components/share-dialog.tsx";
import {
  bootRuntime,
  loadEditor,
  loadProjectFiles,
  type InitialFiles,
} from "./store/operations.ts";
import { actions, createAppApi, createAppStore } from "./store/index.ts";
import { createServices } from "./store/services.ts";
import type { TemplateFile } from "./templates/default.ts";
import { resolveAppUiOptions, type AppUiOptionsInput } from "./options.ts";

export type { AppUiOptions, AppUiOptionsInput, PreviewMode } from "./options.ts";
export type { InitialFiles } from "./store/operations.ts";
export type { TemplateFile } from "./templates/default.ts";

export interface AppProps {
  initialFiles?: InitialFiles;

  /** File to show first. Accepts either `app/file.tsx` or `/app/file.tsx`. */
  initialOpenFile?: string;

  /** Initial tab list. Defaults to `[initialOpenFile]` when provided. */
  initialOpenFiles?: readonly string[];

  /** Controls which chrome is shown and the container sizing. */
  ui?: AppUiOptionsInput;
}

/**
 * The application shell.
 *
 * Each App instance owns its store and live service bag. This keeps editor
 * models, VFS/runtime state, DOM refs, dialogs, and preview route bookkeeping
 * isolated so multiple <App /> components can be rendered on one page.
 */
export function App(handle: Handle<AppProps>) {
  const ui = resolveAppUiOptions(handle.props.ui);
  const services = createServices();
  const store = createAppStore(services);
  const api = createAppApi(store, services);

  const requestedInitialOpenFile = handle.props.initialOpenFile
    ? normalizePath(handle.props.initialOpenFile)
    : undefined;
  const initialOpenFiles = (
    handle.props.initialOpenFiles ?? (requestedInitialOpenFile ? [requestedInitialOpenFile] : [])
  ).map(normalizePath);
  const initialOpenFile = requestedInitialOpenFile ?? initialOpenFiles[0];
  if (initialOpenFile && !initialOpenFiles.includes(initialOpenFile)) {
    initialOpenFiles.unshift(initialOpenFile);
  }

  if (initialOpenFile) store.dispatch(actions.setActivePath(initialOpenFile));
  if (initialOpenFiles.length > 0) store.dispatch(actions.setOpenFiles(initialOpenFiles));

  // The three boot phases coordinate through the per-instance store plus this
  // promise, which resolves once the project's files have been published to
  // state. `loadEditor` and `loadProjectFiles` run in parallel; `bootRuntime`
  // waits for both Monaco and the files.
  const templateFilesReady = Promise.withResolvers<Record<string, TemplateFile>>();

  handle.queueTask(() => store.dispatch(loadEditor()));
  handle.queueTask(() =>
    store.dispatch(loadProjectFiles(handle.props.initialFiles)).then(() => {
      templateFilesReady.resolve(store.getState().templateFiles!);
    }),
  );
  handle.queueTask(() => store.dispatch(bootRuntime(templateFilesReady.promise)));

  // Dispose every editor model when this App goes away.
  handle.signal.addEventListener(
    "abort",
    () => {
      services.models.forEach((model) => model.dispose());
      services.models.clear();
      services.runtime?.terminate();
    },
    { once: true },
  );

  return () => (
    <>
      <div mix={css({ height: ui.height, minHeight: 0, overflow: "hidden" })}>
        <Layout api={api} ui={ui} initialOpenFiles={initialOpenFiles} />
        {ui.fileActions ? <FileDialogs api={api} /> : null}
        {ui.shareButton ? <ShareDialog api={api} /> : null}
      </div>
    </>
  );
}
