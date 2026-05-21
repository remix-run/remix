// Type declarations for Pagefind Component UI custom elements
declare namespace JSX {
  interface IntrinsicElements {
    'pagefind-modal': { instance?: string; 'reset-on-close'?: boolean; mix?: unknown }
    'pagefind-modal-trigger': {
      instance?: string
      compact?: boolean
      placeholder?: string
      shortcut?: string
      'hide-shortcut'?: boolean
      mix?: unknown
    }
  }
}
