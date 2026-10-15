import type { Handle, RemixNode } from 'remix/component'

export function referenceTable(
  columns: readonly string[],
  rows: readonly (readonly string[])[],
): RemixNode {
  return (
    <ReferenceTable>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            {row.map((cell, index) => (
              <td key={index}>{index < row.length - 1 ? <code>{cell}</code> : cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </ReferenceTable>
  )
}

export function ReferenceTable(handle: Handle<{ children?: RemixNode }>) {
  return () => (
    <div class="ui-reference-table">
      <table>{handle.props.children}</table>
    </div>
  )
}
