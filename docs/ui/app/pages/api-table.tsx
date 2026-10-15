import type { Handle, RemixNode } from 'remix/component'

export interface ApiEntry {
  name: string
  type: RemixNode
  defaultValue?: RemixNode
  description: RemixNode
  details?: RemixNode
  required?: boolean
  id?: string
}

export function ApiTable(
  handle: Handle<{
    id: string
    label?: string
    typeLabel?: string
    detailsLabel?: string
    entries: readonly ApiEntry[]
    defaults?: boolean
  }>,
) {
  return () => {
    let {
      id,
      label = 'Name',
      typeLabel = 'Type',
      detailsLabel = 'Details',
      entries,
      defaults = false,
    } = handle.props
    return (
      <div id={id} class="ui-api-table" data-defaults={defaults || undefined}>
        <div class="ui-api-table-header" aria-hidden="true">
          <span>{label}</span>
          <span>{typeLabel}</span>
          {defaults ? <span>Default</span> : null}
          <span />
        </div>
        {entries.map((entry) => {
          let entryId =
            entry.id ?? `${id}-${entry.name.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '')}`
          return (
            <details key={entry.name} class="ui-api-entry">
              <summary>
                <span class="ui-api-name">
                  <code>{entry.name}</code>
                  {entry.required ? <span class="ui-api-required">Required</span> : null}
                </span>
                <span class="ui-api-type">{entry.type}</span>
                {defaults ? (
                  <span class="ui-api-default">
                    <span class="ui-api-default-label">Default </span>
                    {entry.defaultValue ?? <span>None</span>}
                  </span>
                ) : null}
                <span class="ui-api-chevron" aria-hidden="true" />
              </summary>
              <div id={entryId} class="ui-api-entry-content">
                <table class="ui-api-details" aria-label={`${entry.name} details`}>
                  <tbody>
                    <tr>
                      <th scope="row">Description</th>
                      <td>
                        <a
                          class="ui-api-permalink"
                          href={`#${entryId}`}
                          aria-label={`Link to ${entry.name}`}
                        >
                          <PermalinkIcon />
                        </a>
                        {entry.description}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">{typeLabel}</th>
                      <td>{entry.type}</td>
                    </tr>
                    {defaults && entry.defaultValue !== undefined ? (
                      <tr>
                        <th scope="row">Default</th>
                        <td>{entry.defaultValue}</td>
                      </tr>
                    ) : null}
                    {entry.details ? (
                      <tr>
                        <th scope="row">{detailsLabel}</th>
                        <td>{entry.details}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </details>
          )
        })}
      </div>
    )
  }
}

function PermalinkIcon() {
  return () => (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}
