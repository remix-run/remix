declare namespace JSX {
  interface IntrinsicElements {
    'pagefind-config': {
      'base-url'?: string
      'bundle-path'?: string
    }
    'pagefind-modal': {
      instance?: string
      'reset-on-close'?: boolean
      'data-key'?: string
      'rmx-preserve-dom'?: boolean | ''
    }
    'pagefind-modal-trigger': {
      id?: string
      class?: string
      instance?: string
      compact?: boolean
      placeholder?: string
      shortcut?: string
      'data-key'?: string
      'hide-shortcut'?: boolean
      'aria-hidden'?: boolean | 'true' | 'false'
      'rmx-preserve-dom'?: boolean | ''
    }
  }
}
