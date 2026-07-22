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
  }
}
