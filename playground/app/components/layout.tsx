import { css, on, ref, type Handle } from "remix/ui";

import { languageLabel } from "../lib/paths.ts";
import type { AppUiOptions } from "../options.ts";
import {
  refreshPreviewFrame,
  rememberPreviewLocation,
  resetDatabase,
  runMigrations,
  shareProject,
  statusLabel,
} from "../store/operations.ts";
import { actions, connect, type AppUiApi, shallowEqual } from "../store/index.ts";
import { Editor } from "./editor.tsx";
import { FileTabs } from "./file-tabs.tsx";
import { FileTree } from "./file-tree.tsx";

export function Layout(
  handle: Handle<{ api: AppUiApi; ui: AppUiOptions; initialOpenFiles: readonly string[] }>,
) {
  const { api, ui } = handle.props;
  let hideExplorerDesktop = false;
  let terminalCollapsed = false;
  let previewOpen = ui.previewMode === "split" || ui.previewInitiallyOpen;
  let fileExplorerDialog: HTMLDialogElement | null = null;
  let previewDialog: HTMLDialogElement | null = null;

  const view = connect(
    handle,
    api,
    (s) => ({
      activeFile: s.activePath,
      editorStatus: s.editorStatus,
      runtimeStatus: s.runtimeStatus,
      consoleOutput: s.consoleOutput,
      readonly: s.templateFiles?.[(s.activePath || "").slice(1)]?.readonly,
    }),
    shallowEqual,
  );

  function newEntry(kind: "file" | "dir") {
    api.dispatch(actions.setCreateTarget({ kind }));
  }

  function togglePreview() {
    if (ui.previewMode === "split") {
      previewDialog?.showModal();
      return;
    }
    previewOpen = !previewOpen;
    handle.update();
    if (previewOpen) {
      handle.queueTask(() => refreshPreviewFrame(api));
    }
  }

  const showToolbar = ui.explorer || ui.tabs || ui.shareButton || ui.preview;

  function renderPreviewPane(consoleOutput: string, options: { mobileClose?: boolean } = {}) {
    return (
      <jui-stack mix={css({ height: "100%", minHeight: 0, overflow: "hidden" })}>
        {options.mobileClose ? (
          <jui-group p="xs" hide="tablet" border="top">
            <div grow />
            <form method="dialog">
              <jui-button size="icon-xs" mix={css({ width: "100%" })}>
                <button type="submit" aria-label="Close Preview" title="Close Preview">
                  <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
                    />
                  </svg>
                </button>
              </jui-button>
            </form>
          </jui-group>
        ) : null}
        <iframe
          grow
          mix={[
            ref((node: HTMLIFrameElement, signal) => {
              api.services.previewFrame = node;
              refreshPreviewFrame(api);
              signal.addEventListener("abort", () => {
                if (api.services.previewFrame === node) api.services.previewFrame = null;
              });
            }),
            on("load", () => {
              rememberPreviewLocation(api);
            }),
          ]}
        ></iframe>
        {ui.terminal ? (
          <>
            <jui-group items="center" gap="xs" nowrap p="xs" bg="muted" border="top bottom" font="xs">
              <div grow weight="bolder">
                TERMINAL
              </div>
              <jui-button size="icon-xs">
                <button
                  type="button"
                  title={terminalCollapsed ? "Show Terminal" : "Hide Terminal"}
                  aria-label={terminalCollapsed ? "Show Terminal" : "Hide Terminal"}
                  aria-expanded={!terminalCollapsed}
                  mix={on("click", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    terminalCollapsed = !terminalCollapsed;
                    handle.update();
                  })}
                >
                  {terminalCollapsed ? (
                    <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  ) : (
                    <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                    </svg>
                  )}
                </button>
              </jui-button>
            </jui-group>
            {!terminalCollapsed ? (
              <div grow p="xs" font="xs" bg="muted" scrollx scrolly style="max-height: 33vh;">
                <div>
                  <pre style="font-family: 'IBM Plex Mono', monospace">{consoleOutput}</pre>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </jui-stack>
    );
  }

  return () => {
    const { activeFile, editorStatus, runtimeStatus, consoleOutput, readonly } = view();
    const status = statusLabel(editorStatus, runtimeStatus);
    const crumbs = activeFile ? activeFile.replace(/^\//, "").split("/") : [];
    const renderSplitPreview = ui.preview && ui.previewMode === "split";
    const renderInlinePreview = ui.preview && ui.previewMode === "toggle" && previewOpen;

    return (
      <jui-stack mix={css({ height: "100%", minHeight: 0, overflow: "hidden" })}>
        <jui-group nowrap grow mix={css({ minHeight: 0, overflow: "hidden" })}>
          {ui.explorer ? (
            <jui-drawer
              show={hideExplorerDesktop ? undefined : "desktop"}
              font="sm"
              mix={css({
                "--max-width-desktop": "max(230px, 10vw)",
                "--max-width-mobile": "100vw",
              })}
            >
              <dialog
                closedby="any"
                mix={ref((node: HTMLDialogElement, signal) => {
                  fileExplorerDialog = node;
                  signal.addEventListener("abort", () => {
                    if (fileExplorerDialog === node) fileExplorerDialog = null;
                  });
                })}
              >
                <jui-group items="center" gap="xs" nowrap pt="xs" pl="xs" pr="xs">
                  <div grow weight="bolder">
                    EXPLORER
                  </div>
                  {ui.fileActions ? (
                    <>
                      <jui-button size="icon-xs">
                        <button
                          title="New File"
                          aria-label="New File"
                          mix={on("click", (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            newEntry("file");
                          })}
                        >
                          <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                            />
                          </svg>
                        </button>
                      </jui-button>
                      <jui-button size="icon-xs">
                        <button
                          title="New Folder"
                          aria-label="New Folder"
                          mix={on("click", (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            newEntry("dir");
                          })}
                        >
                          <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
                            />
                          </svg>
                        </button>
                      </jui-button>
                    </>
                  ) : null}
                  <jui-button size="icon-xs" hide={hideExplorerDesktop ? "desktop" : undefined}>
                    <button
                      title="Hide Explorer"
                      aria-label="Hide Explorer"
                      mix={on("click", (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        fileExplorerDialog?.close();
                        hideExplorerDesktop = true;
                        handle.update();
                      })}
                    >
                      <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
                        />
                      </svg>
                    </button>
                  </jui-button>
                </jui-group>
                <jui-drawer-body p="xs">
                  <FileTree
                    api={api}
                    showFileActions={ui.fileActions}
                    initialOpenFiles={handle.props.initialOpenFiles}
                  />
                </jui-drawer-body>
                {ui.databaseControls ? (
                  <jui-drawer-footer border="top" p="xs">
                    <jui-stack gap="xs">
                      <div weight="bolder" font="xs">
                        DATABASE
                      </div>
                      <jui-group gap="xs" nowrap>
                        <jui-button size="xs" grow>
                          <button
                            type="button"
                            title="Run pending migrations"
                            disabled={runtimeStatus !== "ready"}
                            mix={on("click", (event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              api.dispatch(runMigrations());
                            })}
                          >
                            Run Migrations
                          </button>
                        </jui-button>
                        <jui-button size="xs" variant="error" grow>
                          <button
                            type="button"
                            title="Drop all tables and re-run migrations"
                            disabled={runtimeStatus !== "ready"}
                            mix={on("click", (event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (!confirm("Reset the database? This drops every table and re-runs migrations.")) return;
                              api.dispatch(resetDatabase());
                            })}
                          >
                            Reset
                          </button>
                        </jui-button>
                      </jui-group>
                    </jui-stack>
                  </jui-drawer-footer>
                ) : null}
              </dialog>
            </jui-drawer>
          ) : null}

          <jui-stack grow mix={css({ minWidth: 0, overflow: "hidden" })}>
            {showToolbar ? (
              <jui-group mix={css({ minWidth: 0 })} bg="sheet" border="bottom" items="center" nowrap>
                {ui.explorer ? (
                  <>
                    <jui-button size="icon-xs" hide="desktop" ml="xs">
                      <button
                        title="Show Explorer"
                        aria-label="Show Explorer"
                        mix={on("click", (event) => {
                          event.preventDefault();
                          fileExplorerDialog?.showModal();
                        })}
                      >
                        <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                          />
                        </svg>
                      </button>
                    </jui-button>
                    {hideExplorerDesktop ? (
                      <jui-button size="icon-xs" show="desktop" ml="xs">
                        <button
                          title="Show Explorer"
                          aria-label="Show Explorer"
                          mix={on("click", (event) => {
                            event.preventDefault();
                            hideExplorerDesktop = false;
                            handle.update();
                            fileExplorerDialog?.showModal();
                          })}
                        >
                          <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                            />
                          </svg>
                        </button>
                      </jui-button>
                    ) : null}
                  </>
                ) : null}

                {ui.tabs ? <FileTabs api={api} /> : <span grow />}

                {(ui.shareButton || ui.preview) ? (
                  <jui-group gap="xs" p="xs" border="left" nowrap>
                    {ui.shareButton ? (
                      <jui-button size="icon-xs">
                        <button
                          aria-label="Share"
                          title="Share"
                          mix={on("click", (event, signal) => {
                            event.preventDefault();
                            event.stopPropagation();
                            api.dispatch(shareProject(signal));
                            api.services.shareDialog?.showModal();
                          })}
                        >
                          <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
                            />
                          </svg>
                        </button>
                      </jui-button>
                    ) : null}
                    {ui.preview ? (
                      <jui-button size="icon-xs" hide={ui.previewMode === "split" ? "tablet" : undefined}>
                        <button
                          aria-label={previewOpen && ui.previewMode === "toggle" ? "Hide Preview" : "Show Preview"}
                          title={previewOpen && ui.previewMode === "toggle" ? "Hide Preview" : "Show Preview"}
                          mix={on("click", (event) => {
                            event.preventDefault();
                            togglePreview();
                          })}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            class="size-6"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125Z"
                            />
                          </svg>
                        </button>
                      </jui-button>
                    ) : null}
                  </jui-group>
                ) : null}
              </jui-group>
            ) : null}

            {ui.breadcrumb ? (
              <jui-group
                items="center"
                gap="xs"
                nowrap
                pl="md"
                pt="xs"
                pb="xs"
                font="xs"
                border="bottom"
                mix={css({ overflowX: "auto" })}
              >
                {crumbs.length === 0 ? (
                  <span>No file open</span>
                ) : (
                  crumbs.flatMap((segment, index) =>
                    index === 0
                      ? [
                          <span key={index}>
                            {segment} {readonly && index === crumbs.length - 1 ? " (readonly)" : null}
                          </span>,
                        ]
                      : [
                          <span key={`sep-${index}`}>›</span>,
                          <span key={index}>
                            {segment}
                            {readonly && index === crumbs.length - 1 ? " (readonly)" : null}
                          </span>,
                        ],
                  )
                )}
              </jui-group>
            ) : null}

            <jui-stack grow mix={css({ minWidth: 0, overflow: "hidden" })}>
              {renderInlinePreview ? renderPreviewPane(consoleOutput) : <Editor api={api} />}
            </jui-stack>

            {ui.statusBar ? (
              <jui-group items="center" gap="md" nowrap pl="md" pr="md" bg="secondary" font="xs">
                <span>{status}</span>
                <span grow></span>
                <span>{languageLabel(activeFile)}</span>
              </jui-group>
            ) : null}
          </jui-stack>

          {renderSplitPreview ? (
            <jui-drawer
              position="right"
              show="tablet"
              grow
              mix={css({
                "--max-width-desktop": "max(375px, 40vw)",
                "--max-width-mobile": "100vw",
              })}
            >
              <dialog
                closedby="any"
                mix={ref((node: HTMLDialogElement, signal) => {
                  previewDialog = node;
                  signal.addEventListener("abort", () => {
                    if (previewDialog === node) previewDialog = null;
                  });
                })}
              >
                {renderPreviewPane(consoleOutput, { mobileClose: true })}
              </dialog>
            </jui-drawer>
          ) : null}
        </jui-group>
      </jui-stack>
    );
  };
}
