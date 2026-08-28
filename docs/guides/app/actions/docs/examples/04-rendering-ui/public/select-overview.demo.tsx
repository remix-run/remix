import { css } from "remix/ui";
import { Option, Select } from "remix/ui/select";

/**
 * @name Select Overview
 * @description A styled select control with a searchable dropdown and accessible label.
 * @layout center
 */
export function SelectOverview() {
  return () => (
    <div mix={stackCss}>
      <label for="fruit-select" mix={labelCss}>
        Choose a fruit
      </label>
      <Select
        id="fruit-select"
        defaultLabel="Banana"
        defaultValue="banana"
        name="fruit"
        mix={selectCss}
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
  );
}

const selectCss = css({
  width: "16rem",
});

const stackCss = css({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  width: "100%",
});

const labelCss = css({
  margin: 0,
  fontSize: "12px",
  fontWeight: "600",
  color: "#151515",
});
