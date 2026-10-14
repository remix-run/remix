import type { RemixNode } from 'remix/component'

export function referenceTable(
  columns: readonly string[],
  rows: readonly (readonly string[])[],
): RemixNode {
  return (
    <table>
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
    </table>
  )
}
