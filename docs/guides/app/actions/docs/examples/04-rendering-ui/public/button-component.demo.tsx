import { css } from "remix/ui";
import button from "remix/ui/button";

/**
 * @name Button-like Hosts
 * @description The button mixin styles native buttons and button-like hosts without owning the markup.
 * @layout center
 */
export function ButtonComponent() {
  return () => (
    <div mix={buttonHostDemoCss}>
      <button mix={button({ tone: "primary" })}>Create project</button>
      <button mix={[dangerButtonCss, button({ tone: "ghost" })]}>Delete draft</button>
      <a href="#button-host" mix={button()}>
        View docs
      </a>
      <span aria-disabled="true" role="button" tabIndex={-1} mix={button()}>
        Disabled host
      </span>
    </div>
  );
}

const buttonHostDemoCss = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "10px",
});

const dangerButtonCss = css({
  color: "#C52600",
  '&:hover:not(:disabled):not([aria-disabled="true"])': {
    color: "#A82000",
  },
});
