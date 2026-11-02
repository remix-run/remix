import { animateLayout, prefersReducedMotion, spring } from '@remix-run/ui/animation'
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleLayout(handle: Handle) {
  let sort: 'due' | 'priority' = 'due'
  return () => (
    <div mix={styles.root}>
      <div mix={styles.header}>
        <div>
          <strong>Upcoming tasks</strong>
          <p mix={styles.muted}>3 tasks remaining</p>
        </div>
        <div role="radiogroup" aria-label="Sort tasks" mix={styles.toolbar}>
          {sortOptions.map((option) => (
            <label key={option.value}>
              <input
                type="radio"
                name={`${handle.id}-task-sort`}
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
      <ol mix={styles.list}>
        {[...tasks]
          .sort((a, b) => a[sort] - b[sort])
          .map((task) => (
            <li
              key={task.id}
              mix={[
                animateLayout(prefersReducedMotion() ? false : spring('snappy')),
                styles.surface,
              ]}
            >
              <div mix={styles.taskTitle}>
                <strong>{task.title}</strong>
                <p mix={styles.muted}>{task.date}</p>
              </div>
              <span data-high={task.priority === 0} mix={styles.priority}>
                {task.priority === 0 ? 'High' : task.priority === 1 ? 'Medium' : 'Low'}
              </span>
            </li>
          ))}
      </ol>
    </div>
  )
}

const styles = {
  root: css({
    '--text': 'light-dark(#202027, #eeeef2)',
    '--muted': 'light-dark(#62626c, #b0b0bb)',
    '--border': 'light-dark(#e0e0e6, #393940)',

    colorScheme: 'light dark',
    '&, & *, &::before, &::after, & *::before, & *::after': {
      boxSizing: 'border-box',
    },
    width: '28rem',
    maxWidth: '100%',
    display: 'grid',
    gap: '20px',
    color: 'var(--text)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  }),

  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
  }),

  muted: css({
    color: 'var(--muted)',
    margin: 0,
    fontSize: '12px',
  }),

  toolbar: css({
    display: 'flex',
    gap: '4px',
    padding: '4px',
    borderRadius: '9px',
    background: 'light-dark(#ececf0, #25252b)',
    border: '1px solid var(--border)',
    '& label': {
      position: 'relative',
      cursor: 'pointer',
    },
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
      color: 'var(--muted)',
      transition: 'background-color 160ms ease, color 160ms ease',
    },
    '& input:checked + span': {
      background: 'light-dark(#fff, #393940)',
      color: 'var(--text)',
      boxShadow: '0 1px 3px #00000018',
    },
    '& input:focus-visible + span': {
      outline: '2px solid light-dark(#70707c, #a0a0ac)',
      outlineOffset: '2px',
    },
    '@media (prefers-reduced-motion: reduce)': {
      '& span': {
        transition: 'none',
      },
    },
  }),

  list: css({
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'grid',
    gap: '8px',
  }),

  surface: css({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    background: 'light-dark(#fff, #1b1b20)',
  }),

  taskTitle: css({
    flex: 1,
    minWidth: 0,
  }),

  priority: css({
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '5px',
    background: 'light-dark(#f0f0f5, #292930)',
    color: 'var(--muted)',
    '&[data-high="true"]': {
      background: 'light-dark(#e4e4eb, #3b3b44)',
      color: 'light-dark(#50505b, #c3c3cd)',
    },
  }),
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
