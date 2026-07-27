// Type declarations for Pagefind Component UI custom elements
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
      style?: string
    }
    'pagefind-modal-trigger': {
      instance?: string
      compact?: boolean
      placeholder?: string
      shortcut?: string
      'data-key'?: string
      'hide-shortcut'?: boolean
      'rmx-preserve-dom'?: boolean | ''
      style?: string
    }
  }
}
