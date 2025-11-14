import { createSignal, createSelector, For } from 'solid-js'
import { render } from 'solid-js/web'
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

export const name = 'solid'

// Stateful Metric Card Component
function MetricCard(props: { id: number; label: string; value: string; change: string }) {
  let [selected, setSelected] = createSignal(false)
  let [hovered, setHovered] = createSignal(false)

  return (
    <div
      class={`metric-card ${selected() ? 'selected' : ''}`}
      onClick={() => setSelected(!selected())}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(e) => {
        e.currentTarget.style.outline = '2px solid #222'
        e.currentTarget.style.outlineOffset = '2px'
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = ''
      }}
      tabIndex={0}
      style={{
        'background-color': hovered() ? '#f5f5f5' : '#fff',
        transform: hovered() && !selected() ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.2s',
        padding: '20px',
        border: '1px solid #ddd',
        'border-radius': '8px',
        cursor: 'pointer',
        'box-shadow': selected() ? '0 4px 8px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ 'font-size': '14px', color: '#666', 'margin-bottom': '8px' }}>
        {props.label}
      </div>
      <div style={{ 'font-size': '24px', 'font-weight': 'bold', 'margin-bottom': '4px' }}>
        {props.value}
      </div>
      <div
        style={{ 'font-size': '12px', color: props.change.startsWith('+') ? '#28a745' : '#dc3545' }}
      >
        {props.change}
      </div>
    </div>
  )
}

// Stateful Chart Bar Component
function ChartBar(props: { value: number; index: number }) {
  let [hovered, setHovered] = createSignal(false)

  return (
    <div
      class="chart-bar"
      style={{
        height: `${props.value}%`,
        'background-color': hovered() ? '#286090' : '#337ab7',
        width: '30px',
        margin: '0 2px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        opacity: hovered() ? 0.9 : 1,
        transform: hovered() ? 'scaleY(1.1)' : 'scaleY(1)',
      }}
      onClick={() => {}}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(e) => {
        e.currentTarget.style.outline = '2px solid #222'
        e.currentTarget.style.outlineOffset = '2px'
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = ''
      }}
      tabIndex={0}
    />
  )
}

// Stateful Activity Item Component
function ActivityItem(props: { id: number; title: string; time: string; icon: string }) {
  let [read, setRead] = createSignal(false)
  let [hovered, setHovered] = createSignal(false)

  return (
    <li
      class={`activity-item ${read() ? 'read' : ''}`}
      onClick={() => setRead(!read())}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '12px',
        'border-bottom': '1px solid #eee',
        cursor: 'pointer',
        'background-color': hovered() ? '#f5f5f5' : read() ? 'rgba(245, 245, 245, 0.6)' : '#fff',
        display: 'flex',
        'align-items': 'center',
        gap: '12px',
      }}
    >
      <span
        style={{
          width: '32px',
          height: '32px',
          'border-radius': '50%',
          'background-color': '#337ab7',
          color: '#fff',
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
          'font-weight': 'bold',
        }}
      >
        {props.icon}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ 'font-weight': read() ? 'normal' : 'bold' }}>{props.title}</div>
        <div style={{ 'font-size': '12px', color: '#666' }}>{props.time}</div>
      </div>
    </li>
  )
}

// Stateful Dropdown Menu Component
function DropdownMenu(props: { rowId: number }) {
  let [open, setOpen] = createSignal(false)
  let [hovered, setHovered] = createSignal(false)

  let actions = ['View Details', 'Edit', 'Duplicate', 'Archive', 'Delete']

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        class="btn btn-primary"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open())
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid #222'
          e.currentTarget.style.outlineOffset = '2px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = ''
        }}
        style={{
          padding: '4px 8px',
          'font-size': '12px',
          'background-color': hovered() ? '#286090' : '#337ab7',
        }}
      >
        ⋮
      </button>
      {open() && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            'background-color': '#fff',
            border: '1px solid #ddd',
            'border-radius': '4px',
            'box-shadow': '0 4px 8px rgba(0,0,0,0.1)',
            'z-index': 1000,
            'min-width': '150px',
            'margin-top': '4px',
          }}
          onMouseLeave={() => setOpen(false)}
        >
          <For each={actions}>
            {(action, idx) => (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f5f5f5'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fff'
                }}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  'border-bottom': idx() < actions.length - 1 ? '1px solid #eee' : 'none',
                }}
              >
                {action}
              </div>
            )}
          </For>
        </div>
      )}
    </div>
  )
}

