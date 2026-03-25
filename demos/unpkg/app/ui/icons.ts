import { html } from 'remix/html-template'

export const icons = {
  file: html`<svg
    class="icon-file"
    viewBox="0 0 16 16"
    fill="none"
    stroke="#57606a"
    stroke-width="1.5"
  >
    <path d="M3 1.5h6.5L13 5v9.5H3z" />
    <path d="M9.5 1.5V5H13" />
  </svg>`,

  directory: html`<svg
    class="icon-dir"
    viewBox="0 0 16 16"
    fill="none"
    stroke="#57606a"
    stroke-width="1.5"
  >
    <path d="M1.5 3.5h4l1.5 2h7.5v8h-13z" />
  </svg>`,
}
