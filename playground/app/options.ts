export type PreviewMode = 'split' | 'toggle'

export interface AppUiOptions {
  /** Height of the playground container. Defaults to full viewport height. */
  height: string

  /** Show the file explorer drawer/sidebar. */
  explorer: boolean

  /** Show open-file tabs above the editor. */
  tabs: boolean

  /** Show the active file breadcrumb/path bar. */
  breadcrumb: boolean

  /** Show the status/language bar below the editor. */
  statusBar: boolean

  /** Show share controls/dialog. */
  shareButton: boolean

  /** Show create/rename/delete controls. */
  fileActions: boolean

  /** Show database migration controls in the explorer. */
  databaseControls: boolean

  /** Enable the live preview pane. */
  preview: boolean

  /** `split` keeps preview visible on larger screens; `toggle` hides it behind a button. */
  previewMode: PreviewMode

  /** Initial visibility when `previewMode` is `toggle`. */
  previewInitiallyOpen: boolean

  /** Show the runtime console below the preview iframe. */
  terminal: boolean
}

export type AppUiOptionsInput = Partial<AppUiOptions>

export const defaultAppUiOptions: AppUiOptions = {
  height: '100vh',
  explorer: true,
  tabs: true,
  breadcrumb: true,
  statusBar: true,
  shareButton: true,
  fileActions: true,
  databaseControls: true,
  preview: true,
  previewMode: 'split',
  previewInitiallyOpen: false,
  terminal: true,
}

export function resolveAppUiOptions(input: AppUiOptionsInput | undefined): AppUiOptions {
  return { ...defaultAppUiOptions, ...input }
}
