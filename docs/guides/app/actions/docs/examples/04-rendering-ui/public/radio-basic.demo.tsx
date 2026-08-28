import { css } from "remix/ui";
import radio from "remix/ui/radio";

/**
 * @name Radio Basic
 * @description The radio mixin applies small or large radio styling to native inputs.
 * @layout center
 */
export function RadioBasic() {
  return () => (
    <fieldset mix={radioDemoCss}>
      <legend mix={legendCss}>Shipping speed</legend>
      <label mix={optionCss}>
        <input defaultChecked mix={radio()} name="shipping-speed" value="standard" />
        Standard
      </label>
      <label mix={optionCss}>
        <input mix={radio()} name="shipping-speed" value="express" />
        Express
      </label>
      <label mix={optionCss}>
        <input mix={radio({ size: "lg" })} name="shipping-speed" value="overnight" />
        Overnight
      </label>
      <label mix={optionCss}>
        <input disabled mix={radio()} name="shipping-speed" value="courier" />
        Courier
      </label>
    </fieldset>
  );
}

const radioDemoCss = css({
  display: "grid",
  gap: "10px",
  width: "min(100%, 20rem)",
  margin: 0,
  padding: 0,
  border: 0,
});

const legendCss = css({
  padding: 0,
  marginBlockEnd: "4px",
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: "13px",
  lineHeight: "18px",
  fontWeight: 650,
  letterSpacing: 0,
  color: "#101010",
});

const optionCss = css({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minHeight: "28px",
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: "13px",
  lineHeight: "18px",
  fontWeight: 500,
  letterSpacing: 0,
  color: "#101010",
});
