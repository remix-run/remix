import { css } from 'remix/component'
import { Option, Select } from '@remix-run/ui/select'
import { theme } from '@remix-run/ui/theme'
let selectExampleCss = css({
  width: '16rem',
})

export default function Example() {
  return () => (
    <div mix={stackCss}>
      <label for="environment" mix={labelCss}>
        Choose a fruit
      </label>
      <Select
        id="environment"
        defaultLabel="Banana"
        defaultValue="banana"
        name="environment"
        mix={selectExampleCss}
      >
        <Option label="Apple" value="apple" />
        <Option label="Apricot" value="apricot" />
        <Option label="Banana" value="banana" />
        <Option label="Blackberry" value="blackberry" />
        <Option label="Blackcurrant" value="blackcurrant" />
        <Option label="Blueberry" value="blueberry" />
        <Option label="Boysenberry" value="boysenberry" />
        <Option label="Cantaloupe" value="cantaloupe" />
      </Select>
    </div>
  )
}

let stackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  width: '100%',
})

let labelCss = css({
  margin: 0,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})
