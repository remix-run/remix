/**
 * This file is used to convert our custom `sprinkles` function
 * into a primitive `Box` component so that we don't need to
 * manually manage the `className` prop when using our own
 * utility classes, e.g. `<Box padding="small">` rather than
 * `<Box className={sprinkles({ padding: 'small' })}>`.
 */
import type { AllHTMLAttributes, ElementType } from "react";
import { createElement } from "react";
import { forwardRef } from "react";
import type { ClassValue } from "clsx";
import clsx from "clsx";
import type { Sprinkles } from "~/styles";
import { sprinkles } from "~/styles";

interface ExtendedBoxProps extends Sprinkles {
  as?: ElementType;
  className?: ClassValue;
}

type BoxProps = Omit<AllHTMLAttributes<HTMLElement>, keyof ExtendedBoxProps> &
  ExtendedBoxProps;

export const Box = forwardRef<HTMLElement, BoxProps>(
  ({ as = "div", className, ...props }, ref) => {
    const atomProps: Record<string, unknown> = {};
    const nativeProps: Record<string, unknown> = {};

    for (const key in props) {
      // Sprinkles allows us to detect whether a given property
      // is available as part of our suite of utility classes,
      // e.g. `sprinkles.properties.has('padding')` is true
      // while `sprinkles.properties.has('onClick')` is false.
      // We use this to determine whether to pass the property
      // to Sprinkles or to the native HTML element.
      if (sprinkles.properties.has(key as keyof Sprinkles)) {
        atomProps[key] = props[key as keyof typeof props];
      } else {
        nativeProps[key] = props[key as keyof typeof props];
      }
    }

    const atomicClasses = sprinkles(atomProps);
    const customClasses = clsx(className);

    return createElement(as, {
      className: `${atomicClasses}${customClasses ? ` ${customClasses}` : ""}`,
      ...nativeProps,
      ref,
    });
  }
);

Box.displayName = "Box";
