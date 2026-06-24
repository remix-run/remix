import { css, type Handle } from "remix/ui";

import type * as monacoTypes from "monaco-editor";

import { monacoEditor } from "../monaco.tsx";
import { modelFor, openFile } from "../store/operations.ts";
import { connect, type AppUiApi, shallowEqual } from "../store/index.ts";

/**
 * The Monaco editor pane. It subscribes to the store for the active file (and
 * the editor/filesystem readiness that gate model creation), resolves the
 * matching text model, and hands it to the {@link monacoEditor} mixin. The
 * mixin owns the live editor instance; this component only chooses which model
 * it shows.
 */
export function Editor(handle: Handle<{ api: AppUiApi }>) {
  const { api } = handle.props;
  // Re-render when the active file changes, when Monaco finishes loading, or
  // when the filesystem changes (a model may now exist for a new file).
  const view = connect(
    handle,
    api,
    (s) => ({
      activePath: s.activePath,
      editorStatus: s.editorStatus,
      fsRevision: s.fsRevision,
    }),
    shallowEqual,
  );

  // Resolve a ctrl+click "go to definition" target to its model. Opening the
  // file (tab + active path) is a side effect; the mixin switches the editor
  // onto the returned model and reveals the selection.
  const openModel = (uri: monacoTypes.Uri) => {
    const path = uri.path;
    api.dispatch(openFile(path));
    return modelFor(api, path);
  };

  return () => {
    const { activePath } = view();
    const model = activePath ? modelFor(api, activePath) : null;
    return (
      <div
        innerHTML=""
        grow
        mix={[css({ minHeight: 0, overflow: "hidden" }), monacoEditor({ model, openModel })]}
      />
    );
  };
}
