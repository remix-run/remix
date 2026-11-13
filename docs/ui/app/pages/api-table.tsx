import type { Handle, RemixNode } from 'remix/component'

interface ApiTableProps {
  id: string
  label?: string
  typeLabel?: string
  defaults?: boolean
  children: RemixNode
}

interface ApiEntryProps {
  name: string
  type: string
  defaultValue?: string
  required?: boolean
  id?: string
  children: RemixNode
}

export function ApiTable(
  handle: Handle<ApiTableProps, Pick<ApiTableProps, 'id' | 'typeLabel' | 'defaults'>>,
) {
  return () => {
    let { id, label = 'Name', typeLabel = 'Type', defaults = false, children } = handle.props
    handle.context.set({ id, typeLabel, defaults })

    return (
      <div id={id} class="ui-api-table" data-defaults={defaults || undefined}>
        <div class="ui-api-table-header" aria-hidden="true">
          <span>{label}</span>
          <span>{typeLabel}</span>
          {defaults ? <span>Default</span> : null}
          <span />
        </div>
        {children}
      </div>
    )
  }
}

export function ApiEntry(handle: Handle<ApiEntryProps>) {
  return () => {
    let { id, name, type, defaultValue, required, children } = handle.props
    let { id: tableId, typeLabel = 'Type', defaults } = handle.context.get(ApiTable)
    let entryId = id ?? `${tableId}-${name.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '')}`

    return (
      <details class="ui-api-entry">
        <summary>
          <span class="ui-api-name">
            <code>{name}</code>
            {required ? <span class="ui-api-required">Required</span> : null}
          </span>
          <span class="ui-api-type">
            <code>{type}</code>
          </span>
          {defaults ? (
            <span class="ui-api-default">
              <span class="ui-api-default-label">Default </span>
              {defaultValue !== undefined ? <code>{defaultValue}</code> : <span>None</span>}
            </span>
          ) : null}
          <span class="ui-api-chevron" aria-hidden="true" />
        </summary>
        <div id={entryId} class="ui-api-entry-content">
          <table class="ui-api-details" aria-label={`${name} details`}>
            <tbody>
              <tr>
                <th scope="row">Description</th>
                <td>
                  <a class="ui-api-permalink" href={`#${entryId}`} aria-label={`Link to ${name}`}>
                    <PermalinkIcon />
                  </a>
                  {children}
                </td>
              </tr>
              <tr>
                <th scope="row">{typeLabel}</th>
                <td>
                  <code>{type}</code>
                </td>
              </tr>
              {defaults && defaultValue !== undefined ? (
                <tr>
                  <th scope="row">Default</th>
                  <td>
                    <code>{defaultValue}</code>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </details>
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
