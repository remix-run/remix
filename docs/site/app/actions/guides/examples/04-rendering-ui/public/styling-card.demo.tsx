import { css } from "remix/component";
import type { Handle } from "remix/component";

export function StylingCardDemo() {
  return () => (
    <ProductCard
      title="Noise-canceling headphones"
      price={199}
      description="Hover the card to let nested CSS selectors update the title and button."
    />
  );
}

type Product = { description: string; price: number; title: string };

function ProductCard(handle: Handle<Product>) {
  return () => (
    <article
      mix={css({
        display: "grid",
        gridTemplateColumns: "minmax(0, 10rem) minmax(0, 1fr)",
        maxWidth: "34rem",
        overflow: "hidden",
        border: "1px solid light-dark(#d6d6d6, #3f3f46)",
        borderRadius: "18px",
        background: "light-dark(white, #2a2a30)",
        color: "light-dark(#151515, #f4f4f5)",
        boxShadow: "0 12px 32px light-dark(rgb(15 17 21 / 0.08), rgb(0 0 0 / 0.4))",
        transition: "transform 180ms ease, box-shadow 180ms ease",
        // Hovering the card restyles the title and button inside its child components.
        "&:hover": {
          boxShadow: "0 18px 44px light-dark(rgb(15 17 21 / 0.14), rgb(0 0 0 / 0.6))",
          transform: "translateY(-3px)",
          "& .title": {
            color: "light-dark(#d83a5a, #ff6b88)",
          },
          "& button": {
            backgroundColor: "#b8324d",
          },
        },
        "@media (max-width: 560px)": {
          gridTemplateColumns: "1fr",
        },
      })}
    >
      <ProductImage />
      <ProductDetails {...handle.props} />
    </article>
  );
}

function ProductImage() {
  return () => (
    <div
      aria-hidden="true"
      mix={css({
        display: "grid",
        placeItems: "center",
        minHeight: "12rem",
        background:
          "linear-gradient(135deg, light-dark(#ffe5eb, #4a2733), light-dark(#f8fafc, #2a2a30))",
        color: "light-dark(#d83a5a, #ff6b88)",
      })}
    >
      <HeadphonesIcon />
    </div>
  );
}

function ProductDetails(handle: Handle<Product>) {
  return () => (
    <div
      mix={css({
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        padding: "1rem",
      })}
    >
      <h4
        class="title"
        mix={css({
          margin: 0,
          fontSize: "1.15rem",
          fontWeight: "800",
          letterSpacing: "-0.03em",
          transition: "color 180ms ease",
        })}
      >
        {handle.props.title}
      </h4>
      <p
        mix={css({
          margin: 0,
          color: "light-dark(#4f4f4f, #a1a1aa)",
          lineHeight: "1.6",
        })}
      >
        {handle.props.description}
      </p>
      <div
        mix={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          marginTop: "auto",
        })}
      >
        <span
          mix={css({
            fontSize: "1.5rem",
            fontWeight: "900",
            letterSpacing: "-0.06em",
          })}
        >
          ${handle.props.price}
        </span>
        <AddToCartButton />
      </div>
    </div>
  );
}

function AddToCartButton() {
  return () => (
    <button
      type="button"
      mix={css({
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
      })}
    >
      Add to cart
    </button>
  );
}

function HeadphonesIcon() {
  return () => (
    <svg viewBox="0 0 120 80" fill="none" width="112">
      <path
        d="M30 43c0-18 12-31 30-31s30 13 30 31"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="8"
      />
      <rect width="24" height="34" x="18" y="38" fill="currentColor" rx="12" />
      <rect width="24" height="34" x="78" y="38" fill="currentColor" rx="12" />
    </svg>
  );
}
