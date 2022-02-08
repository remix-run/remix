import * as React from "react";
import cx from "clsx";

const COMP_CLASS = "ui--flex";

const Flex = React.forwardRef<HTMLDivElement, FlexProps>(
  (
    {
      children,
      className,
      inline,
      direction,
      wrap,
      flex,
      alignItems,
      alignContent,
      justifyItems,
      justifyContent,
      placeContent,
      placeItems,
      ...props
    },
    forwardedRef
  ) => {
    return (
      <div
        ref={forwardedRef}
        className={cx(className, COMP_CLASS, {
          [`${COMP_CLASS}--inline`]: inline,
          [`${COMP_CLASS}--dir-${direction}`]: direction,
          [`${COMP_CLASS}--${
            wrap === true
              ? "wrap"
              : wrap === false || wrap === "nowrap"
              ? "nowrap"
              : wrap === "reverse"
              ? "wrap-reverse"
              : wrap
          }`]: wrap != null,
          [`${COMP_CLASS}--align-items-${alignItems}`]: alignItems != null,
          [`${COMP_CLASS}--align-content-${alignContent}`]:
            alignContent != null,
          [`${COMP_CLASS}--justify-items-${justifyItems}`]:
            justifyItems != null,
          [`${COMP_CLASS}--justify-content-${justifyContent}`]:
            justifyContent != null,
          [`${COMP_CLASS}--place-items-${placeItems}`]: placeItems != null,
          [`${COMP_CLASS}--place-content-${placeContent}`]: placeContent != null
        })}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Flex.displayName = "Flex";

const FlexItem = React.forwardRef<HTMLDivElement, FlexItemProps>(
  (
    { children, className, grow, shrink, justify, align, place, ...props },
    forwardedRef
  ) => {
    return (
      <div
        ref={forwardedRef}
        className={cx(className, `${COMP_CLASS}__item`, {
          [`${COMP_CLASS}__item--grow-${grow}`]: grow != null,
          [`${COMP_CLASS}__item--grow-${shrink}`]: shrink != null,
          [`${COMP_CLASS}__item--align-${align}`]: align != null,
          [`${COMP_CLASS}__item--justify-${justify}`]: justify != null,
          [`${COMP_CLASS}__item--place-${place}`]: place != null
        })}
        {...props}
      >
        {children}
      </div>
    );
  }
);
FlexItem.displayName = "FlexItem";

interface FlexOwnProps {
  inline?: boolean;
  direction?: "row" | "column" | "row-reverse" | "column-reverse";
  wrap?: boolean | null | "wrap" | "nowrap" | "reverse";
  flex?: 1 | "auto" | "initial" | "none";
  alignItems?: "start" | "end" | "center" | "stretch" | "baseline";
  alignContent?: "start" | "end" | "center" | "between" | "around" | "evenly";
  justifyItems?: "start" | "end" | "center" | "stretch";
  justifyContent?: "start" | "end" | "center" | "between" | "around" | "evenly";
  placeItems?: "start" | "end" | "center" | "stretch";
  placeContent?:
    | "start"
    | "end"
    | "center"
    | "between"
    | "around"
    | "evenly"
    | "stretch";
}

interface FlexItemOwnProps {
  grow?: 1 | 0;
  shrink?: 1 | 0;
  justify?: "auto" | "start" | "end" | "center" | "stretch";
  place?: "auto" | "start" | "end" | "center" | "stretch";
  align?: "auto" | "start" | "end" | "center" | "stretch" | "baseline";
}

interface FlexProps
  extends FlexOwnProps,
    Omit<React.ComponentPropsWithRef<"div">, keyof FlexOwnProps> {}

interface FlexItemProps
  extends FlexItemOwnProps,
    Omit<React.ComponentPropsWithRef<"div">, keyof FlexItemOwnProps> {}

export type { FlexProps, FlexItemProps };
export { Flex, FlexItem };
