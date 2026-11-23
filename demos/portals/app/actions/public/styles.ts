import { css } from 'remix/component'

export const styles = {
  row: css({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  }),
  heading: css({ margin: 0, fontSize: 16, fontWeight: 600 }),
  panel: css({
    border: '1px dashed var(--border)',
    borderRadius: 10,
    padding: 20,
    '@media (max-width: 600px)': { padding: 14 },
  }),
  muted: css({ fontSize: 12, color: 'var(--muted)' }),
  timestamp: css({ fontVariantNumeric: 'tabular-nums' }),
  field: css({
    font: 'inherit',
    color: 'inherit',
    background: 'var(--surface)',
    border: '1px solid var(--control-border)',
    borderRadius: 6,
  }),
  button: css({
    font: 'inherit',
    color: 'inherit',
    background: 'var(--surface)',
    border: '1px solid var(--control-border)',
    borderRadius: 6,
    minHeight: 36,
    padding: '6px 10px',
    cursor: 'pointer',
    '&:hover': { background: 'var(--hover)' },
  }),
  label: css({ display: 'inline-flex', alignItems: 'center', gap: 6 }),
  checkbox: css({ width: 16, height: 16, accentColor: '#333' }),
  secondary: css({
    border: '1px solid var(--control-border)',
    borderRadius: 8,
    padding: '12px 18px',
    background: 'var(--secondary)',
    fontSize: 13,
  }),
}
