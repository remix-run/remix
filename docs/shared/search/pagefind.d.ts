declare namespace JSX {
  interface IntrinsicElements {
    'pagefind-config': {
      'base-url'?: string
      'bundle-path'?: string
    }
    'pagefind-modal': {
      instance?: string
      'reset-on-close'?: boolean
      'data-rmx-key'?: string
      'data-rmx-preserve-dom'?: boolean | ''
      style?: string
    }
  }
}
