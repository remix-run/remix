import { css, on, type Handle } from "remix/component";
import * as popover from "@remix-run/ui/popover";

/**
 * @name Popover
 * @description Anchored popover behavior with focus restoration and outside-click dismissal.
 * @layout center
 */
export function PopoverBasic(handle: Handle) {
  let open = false;

  function setOpen(nextOpen: boolean) {
    open = nextOpen;
    void handle.update();
  }

  return () => (
    <popover.Context>
      <div mix={demoCss}>
        <button
          mix={[
            buttonCss,
            popover.anchor({ placement: "bottom-start", offset: 8 }),
            popover.focusOnHide(),
            on("click", () => {
              setOpen(!open);
            }),
          ]}
        >
          View options
        </button>

        <div
          mix={[
            surfaceCss,
            popover.surface({
              open,
              onHide() {
                setOpen(false);
              },
            }),
          ]}
        >
          <button
            mix={[
              ghostButtonCss,
              popover.focusOnShow(),
              on("click", () => {
                setOpen(false);
              }),
            ]}
          >
            Close
          </button>
          <div mix={surfaceBodyCss}>Popover content stays app-owned.</div>
        </div>
      </div>
    </popover.Context>
  );
}

const demoCss = css({
  display: "grid",
  placeItems: "center",
  minHeight: "10rem",
  width: "min(100%, 24rem)",
});

const buttonCss = css({
  minHeight: "30px",
  paddingInline: "12px",
  border: "1px solid #d1d1d1",
  borderRadius: "999px",
  background: "#fff",
  color: "#101010",
});

const ghostButtonCss = css({
  padding: "4px 8px",
  border: 0,
  borderRadius: "6px",
  background: "transparent",
  color: "#101010",
});

const surfaceCss = css({
  boxSizing: "border-box",
  width: "14rem",
  margin: 0,
  border: "1px solid rgba(0, 0, 0, 0.12)",
  borderRadius: "8px",
  background: "#FFFFFF",
  boxShadow: "0 16px 40px rgba(0, 0, 0, 0.14)",
  color: "#101010",
  padding: "8px",
  "&:popover-open": {
    display: "grid",
    gap: "8px",
  },
});

const surfaceBodyCss = css({
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: "13px",
  lineHeight: "18px",
  fontWeight: 500,
  letterSpacing: 0,
  color: "#4f4f4f",
  padding: "2px 4px 4px",
});
