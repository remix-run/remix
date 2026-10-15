import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'
import { animateLayout, prefersReducedMotion, spring } from '@remix-run/ui/animation'

export default function Example(handle: Handle) {
  let sort: 'due' | 'priority' = 'due'
  return () => (
    <div mix={panelCss}>
      <div
        mix={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        })}
      >
        <div>
          <strong>Upcoming tasks</strong>
          <p mix={mutedCss}>3 tasks remaining</p>
        </div>
        <div role="radiogroup" aria-label="Sort tasks" mix={toolbarCss}>
          {sortOptions.map((option) => (
            <label key={option.value}>
              <input
                type="radio"
                name="task-sort"
                checked={sort === option.value}
                mix={on('change', () => {
                  sort = option.value
                  handle.update()
                })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>
      <ol mix={css({ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '8px' })}>
        {[...tasks]
          .sort((a, b) => a[sort] - b[sort])
          .map((task) => (
            <li
              key={task.id}
              mix={[
                surfaceCss,
                css({ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }),
                animateLayout(prefersReducedMotion() ? false : { ...spring('snappy') }),
              ]}
            >
              <div mix={css({ flex: 1, minWidth: 0 })}>
                <strong>{task.title}</strong>
                <p mix={mutedCss}>{task.date}</p>
              </div>
              <span
                mix={css({
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  background:
                    task.priority === 0
                      ? 'light-dark(#fdf0e4, #39291f)'
                      : 'light-dark(#f0f0f5, #292930)',
                  color:
                    task.priority === 0
                      ? 'light-dark(#a75512, #e9ac77)'
                      : 'light-dark(#62626c, #b0b0bb)',
                })}
              >
                {task.priority === 0 ? 'High' : task.priority === 1 ? 'Medium' : 'Low'}
              </span>
            </li>
          ))}
      </ol>
    </div>
  )
}
const sortOptions: { value: 'due' | 'priority'; label: string }[] = [
  { value: 'due', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
]
const tasks = [
  { id: 'notes', title: 'Write release notes', date: 'Due today', due: 0, priority: 2 },
  { id: 'security', title: 'Review security changes', date: 'Due tomorrow', due: 1, priority: 0 },
  { id: 'tests', title: 'Run browser tests', date: 'Due next week', due: 2, priority: 1 },
]

const panelCss = css({
  colorScheme: 'light dark',
  width: '28rem',
  maxWidth: '100%',
  display: 'grid',
  gap: '20px',
  color: 'light-dark(#202027, #eeeef2)',
  font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
})
const surfaceCss = css({
  padding: '24px',
  border: '1px solid light-dark(#e0e0e6, #393940)',
  borderRadius: '12px',
  background: 'light-dark(#fff, #1b1b20)',
})
const mutedCss = css({ color: 'light-dark(#62626c, #b0b0bb)', margin: 0, fontSize: '12px' })

const toolbarCss = css({
  display: 'flex',
  gap: '4px',
  padding: '4px',
  borderRadius: '9px',
  background: 'light-dark(#ececf0, #25252b)',
  border: '1px solid light-dark(#e0e0e6, #393940)',
  '& label': { position: 'relative', cursor: 'pointer' },
  '& input': {
    position: 'absolute',
    opacity: 0,
    width: '100%',
    height: '100%',
    inset: 0,
    margin: 0,
    cursor: 'pointer',
  },
  '& span': {
    display: 'block',
    padding: '6px 12px',
    borderRadius: '5px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'light-dark(#62626c, #b0b0bb)',
    transition: 'background-color 160ms ease, color 160ms ease',
  },
  '& input:checked + span': {
    background: 'light-dark(#fff, #393940)',
    color: 'light-dark(#202027, #eeeef2)',
    boxShadow: '0 1px 3px #00000018',
  },
  '& input:focus-visible + span': { outline: '2px solid #5bb8ef', outlineOffset: '2px' },
  '@media (prefers-reduced-motion: reduce)': { '& span': { transition: 'none' } },
})
