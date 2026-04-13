import { css } from 'remix/component'
import { Option, Select, ui } from 'remix/ui'

let selectExampleCss = css({
  width: '16rem',
})

export default function Example() {
  return () => (
      <div mix={[ui.stack, ui.gap.sm]}>
        <label for="environment">Choose a fruit</label>
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
          <Option label="Cherry" value="cherry" />
          <Option label="Clementine" value="clementine" />
          <Option label="Coconut" value="coconut" />
          <Option label="Cranberry" value="cranberry" />
          <Option label="Currant" value="currant" />
          <Option label="Date" value="date" />
          <Option label="Dragonfruit" value="dragonfruit" />
          <Option label="Elderberry" value="elderberry" />
          <Option label="Fig" value="fig" />
          <Option label="Goji Berry" value="goji-berry" />
          <Option label="Gooseberry" value="gooseberry" />
          <Option label="Grape" value="grape" />
          <Option label="Grapefruit" value="grapefruit" />
          <Option label="Guava" value="guava" />
          <Option label="Honeydew" value="honeydew" />
          <Option label="Huckleberry" value="huckleberry" />
          <Option label="Jackfruit" value="jackfruit" />
          <Option label="Kiwi" value="kiwi" />
          <Option label="Kumquat" value="kumquat" />
          <Option label="Lemon" value="lemon" />
          <Option label="Lime" value="lime" />
          <Option label="Lychee" value="lychee" />
          <Option label="Mandarin" value="mandarin" />
          <Option label="Mango" value="mango" />
          <Option label="Mulberry" value="mulberry" />
          <Option label="Nectarine" value="nectarine" />
          <Option label="Orange" value="orange" />
          <Option label="Papaya" value="papaya" />
          <Option label="Passionfruit" value="passionfruit" />
          <Option label="Peach" value="peach" />
          <Option label="Pear" value="pear" />
          <Option label="Persimmon" value="persimmon" />
          <Option label="Pineapple" value="pineapple" />
          <Option label="Plum" value="plum" />
          <Option label="Pomegranate" value="pomegranate" />
          <Option label="Pomelo" value="pomelo" />
          <Option label="Quince" value="quince" />
          <Option label="Raspberry" value="raspberry" />
          <Option label="Redcurrant" value="redcurrant" />
          <Option label="Starfruit" value="starfruit" />
          <Option label="Strawberry" value="strawberry" />
          <Option label="Tangerine" value="tangerine" />
          <Option label="Ugli Fruit" value="ugli-fruit" />
          <Option label="Watermelon" value="watermelon" />
          <Option label="White Currant" value="white-currant" />
          <Option label="Yuzu" value="yuzu" />
        </Select>
      </div>
  )
}
