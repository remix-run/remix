import type * as monacoTypes from "monaco-editor";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import TypeScriptWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

import { createMixin } from "remix/ui";

import { nodeTypes, remixJSX, remixTypes, remixUI } from "./generated/types.ts";

self.MonacoEnvironment = {
  getWorker: function (workerId, label) {
    switch (label) {
      case "json":
        return new JsonWorker({ name: label });
      case "css":
      case "scss":
      case "less":
        return new CssWorker({ name: label });
      case "html":
      case "handlebars":
      case "razor":
        return new HtmlWorker({ name: label });
      case "typescript":
      case "javascript":
        return new TypeScriptWorker({ name: label });
      default:
        return new EditorWorker({ name: label });
    }
  },
};

export const monacoPromise = import("monaco-editor").then((monaco) => {
  monaco.typescript.typescriptDefaults.setCompilerOptions({
    jsx: monaco.typescript.JsxEmit.ReactJSX,
    jsxImportSource: "remix/ui",
    strict: true,
    lib: ["es2022", "dom", "dom.iterable"],
    types: ["node"],
    target: monaco.typescript.ScriptTarget.ESNext,
    module: monaco.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
    allowImportingTsExtensions: true,
    isolatedModules: true,
    skipLibCheck: true,
    noEmit: true,
  });

  // The pre-bundled `remix` type definitions are registered directly with the
  // language service: `remixTypes` carries the `declare module "remix/*"`
  // blocks, while `remixUI`/`remixJSX` supply the `remix/ui/jsx-runtime` module
  // (required by `jsxImportSource`) and the global `JSX` namespace it provides.
  monaco.typescript.typescriptDefaults.addExtraLib(
    JSON.stringify({ name: "remix", version: "0.0.0" }),
    `file:///playground/node_modules/remix/package.json`,
  );
  for (const [fileName, contents] of [
    ["index.d.ts", remixTypes],
    ["ui.d.ts", remixUI],
    ["ui/jsx-runtime.d.ts", remixJSX],
  ] as const) {
    monaco.typescript.typescriptDefaults.addExtraLib(
      contents,
      `file:///playground/node_modules/remix/${fileName}`,
    );
  }

  // `@types/node` declaration files, embedded at build time. Registered under
  // their real `node_modules/@types/node/` paths so the inter-file `///
  // <reference path>` directives resolve; Monaco includes every extra lib as a
  // program root file, so the ambient `process`/`Buffer`/`node:*` declarations
  // become globally available.
  for (const [relPath, contents] of nodeTypes) {
    monaco.typescript.typescriptDefaults.addExtraLib(
      contents,
      `file:///playground/node_modules/@types/node/${relPath}`,
    );
  }

  monaco.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });
  monaco.typescript.typescriptDefaults.setEagerModelSync(true);

  return monaco;
});

export const monacoEditor = createMixin<
  HTMLElement,
  [
    options: {
      model: monacoTypes.editor.ITextModel | null;
      /**
       * Resolve a cross-file navigation target (ctrl+click "go to
       * definition", peek, etc.) to its Monaco model, opening the file in the
       * app as a side effect. Returning `null` leaves the navigation
       * unhandled. The mixin switches the editor to the returned model and
       * reveals the requested selection.
       */
      openModel?: (uri: monacoTypes.Uri) => monacoTypes.editor.ITextModel | null;
    },
  ]
