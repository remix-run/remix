// DOM-only test helpers. Kept in a separate entry from `@remix-run/test` so
// the main entry's types stay node-compatible — anything here pulls in DOM
// lib types and is only useful from browser-mode test files.
export { userEvent } from './lib/user-event.ts'
export type { KeyboardKey, UserEvent } from './lib/user-event.ts'