// Stateful Dashboard Table Row Component
function DashboardTableRow(props: { row: Row }) {
  let [hovered, setHovered] = createSignal(false)
  let [selected, setSelected] = createSignal(false)

  return (
    <tr
      class={selected() ? 'danger' : ''}
      onClick={() => setSelected(!selected())}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        'background-color': hovered() ? '#f5f5f5' : '#fff',
        cursor: 'pointer',
      }}
    >
      <td style={{ padding: '12px', 'border-top': '1px solid #ddd' }}>{props.row.id}</td>
      <td style={{ padding: '12px', 'border-top': '1px solid #ddd' }}>{props.row.label}</td>
      <td style={{ padding: '12px', 'border-top': '1px solid #ddd' }}>
        <span style={{ color: '#28a745' }}>Active</span>
      </td>
      <td style={{ padding: '12px', 'border-top': '1px solid #ddd' }}>
        ${(props.row.id * 10.5).toFixed(2)}
      </td>
      <td style={{ padding: '12px', 'border-top': '1px solid #ddd' }}>
        <DropdownMenu rowId={props.row.id} />
      </td>
    </tr>
  )
}

// Stateful Search Input Component
function SearchInput() {
  let [value, setValue] = createSignal('')
  let [focused, setFocused] = createSignal(false)

  return (
    <input
      type="text"
      placeholder="Search..."
      value={value()}
      onInput={(e) => setValue(e.currentTarget.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        padding: '8px 12px',
        border: `1px solid ${focused() ? '#337ab7' : '#ddd'}`,
        'border-radius': '4px',
        'font-size': '14px',
        width: '300px',
        outline: focused() ? '2px solid #337ab7' : 'none',
        'outline-offset': '2px',
      }}
    />
  )
}

