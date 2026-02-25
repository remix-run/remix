import { css } from '@remix-run/dom/css'

export let panel = css({
  backgroundColor: 'white',
  padding: 24,
  borderRadius: 12,
  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  position: 'relative',
})

export let replayButton = css({
  position: 'absolute',
  bottom: 8,
  right: 8,
  width: 18,
  height: 18,
  border: 'none',
  padding: 0,
  background: 'transparent',
  cursor: 'pointer',
  opacity: 0.45,
  ':hover': { opacity: 1 },
})

export let tileBody = css({
  minHeight: 230,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})

export let page = css({
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  backgroundColor: '#f8fafc',
  minHeight: '100vh',
  color: '#0f172a',
})

export let container = css({
  maxWidth: 1180,
  margin: '0 auto',
  padding: '28px 20px 60px',
})

export let grid = css({
  display: 'grid',
  gap: 24,
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
})
