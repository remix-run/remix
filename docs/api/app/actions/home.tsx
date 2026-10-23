import type { Handle } from 'remix/component'

import type { Versions } from '../data/docs.ts'
import { routes, withVersion } from '../routes.ts'

export function VersionList(handle: Handle<{ versions: Versions; activeVersion?: string }>) {
  return () => {
    let { versions, activeVersion } = handle.props
    if (versions.length < 2) return null

    return (
      <section>
        <h2 id="versions">Versions</h2>
        <ul>
          {versions.map((version, index) => {
            let latest = index === 0
            let active = version === activeVersion || (latest && !activeVersion)

            return (
              <li key={version}>
                <a
                  href={withVersion(routes.home.href(), latest ? undefined : version)}
                  rel={active ? undefined : 'nofollow'}
                  aria-current={active ? 'page' : undefined}
                >
                  {version}
                </a>
                {latest ? ' (latest)' : null}
              </li>
            )
          })}
        </ul>
      </section>
    )
  }
}
