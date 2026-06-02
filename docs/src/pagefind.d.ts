// Type declarations for Pagefind Component UI custom elements
declare namespace JSX {
  interface IntrinsicElements {
    'pagefind-modal': {
      instance?: string
      'reset-on-close'?: boolean
      'data-key'?: string
      'rmx-ignore'?: boolean | ''
      mix?: unknown
    }
    'pagefind-modal-trigger': {
      instance?: string
      compact?: boolean
      placeholder?: string
      shortcut?: string
      'data-key'?: string
      'hide-shortcut'?: boolean
      'rmx-ignore'?: boolean | ''
      mix?: unknown
    }
  }
}
