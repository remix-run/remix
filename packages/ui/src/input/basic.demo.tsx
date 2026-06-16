import { css } from '@remix-run/ui'
import input from '@remix-run/ui/input'
import { SearchIcon } from './icons.tsx'

/**
 * @name Input Basic
 * @description The input mixin styles standalone inputs and icon-capable input roots.
 * @layout center
 */
export default function Example() {
  return () => (
    <div mix={inputDemoCss}>
      <label mix={fieldCss}>
        <span mix={labelCss}>Standalone</span>
        <input mix={input()} placeholder="Placeholder" />
      </label>

      <div mix={fieldCss}>
        <span mix={labelCss}>With icon</span>
        <div mix={input.root()}>
          <SearchIcon />
          <input aria-label="With icon" mix={input.field()} placeholder="Placeholder" />
        </div>
      </div>

      <div mix={fieldCss}>
        <span mix={labelCss}>Filled</span>
        <div mix={input.root()}>
          <input aria-label="Filled" defaultValue="Value" mix={input.field()} />
        </div>
      </div>

      <label mix={fieldCss}>
        <span mix={labelCss}>Disabled</span>
        <input disabled mix={input()} placeholder="Placeholder" />
      </label>
    </div>
  )
}

const inputDemoCss = css({
  display: 'grid',
  gap: '20px',
  width: 'min(100%, 40rem)',
})

const fieldCss = css({
  display: 'grid',
  gap: '8px',
})

const labelCss = css({
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: '14px',
  lineHeight: '18px',
  fontWeight: 600,
  color: '#101010',
})