// Stateful Form Widgets Component
function FormWidgets() {
  let [selectValue, setSelectValue] = createSignal('option1')
  let [checkboxValues, setCheckboxValues] = createSignal<Set<string>>(new Set())
  let [radioValue, setRadioValue] = createSignal('radio1')
  let [toggleValue, setToggleValue] = createSignal(false)
  let [progressValue, setProgressValue] = createSignal(45)

  let checkboxLabels = ['Checkbox 1', 'Checkbox 2', 'Checkbox 3']
  let radioLabels = ['Radio 1', 'Radio 2', 'Radio 3']

  return (
    <div style={{ padding: '20px', 'background-color': '#f9f9f9', 'border-radius': '8px' }}>
      <h3 style={{ 'margin-top': 0, 'margin-bottom': '16px' }}>Settings</h3>
      <div style={{ 'margin-bottom': '16px' }}>
        <label style={{ display: 'block', 'margin-bottom': '4px', 'font-size': '14px' }}>
          Select Option
        </label>
        <select
          value={selectValue()}
          onChange={(e) => setSelectValue(e.currentTarget.value)}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#337ab7'
            e.currentTarget.style.outline = '2px solid #337ab7'
            e.currentTarget.style.outlineOffset = '2px'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#ddd'
            e.currentTarget.style.outline = 'none'
          }}
          style={{
            padding: '6px 12px',
            border: '1px solid #ddd',
            'border-radius': '4px',
            'font-size': '14px',
            width: '100%',
          }}
        >
          <option value="option1">Option 1</option>
          <option value="option2">Option 2</option>
          <option value="option3">Option 3</option>
          <option value="option4">Option 4</option>
        </select>
      </div>
      <For each={checkboxLabels}>
        {(label, idx) => (
          <div
            style={{
              'margin-bottom': '12px',
              display: 'flex',
              'align-items': 'center',
              gap: '8px',
            }}
          >
            <input
              type="checkbox"
              id={`checkbox-${idx()}`}
              checked={checkboxValues().has(`checkbox-${idx()}`)}
              onChange={(e) => {
                let next = new Set(checkboxValues())
                if (e.target.checked) {
                  next.add(`checkbox-${idx()}`)
                } else {
                  next.delete(`checkbox-${idx()}`)
                }
                setCheckboxValues(next)
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid #337ab7'
                e.currentTarget.style.outlineOffset = '2px'
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = ''
              }}
            />
            <label for={`checkbox-${idx()}`} style={{ 'font-size': '14px', cursor: 'pointer' }}>
              {label}
            </label>
          </div>
        )}
      </For>
      <div style={{ 'margin-bottom': '16px' }}>
        <For each={radioLabels}>
          {(label, idx) => (
            <label style={{ display: 'block', 'margin-bottom': '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="radio-group"
                value={`radio${idx() + 1}`}
                checked={radioValue() === `radio${idx() + 1}`}
                onChange={(e) => setRadioValue(e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.outline = '2px solid #337ab7'
                  e.currentTarget.style.outlineOffset = '2px'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = ''
                }}
                style={{ 'margin-right': '8px' }}
              />
              {label}
            </label>
          )}
        </For>
      </div>
      <div style={{ 'margin-bottom': '16px' }}>
        <label style={{ display: 'block', 'margin-bottom': '4px', 'font-size': '14px' }}>
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
            checked={toggleValue()}
            onChange={(e) => setToggleValue(e.target.checked)}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid #222'
              e.currentTarget.style.outlineOffset = '2px'
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = ''
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
              'background-color': toggleValue() ? '#337ab7' : '#ccc',
              'border-radius': '24px',
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
                'background-color': '#fff',
                'border-radius': '50%',
                transition: 'transform 0.3s',
                transform: toggleValue() ? 'translateX(26px)' : 'translateX(0)',
              }}
            />
          </span>
        </label>
      </div>
      <div>
        <label style={{ display: 'block', 'margin-bottom': '4px', 'font-size': '14px' }}>
          Progress Bar
        </label>
        <div
          style={{
            width: '100%',
            height: '24px',
            'background-color': '#eee',
            'border-radius': '4px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: `${progressValue()}%`,
              height: '100%',
              'background-color': '#337ab7',
              transition: 'width 0.3s',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              color: '#fff',
              'font-size': '12px',
            }}
          >
            {progressValue()}%
          </div>
        </div>
      </div>
    </div>
  )
}

