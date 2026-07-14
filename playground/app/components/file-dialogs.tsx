import { css, on, ref, type Handle } from 'remix/ui'

import { createEntry, deleteFile, renameFile } from '../store/operations.ts'
import { actions, connect, type AppUiApi, shallowEqual } from '../store/index.ts'

/** Read the value of the button that submitted a `<form method="dialog">`. */
function submitterValue(event: Event): string | undefined {
  let submitter = (event as SubmitEvent).submitter
  return submitter instanceof HTMLButtonElement ? submitter.value : undefined
}

/**
 * Modals for the file create / rename / delete flows.
 *
 * The component subscribes to the store's dialog *targets*. Setting a target
 * (from the explorer header or a tree row action) is what opens the matching
 * dialog: each render compares the target's identity against the last one it
 * opened for, and opens the dialog after the update lands (every dispatch
 * produces a fresh target object, so re-requesting the same kind reopens).
 *
 * Forms use `method="dialog"` so the native dialog closes on submit. On confirm
 * the form dispatches the matching operation thunk — {@link createEntry},
 * {@link renameFile}, or {@link deleteFile}.
 */
export function FileDialogs(handle: Handle<{ api: AppUiApi }>) {
  let { api } = handle.props
  let view = connect(
    handle,
    api,
    (s) => ({ create: s.createTarget, rename: s.renameTarget, remove: s.deleteTarget }),
    shallowEqual,
  )

  // Identity of the target each dialog was last opened for, so we open once per
  // request rather than on every render.
  let lastCreate: object | undefined
  let lastRename: object | undefined
  let lastDelete: object | undefined
  let createDialog: HTMLDialogElement | null = null
  let renameDialog: HTMLDialogElement | null = null
  let deleteDialog: HTMLDialogElement | null = null
  let renameInput: HTMLInputElement | null = null

  let createInputId = `${handle.id}-file-create-name`
  let renameInputId = `${handle.id}-file-rename-name`

  return () => {
    let create = view().create
    let rename = view().rename
    let remove = view().remove

    // Open whichever dialog just got a (new) target, after the DOM updates.
    if (create && create !== lastCreate) {
      lastCreate = create
      handle.queueTask(() => {
        if (createDialog && !createDialog.open) createDialog.showModal()
      })
    } else if (!create) lastCreate = undefined

    if (rename && rename !== lastRename) {
      lastRename = rename
      handle.queueTask(() => {
        if (renameDialog && !renameDialog.open) renameDialog.showModal()
        renameInput?.focus()
        renameInput?.select()
      })
    } else if (!rename) lastRename = undefined

    if (remove && remove !== lastDelete) {
      lastDelete = remove
      handle.queueTask(() => {
        if (deleteDialog && !deleteDialog.open) deleteDialog.showModal()
      })
    } else if (!remove) lastDelete = undefined

    let createKind = create?.kind
    let createTitle =
      createKind === 'dir' ? 'New Folder' : createKind === 'file' ? 'New File' : 'New'

    return (
      <>
        {/* --- Create file / folder ------------------------------------- */}
        <jui-modal>
          <dialog
            closedby="any"
            mix={ref((node: HTMLDialogElement, signal) => {
              createDialog = node
              signal.addEventListener('abort', () => {
                if (createDialog === node) createDialog = null
              })
            })}
          >
            <jui-modal-header>
              <jui-group items="center" gap="xs" nowrap>
                {createKind === 'dir' ? (
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    width="1.5rem"
                    height="1.5rem"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                    />
                  </svg>
                ) : (
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    width="1.5em"
                    height="1.5em"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
                    />
                  </svg>
                )}

                <span weight="bolder">{createTitle}</span>
              </jui-group>
            </jui-modal-header>
            <form
              method="dialog"
              mix={on<HTMLFormElement>('submit', (event) => {
                let form = event.currentTarget
                queueMicrotask(() => form.reset())
                api.dispatch(actions.setCreateTarget(undefined))
                if (submitterValue(event) !== 'confirm') return
                let name = String(new FormData(form).get('name') ?? '').trim()
                if (!name) return
                api.dispatch(createEntry(name, createKind))
              })}
            >
              <jui-modal-body>
                <jui-stack gap="sm">
                  <jui-field size="sm">
                    <label for={createInputId}>Name</label>
                    <input
                      id={createInputId}
                      name="name"
                      type="text"
                      autocomplete="off"
                      placeholder={createKind === 'dir' ? 'components' : 'index.tsx'}
                    />
                    <small>Use “/” to create nested folders.</small>
                  </jui-field>
                </jui-stack>
              </jui-modal-body>
              <jui-modal-footer>
                <jui-group justify="end" gap="xs" nowrap>
                  <jui-button size="sm" variant="primary">
                    <button type="submit" value="confirm">
                      <span>Create</span>
                    </button>
                  </jui-button>
                  <jui-button size="sm" variant="muted">
                    <button type="submit" value="cancel">
                      Cancel
                    </button>
                  </jui-button>
                </jui-group>
              </jui-modal-footer>
            </form>
          </dialog>
        </jui-modal>

        {/* --- Rename --------------------------------------------------- */}
        <jui-modal>
          <dialog
            closedby="any"
            mix={ref((node: HTMLDialogElement, signal) => {
              renameDialog = node
              signal.addEventListener('abort', () => {
                if (renameDialog === node) renameDialog = null
              })
            })}
          >
            <jui-modal-header>
              <jui-group items="center" gap="xs" nowrap>
                <span aria-hidden="true">
                  <svg
                    width="1.5rem"
                    height="1.5rem"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                    />
                  </svg>
                </span>
                <span weight="bolder">Rename</span>
              </jui-group>
            </jui-modal-header>
            <form
              method="dialog"
              mix={on<HTMLFormElement>('submit', (event) => {
                let form = event.currentTarget
                queueMicrotask(() => form.reset())
                let target = rename
                api.dispatch(actions.setRenameTarget(undefined))
                if (submitterValue(event) !== 'confirm') return
                if (!target) return
                let name = String(new FormData(form).get('name') ?? '').trim()
                if (!name) return
                api.dispatch(renameFile(target.path, name))
              })}
            >
              <jui-modal-body>
                <jui-stack gap="sm">
                  <jui-field size="sm">
                    <label for={renameInputId}>New path</label>
                    {/*
                      Uncontrolled on purpose: setting a reactive `value` prop
                      makes the runtime restore it on every keystroke, which
                      blocks typing. Seed the full path imperatively and key the
                      input by path so it re-seeds when a new node is targeted.
                    */}
                    <input
                      id={renameInputId}
                      key={rename?.path ?? 'rename'}
                      name="name"
                      type="text"
                      autocomplete="off"
                      placeholder="app/views/home.tsx"
                      mix={ref((node: HTMLInputElement, signal) => {
                        renameInput = node
                        node.value = rename?.path ?? ''
                        signal.addEventListener('abort', () => {
                          if (renameInput === node) renameInput = null
                        })
                      })}
                    />
                    <small>Edit any part of the path to rename or move the file.</small>
                  </jui-field>
                </jui-stack>
              </jui-modal-body>
              <jui-modal-footer>
                <jui-group justify="end" gap="xs" nowrap>
                  <jui-button size="sm" variant="primary">
                    <button type="submit" value="confirm">
                      <span>Rename</span>
                    </button>
                  </jui-button>
                  <jui-button size="sm" variant="muted">
                    <button type="submit" value="cancel">
                      Cancel
                    </button>
                  </jui-button>
                </jui-group>
              </jui-modal-footer>
            </form>
          </dialog>
        </jui-modal>

        {/* --- Delete --------------------------------------------------- */}
        <jui-modal>
          <dialog
            closedby="any"
            mix={ref((node: HTMLDialogElement, signal) => {
              deleteDialog = node
              signal.addEventListener('abort', () => {
                if (deleteDialog === node) deleteDialog = null
              })
            })}
          >
            <jui-modal-header>
              <jui-group items="center" gap="xs" nowrap>
                <span aria-hidden="true">
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    width="1.5rem"
                    height="1.5rem"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                    />
                  </svg>
                </span>
                <span weight="bolder">Delete {remove?.type === 'dir' ? 'folder' : 'file'}</span>
              </jui-group>
            </jui-modal-header>
            <form
              method="dialog"
              mix={on<HTMLFormElement>('submit', (event) => {
                let form = event.currentTarget
                queueMicrotask(() => form.reset())
                let target = remove
                api.dispatch(actions.setDeleteTarget(undefined))
                if (submitterValue(event) !== 'confirm') return
                if (!target) return
                api.dispatch(deleteFile(target.path))
              })}
            >
              <jui-modal-body>
                <jui-stack gap="sm">
                  <p>
                    Are you sure you want to delete{' '}
                    <code mix={css({ wordBreak: 'break-all' })}>{remove?.path ?? 'this item'}</code>
                    ?
                  </p>
                  {remove?.type === 'dir' ? (
                    <p font="sm">This will delete everything inside the folder.</p>
                  ) : null}
                  <p font="sm">This action cannot be undone.</p>
                </jui-stack>
              </jui-modal-body>
              <jui-modal-footer>
                <jui-group justify="end" gap="xs" nowrap>
                  <jui-button size="sm" variant="error">
                    <button type="submit" value="confirm">
                      <span>Delete</span>
                    </button>
                  </jui-button>
                  <jui-button size="sm" variant="muted">
                    <button type="submit" value="cancel">
                      Cancel
                    </button>
                  </jui-button>
                </jui-group>
              </jui-modal-footer>
            </form>
          </dialog>
        </jui-modal>
      </>
    )
  }
}
