import { version } from 'react'

const esm = 'https://esm.unpkg.com'

/**
 * Browser import map for the React runtime. React publishes CommonJS, so the browser loads it
 * through esm.unpkg.com, which converts packages to ES modules on demand.
 *
 * Versions are pinned to the copy installed on the server so hydration matches server output.
 * `react-dom/client` is requested with `?external=react` so its own `react` import stays a bare
 * specifier and resolves through this map; otherwise esm.unpkg.com would inline the newest
 * matching `react` and the page would end up with two copies.
 */
export const reactImportMap = {
  imports: {
    react: `${esm}/react@${version}`,
    'react/jsx-runtime': `${esm}/react@${version}/jsx-runtime`,
    'react-dom/client': `${esm}/react-dom@${version}/client?external=react`,
  },
}
