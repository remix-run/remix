import { css, on, ref, type Handle, type RemixNode } from "remix/ui";

import { modelFor, openFile } from "../store/operations.ts";
import { actions, connect, DEFAULT_OPEN_FILES, type AppUiApi, shallowEqual } from "../store/index.ts";

type FileNode = {
  name: string;
  type: "dir" | "file";
  readonly?: boolean;
  children?: FileNode[];
};

type VisibleItem = {
  path: string;
  type: "dir" | "file";
  depth: number;
  isOpen: boolean;
};

/**
 * Build the file tree by walking the live VFS (skipping `node_modules`), warming
 * the Monaco model cache for each openable file along the way. Slash-free paths
 * match the tree's internal keys.
 */
function buildTree(api: AppUiApi, path = ""): FileNode[] {
  const { vfs } = api.services;
  const templateFiles = api.getState().templateFiles;
  if (!vfs || !templateFiles) return [];

  const results: FileNode[] = [];
  for (const entry of vfs.readdirSync(path) || []) {
    if (entry === "node_modules") continue;

    const fullPath = `${path}/${entry}`;
    const stats = vfs.statSync(fullPath);
    if (stats?.isDirectory()) {
      results.push({ name: entry, type: "dir", children: buildTree(api, fullPath) });
    } else {
      modelFor(api, fullPath); // warm the model cache for openable files
      results.push({
        name: entry,
        type: "file",
        readonly: templateFiles[fullPath.slice(1)]?.readonly,
      });
    }
  }
  return results.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "dir" ? -1 : 1;
  });
}

/**
 * The file explorer tree. It subscribes to the store (the filesystem revision,
 * the template metadata, and the active file) and rebuilds itself from the live
 * VFS when any of those change. Activating a file dispatches {@link openFile};
 * the rename/delete row actions set the matching dialog target so
 * {@link FileDialogs} opens itself. No props, no bubbled events.
 *
 * Directory expansion and roving focus are local UI state (uncontrolled).
 */
