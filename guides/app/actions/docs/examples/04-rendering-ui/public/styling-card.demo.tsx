import { css } from "remix/ui";
import type { Handle } from "remix/ui";

export function StylingCardDemo() {
  return () => (
    <ProductCard
      title="Noise-canceling headphones"
      price={199}
      description="Hover the card to let nested CSS selectors update the title and button."
    />
  );
}

function ProductCard(
  handle: Handle<{ description: string; price: number; title: string }>,
) {
  return () => (
    <article mix={productCardStyles}>
      <div mix={productImageStyles} aria-hidden="true">
        <svg viewBox="0 0 120 80" fill="none">
          <path
            d="M30 43c0-18 12-31 30-31s30 13 30 31"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-width="8"
          />
          <rect
            width="24"
            height="34"
            x="18"
            y="38"
            fill="currentColor"
            rx="12"
          />
          <rect
            width="24"
            height="34"
            x="78"
            y="38"
            fill="currentColor"
            rx="12"
          />
        </svg>
      </div>
      <div mix={productBodyStyles}>
        <h4 class="title" mix={productTitleStyles}>
          {handle.props.title}
        </h4>
        <p mix={productDescriptionStyles}>{handle.props.description}</p>
        <div mix={productFooterStyles}>
          <span mix={productPriceStyles}>${handle.props.price}</span>
          <button mix={productButtonStyles} type="button">
            Add to cart
          </button>
        </div>
      </div>
    </article>
  );
}

const productCardStyles = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 10rem) minmax(0, 1fr)",
  maxWidth: "34rem",
  overflow: "hidden",
  border: "1px solid #d6d6d6",
  borderRadius: "18px",
  background: "white",
  boxShadow: "0 12px 32px rgba(15, 17, 21, 0.08)",
  transition: "transform 180ms ease, box-shadow 180ms ease",
  "&:hover": {
    boxShadow: "0 18px 44px rgba(15, 17, 21, 0.14)",
    transform: "translateY(-3px)",
    "& .title": {
      color: "#d83a5a",
    },
    "& button": {
      backgroundColor: "#b8324d",
    },
  },
  "@media (max-width: 560px)": {
    gridTemplateColumns: "1fr",
  },
});

const productImageStyles = css({
  display: "grid",
  placeItems: "center",
  minHeight: "12rem",
  background: "linear-gradient(135deg, #ffe5eb, #f8fafc)",
  color: "#d83a5a",
  "& svg": {
    width: "7rem",
    height: "auto",
  },
});

const productBodyStyles = css({
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  padding: "1rem",
});

const productTitleStyles = css({
  margin: 0,
  fontSize: "1.15rem",
  fontWeight: "800",
  letterSpacing: "-0.03em",
  transition: "color 180ms ease",
});

const productDescriptionStyles = css({
  margin: 0,
  color: "#4f4f4f",
  lineHeight: "1.6",
});

const productFooterStyles = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  marginTop: "auto",
});

const productPriceStyles = css({
  fontSize: "1.5rem",
  fontWeight: "900",
  letterSpacing: "-0.06em",
});

const productButtonStyles = css({
  border: "1px solid #d83a5a",
  borderRadius: "999px",
  background: "#d83a5a",
  color: "white",
  cursor: "pointer",
  font: "inherit",
  fontWeight: "700",
  padding: "0.7rem 1rem",
  transition: "background-color 180ms ease, transform 120ms ease",
  "&:active": {
    transform: "scale(0.98)",
  },
});
