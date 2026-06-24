/**
 * The app's Redux Toolkit slice: state shape, action creators, and reducer in
 * one place. `createSlice` uses Immer under the hood, so each case "mutates" a
 * draft and RTK produces the next immutable state.
 *
 * Side effects (Monaco edits, VFS writes, network) live in thunks (see
 * ./operations.ts), which dispatch these actions to publish data changes.
 */
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { TemplateFile } from "../templates/default.ts";
import {
  createInitialState,
  type Diagnostic,
  type EditorStatus,
  type RuntimeStatus,
} from "./state.ts";

const appSlice = createSlice({
  name: "app",
  initialState: createInitialState,
  reducers: {
    setEditorStatus(state, action: PayloadAction<EditorStatus>) {
      state.editorStatus = action.payload;
    },
    setRuntimeStatus(state, action: PayloadAction<RuntimeStatus>) {
      state.runtimeStatus = action.payload;
    },
    setActivePath(state, action: PayloadAction<string | undefined>) {
      state.activePath = action.payload;
    },
    setOpenFiles(state, action: PayloadAction<readonly string[]>) {
      state.openFiles = [...action.payload];
    },
    /** Mark a file active and ensure it has a tab. */
    openFile(state, action: PayloadAction<string>) {
      state.activePath = action.payload;
      if (!state.openFiles.includes(action.payload)) {
        state.openFiles = [...state.openFiles, action.payload];
      }
    },
    setConsole(state, action: PayloadAction<string>) {
      state.consoleOutput = action.payload;
    },
    appendConsole(state, action: PayloadAction<string>) {
      state.consoleOutput += action.payload;
    },
    setSharing(state, action: PayloadAction<boolean>) {
      state.sharing = action.payload;
    },
    setSharedId(state, action: PayloadAction<string | null>) {
      state.sharedId = action.payload;
    },
    setCreateTarget(state, action: PayloadAction<{ kind: "file" | "dir" } | undefined>) {
      state.createTarget = action.payload;
    },
    setRenameTarget(state, action: PayloadAction<{ path: string; name: string } | undefined>) {
      state.renameTarget = action.payload;
    },
    setDeleteTarget(
      state,
      action: PayloadAction<{ path: string; type: "file" | "dir" } | undefined>,
    ) {
      state.deleteTarget = action.payload;
    },
    setEditorView(state, action: PayloadAction<"editor" | "chat">) {
      state.editorView = action.payload;
    },
    toggleEditorView(state) {
      state.editorView = state.editorView === "editor" ? "chat" : "editor";
    },
    setTemplateFiles(state, action: PayloadAction<Record<string, TemplateFile>>) {
      state.templateFiles = action.payload;
    },
    setDiagnostics(state, action: PayloadAction<readonly Diagnostic[]>) {
      state.diagnostics = [...action.payload];
    },
    /** Signal that the virtual filesystem changed so VFS-derived views refresh. */
    touchFs(state) {
      state.fsRevision += 1;
    },
  },
});

export const actions = appSlice.actions;
export const reducer = appSlice.reducer;
export type AppAction = ReturnType<(typeof appSlice.actions)[keyof typeof appSlice.actions]>;