function Dashboard(props: { onSwitchToTable: () => void }) {
  let [dashboardRows, setDashboardRows] = createSignal(buildData(300))

  let sortDashboardAsc = () => {
    setDashboardRows((current) => sortRows(current, true))
  }

  let sortDashboardDesc = () => {
    setDashboardRows((current) => sortRows(current, false))
  }
  let chartData = [65, 45, 78, 52, 89, 34, 67, 91, 43, 56, 72, 38, 55, 82, 47, 63, 71, 39, 58, 84]
  let activities = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    title: `Activity ${i + 1}: ${['Order placed', 'Payment received', 'Shipment created', 'Customer registered', 'Product updated'][i % 5]}`,
    time: `${i + 1} ${i === 0 ? 'minute' : 'minutes'} ago`,
    icon: ['O', 'P', 'S', 'C', 'U'][i % 5],
  }))

  return (
    <div class="container" style={{ 'max-width': '1400px' }}>
      <div
        style={{
          display: 'flex',
          'margin-bottom': '20px',
          'align-items': 'center',
          'justify-content': 'space-between',
        }}
      >
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <button
          id="switchToTable"
          class="btn btn-primary"
          type="button"
          onClick={props.onSwitchToTable}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid #222'
            e.currentTarget.style.outlineOffset = '2px'
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = ''
          }}
        >
          Switch to Table
        </button>
      </div>

      <div style={{ display: 'flex', gap: '20px', 'margin-bottom': '20px' }}>
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
          'grid-template-columns': '1fr 1fr',
          gap: '20px',
          'margin-bottom': '20px',
        }}
      >
        <div
          style={{
            padding: '20px',
            'background-color': '#fff',
            border: '1px solid #ddd',
            'border-radius': '8px',
          }}
        >
          <h3 style={{ 'margin-top': 0, 'margin-bottom': '16px' }}>Sales Performance</h3>
          <div
            style={{
              display: 'flex',
              'align-items': 'flex-end',
              'justify-content': 'space-around',
              height: '200px',
              padding: '20px 0',
            }}
          >
            <For each={chartData}>
              {(value, index) => <ChartBar value={value} index={index()} />}
            </For>
          </div>
        </div>

        <div
          style={{
            padding: '20px',
            'background-color': '#fff',
            border: '1px solid #ddd',
            'border-radius': '8px',
          }}
        >
          <h3 style={{ 'margin-top': 0, 'margin-bottom': '16px' }}>Recent Activity</h3>
          <ul
            style={{
              'list-style': 'none',
              padding: 0,
              margin: 0,
              'max-height': '200px',
              'overflow-y': 'auto',
            }}
          >
            <For each={activities}>{(activity) => <ActivityItem {...activity} />}</For>
          </ul>
        </div>
      </div>

      <div style={{ 'margin-bottom': '20px' }}>
        <div
          style={{
            display: 'flex',
            'justify-content': 'space-between',
            'align-items': 'center',
            'margin-bottom': '12px',
          }}
        >
          <div style={{ display: 'flex', 'align-items': 'center', gap: '12px' }}>
            <h3 style={{ margin: 0 }}>Dashboard Items</h3>
            <button
              id="sortDashboardAsc"
              class="btn btn-primary"
              type="button"
              onClick={sortDashboardAsc}
              style={{ padding: '4px 8px', 'font-size': '12px' }}
            >
              Sort ↑
            </button>
            <button
              id="sortDashboardDesc"
              class="btn btn-primary"
              type="button"
              onClick={sortDashboardDesc}
              style={{ padding: '4px 8px', 'font-size': '12px' }}
            >
              Sort ↓
            </button>
          </div>
          <SearchInput />
        </div>
        <div
          style={{
            'background-color': '#fff',
            border: '1px solid #ddd',
            'border-radius': '8px',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', 'border-collapse': 'collapse' }}>
            <thead>
              <tr style={{ 'background-color': '#f5f5f5' }}>
                <th
                  style={{
                    padding: '12px',
                    'text-align': 'left',
                    'border-bottom': '2px solid #ddd',
                  }}
                >
                  ID
                </th>
                <th
                  style={{
                    padding: '12px',
                    'text-align': 'left',
                    'border-bottom': '2px solid #ddd',
                  }}
                >
                  Label
                </th>
                <th
                  style={{
                    padding: '12px',
                    'text-align': 'left',
                    'border-bottom': '2px solid #ddd',
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    padding: '12px',
                    'text-align': 'left',
                    'border-bottom': '2px solid #ddd',
                  }}
                >
                  Value
                </th>
                <th
                  style={{
                    padding: '12px',
                    'text-align': 'left',
                    'border-bottom': '2px solid #ddd',
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={dashboardRows()}>{(row) => <DashboardTableRow row={row} />}</For>
            </tbody>
          </table>
        </div>
      </div>

      <FormWidgets />
    </div>
  )
}

function App() {
  let [rows, setRows] = createSignal<Row[]>([])
  let [selected, setSelected] = createSignal<number | null>(null)
  let [view, setView] = createSignal<'table' | 'dashboard'>('table')

  let run = () => {
    setRows(get1000Rows())
    setSelected(null)
  }

  let runLots = () => {
    setRows(get10000Rows())
    setSelected(null)
  }

  let add = () => {
    setRows((current) => [...current, ...get1000Rows()])
  }

  let update = () => {
    setRows((current) => updatedEvery10thRow(current))
  }

  let clear = () => {
    setRows([])
    setSelected(null)
  }

  let swap = () => {
    setRows((current) => swapRows(current))
  }

  let removeRow = (id: number) => {
    setRows((current) => remove(current, id))
  }

  let sortAsc = () => {
    setRows((current) => sortRows(current, true))
  }

  let sortDesc = () => {
    setRows((current) => sortRows(current, false))
  }

  let switchToDashboard = () => {
    setView('dashboard')
  }

  let switchToTable = () => {
    setView('table')
  }

  let isSelected = createSelector(selected)

  return (
    <>
      {view() === 'dashboard' ? (
        <Dashboard onSwitchToTable={switchToTable} />
      ) : (
        <div class="container">
          <div class="jumbotron">
            <div class="row">
              <div class="col-md-6">
                <h1>SolidJS</h1>
              </div>
              <div class="col-md-6">
                <div class="row">
                  <div class="col-sm-6 smallpad">
                    <button id="run" class="btn btn-primary btn-block" type="button" onClick={run}>
                      Create 1,000 rows
                    </button>
                  </div>
                  <div class="col-sm-6 smallpad">
                    <button
                      id="runlots"
                      class="btn btn-primary btn-block"
                      type="button"
                      onClick={runLots}
                    >
                      Create 10,000 rows
                    </button>
                  </div>
                  <div class="col-sm-6 smallpad">
                    <button id="add" class="btn btn-primary btn-block" type="button" onClick={add}>
                      Append 1,000 rows
                    </button>
                  </div>
                  <div class="col-sm-6 smallpad">
                    <button
                      id="update"
                      class="btn btn-primary btn-block"
                      type="button"
                      onClick={update}
                    >
                      Update every 10th row
                    </button>
                  </div>
                  <div class="col-sm-6 smallpad">
                    <button
                      id="clear"
                      class="btn btn-primary btn-block"
                      type="button"
                      onClick={clear}
                    >
                      Clear
                    </button>
                  </div>
                  <div class="col-sm-6 smallpad">
                    <button
                      id="swaprows"
                      class="btn btn-primary btn-block"
                      type="button"
                      onClick={swap}
                    >
                      Swap Rows
                    </button>
                  </div>
                  <div class="col-sm-6 smallpad">
                    <button
                      id="sortasc"
                      class="btn btn-primary btn-block"
                      type="button"
                      onClick={sortAsc}
                    >
                      Sort Ascending
                    </button>
                  </div>
                  <div class="col-sm-6 smallpad">
                    <button
                      id="sortdesc"
                      class="btn btn-primary btn-block"
                      type="button"
                      onClick={sortDesc}
                    >
                      Sort Descending
                    </button>
                  </div>
                  <div class="col-sm-6 smallpad">
                    <button
                      id="switchToDashboard"
                      class="btn btn-primary btn-block"
                      type="button"
                      onClick={switchToDashboard}
                    >
                      Switch to Dashboard
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <table class="table table-hover table-striped test-data">
            <tbody>
              <For each={rows()}>
                {(row) => {
                  let rowId = row.id
                  return (
                    <tr class={isSelected(rowId) ? 'danger' : ''}>
                      <td class="col-md-1">{rowId}</td>
                      <td class="col-md-4">
                        <a
                          href="#"
                          onClick={(event) => {
                            event.preventDefault()
                            setSelected(rowId)
                          }}
                        >
                          {row.label}
                        </a>
                      </td>
                      <td class="col-md-1">
                        <a
                          href="#"
                          onClick={(event) => {
                            event.preventDefault()
                            removeRow(rowId)
                          }}
                        >
                          <span class="glyphicon glyphicon-remove" aria-hidden="true" />
                        </a>
                      </td>
                      <td class="col-md-6" />
                    </tr>
                  )
                }}
              </For>
            </tbody>
          </table>
          <span class="preloadicon glyphicon glyphicon-remove" aria-hidden="true" />
        </div>
      )}
    </>
  )
}

let el = document.getElementById('app')!
render(() => <App />, el)
