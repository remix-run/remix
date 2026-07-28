import { css } from "remix/ui";
import button from "remix/ui/button";

/**
 * @name Button Basic
 * @description The button mixin applies neutral, primary, or ghost pill styling to button-like hosts.
 * @layout center
 */
export function ButtonBasic() {
  return () => (
    <div mix={buttonDemoCss}>
      <section mix={toneSectionCss}>
        <h2 mix={toneLabelCss}>Neutral</h2>
        <div mix={buttonRowCss}>
          <button mix={button()}>Medium</button>
          <button mix={button({ size: "lg" })}>Large</button>
          <button aria-pressed="true" mix={button()}>
            Pressed
          </button>
          <button disabled mix={button()}>
            Disabled
          </button>
        </div>
      </section>

      <section mix={toneSectionCss}>
        <h2 mix={toneLabelCss}>Primary</h2>
        <div mix={buttonRowCss}>
          <button mix={button({ tone: "primary" })}>Medium</button>
          <button mix={button({ size: "lg", tone: "primary" })}>Large</button>
          <button aria-pressed="true" mix={button({ tone: "primary" })}>
            Pressed
          </button>
          <button disabled mix={button({ tone: "primary" })}>
            Disabled
          </button>
        </div>
      </section>

      <section mix={toneSectionCss}>
        <h2 mix={toneLabelCss}>Ghost</h2>
        <div mix={buttonRowCss}>
          <button mix={button({ tone: "ghost" })}>Medium</button>
          <button mix={button({ size: "lg", tone: "ghost" })}>Large</button>
          <button aria-pressed="true" mix={button({ tone: "ghost" })}>
            Pressed
          </button>
          <button disabled mix={button({ tone: "ghost" })}>
            Disabled
          </button>
        </div>
      </section>
    </div>
  );
}

const buttonDemoCss = css({
  display: "grid",
  gap: "22px",
  width: "min(100%, 34rem)",
});

const toneSectionCss = css({
  display: "grid",
  gap: "8px",
});

const toneLabelCss = css({
  margin: 0,
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: "11px",
  lineHeight: "14px",
  fontWeight: 600,
  letterSpacing: 0,
  color: "rgba(16, 16, 16, 0.58)",
});

const buttonRowCss = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "10px",
});