>((handle) => {
  const signal = handle.signal;
  if (signal.aborted) return () => [];

  let editor: monacoTypes.editor.IStandaloneCodeEditor | null = null;

  // The most recent cross-file navigation resolver supplied by the App. Updated
  // on every render and read lazily from the `openCodeEditor` hook (which only
  // fires on user interaction), so a stale closure is never a concern.
  let openModel: ((uri: monacoTypes.Uri) => monacoTypes.editor.ITextModel | null) | undefined;

  // The host element (captured on insert) and the dedicated container we mount
  // Monaco into. Monaco builds its DOM lazily and imperatively, so we give it a
  // private `mount` element rather than the host itself.
  let host: HTMLElement | null = null;
  let mount: HTMLElement | null = null;

  // The host has no virtual children, so on every App-driven update the
  // reconciler bulk-clears its DOM (`domParent.textContent = ''`), detaching
  // our `mount` (and the editor inside it). The nodes aren't destroyed though —
  // we just re-attach `mount` in the `commit` phase, after the reconciler is
  // done, so the editor survives re-renders untouched.

  // The model the App most recently asked us to render. Kept separate from the
  // editor's live model so we can apply it once the editor exists (insert) and
  // re-apply it whenever the App swaps models (render).
  let desiredModel: monacoTypes.editor.ITextModel | null = null;

  // Per-model editor view state (cursor, selection, scroll, folding). The App
  // owns the models; the mixin owns the *view* of each one so switching files
  // and coming back restores exactly where the user left off. Keyed by model so
  // entries disappear automatically when the App disposes a model.
  const viewStates = new WeakMap<
    monacoTypes.editor.ITextModel,
    monacoTypes.editor.ICodeEditorViewState
  >();

  // Swap the editor onto `next`, preserving view state across the transition.
  function applyModel(next: monacoTypes.editor.ITextModel | null) {
    if (!editor) return;

    const current = editor.getModel();
    if (current === next) return;

    // Stash the outgoing model's view state before we detach it.
    if (current) {
      const state = editor.saveViewState();
      if (state) viewStates.set(current, state);
    }

    editor.setModel(next);

    // Restore the incoming model's view state, if we've seen it before.
    if (next) {
      const state = viewStates.get(next);
      if (state) editor.restoreViewState(state);
    }
  }

  const resize = new ResizeObserver(() => editor?.layout());
  resize.observe(document.body);
  handle.signal.addEventListener("abort", () => resize.disconnect(), { once: true });

  handle.addEventListener("insert", async (event) => {
    const monaco = await monacoPromise;
    if (signal.aborted) return;

    host = event.node;
    mount = document.createElement("div");
    mount.style.width = "100%";
    mount.style.height = "100%";
    host.appendChild(mount);
    editor = monaco.editor.create(mount, {
      automaticLayout: true,
      fontSize: 12,
      tabSize: 2,
      codeLensFontSize: 12,
      scrollBeyondLastLine: false,
      fixedOverflowWidgets: true,
      minimap: {
        enabled: false,
      },
    });
    applyModel(desiredModel);

    // Cross-file "go to definition" / peek targets a different model than the
    // one we're showing. A standalone editor's code-editor service can't open
    // those itself (it has no file/editor service), so its `openCodeEditor`
    // returns `null` and the navigation silently no-ops. Intercept that case:
    // ask the App to open the target file and switch the editor onto its model,
    // revealing the requested selection.
    interface CodeEditorOpenInput {
      resource: monacoTypes.Uri;
      options?: { selection?: monacoTypes.IRange };
    }
    interface CodeEditorService {
      openCodeEditor(
        input: CodeEditorOpenInput,
        source: monacoTypes.editor.ICodeEditor | null,
        sideBySide?: boolean,
      ): Promise<monacoTypes.editor.ICodeEditor | null>;
    }
    const codeEditorService = (
      editor as unknown as { _codeEditorService?: CodeEditorService }
    )._codeEditorService;
    if (codeEditorService) {
      const openBase = codeEditorService.openCodeEditor.bind(codeEditorService);
      codeEditorService.openCodeEditor = async (input, source, sideBySide) => {
        const result = await openBase(input, source, sideBySide);
        // The base service handled it (same model / in-editor jump).
        if (result || !editor) return result;

        const target = openModel?.(input.resource);
        if (!target) return result;

        applyModel(target);
        const selection = input.options?.selection;
        if (selection) {
          const range = new monaco.Range(
            selection.startLineNumber,
            selection.startColumn,
            selection.endLineNumber ?? selection.startLineNumber,
            selection.endColumn ?? selection.startColumn,
          );
          editor.setSelection(range);
          editor.revealRangeInCenter(range, monaco.editor.ScrollType.Immediate);
        }
        editor.focus();
        return editor;
      };
    }

    // Monaco builds its view lazily; nudge a layout so the editor paints even
    // before the first App-driven update.
    handle.queueTask(() => editor?.layout());
  });

  handle.addEventListener("remove", () => {
    // Capture the final view state so a remount (e.g. reconciliation) lands the
    // user back where they were.
    const current = editor?.getModel();
    if (editor && current) {
      const state = editor.saveViewState();
      if (state) viewStates.set(current, state);
    }
    editor?.dispose();
    editor = null;
    host = null;
    mount = null;
  });

  // After each update the reconciler may have detached our mount from the host
  // (see note above). Re-attach it and re-measure once the DOM has settled.
  handle.addEventListener("commit", () => {
    if (!host || !mount) return;
    if (mount.parentNode !== host) host.appendChild(mount);
    editor?.layout();
  });

  return ({ model, openModel: open }) => {
    openModel = open;
    if (model !== desiredModel) {
      desiredModel = model;
      applyModel(model);
    }
    return [];
  };
});
