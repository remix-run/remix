import { css } from "remix/component";
import * as accordion from "@remix-run/ui/accordion";

/**
 * @name Accordion Primitives
 * @description Headless accordion behavior with minimal local styles.
 * @layout center
 */
export function AccordionPrimitives() {
  return () => (
    <accordion.Context defaultValue="shipping">
      <div
        mix={[
          accordion.root(),
          css({
            width: "24rem",
            maxWidth: "100%",
            border: "1px solid light-dark(#d6d6d6, #3f3f46)",
            borderRadius: "8px",
            background: "light-dark(white, #2a2a30)",
            color: "light-dark(#151515, #f4f4f5)",
          }),
        ]}
      >
        {items.map((item) => (
          <accordion.ItemContext key={item.value} value={item.value} disabled={item.disabled}>
            <div
              mix={[
                accordion.item(),
                css({
                  "& + &": {
                    borderTop: "1px solid light-dark(#e8e8e8, #3f3f46)",
                  },
                  "&[data-disabled]": {
                    opacity: 0.45,
                  },
                }),
              ]}
            >
              <h3 mix={css({ margin: 0, fontSize: "inherit" })}>
                <button
                  type="button"
                  mix={[
                    accordion.trigger(),
                    css({
                      display: "flex",
                      justifyContent: "space-between",
                      width: "100%",
                      padding: "0.75rem 1rem",
                      border: 0,
                      background: "none",
                      color: "inherit",
                      font: "inherit",
                      fontWeight: 600,
                      "&::after": {
                        content: '"+"',
                      },
                      '&[data-state="open"]::after': {
                        content: '"−"',
                      },
                    }),
                  ]}
                >
                  {item.label}
                </button>
              </h3>
              <div
                mix={[
                  accordion.content(),
                  css({
                    padding: "0 1rem 0.75rem",
                    color: "light-dark(#4f4f4f, #a1a1aa)",
                    '&[data-state="closed"]': {
                      display: "none",
                    },
                  }),
                ]}
              >
                {item.details}
              </div>
            </div>
          </accordion.ItemContext>
        ))}
      </div>
    </accordion.Context>
  );
}

const items = [
  {
    value: "shipping",
    label: "Shipping",
    details: "Default carrier, cutoff time, and delivery windows.",
  },
  {
    value: "billing",
    label: "Billing",
    details: "Invoice cadence, billing contact, and tax settings.",
  },
  {
    value: "archived",
    label: "Archived",
    details: "Unavailable settings.",
    disabled: true,
  },
];
