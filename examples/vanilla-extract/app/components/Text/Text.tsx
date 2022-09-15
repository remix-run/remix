/**
 * Note that styles are imported from "~/styles" rather than
 * "./Text.css.ts". This is because we need to import the
 * compiled output from the vanilla-extract build step,
 * otherwise our `.css.ts` files would go through the Remix
 * compiler and wouldn't generate any static CSS.
 */
import { componentStyles } from "~/styles";
import type { ReactNode } from "react";
import { Box } from "../Box/Box";

// Select the styles that we scoped to this component
const styles = componentStyles.Text;

export function Text({
  children,
  size,
}: {
  children: ReactNode;
  size: keyof typeof styles.size;
}) {
  return (
    <Box
      className={[styles.root, styles.size[size]]}
      color={{
        lightMode: "darkGray",
        darkMode: "lightBlue",
      }}
    >
      {children}
    </Box>
  );
}