export function FileTree(
  handle: Handle<{ api: AppUiApi; showFileActions?: boolean; initialOpenFiles?: readonly string[] }>,
) {
  const { api } = handle.props;
  const showFileActions = handle.props.showFileActions ?? true;
  // Re-render whenever the filesystem changes, files load, or the active file
  // moves. `fsRevision` is bumped by every VFS mutation.
  const view = connect(
    handle,
    api,
    (s) => ({
      fsRevision: s.fsRevision,
      templateFiles: s.templateFiles,
      activePath: s.activePath?.slice(1),
    }),
    shallowEqual,
  );

  // Recomputed each render; keydown handlers close over these.
  let visible: VisibleItem[] = [];
  const nodes = new Map<string, HTMLElement>();

  // Expansion is owned locally (uncontrolled). Seed it once from the default
  // open files, expanding each ancestor directory.
  const expanded = expandAncestors(
    (handle.props.initialOpenFiles?.length ? handle.props.initialOpenFiles : DEFAULT_OPEN_FILES).map((p) =>
      p.replace(/^\//, ""),
    ),
  );

  // Roving-tabindex focus is local UI state, not data.
  let focused: string | undefined = view().activePath ?? firstPath(buildTree(api));

  // The active path we last revealed; expand its ancestors when it changes.
  let lastRevealed: string | undefined;

  function commit(nextFocus: string | undefined = focused) {
    focused = nextFocus;
    handle.update();
    if (focused) {
      const path = focused;
      handle.queueTask(() => nodes.get(path)?.focus());
    }
  }

  function selectFile(path: string) {
    commit(path);
    api.dispatch(actions.setEditorView("editor"));
    api.dispatch(openFile(`/${path}`));
  }

  function toggleDir(path: string, open: boolean) {
    if (open) expanded.add(path);
    else expanded.delete(path);
    commit(path);
  }

  function activate(path: string) {
    const item = currentItem(path);
    if (!item) return;
    if (item.type === "dir") toggleDir(path, !item.isOpen);
    else selectFile(path);
  }

  function requestRename(path: string, name: string) {
    // Set the dialog target; FileDialogs subscribes and opens itself.
    api.dispatch(actions.setRenameTarget({ path: `/${path}`, name }));
  }

  function requestDelete(path: string, type: "dir" | "file") {
    api.dispatch(actions.setDeleteTarget({ path: `/${path}`, type }));
  }

  // --- Traversal over the visible list -------------------------------------
  function indexOf(path: string) {
    return visible.findIndex((v) => v.path === path);
  }
  function currentItem(path: string): VisibleItem | undefined {
    return visible[indexOf(path)];
  }
  function focusAt(index: number) {
    const target = visible[index];
    if (target) commit(target.path);
  }
  function parentIndex(index: number) {
    const depth = visible[index]!.depth;
    for (let i = index - 1; i >= 0; i--) {
      if (visible[i]!.depth < depth) return i;
    }
    return -1;
  }
  function hasFirstChild(index: number) {
    const next = visible[index + 1];
    return next != null && next.depth === visible[index]!.depth + 1;
  }

  type NodeState = "leaf" | "closed-dir" | "open-dir";
  function stateOf(item: VisibleItem): NodeState {
    if (item.type !== "dir") return "leaf";
    return item.isOpen ? "open-dir" : "closed-dir";
  }

  function onKeyDown(event: KeyboardEvent, path: string) {
    const index = indexOf(path);
    if (index === -1) return;
    const item = visible[index]!;
    const state = stateOf(item);

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(visible.length - 1);
        break;
      case "ArrowRight":
        event.preventDefault();
        if (state === "closed-dir") {
          toggleDir(path, true);
        } else if (state === "open-dir" && hasFirstChild(index)) {
          focusAt(index + 1);
        }
        break;
      case "ArrowLeft":
        event.preventDefault();
        if (state === "open-dir") {
          toggleDir(path, false);
        } else {
          focusAt(parentIndex(index));
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();
        activate(path);
        break;
    }
  }

  function renderNodes(
    treeNodes: FileNode[],
    depth: number,
    parentPath: string,
    selected: string | undefined,
  ): RemixNode[] {
    const rows: RemixNode[] = [];

    for (const node of treeNodes) {
      const path = parentPath ? `${parentPath}/${node.name}` : node.name;
      const isDir = node.type === "dir";
      const isOpen = isDir && expanded.has(path);
      visible.push({ path, type: node.type, depth, isOpen });

      rows.push(
        <jui-group
          key={path}
          items="center"
          gap="xs"
          mb="xs"
          mr="sm"
          nowrap
          // @ts-expect-error - role is a valid host attribute
          role="treeitem"
          tabindex={focused === path ? 0 : -1}
          aria-level={depth + 1}
          aria-expanded={isDir ? String(isOpen) : undefined}
          aria-selected={!isDir && selected === path ? "true" : "false"}
          weight={!isDir && selected === path ? "bolder" : undefined}
          mix={[
            css({
              paddingLeft: `calc(${depth} * 0.625rem)`,
              cursor: "pointer",
              userSelect: "none",
              outlineOffset: "-2px",
              "& [data-tree-actions]": {
                opacity: "0",
                transition: "opacity var(--jui-duration) var(--jui-ease)",
              },
              "&:hover [data-tree-actions], &:focus-within [data-tree-actions]": {
                opacity: "1",
              },
            }),
            ref((el: HTMLElement, signal) => {
              nodes.set(path, el);
              signal.addEventListener("abort", () => {
                if (nodes.get(path) === el) nodes.delete(path);
              });
            }),
            on<HTMLElement>("click", (event) => {
              event.preventDefault();
              event.stopImmediatePropagation();
              event.stopPropagation();
              activate(path);
            }),
            on<HTMLElement>("keydown", (event) => onKeyDown(event as KeyboardEvent, path)),
          ]}
        >
          {isDir ? <span>{isOpen ? "▾" : "▸"}</span> : null}
          <span truncate>
            {node.name}
            {node.readonly ? <span> (read-only)</span> : null}
          </span>
          <span grow />
          {node.readonly || !showFileActions ? null : (
            <jui-group data-tree-actions items="center" gap="xs" nowrap>
              <span
                role="button"
                aria-label={`Rename ${node.name}`}
                title="Rename"
                mix={[
                  css({ cursor: "pointer" }),
                  on<HTMLElement>("click", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    requestRename(path, node.name);
                  }),
                ]}
              >
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  width="1em"
                  height="1em"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                  />
                </svg>
              </span>
              <span
                role="button"
                aria-label={`Delete ${node.name}`}
                title="Delete"
                mix={[
                  css({ cursor: "pointer" }),
                  on<HTMLElement>("click", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    requestDelete(path, node.type);
                  }),
                ]}
              >
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  width="1em"
                  height="1em"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                  />
                </svg>
              </span>
            </jui-group>
          )}
        </jui-group>,
      );

      if (isDir && isOpen && node.children) {
        rows.push(...renderNodes(node.children, depth + 1, path, selected));
      }
    }

    return rows;
  }

  return () => {
    visible = [];
    const selected = view().activePath;

    // Reveal the active file by expanding every ancestor directory, then park
    // keyboard focus on it — but only when it changes.
    if (selected && selected !== lastRevealed) {
      lastRevealed = selected;
      for (const dir of ancestorDirs(selected)) expanded.add(dir);
      focused = selected;
    }

    const rows = renderNodes(buildTree(api), 0, "", selected);
    if (!visible.some((v) => v.path === focused) && visible.length) {
      focused = visible[0]!.path;
    }
    return (
      <jui-stack
        // @ts-expect-error - role is a valid host attribute
        role="tree"
        aria-label="Files"
      >
        {rows}
      </jui-stack>
    );
  };
}

// Every ancestor directory of a (slash-free) path: `a/b/c.ts` → ["a", "a/b"].
function ancestorDirs(path: string): string[] {
  const segments = path.split("/").filter(Boolean);
  const dirs: string[] = [];
  let prefix = "";
  for (let i = 0; i < segments.length - 1; i++) {
    prefix = prefix ? `${prefix}/${segments[i]}` : segments[i]!;
    dirs.push(prefix);
  }
  return dirs;
}

function firstPath(nodes: FileNode[]): string {
  return nodes.length ? nodes[0]!.name : "";
}

// Build the open set from arbitrary paths, adding every ancestor directory so
// that opening `a/b/c.ts` reveals `a` and `a/b`.
function expandAncestors(paths: string[]): Set<string> {
  const open = new Set<string>();
  for (const raw of paths) {
    const segments = raw.split("/").filter(Boolean);
    let prefix = "";
    for (const segment of segments) {
      prefix = prefix ? `${prefix}/${segment}` : segment;
      open.add(prefix);
    }
  }
  return open;
}
