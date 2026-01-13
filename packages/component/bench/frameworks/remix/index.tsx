import {
  get1000Rows,
  get10000Rows,
  remove,
  sortRows,
  swapRows,
  updatedEvery10thRow,
  buildData,
} from '../shared.ts'
import type { Benchmark, Row } from '../shared.ts'
import { type Handle, createRoot } from '@remix-run/component'

export const name = 'remix'

function Button() {
  return ({ id, text, fn }: { id: string; text: string; fn: () => void }) => (
    <div class="col-sm-6 smallpad">
      <button id={id} class="btn btn-primary btn-block" type="button" on={{ click: fn }}>
        {text}
      </button>
    </div>
  )
}

// Stateful Metric Card Component
function MetricCard(handle: Handle) {
  let selected = false
  let hovered = false

  return ({
    id,
    label,
    value,
    change,
  }: {
    id: number
    label: string
    value: string
    change: string
  }) => (
    <div
      class={`metric-card ${selected ? 'selected' : ''}`}
      on={{
        click: () => {
          selected = !selected
          handle.update()
        },
        mouseenter: () => {
          hovered = true
          handle.update()
        },
        mouseleave: () => {
          hovered = false
          handle.update()
        },
        focus: (e: any) => {
          e.currentTarget.style.outline = '2px solid #222'
          e.currentTarget.style.outlineOffset = '2px'
        },
        blur: (e: any) => {
          e.currentTarget.style.outline = ''
        },
      }}
      tabIndex={0}
      style={{
        backgroundColor: hovered ? '#f5f5f5' : '#fff',
        transform: hovered && !selected ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.2s',
        padding: '20px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        cursor: 'pointer',
        boxShadow: selected ? '0 4px 8px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>{value}</div>
      <div style={{ fontSize: '12px', color: change.startsWith('+') ? '#28a745' : '#dc3545' }}>
        {change}
      </div>
    </div>
  )
}

// Stateful Chart Bar Component
function ChartBar(handle: Handle) {
  let hovered = false

  return ({ value, index }: { value: number; index: number }) => (
    <div
      class="chart-bar"
      style={{
        height: `${value}%`,
        backgroundColor: hovered ? '#286090' : '#337ab7',
        width: '30px',
        margin: '0 2px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        opacity: hovered ? 0.9 : 1,
        transform: hovered ? 'scaleY(1.1)' : 'scaleY(1)',
      }}
      on={{
        click: () => {},
        mouseenter: () => {
          hovered = true
          handle.update()
        },
        mouseleave: () => {
          hovered = false
          handle.update()
        },
        focus: (e: any) => {
          e.currentTarget.style.outline = '2px solid #222'
          e.currentTarget.style.outlineOffset = '2px'
        },
        blur: (e: any) => {
          e.currentTarget.style.outline = ''
        },
      }}
      tabIndex={0}
    />
  )
}

// Stateful Activity Item Component
function ActivityItem(handle: Handle) {
  let read = false
  let hovered = false

  return ({ id, title, time, icon }: { id: number; title: string; time: string; icon: string }) => (
    <li
      class={`activity-item ${read ? 'read' : ''}`}
      on={{
        click: () => {
          read = !read
          handle.update()
        },
        mouseenter: () => {
          hovered = true
          handle.update()
        },
        mouseleave: () => {
          hovered = false
          handle.update()
        },
      }}
      style={{
        padding: '12px',
        borderBottom: '1px solid #eee',
        cursor: 'pointer',
        backgroundColor: hovered ? '#f5f5f5' : read ? 'rgba(245, 245, 245, 0.6)' : '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <span
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: '#337ab7',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: read ? 'normal' : 'bold' }}>{title}</div>
        <div style={{ fontSize: '12px', color: '#666' }}>{time}</div>
      </div>
    </li>
  )
}

// Stateful Dropdown Menu Component
function DropdownMenu(handle: Handle) {
  let open = false
  let hovered = false

  let actions = ['View Details', 'Edit', 'Duplicate', 'Archive', 'Delete']

  return ({ rowId }: { rowId: number }) => (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        class="btn btn-primary"
        on={{
          click: (e: any) => {
            e.stopPropagation()
            open = !open
            handle.update()
          },
          mouseenter: () => {
            hovered = true
            handle.update()
          },
          mouseleave: () => {
            hovered = false
            handle.update()
          },
          focus: (e: any) => {
            e.currentTarget.style.outline = '2px solid #222'
            e.currentTarget.style.outlineOffset = '2px'
          },
          blur: (e: any) => {
            e.currentTarget.style.outline = ''
          },
        }}
        style={{
          padding: '4px 8px',
          fontSize: '12px',
          backgroundColor: hovered ? '#286090' : '#337ab7',
        }}
      >
        ⋮
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
            zIndex: 1000,
            minWidth: '150px',
            marginTop: '4px',
          }}
          on={{
            mouseleave: () => {
              open = false
              handle.update()
            },
          }}
        >
          {actions.map((action, idx) => (
            <div
              key={idx}
              on={{
                click: (e: any) => {
                  e.stopPropagation()
                  open = false
                  handle.update()
                },
                mouseenter: (e: any) => {
                  e.currentTarget.style.backgroundColor = '#f5f5f5'
                },
                mouseleave: (e: any) => {
                  e.currentTarget.style.backgroundColor = '#fff'
                },
              }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: idx < actions.length - 1 ? '1px solid #eee' : 'none',
              }}
            >
              {action}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Stateful Dashboard Table Row Component
function DashboardTableRow(handle: Handle) {
  let hovered = false
  let selected = false

  return ({ row }: { row: Row }) => (
    <tr
      class={selected ? 'danger' : ''}
      on={{
        click: () => {
          selected = !selected
          handle.update()
        },
        mouseenter: () => {
          hovered = true
          handle.update()
        },
        mouseleave: () => {
          hovered = false
          handle.update()
        },
      }}
      style={{
        backgroundColor: hovered ? '#f5f5f5' : '#fff',
        cursor: 'pointer',
      }}
    >
      <td style={{ padding: '12px', borderTop: '1px solid #ddd' }}>{row.id}</td>
      <td style={{ padding: '12px', borderTop: '1px solid #ddd' }}>{row.label}</td>
      <td style={{ padding: '12px', borderTop: '1px solid #ddd' }}>
        <span style={{ color: '#28a745' }}>Active</span>
      </td>
      <td style={{ padding: '12px', borderTop: '1px solid #ddd' }}>
        ${(row.id * 10.5).toFixed(2)}
      </td>
      <td style={{ padding: '12px', borderTop: '1px solid #ddd' }}>
        <DropdownMenu rowId={row.id} />
      </td>
    </tr>
  )
}

// Stateful Search Input Component
function SearchInput(handle: Handle) {
  let value = ''
  let focused = false

  return () => (
    <input
      type="text"
      placeholder="Search..."
      value={value}
      on={{
        input: (e: any) => {
          value = e.target.value
          handle.update()
        },
        focus: () => {
          focused = true
          handle.update()
        },
        blur: () => {
          focused = false
          handle.update()
        },
      }}
      style={{
        padding: '8px 12px',
        border: `1px solid ${focused ? '#337ab7' : '#ddd'}`,
        borderRadius: '4px',
        fontSize: '14px',
        width: '300px',
        outline: focused ? '2px solid #337ab7' : 'none',
        outlineOffset: '2px',
      }}
    />
  )
}

// Stateful Form Widgets Component
function FormWidgets(handle: Handle) {
  let selectValue = 'option1'
  let checkboxValues = new Set<string>()
  let radioValue = 'radio1'
  let toggleValue = false
  let progressValue = 45

  return () => (
    <div style={{ padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
      <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Settings</h3>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
          Select Option
        </label>
        <select
          value={selectValue}
          on={{
            change: (e: any) => {
              selectValue = e.target.value
              handle.update()
            },
            focus: (e: any) => {
              e.currentTarget.style.borderColor = '#337ab7'
              e.currentTarget.style.outline = '2px solid #337ab7'
              e.currentTarget.style.outlineOffset = '2px'
            },
            blur: (e: any) => {
              e.currentTarget.style.borderColor = '#ddd'
              e.currentTarget.style.outline = 'none'
            },
          }}
          style={{
            padding: '6px 12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
            width: '100%',
          }}
        >
          <option value="option1">Option 1</option>
          <option value="option2">Option 2</option>
          <option value="option3">Option 3</option>
          <option value="option4">Option 4</option>
        </select>
      </div>
      {['Checkbox 1', 'Checkbox 2', 'Checkbox 3'].map((label, idx) => (
        <div
          key={idx}
          style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <input
            type="checkbox"
            id={`checkbox-${idx}`}
            checked={checkboxValues.has(`checkbox-${idx}`)}
            on={{
              change: (e: any) => {
                if (e.target.checked) {
                  checkboxValues.add(`checkbox-${idx}`)
                } else {
                  checkboxValues.delete(`checkbox-${idx}`)
                }
                handle.update()
              },
              focus: (e: any) => {
                e.currentTarget.style.outline = '2px solid #337ab7'
                e.currentTarget.style.outlineOffset = '2px'
              },
              blur: (e: any) => {
                e.currentTarget.style.outline = ''
              },
            }}
          />
          <label for={`checkbox-${idx}`} style={{ fontSize: '14px', cursor: 'pointer' }}>
            {label}
          </label>
        </div>
      ))}
      <div style={{ marginBottom: '16px' }}>
        {['Radio 1', 'Radio 2', 'Radio 3'].map((label, idx) => (
          <label key={idx} style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="radio-group"
              value={`radio${idx + 1}`}
              checked={radioValue === `radio${idx + 1}`}
              on={{
                change: (e: any) => {
                  radioValue = e.target.value
                  handle.update()
                },
                focus: (e: any) => {
                  e.currentTarget.style.outline = '2px solid #337ab7'
                  e.currentTarget.style.outlineOffset = '2px'
                },
                blur: (e: any) => {
                  e.currentTarget.style.outline = ''
                },
              }}
              style={{ marginRight: '8px' }}
            />
            {label}
          </label>
        ))}
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
          Toggle Switch
        </label>
        <label
          style={{
            display: 'inline-block',
            position: 'relative',
            width: '50px',
            height: '24px',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={toggleValue}
            on={{
              change: (e: any) => {
                toggleValue = e.target.checked
                handle.update()
              },
              focus: (e: any) => {
                e.currentTarget.style.outline = '2px solid #222'
                e.currentTarget.style.outlineOffset = '2px'
              },
              blur: (e: any) => {
                e.currentTarget.style.outline = ''
              },
            }}
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          <span
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: toggleValue ? '#337ab7' : '#ccc',
              borderRadius: '24px',
              transition: 'background-color 0.3s',
            }}
          >
            <span
              style={{
                position: 'absolute',
                content: '""',
                height: '18px',
                width: '18px',
                left: '3px',
                bottom: '3px',
                backgroundColor: '#fff',
                borderRadius: '50%',
                transition: 'transform 0.3s',
                transform: toggleValue ? 'translateX(26px)' : 'translateX(0)',
              }}
            />
          </span>
        </label>
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
          Progress Bar
        </label>
        <div
          style={{
            width: '100%',
            height: '24px',
            backgroundColor: '#eee',
            borderRadius: '4px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: `${progressValue}%`,
              height: '100%',
              backgroundColor: '#337ab7',
              transition: 'width 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '12px',
            }}
          >
            {progressValue}%
          </div>
        </div>
      </div>
    </div>
  )
}

function Dashboard(handle: Handle) {
  let dashboardRows = buildData(300)

  let sortDashboardAsc = () => {
    dashboardRows = sortRows(dashboardRows, true)
    handle.update()
  }

  let sortDashboardDesc = () => {
    dashboardRows = sortRows(dashboardRows, false)
    handle.update()
  }
  let chartData = [65, 45, 78, 52, 89, 34, 67, 91, 43, 56, 72, 38, 55, 82, 47, 63, 71, 39, 58, 84]
  let activities = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    title: `Activity ${i + 1}: ${['Order placed', 'Payment received', 'Shipment created', 'Customer registered', 'Product updated'][i % 5]}`,
    time: `${i + 1} ${i === 0 ? 'minute' : 'minutes'} ago`,
    icon: ['O', 'P', 'S', 'C', 'U'][i % 5],
  }))

  return ({ onSwitchToTable }: { onSwitchToTable: () => void }) => (
    <div class="container" style={{ maxWidth: '1400px' }}>
      <div
        style={{
          display: 'flex',
          marginBottom: '20px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <button
          id="switchToTable"
          class="btn btn-primary"
          type="button"
          on={{ click: onSwitchToTable }}
        >
          Switch to Table
        </button>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div style={{ flex: 1, display: 'flex', gap: '16px' }}>
          <MetricCard id={1} label="Total Sales" value="$125,430" change="+12.5%" />
          <MetricCard id={2} label="Orders" value="1,234" change="+8.2%" />
          <MetricCard id={3} label="Customers" value="5,678" change="+15.3%" />
          <MetricCard id={4} label="Revenue" value="$89,123" change="+9.7%" />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            padding: '20px',
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '8px',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Sales Performance</h3>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-around',
              height: '200px',
              padding: '20px 0',
            }}
          >
            {chartData.map((value, index) => (
              <ChartBar key={index} value={value} index={index} />
            ))}
          </div>
        </div>

        <div
          style={{
            padding: '20px',
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '8px',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Recent Activity</h3>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              maxHeight: '200px',
              overflowY: 'auto',
            }}
          >
            {activities.map((activity) => (
              <ActivityItem key={activity.id} {...activity} />
            ))}
          </ul>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 style={{ margin: 0 }}>Dashboard Items</h3>
            <button
              id="sortDashboardAsc"
              class="btn btn-primary"
              type="button"
              on={{ click: sortDashboardAsc }}
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              Sort ↑
            </button>
            <button
              id="sortDashboardDesc"
              class="btn btn-primary"
              type="button"
              on={{ click: sortDashboardDesc }}
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              Sort ↓
            </button>
          </div>
          <SearchInput />
        </div>
        <div
          style={{
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                  ID
                </th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                  Label
                </th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                  Status
                </th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                  Value
                </th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {dashboardRows.map((row) => (
                <DashboardTableRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <FormWidgets />
    </div>
  )
}

function App(handle: Handle) {
  let rows: Row[] = []
  let selected: number | null = null
  let view: 'table' | 'dashboard' = 'table'

  let setRows = (newRows: Row[]) => {
    rows = newRows
    handle.update()
  }

  let setSelected = (newSelected: number | null) => {
    selected = newSelected
    handle.update()
  }

  let switchToDashboard = () => {
    view = 'dashboard'
    handle.update()
  }

  let switchToTable = () => {
    view = 'table'
    handle.update()
  }

  return () => {
    if (view === 'dashboard') {
      return <Dashboard onSwitchToTable={switchToTable} />
    }

    return (
      <div class="container">
        <div class="jumbotron">
          <div class="row">
            <div class="col-md-6">
              <h1>Remix</h1>
            </div>
            <div class="col-md-6">
              <div class="row">
                <Button
                  id="run"
                  text="Create 1,000 rows"
                  fn={() => {
                    rows = get1000Rows()
                    selected = null
                    handle.update()
                  }}
                />
                <Button
                  id="runlots"
                  text="Create 10,000 rows"
                  fn={() => {
                    rows = get10000Rows()
                    selected = null
                    handle.update()
                  }}
                />
                <Button
                  id="add"
                  text="Append 1,000 rows"
                  fn={() => {
                    setRows([...rows, ...get1000Rows()])
                  }}
                />
                <Button
                  id="update"
                  text="Update every 10th row"
                  fn={() => {
                    setRows(updatedEvery10thRow(rows))
                  }}
                />
                <Button
                  id="clear"
                  text="Clear"
                  fn={() => {
                    rows = []
                    selected = null
                    handle.update()
                  }}
                />
                <Button
                  id="swaprows"
                  text="Swap Rows"
                  fn={() => {
                    setRows(swapRows(rows))
                  }}
                />
                <Button
                  id="sortasc"
                  text="Sort Ascending"
                  fn={() => {
                    setRows(sortRows(rows, true))
                  }}
                />
                <Button
                  id="sortdesc"
                  text="Sort Descending"
                  fn={() => {
                    setRows(sortRows(rows, false))
                  }}
                />
                <Button id="switchToDashboard" text="Switch to Dashboard" fn={switchToDashboard} />
              </div>
            </div>
          </div>
        </div>
        <table class="table table-hover table-striped test-data">
          <tbody>
            {rows.map((row) => {
              let rowId = row.id
              return (
                <tr key={rowId} class={selected === rowId ? 'danger' : ''}>
                  <td class="col-md-1">{rowId}</td>
                  <td class="col-md-4">
                    <a
                      on={{
                        click: () => {
                          setSelected(rowId)
                        },
                      }}
                    >
                      {row.label}
                    </a>
                  </td>
                  <td class="col-md-1">
                    <a
                      on={{
                        click: () => {
                          setRows(remove(rows, rowId))
                        },
                      }}
                    >
                      <span class="glyphicon glyphicon-remove" aria-hidden="true" />
                    </a>
                  </td>
                  <td class="col-md-6" />
                </tr>
              )
            })}
          </tbody>
        </table>
        <span class="preloadicon glyphicon glyphicon-remove" aria-hidden="true" />
      </div>
    )
  }
}

let el = document.getElementById('app')!
let root = createRoot(el)
root.render(<App />)
